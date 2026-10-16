import React, { useState, useEffect, useRef } from 'react';
import { chatService } from '../services/chatService';
import { chatWs } from '../services/chatWebSocket';
import { ChatSession, ChatMessage } from '../types/chat';
import {
  MessageSquare,
  X,
  Send,
  Image as ImageIcon,
  Bot,
  User,
  ShieldCheck,
  Headphones,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';

export const LiveChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem('livechat_minimized') === 'true';
  });

  const toggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMinimized((prev) => {
      const next = !prev;
      localStorage.setItem('livechat_minimized', String(next));
      return next;
    });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<any>(null);

  // Load active session when widget is opened
  useEffect(() => {
    if (isOpen) {
      loadSession();
      setUnreadCount(0);
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isOpen]);

  // Start polling when session is loaded & widget is open
  useEffect(() => {
    if (isOpen && session && session.status !== 'closed') {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      pollIntervalRef.current = setInterval(async () => {
        try {
          const lastMsg = messages[messages.length - 1];
          const lastId = lastMsg ? lastMsg.id : 0;
          const res = await chatService.pollUserMessages(session.id, lastId);

          if (res.messages && res.messages.length > 0) {
            setMessages((prev) => [...prev, ...res.messages]);
          }

          if (res.status && res.status !== session.status) {
            setSession((prev) => (prev ? { ...prev, status: res.status as any, assigned_agent: res.assigned_agent as any } : null));
          }
        } catch (e) {
          // silent error on polling
        }
      }, 2500);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, session, messages.length]);

  // Real-time messages via WebSocket
  useEffect(() => {
    if (!isOpen || !session?.id) return;

    chatWs.connect();
    const channel = `session_${session.id}`;
    chatWs.subscribe(channel);

    const unsubMsg = chatWs.on(`${channel}:new_message`, (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    });

    const unsubClaimed = chatWs.on(`${channel}:agent_claimed`, (updatedSession: any) => {
      setSession(updatedSession);
    });

    const unsubClosed = chatWs.on(`${channel}:session_closed`, () => {
      loadSession();
    });

    return () => {
      unsubMsg();
      unsubClaimed();
      unsubClosed();
      chatWs.unsubscribe(channel);
    };
  }, [isOpen, session?.id]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSession = async () => {
    setIsLoading(true);
    try {
      const res = await chatService.getActiveSession();
      setSession(res.session);
      setMessages(res.messages || []);
    } catch (err) {
      console.error('Failed to load active chat session', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (customText?: string, actionCode?: string) => {
    const textToSend = customText ?? inputText;
    if (!textToSend.trim() && !selectedPhoto && !actionCode) return;
    if (!session) return;

    try {
      setIsSending(true);
      setInputText('');
      const photoToUpload = selectedPhoto;
      setSelectedPhoto(null);
      setPhotoPreview(null);

      const res = await chatService.sendMessage({
        session_id: session.id,
        message: textToSend.trim() || undefined,
        photo: photoToUpload || undefined,
        action_code: actionCode,
      });

      setSession(res.session);
      setMessages((prev) => {
        const next = [...prev, res.user_message];
        if (res.bot_message) {
          next.push(res.bot_message);
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleRequestAgent = async () => {
    if (!session) return;
    try {
      setIsSending(true);
      const res = await chatService.requestAgent(session.id);
      setSession(res.session);
      setMessages((prev) => [...prev, res.system_message]);
    } catch (err) {
      console.error('Failed to request agent', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseSession = async () => {
    if (!session) return;
    if (!window.confirm('Apakah Anda yakin ingin menyelesaikan sesi obrolan ini?')) return;
    try {
      await chatService.closeUserSession(session.id);
      setSession((prev) => (prev ? { ...prev, status: 'closed' } : null));
      loadSession();
    } catch (err) {
      console.error('Failed to close session', err);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('File harus berupa foto/gambar.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Ukuran foto maksimal 10MB.');
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
    <>
      {/* 1A. MINIMIZED STATE (Tiny subtle tab at bottom right) */}
      {!isOpen && isMinimized && (
        <div className="fixed bottom-3 right-4 sm:right-6 z-50">
          <button
            type="button"
            onClick={() => {
              setIsMinimized(false);
              localStorage.setItem('livechat_minimized', 'false');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-panel/95 hover:bg-surface-container text-text-muted hover:text-text-primary text-[11.5px] font-medium shadow-md border border-border-subtle transition-all hover:scale-105 cursor-pointer backdrop-blur-xs group"
            title="Klik untuk menampilkan tombol Live Chat"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
            <span>Chat Bantuan</span>
            {unreadCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>
        </div>
      )}

      {/* 1B. FLOATING LAUNCHER BUTTON (Compact circular FAB - won't block pagination) */}
      {!isOpen && !isMinimized && (
        <div className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2 group">
          {/* Tooltip on hover */}
          <div className="hidden lg:group-hover:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 text-white text-[12px] font-medium shadow-lg pointer-events-none transition-all duration-200 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 whitespace-nowrap">
            <span>Live Chat & Bantuan</span>
            <span className="text-[10px] text-emerald-400 font-mono">• Online</span>
          </div>

          <div className="relative">
            {/* Quick minimize button (x icon) */}
            <button
              type="button"
              onClick={toggleMinimize}
              className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-900 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
              title="Sembunyikan Widget Chat (Minimize)"
            >
              <X className="w-3 h-3" />
            </button>

            {/* Circular FAB */}
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="relative w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl hover:shadow-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer border border-emerald-400/40 flex items-center justify-center"
              title="Buka Live Chat & Bantuan AI"
              aria-label="Live Chat & Bantuan"
            >
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-emerald-300 rounded-full border-2 border-emerald-800" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping opacity-75" />

              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 text-[10px] font-bold bg-rose-500 text-white rounded-full shadow-md min-w-[18px] text-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 2. CHAT WINDOW DRAWER (Modal Box on Desktop, Full Overlay on Mobile) */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 w-full sm:w-[410px] h-[92vh] sm:h-[620px] max-h-[850px] bg-surface-panel rounded-t-2xl sm:rounded-2xl border border-border-subtle shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          {/* Header Bar */}
          <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-3.5 sm:p-4 flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center shrink-0">
                {session?.status === 'active_agent' ? (
                  <Headphones className="w-5 h-5 text-emerald-200" />
                ) : (
                  <Bot className="w-5 h-5 text-emerald-200" />
                )}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-emerald-800 rounded-full" />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-[14px] leading-tight">
                    {session?.status === 'active_agent'
                      ? `CS Agent: ${session.assigned_agent?.name || 'Customer Service'}`
                      : 'AI Virtual Assistant & CS'}
                  </h3>
                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-white/20 text-white uppercase">
                    Live
                  </span>
                </div>
                <p className="text-[11px] text-emerald-100 mt-0.5 flex items-center gap-1">
                  {session?.status === 'waiting_agent' ? (
                    <span className="text-amber-200 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-spin" /> Menghubungkan ke Agent...
                    </span>
                  ) : session?.status === 'active_agent' ? (
                    <span className="text-emerald-200 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Agen Aktif dalam Chat
                    </span>
                  ) : session?.status === 'closed' ? (
                    <span className="text-slate-300">Sesi Telah Selesai</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-300" /> Didukung AI Machine Learning
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {session && session.status !== 'closed' && (
                <button
                  type="button"
                  onClick={handleCloseSession}
                  className="px-2 py-1 text-[11px] font-semibold text-rose-200 hover:text-white bg-rose-500/20 hover:bg-rose-500/40 rounded-lg transition-all cursor-pointer mr-1"
                  title="Selesaikan Obrolan"
                >
                  Selesai
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                title="Tutup Jendela"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick FAQ Chips Row */}
          <div className="px-3 py-2 bg-surface-container border-b border-border-subtle flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
            {[
              { label: '💰 Jadwal Gaji', action: 'ask_payroll_schedule' },
              { label: '📍 Kendala Absensi GPS', action: 'ask_attendance_guide' },
              { label: '👤 Hubungi CS Live', action: 'request_agent' },
            ].map((chip) => (
              <button
                key={chip.action}
                type="button"
                onClick={() => handleSendMessage(undefined, chip.action)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface-panel hover:bg-primary/10 hover:text-primary hover:border-primary/30 border border-border-subtle text-text-primary whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-2xs"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Escalation Banner (If in Bot mode) */}
          {session?.status === 'bot' && (
            <div className="bg-amber-50/90 border-b border-amber-200/80 px-3 py-1.5 flex items-center justify-between gap-2 shrink-0">
              <span className="text-[11px] text-amber-900 font-medium truncate">
                Butuh bantuan khusus dari staf?
              </span>
              <button
                type="button"
                onClick={handleRequestAgent}
                disabled={isSending}
                className="px-2 py-0.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-[10.5px] font-bold transition-all shrink-0 cursor-pointer shadow-2xs"
              >
                Hubungkan ke CS
              </button>
            </div>
          )}

          {/* Waiting Agent Notice Banner */}
          {session?.status === 'waiting_agent' && (
            <div className="bg-sky-50 border-b border-sky-200 px-3 py-2 flex items-center gap-2 shrink-0">
              <Clock className="w-4 h-4 text-sky-600 animate-spin shrink-0" />
              <p className="text-[11.5px] text-sky-900 leading-tight">
                Anda berada di antrean prioritas CS HRD. Agen kami akan segera merespons Anda.
              </p>
            </div>
          )}

          {/* Message List */}
          <div className="flex-1 p-3.5 space-y-3.5 overflow-y-auto bg-surface">
            {isLoading ? (
              <div className="space-y-3 p-4">
                <div className="h-12 bg-surface-container rounded-2xl w-3/4 animate-pulse" />
                <div className="h-12 bg-surface-container rounded-2xl w-2/3 ml-auto animate-pulse" />
                <div className="h-16 bg-surface-container rounded-2xl w-4/5 animate-pulse" />
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.sender_type === 'user';
                const isBot = msg.sender_type === 'bot';
                const isAgent = msg.sender_type === 'agent';
                const isSystem = msg.sender_type === 'system';

                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <div className="max-w-[85%] px-3 py-1.5 rounded-full bg-surface-container border border-border-subtle text-[11px] text-text-muted text-center leading-relaxed">
                        {msg.message}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center shrink-0 text-xs">
                        {isAgent ? (
                          <Headphones className="w-3.5 h-3.5 text-emerald-700" />
                        ) : (
                          <Bot className="w-3.5 h-3.5 text-emerald-700" />
                        )}
                      </div>
                    )}

                    <div className="max-w-[82%] space-y-1.5">
                      <div
                        className={`p-3 rounded-2xl text-[12.5px] leading-relaxed shadow-2xs ${
                          isUser
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-br-xs'
                            : isAgent
                            ? 'bg-surface-panel border border-emerald-200 text-text-primary rounded-bl-xs'
                            : 'bg-surface-panel border border-border-subtle text-text-primary rounded-bl-xs'
                        }`}
                      >
                        {/* Sender Label for Agent */}
                        {isAgent && (
                          <div className="text-[10.5px] font-bold text-emerald-700 mb-1 flex items-center gap-1">
                            <Headphones className="w-3 h-3" />
                            <span>{msg.sender_name} (CS HRD)</span>
                          </div>
                        )}

                        {/* Text Message */}
                        <div className="whitespace-pre-line">{msg.message}</div>

                        {/* Image Attachment */}
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
                                alt="Foto Lampiran"
                                className="w-full max-h-48 object-cover rounded-xl"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-semibold gap-1">
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Lihat Foto Penuh</span>
                              </div>
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Suggested Action Buttons from Bot */}
                      {isBot && msg.suggested_actions && msg.suggested_actions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {msg.suggested_actions.map((act, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSendMessage(undefined, act.action)}
                              className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer shadow-2xs"
                            >
                              {act.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Timestamp */}
                      <div
                        className={`text-[9.5px] text-text-muted px-1 ${
                          isUser ? 'text-right' : 'text-left'
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

          {/* Photo Preview Thumbnail before send */}
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
                className="p-1 rounded-full text-rose-500 hover:bg-rose-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Input & Action Bar */}
          <div className="p-2.5 sm:p-3 bg-surface-panel border-t border-border-subtle shrink-0">
            {session?.status === 'closed' ? (
              <div className="text-center py-2 space-y-2">
                <p className="text-xs text-text-muted">Percakapan ini telah selesai.</p>
                <button
                  type="button"
                  onClick={loadSession}
                  className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold cursor-pointer shadow-xs"
                >
                  Mulai Percakapan Baru
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                {/* File Attachment Button */}
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
                  title="Lampirkan Foto"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>

                {/* Input Text Box */}
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ketik pertanyaan atau kendala..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-surface border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary text-[13px] text-text-primary outline-hidden"
                  disabled={isSending}
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={isSending || (!inputText.trim() && !selectedPhoto)}
                  className="p-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white disabled:opacity-40 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Kirim Pesan"
                >
                  <Send className="w-4.5 h-4.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
