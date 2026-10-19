import React, { useEffect, useState, useRef } from 'react';
import { chatService } from '../services/chatService';
import { chatWs } from '../services/chatWebSocket';
import { ChatSession, ChatMessage, Contact360, ChatStats, ChatQuickReply } from '../types/chat';
import { useAuthStore } from '../../../store/authStore';
import { useTenantTheme } from '../../../lib/theme';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { formatCurrency } from '../../../lib/utils';
import {
  MessageSquare,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  Bot,
  User,
  Headphones,
  Send,
  Image as ImageIcon,
  ExternalLink,
  Sparkles,
  Zap,
  Building2,
  Calendar,
  Wallet,
  ShieldCheck,
  Check,
  RotateCw,
  Trash2,
  Lock,
  Wrench,
} from 'lucide-react';

// ============================================================================
// FEATURE LOCK FLAG (Under Maintenance by Developer)
// Sesuai instruksi: fitur ini di-lock / ditutup sementara tanpa menghapus kode.
// Set ke `false` untuk membuka kembali fitur secara penuh kapan saja.
// ============================================================================
export const IS_LIVE_CHAT_LOCKED = true;

export const AdminLiveChatPage: React.FC = () => {
  const { user } = useAuthStore();
  const { tenant } = useTenantTheme();

  // State Sessions & Active
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [counters, setCounters] = useState({
    all: 0,
    waiting_agent: 0,
    active_agent: 0,
    bot: 0,
    closed: 0,
  });
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [contact360, setContact360] = useState<Contact360 | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quickReplies, setQuickReplies] = useState<ChatQuickReply[]>([]);
  const [stats, setStats] = useState<ChatStats | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<string>('waiting_agent');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Inputs
  const [replyText, setReplyText] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollListIntervalRef = useRef<any>(null);
  const pollChatIntervalRef = useRef<any>(null);

  // 1. WebSocket Omnichannel connection & subscriptions
  useEffect(() => {
    chatWs.connect();
    const unsubStatus = chatWs.onStatusChange((st) => setWsStatus(st));

    chatWs.subscribe('admin_omnichannel');

    const unsubUpdated = chatWs.on('admin_omnichannel:session_updated', (updated: any) => {
      fetchSessions(true);
      fetchStats();
      if (selectedSessionId && updated?.id === selectedSessionId) {
        setSelectedSession(updated);
      }
    });

    const unsubWaiting = chatWs.on('admin_omnichannel:session_waiting', () => {
      fetchSessions(true);
      fetchStats();
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (e) {}
    });

    return () => {
      unsubStatus();
      unsubUpdated();
      unsubWaiting();
      chatWs.unsubscribe('admin_omnichannel');
    };
  }, [selectedSessionId]);

  // 2. Real-time messages for active session via WebSocket
  useEffect(() => {
    if (!selectedSessionId) return;

    const channel = `session_${selectedSessionId}`;
    chatWs.subscribe(channel);

    const unsubNewMsg = chatWs.on(`${channel}:new_message`, (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    });

    const unsubClaimed = chatWs.on(`${channel}:agent_claimed`, (session: ChatSession) => {
      setSelectedSession(session);
      fetchSessions(true);
    });

    const unsubClosed = chatWs.on(`${channel}:session_closed`, () => {
      loadSessionDetail(selectedSessionId);
      fetchSessions(true);
    });

    return () => {
      unsubNewMsg();
      unsubClaimed();
      unsubClosed();
      chatWs.unsubscribe(channel);
    };
  }, [selectedSessionId]);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchQuickReplies();
  }, []);

  // Fetch session list when tab/filter changes
  useEffect(() => {
    fetchSessions();

    if (IS_LIVE_CHAT_LOCKED) {
      if (pollListIntervalRef.current) clearInterval(pollListIntervalRef.current);
      return;
    }

    if (pollListIntervalRef.current) clearInterval(pollListIntervalRef.current);
    pollListIntervalRef.current = setInterval(() => {
      fetchSessions(true);
    }, 4500);

    return () => {
      if (pollListIntervalRef.current) clearInterval(pollListIntervalRef.current);
    };
  }, [activeTab, companyFilter, search]);

  // Load active session messages
  useEffect(() => {
    if (selectedSessionId) {
      loadSessionDetail(selectedSessionId);

      if (IS_LIVE_CHAT_LOCKED) {
        if (pollChatIntervalRef.current) clearInterval(pollChatIntervalRef.current);
        return;
      }

      if (pollChatIntervalRef.current) clearInterval(pollChatIntervalRef.current);
      pollChatIntervalRef.current = setInterval(() => {
        pollActiveChat(selectedSessionId);
      }, 2500);
    } else {
      setSelectedSession(null);
      setContact360(null);
      setMessages([]);
      if (pollChatIntervalRef.current) clearInterval(pollChatIntervalRef.current);
    }

    return () => {
      if (pollChatIntervalRef.current) clearInterval(pollChatIntervalRef.current);
    };
  }, [selectedSessionId]);

  // Scroll to bottom on messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchStats = async () => {
    try {
      const res = await chatService.getAdminStats();
      setStats(res);
    } catch (err) {
      console.error('Failed to load chat stats', err);
    }
  };

  const fetchQuickReplies = async () => {
    try {
      const res = await chatService.getQuickReplies();
      setQuickReplies(res.templates || []);
    } catch (err) {
      console.error('Failed to load quick replies', err);
    }
  };

  const fetchSessions = async (isBackground = false) => {
    if (!isBackground) setIsLoadingList(true);
    try {
      const res = await chatService.getAdminSessions({
        status: activeTab,
        company: companyFilter !== 'all' ? companyFilter : undefined,
        search: search.trim() || undefined,
      });

      setSessions(res.data || []);
      setCounters(res.counters);

      // Auto-select first item if none selected and not on mobile
      if (!selectedSessionId && res.data.length > 0 && !isBackground) {
        setSelectedSessionId(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load sessions', err);
    } finally {
      if (!isBackground) setIsLoadingList(false);
    }
  };

  const loadSessionDetail = async (id: number) => {
    setIsLoadingChat(true);
    try {
      const res = await chatService.getAdminSessionDetail(id);
      setSelectedSession(res.session);
      setContact360(res.contact360 || null);
      setMessages(res.messages || []);
    } catch (err) {
      console.error('Failed to load session detail', err);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const pollActiveChat = async (id: number) => {
    try {
      const res = await chatService.getAdminSessionDetail(id);
      setMessages(res.messages || []);
      setSelectedSession(res.session);
    } catch (err) {
      // silent
    }
  };

  const handleClaim = async () => {
    if (!selectedSessionId) return;
    try {
      setIsSending(true);
      const res = await chatService.claimSession(selectedSessionId);
      setSelectedSession(res.session);
      setMessages((prev) => [...prev, res.message]);
      fetchSessions(true);
      fetchStats();
    } catch (err) {
      console.error('Failed to claim session', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedSessionId) return;
    if (!replyText.trim() && !selectedPhoto) return;

    try {
      setIsSending(true);
      const text = replyText.trim();
      const photo = selectedPhoto;
      setReplyText('');
      setSelectedPhoto(null);
      setPhotoPreview(null);

      const res = await chatService.replySession(selectedSessionId, {
        message: text || undefined,
        photo: photo || undefined,
      });

      setMessages((prev) => [...prev, res.message]);
      setSelectedSession(res.session);
      fetchSessions(true);
    } catch (err) {
      console.error('Failed to send reply', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseSession = async () => {
    if (!selectedSessionId) return;
    const reason = window.prompt('Masukkan catatan resolusi / alasan penutupan tiket (opsional):', 'Selesai ditangani');
    if (reason === null) return;

    try {
      setIsSending(true);
      const res = await chatService.closeAdminSession(selectedSessionId, reason);
      setSelectedSession(res.session);
      loadSessionDetail(selectedSessionId);
      fetchSessions(true);
      fetchStats();
    } catch (err) {
      console.error('Failed to close session', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!selectedSessionId) return;
    const ok = window.confirm('Apakah Anda yakin ingin menghapus sesi chat ini beserta seluruh pesan dan lampiran fotonya?');
    if (!ok) return;

    try {
      setIsSending(true);
      await chatService.deleteSession(selectedSessionId);
      setSelectedSessionId(null);
      setSelectedSession(null);
      setMessages([]);
      setContact360(null);
      fetchSessions(true);
      fetchStats();
    } catch (err) {
      console.error('Failed to delete session', err);
      alert('Gagal menghapus sesi chat.');
    } finally {
      setIsSending(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('File harus berupa foto/gambar.');
      return;
    }
    setSelectedPhoto(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      {/* ============================================================== */}
      {/* 1. TOP HEADER                                                  */}
      {/* ============================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-headline-page text-[22px] sm:text-[24px] font-bold text-text-primary tracking-tight flex items-center gap-2.5">
              <Headphones className="w-6 h-6 text-emerald-600" />
              <span>Omnichannel Live Chat CS & Bantuan AI</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Live Desk
            </span>

            {/* Realtime WebSocket Badge */}
            {wsStatus === 'connected' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                <Zap className="w-3 h-3 text-emerald-600 fill-emerald-600 animate-pulse" />
                <span>Realtime WebSocket Aktif</span>
              </span>
            ) : wsStatus === 'connecting' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
                <RotateCw className="w-3 h-3 text-amber-600 animate-spin" />
                <span>Menghubungkan WS...</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-surface-container text-text-muted border border-border-subtle flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Polling Fallback</span>
              </span>
            )}
          </div>
          <p className="font-body-default text-[13px] text-text-muted mt-1">
            Layanan percakapan langsung karyawan & pengguna, eskalasi bot AI, dan pembagian tiket agen CS aktif
          </p>
        </div>
      </div>

      {/* MAINTENANCE NOTICE BANNER */}
      {IS_LIVE_CHAT_LOCKED && (
        <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start sm:items-center justify-between gap-4 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold">
                  Fitur Live Chat Sedang Dikunci (Under Maintenance)
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500 text-white">
                  Maintenance
                </span>
              </div>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Widget chat pada sisi karyawan sedang dinonaktifkan sementara oleh developer untuk pemeliharaan & sinkronisasi data. Riwayat percakapan sebelumnya tetap dapat ditinjau dan dikelola di sini.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. THREE-COLUMN WORKSTATION LAYOUT                             */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[750px] min-h-[600px]">
        {/* ============================================================ */}
        {/* COLUMN 1: CONVERSATIONS LIST (3 Cols on Desktop)             */}
        {/* ============================================================ */}
        <div className="lg:col-span-4 xl:col-span-3.5 bg-surface-panel border border-border-subtle rounded-2xl shadow-xs flex flex-col overflow-hidden">
          {/* Company Filter & Search Header */}
          <div className="p-3 border-b border-border-subtle space-y-2 bg-surface-container/50">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-text-muted shrink-0" />
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="flex-1 bg-surface border border-border-subtle text-xs rounded-lg px-2.5 py-1.5 text-text-primary font-semibold outline-hidden"
              >
                <option value="all">Semua Perusahaan (Riama & Rimbun)</option>
                <option value="riama">Riama Mandiri Pratama</option>
                <option value="rimbun">Rimbun Buana Sejahtera</option>
              </select>
              <button
                type="button"
                onClick={() => fetchSessions()}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-container cursor-pointer transition-colors"
                title="Segarkan Daftar"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, NIK, atau no tiket..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-border-subtle text-xs text-text-primary outline-hidden focus:border-primary"
              />
            </div>
          </div>

          {/* Filter Status Tabs */}
          <div className="flex items-center px-2 py-1.5 border-b border-border-subtle bg-surface-container/30 overflow-x-auto scrollbar-none gap-1">
            {[
              {
                key: 'waiting_agent',
                label: 'Antrean CS',
                count: counters.waiting_agent,
                urgent: counters.waiting_agent > 0,
              },
              { key: 'active_agent', label: 'Aktif Agen', count: counters.active_agent },
              { key: 'bot', label: 'Bot AI', count: counters.bot },
              { key: 'closed', label: 'Selesai', count: counters.closed },
              { key: 'all', label: 'Semua', count: counters.all },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === tab.key
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-text-secondary hover:bg-surface-container'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                    activeTab === tab.key
                      ? 'bg-white/20 text-white'
                      : tab.urgent
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-surface-container text-text-muted'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border-subtle">
            {isLoadingList ? (
              <div className="p-4 space-y-3">
                <div className="h-14 bg-surface-container rounded-xl animate-pulse" />
                <div className="h-14 bg-surface-container rounded-xl animate-pulse" />
                <div className="h-14 bg-surface-container rounded-xl animate-pulse" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-xs space-y-1">
                <MessageSquare className="w-8 h-8 mx-auto opacity-30 mb-2" />
                <p className="font-semibold text-text-primary">Tidak Ada Percakapan</p>
                <p>Tidak ada tiket pada status filter ini.</p>
              </div>
            ) : (
              sessions.map((item) => {
                const isSelected = item.id === selectedSessionId;
                const isWaiting = item.status === 'waiting_agent';
                const isActive = item.status === 'active_agent';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedSessionId(item.id)}
                    className={`p-3 transition-colors cursor-pointer relative ${
                      isSelected
                        ? 'bg-primary/10 border-l-4 border-l-primary'
                        : 'hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-xs text-text-primary truncate">
                          {item.user_name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-surface-container text-text-muted border border-border-subtle uppercase">
                          {item.company_name}
                        </span>
                      </div>
                      <span className="text-[10px] text-text-muted whitespace-nowrap shrink-0">
                        {item.last_message_at
                          ? new Date(item.last_message_at).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>

                    <p className="text-[11.5px] text-text-muted line-clamp-1 mb-2">
                      {item.last_message_text || 'Mulai percakapan baru...'}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {isWaiting ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 animate-pulse">
                            <Clock className="w-2.5 h-2.5" /> Menunggu CS
                          </span>
                        ) : isActive ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <Headphones className="w-2.5 h-2.5" /> {item.assigned_agent?.name || 'Agen'}
                          </span>
                        ) : item.status === 'bot' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
                            <Bot className="w-2.5 h-2.5" /> Bot AI
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            Selesai
                          </span>
                        )}
                      </div>

                      {item.unread_agent_count > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-600 text-white shadow-2xs">
                          {item.unread_agent_count} baru
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* COLUMN 2: ACTIVE CHAT THREAD (5 Cols on Desktop)             */}
        {/* ============================================================ */}
        <div className="lg:col-span-5 xl:col-span-5.5 bg-surface-panel border border-border-subtle rounded-2xl shadow-xs flex flex-col overflow-hidden">
          {selectedSession ? (
            <>
              {/* Active Chat Header */}
              <div className="p-3.5 border-b border-border-subtle bg-surface-container/40 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm shrink-0">
                    {selectedSession.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-[13.5px] text-text-primary truncate">
                        {selectedSession.user_name}
                      </h3>
                      <span className="font-mono text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded border border-border-subtle">
                        {selectedSession.session_code}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted truncate">
                      NIK: {selectedSession.user_nik || '-'} • Role: {selectedSession.role}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {selectedSession.status === 'waiting_agent' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleClaim}
                      disabled={isSending}
                      leftIcon={<Headphones className="w-3.5 h-3.5" />}
                    >
                      Ambil Alih (Claim)
                    </Button>
                  )}

                  {selectedSession.status !== 'closed' && (
                    <button
                      type="button"
                      onClick={handleCloseSession}
                      disabled={isSending}
                      className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-all cursor-pointer"
                      title="Selesaikan dan tutup tiket ini"
                    >
                      Tutup Sesi
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDeleteSession}
                    disabled={isSending}
                    className="p-1.5 rounded-lg border border-border-subtle text-text-muted hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                    title="Hapus sesi chat permanen (membersihkan database & lampiran)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Waiting Agent Alert Banner in Chat */}
              {selectedSession.status === 'waiting_agent' && (
                <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2 text-rose-800 text-xs font-medium">
                    <Clock className="w-4 h-4 animate-spin text-rose-600 shrink-0" />
                    <span>Karyawan ini sedang menunggu agen CS untuk mengambil alih percakapan.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClaim}
                    disabled={isSending}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
                  >
                    Respon Sekarang
                  </button>
                </div>
              )}

              {/* Messages Thread Container */}
              <div className="flex-1 p-4 space-y-3.5 overflow-y-auto bg-surface">
                {isLoadingChat ? (
                  <div className="space-y-3 p-4">
                    <div className="h-12 bg-surface-container rounded-2xl w-3/4 animate-pulse" />
                    <div className="h-12 bg-surface-container rounded-2xl w-2/3 ml-auto animate-pulse" />
                    <div className="h-16 bg-surface-container rounded-2xl w-4/5 animate-pulse" />
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isAgent = msg.sender_type === 'agent';
                    const isUser = msg.sender_type === 'user';
                    const isBot = msg.sender_type === 'bot';
                    const isSystem = msg.sender_type === 'system';

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center my-1.5">
                          <div className="max-w-[85%] px-3 py-1 rounded-full bg-surface-container border border-border-subtle text-[11px] text-text-muted text-center">
                            {msg.message}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 ${isAgent ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isAgent && (
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center shrink-0 text-xs">
                            {isBot ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                          </div>
                        )}

                        <div className="max-w-[80%] space-y-1">
                          <div
                            className={`p-3 rounded-2xl text-[12.5px] leading-relaxed shadow-2xs ${
                              isAgent
                                ? 'bg-primary text-white rounded-br-xs'
                                : isBot
                                ? 'bg-indigo-50/70 border border-indigo-200 text-indigo-950 rounded-bl-xs'
                                : 'bg-surface-panel border border-border-subtle text-text-primary rounded-bl-xs'
                            }`}
                          >
                            <div className="text-[10px] font-bold mb-1 opacity-80 flex items-center gap-1">
                              {isAgent ? (
                                <span>Anda ({msg.sender_name})</span>
                              ) : isBot ? (
                                <>
                                  <Sparkles className="w-3 h-3 text-indigo-600" />
                                  <span>AI Virtual Assistant</span>
                                </>
                              ) : (
                                <span>{msg.sender_name} (Karyawan)</span>
                              )}
                            </div>

                            <div className="whitespace-pre-line">{msg.message}</div>

                            {msg.attachment_url && (
                              <div className="mt-2 rounded-xl overflow-hidden border border-border-subtle">
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block relative group"
                                >
                                  <img
                                    src={msg.attachment_url}
                                    alt="Foto"
                                    className="w-full max-h-48 object-cover rounded-xl"
                                  />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-semibold gap-1">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Lihat Penuh</span>
                                  </div>
                                </a>
                              </div>
                            )}
                          </div>

                          <div
                            className={`text-[9.5px] text-text-muted px-1 ${
                              isAgent ? 'text-right' : 'text-left'
                            }`}
                          >
                            {new Date(msg.created_at).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Photo Preview Thumbnail */}
              {photoPreview && (
                <div className="px-3 py-2 bg-surface-container border-t border-border-subtle flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-10 h-10 object-cover rounded-lg border border-border-subtle"
                    />
                    <span className="text-xs text-text-secondary truncate max-w-[200px]">
                      {selectedPhoto?.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPhoto(null);
                      setPhotoPreview(null);
                    }}
                    className="p-1 rounded-full text-rose-500 hover:bg-rose-50 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Quick Replies Carousel Pills */}
              <div className="px-3 py-1.5 bg-surface-container/60 border-t border-border-subtle flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
                <span className="text-[10px] font-bold text-text-muted uppercase shrink-0">
                  Quick Reply:
                </span>
                {quickReplies.map((qr) => (
                  <button
                    key={qr.id}
                    type="button"
                    onClick={() => setReplyText(qr.text)}
                    className="px-2.5 py-1 rounded-lg text-[11px] bg-surface-panel hover:bg-primary/10 hover:text-primary border border-border-subtle text-text-secondary whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-2xs"
                    title={qr.text}
                  >
                    {qr.title}
                  </button>
                ))}
              </div>

              {/* CS Reply Input Bar */}
              <div className="p-3 bg-surface-panel border-t border-border-subtle shrink-0">
                {selectedSession.status === 'closed' ? (
                  <div className="text-center py-2 text-xs text-text-muted">
                    Sesi percakapan ini telah ditutup.
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendReply();
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-xl text-text-muted hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                      title="Lampirkan Dokumen/Foto"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>

                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Ketik balasan resmi CS ke karyawan..."
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-surface border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary text-[13px] text-text-primary outline-hidden"
                      disabled={isSending}
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={isSending || (!replyText.trim() && !selectedPhoto)}
                      leftIcon={<Send className="w-4 h-4" />}
                    >
                      Kirim
                    </Button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-muted space-y-2">
              <Headphones className="w-12 h-12 opacity-30" />
              <h3 className="text-base font-bold text-text-primary">Pilih Percakapan</h3>
              <p className="text-xs max-w-sm">
                Pilih sesi antrean di panel kiri untuk mulai membalas pesan secara real-time dan melihat data profil karyawan.
              </p>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* COLUMN 3: CONTACT 360 PROFILE (3.5 Cols on Desktop)          */}
        {/* ============================================================ */}
        <div className="lg:col-span-3 xl:col-span-3 bg-surface-panel border border-border-subtle rounded-2xl shadow-xs p-4 flex flex-col overflow-y-auto space-y-4">
          <div className="pb-3 border-b border-border-subtle flex items-center justify-between">
            <h3 className="font-bold text-[13.5px] text-text-primary flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Contact 360 Profil</span>
            </h3>
            <span className="text-[10px] text-text-muted font-mono">
              Live HR Insight
            </span>
          </div>

          {contact360 ? (
            <div className="space-y-4 text-xs">
              {/* User Identity Chip */}
              <div className="p-3 rounded-xl bg-surface-container/60 border border-border-subtle space-y-1">
                <div className="font-bold text-[14px] text-text-primary">
                  {contact360.name}
                </div>
                <div className="text-text-muted font-mono">
                  NIK: <strong className="text-text-primary">{contact360.nik}</strong>
                </div>
                <div className="text-text-muted">
                  Email: {contact360.email}
                </div>
                <div className="text-text-muted">
                  Telepon: {contact360.phone}
                </div>
                <div className="pt-1">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      contact360.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    Status: {contact360.status === 'active' ? 'Karyawan Aktif' : 'Non-Aktif'}
                  </span>
                </div>
              </div>

              {/* Placement & School Unit */}
              <div className="p-3 rounded-xl bg-surface border border-border-subtle space-y-1.5">
                <div className="font-semibold text-text-muted flex items-center gap-1 text-[11px]">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  <span>Penempatan & Posisi</span>
                </div>
                <div className="font-bold text-text-primary leading-tight">
                  {contact360.school_unit}
                </div>
                <div className="text-text-secondary">
                  Jabatan: {contact360.position}
                </div>
              </div>

              {/* Latest Payroll Snapshot */}
              <div className="p-3 rounded-xl bg-surface border border-border-subtle space-y-1.5">
                <div className="font-semibold text-text-muted flex items-center gap-1 text-[11px]">
                  <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Gaji Terakhir (THP)</span>
                </div>
                <div className="font-bold text-[16px] text-emerald-700 font-mono">
                  {formatCurrency(contact360.latest_thp)}
                </div>
                <div className="text-text-muted text-[11px]">
                  Periode: {contact360.latest_period || 'Belum ada data'}
                </div>
              </div>

              {/* Attendance Today */}
              <div className="p-3 rounded-xl bg-surface border border-border-subtle space-y-1.5">
                <div className="font-semibold text-text-muted flex items-center gap-1 text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-sky-600" />
                  <span>Presensi Hari Ini</span>
                </div>
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="text-text-muted">Jam Masuk:</span>
                  <span className="font-semibold text-text-primary font-mono">
                    {contact360.today_check_in || '--:--'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="text-text-muted">Jam Pulang:</span>
                  <span className="font-semibold text-text-primary font-mono">
                    {contact360.today_check_out || '--:--'}
                  </span>
                </div>
              </div>

              {/* Complaints History Count */}
              <div className="p-3 rounded-xl bg-surface border border-border-subtle flex items-center justify-between">
                <span className="text-text-muted text-[11px]">Riwayat Keluhan:</span>
                <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {contact360.complaints_count} Keluhan
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-text-muted text-xs space-y-1">
              <User className="w-8 h-8 mx-auto opacity-30 mb-2" />
              <p>Pilih tiket untuk melihat ringkasan data profil karyawan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
