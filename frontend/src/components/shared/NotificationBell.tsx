import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  Bell,
  CheckCheck,
  MessageSquareWarning,
  MessageSquarePlus,
  ClipboardList,
  Sparkles,
  ExternalLink,
  Clock,
} from 'lucide-react';

interface NotificationItem {
  id: number;
  user_id: number | null;
  company: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, any> | null;
  is_read: boolean;
  created_at: string;
}

export const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications', { params: { per_page: 8 } });
      if (response.data && response.data.status === 'success') {
        setNotifications(response.data.data || []);
        setUnreadCount(response.data.meta?.unread_count || 0);
      }
    } catch {
      // Quiet fail if network / unauthenticated
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25000); // Polling every 25 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_read: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignored
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setIsLoading(true);
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      handleMarkAsRead(notif.id);
    }
    setIsOpen(false);

    // Route based on notification type / payload
    const type = notif.type.toLowerCase();
    if (type.includes('complaint') || type.includes('feedback')) {
      navigate('/complaints');
    } else if (type.includes('announcement')) {
      navigate('/announcements');
    } else if (type.includes('work_report')) {
      navigate('/work-reports');
    } else {
      navigate('/dashboard');
    }
  };

  const getIconForType = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('complaint')) {
      return <MessageSquareWarning className="w-4 h-4 text-amber-500 shrink-0" />;
    }
    if (t.includes('feedback')) {
      return <MessageSquarePlus className="w-4 h-4 text-indigo-500 shrink-0" />;
    }
    if (t.includes('work_report')) {
      return <ClipboardList className="w-4 h-4 text-emerald-500 shrink-0" />;
    }
    if (t.includes('announcement')) {
      return <Bell className="w-4 h-4 text-purple-500 shrink-0" />;
    }
    return <Sparkles className="w-4 h-4 text-primary shrink-0" />;
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const diffSec = Math.floor((new Date().getTime() - date.getTime()) / 1000);
      if (diffSec < 60) return 'Baru saja';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m lalu`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}j lalu`;
      return `${Math.floor(diffSec / 86400)}h lalu`;
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
          isOpen
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'hover:bg-surface-container border-transparent hover:border-border-subtle text-text-muted hover:text-text-primary'
        }`}
        title="Notifikasi & Pemberitahuan"
        aria-label="Notifikasi"
      >
        <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[9.5px] font-bold text-white shadow-xs ring-2 ring-surface animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-surface-panel border border-border-subtle shadow-2xl z-50 overflow-hidden divide-y divide-border-row animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="px-4 py-3 bg-surface-container-low/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[13.5px] text-text-primary">Notifikasi</span>
              {unreadCount > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700">
                  {unreadCount} baru
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-slate-100 text-text-muted">
                  Semua terbaca
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={isLoading}
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Tandai dibaca</span>
              </button>
            )}
          </div>

          {/* List of Notifications */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-border-row">
            {notifications.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <div className="w-10 h-10 mx-auto rounded-full bg-surface-container flex items-center justify-center text-text-muted mb-2">
                  <Bell className="w-5 h-5 opacity-40" />
                </div>
                <p className="text-[12.5px] text-text-muted font-medium">Belum ada notifikasi baru</p>
                <p className="text-[11px] text-text-muted/70 mt-0.5">
                  Pemberitahuan pengaduan, feedback, dan pengumuman akan muncul di sini.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-3.5 transition-colors cursor-pointer hover:bg-surface-container/70 flex items-start gap-3 ${
                    !notif.is_read ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="mt-0.5 p-2 rounded-xl bg-surface-container-high shrink-0 shadow-2xs">
                    {getIconForType(notif.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <h4
                        className={`text-[12.5px] leading-snug truncate ${
                          !notif.is_read ? 'font-semibold text-text-primary' : 'font-medium text-text-muted'
                        }`}
                      >
                        {notif.title}
                      </h4>
                      <span className="text-[10px] text-text-muted whitespace-nowrap shrink-0 flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-text-muted leading-relaxed line-clamp-2 mt-0.5">
                      {notif.body}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {!notif.is_read && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                      <span className="text-[10.5px] font-medium text-primary hover:underline flex items-center gap-0.5">
                        Lihat detail
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
