import React, { useEffect, useState } from 'react';
import { complaintService } from '../services/complaintService';
import { Complaint, ComplaintStatus, ComplaintSummary } from '../types/complaint';
import { CreateUserFeedbackModal } from '../components/CreateUserFeedbackModal';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { getStorageUrl } from '../../../lib/utils';
import {
  MessageSquarePlus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  ExternalLink,
  MessageCircle,
  X,
  Sparkles,
  Info,
} from 'lucide-react';

export const UserFeedbackPage: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<Complaint[]>([]);
  const [summary, setSummary] = useState<ComplaintSummary>({
    total: 0,
    pending: 0,
    in_progress: 0,
    resolved: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchFeedbacks();
  }, [selectedStatus]);

  const fetchFeedbacks = async () => {
    setIsLoading(true);
    try {
      const res = await complaintService.getUserFeedback(
        selectedStatus === 'all' ? undefined : selectedStatus
      );
      setFeedbacks(res.data);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err) {
      console.error('Failed to load user feedback', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: ComplaintStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Menunggu Tanggapan
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <AlertCircle className="w-3 h-3" /> Sedang Ditinjau Admin
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Selesai Ditanggapi
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <X className="w-3 h-3" /> Ditolak
          </span>
        );
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'saran':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'sistem':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'gaji':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'absensi':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'teknis':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline-page text-[22px] sm:text-[24px] font-bold text-text-primary tracking-tight">
              Feedback & Masukan Pengguna
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              Role User
            </span>
          </div>
          <p className="font-body-default text-[13px] text-text-muted mt-1">
            Kirimkan saran pengembangan, masukan antarmuka, atau kendala sistem langsung kepada Admin & Super Admin.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span>Kirim Feedback Baru</span>
        </Button>
      </div>

      {/* Info Callout */}
      <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <span className="font-bold">Saluran Komunikasi Langsung:</span> Setiap feedback yang Anda kirimkan akan langsung masuk ke dasbor <strong>Admin</strong> dan <strong>Super Admin</strong>. Anda dapat memantau status tindak lanjut serta membaca catatan tanggapan dari tim manajemen di halaman ini.
        </div>
      </div>

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-surface-panel border border-border-subtle shadow-xs">
          <span className="text-xs text-text-muted font-medium">Total Feedback Saya</span>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-text-primary">
            {summary.total}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/50 border border-amber-200 shadow-xs">
          <span className="text-xs text-amber-800 font-medium">Menunggu Tanggapan</span>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-amber-900">
            {summary.pending}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-sky-50/50 border border-sky-200 shadow-xs">
          <span className="text-xs text-sky-800 font-medium">Sedang Ditinjau Admin</span>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-sky-900">
            {summary.in_progress}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200 shadow-xs">
          <span className="text-xs text-emerald-800 font-medium">Selesai Ditanggapi</span>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-emerald-900">
            {summary.resolved}
          </div>
        </div>
      </div>

      {/* 3. Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-surface-container/40 border border-border-subtle rounded-xl w-fit overflow-x-auto max-w-full">
        {[
          { id: 'all', label: 'Semua Feedback' },
          { id: 'pending', label: 'Menunggu' },
          { id: 'in_progress', label: 'Ditinjau' },
          { id: 'resolved', label: 'Selesai' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedStatus(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
              selectedStatus === tab.id
                ? 'bg-surface-panel text-text-primary shadow-xs font-semibold'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. List Feedback Cards */}
      {isLoading ? (
        <div className="p-12 text-center text-text-muted text-xs bg-surface-panel border border-border-subtle rounded-2xl">
          Memuat riwayat feedback Anda...
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="p-12 text-center bg-surface-panel border border-border-subtle rounded-2xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <MessageSquarePlus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary text-sm">Belum Ada Feedback</h3>
            <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
              Anda belum mengirimkan feedback atau saran. Klik tombol &quot;Kirim Feedback Baru&quot; di atas untuk menyampaikan masukan kepada Admin.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((item) => (
            <div
              key={item.id}
              className="p-5 sm:p-6 rounded-2xl bg-surface-panel border border-border-subtle shadow-xs space-y-4 hover:border-amber-200 transition-colors"
            >
              {/* Card Header: Ticket, Category, Date, Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border-subtle">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {item.ticket_number}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${getCategoryColor(
                      item.category
                    )}`}
                  >
                    {item.category_label || item.category}
                  </span>
                  <span className="text-[11px] text-text-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(item.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div>{getStatusBadge(item.status)}</div>
              </div>

              {/* Title & Description */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-base text-text-primary">
                  {item.title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                  {item.description}
                </p>
              </div>

              {/* Photo Attachment if available */}
              {(item.photo_path || item.photo_full_url) && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setPreviewPhotoUrl(getStorageUrl(item.photo_path || item.photo_full_url))}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container/60 hover:bg-surface-container border border-border-subtle text-xs text-text-primary transition-colors cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-primary" />
                    <span>Lihat Foto Lampiran Bukti</span>
                    <ExternalLink className="w-3 h-3 text-text-muted" />
                  </button>
                </div>
              )}

              {/* Admin Feedback / Tanggapan Box */}
              {item.admin_notes && (
                <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-sky-900">
                    <div className="flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4 text-sky-600" />
                      <span>Tanggapan Resmi dari Admin:</span>
                    </div>
                    {item.resolver && (
                      <span className="text-[11px] text-sky-700 font-normal">
                        Oleh: {item.resolver.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-sky-950 whitespace-pre-wrap leading-relaxed">
                    {item.admin_notes}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Kirim Feedback */}
      <CreateUserFeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchFeedbacks}
      />

      {/* Lightbox Preview Foto */}
      {previewPhotoUrl && (
        <Modal
          isOpen={!!previewPhotoUrl}
          onClose={() => setPreviewPhotoUrl(null)}
          title="Lampiran Foto Bukti"
          maxWidth="3xl"
        >
          <div className="space-y-4">
            <div className="rounded-xl overflow-hidden bg-black/5 border border-border-subtle flex items-center justify-center max-h-[75vh]">
              <img
                src={getStorageUrl(previewPhotoUrl)}
                alt="Foto Lampiran"
                className="max-h-[75vh] w-auto object-contain rounded-lg"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  if (!target.dataset.triedFallback && previewPhotoUrl) {
                    target.dataset.triedFallback = 'true';
                    const clean = previewPhotoUrl.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?storage\/?/, '');
                    target.src = `/storage/${clean}`;
                  }
                }}
              />
            </div>
            <div className="flex justify-end">
              <a
                href={getStorageUrl(previewPhotoUrl)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Ukuran Asli</span>
              </a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
