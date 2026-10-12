import React, { useEffect, useState } from 'react';
import { employeeService } from '../services/employeeService';
import { Announcement } from '../../../types/auth';
import { Card } from '../../../components/ui/Card';
import {
  Bell,
  Calendar,
  User,
  Pin,
  FileText,
  Image as ImageIcon,
  Download,
  ExternalLink,
  X,
} from 'lucide-react';

export const EmployeeAnnouncementsPage: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

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
        <div className="space-y-4">
          {announcements.map((item) => (
            <Card
              key={item.id}
              className={`p-5 sm:p-6 border-border-subtle bg-surface-panel shadow-xs space-y-3.5 transition-colors ${
                item.is_pinned ? 'border-primary/40 bg-surface' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
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

              {/* Attachment Display */}
              {item.attachment_url && (
                <div className="pt-3 border-t border-border-subtle/60 flex flex-wrap items-center gap-3">
                  {item.attachment_type === 'image' ? (
                    <div
                      onClick={() => setPreviewPhotoUrl(item.attachment_url || null)}
                      className="relative inline-flex items-center gap-2.5 p-2 bg-surface hover:bg-surface-container border border-border-subtle rounded-xl cursor-pointer group transition-colors"
                    >
                      <img
                        src={item.attachment_url}
                        alt={item.attachment_name || 'Foto Lampiran'}
                        className="w-20 h-14 object-cover rounded-lg group-hover:scale-102 transition-transform"
                      />
                      <div className="pr-3">
                        <span className="text-xs font-semibold text-text-primary block flex items-center gap-1.5 group-hover:text-primary transition-colors">
                          <ImageIcon className="w-3.5 h-3.5 text-primary" />
                          <span>{item.attachment_name || 'Lihat Foto Lampiran'}</span>
                        </span>
                        <span className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          <span>Klik untuk memperbesar</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <a
                      href={item.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2.5 px-3.5 py-2.5 bg-surface hover:bg-surface-container border border-border-subtle rounded-xl text-xs font-semibold text-primary transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-text-primary font-semibold group-hover:text-primary transition-colors">
                          {item.attachment_name || 'Unduh Dokumen Lampiran'}
                        </span>
                        {item.attachment_size && (
                          <span className="text-[11px] text-text-muted font-normal">
                            Dokumen Resmi • {(item.attachment_size / 1024).toFixed(0)} KB
                          </span>
                        )}
                      </div>
                      <Download className="w-4 h-4 ml-2 text-text-muted group-hover:text-primary transition-colors" />
                    </a>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Lightbox Modal Foto */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-surface rounded-2xl overflow-hidden p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-4 right-4 p-2 bg-black/70 hover:bg-black text-white rounded-full transition-all cursor-pointer z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Foto Pengumuman"
              className="w-full max-h-[85vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
