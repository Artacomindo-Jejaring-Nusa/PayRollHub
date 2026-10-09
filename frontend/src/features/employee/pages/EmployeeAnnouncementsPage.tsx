import React, { useEffect, useState } from 'react';
import { employeeService } from '../services/employeeService';
import { Announcement } from '../../../types/auth';
import { Card } from '../../../components/ui/Card';
import { Bell, Calendar, User, Pin } from 'lucide-react';

export const EmployeeAnnouncementsPage: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const res = await employeeService.getAnnouncements();
      setAnnouncements(res.data);
    } catch (err) {
      console.error('Failed to load announcements', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-28 bg-surface-container rounded-xl w-full" />
        <div className="h-28 bg-surface-container rounded-xl w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-border-subtle">
        <h1 className="font-headline-page text-[22px] sm:text-[24px] font-bold text-text-primary tracking-tight">
          Papan Pengumuman Resmi
        </h1>
        <p className="font-body-default text-[13px] text-text-muted mt-1">
          Informasi operasional, jadwal, dan edaran resmi dari tim HR & Manajemen
        </p>
      </div>

      {announcements.length === 0 ? (
        <Card className="p-8 text-center space-y-2 border-border-subtle bg-surface-panel">
          <Bell className="w-10 h-10 text-text-muted mx-auto" />
          <h3 className="text-[15px] font-semibold text-text-primary">Belum Ada Pengumuman</h3>
          <p className="text-[12px] text-text-muted max-w-sm mx-auto">
            Semua pengumuman dan edaran resmi akan tampil di halaman ini.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((item) => (
            <Card
              key={item.id}
              className={`p-5 border-border-subtle bg-surface-panel shadow-xs space-y-3 transition-colors ${
                item.is_pinned ? 'border-primary/40 bg-surface' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[10.5px] font-bold bg-primary/10 text-primary uppercase">
                    {item.category}
                  </span>
                  {item.is_pinned && (
                    <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-primary text-white flex items-center gap-1">
                      <Pin className="w-3 h-3" /> PENTING
                    </span>
                  )}
                  <h3 className="font-bold text-[15px] text-text-primary">{item.title}</h3>
                </div>

                <div className="flex items-center gap-3 text-[11.5px] text-text-muted">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span>{item.author?.name || 'HRD Pusat'}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {new Date(item.published_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </span>
                </div>
              </div>

              <div className="text-[13px] text-text-primary whitespace-pre-line leading-relaxed">
                {item.content}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
