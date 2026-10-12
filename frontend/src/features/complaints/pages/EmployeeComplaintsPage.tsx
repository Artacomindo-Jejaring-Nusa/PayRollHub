import React, { useEffect, useState } from 'react';
import { complaintService } from '../services/complaintService';
import { Complaint, ComplaintStatus, ComplaintSummary } from '../types/complaint';
import { CreateComplaintModal } from '../components/CreateComplaintModal';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import {
  MessageSquareWarning,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  User,
  Calendar,
  X,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';

export const EmployeeComplaintsPage: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
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
    fetchComplaints();
  }, [selectedStatus]);

  const fetchComplaints = async () => {
    setIsLoading(true);
    try {
      const res = await complaintService.getEmployeeComplaints(
        selectedStatus !== 'all' ? selectedStatus : undefined
      );
      setComplaints(res.data);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err) {
      console.error('Failed to load complaints', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: ComplaintStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" />
            Menunggu Respon
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1">
            <Clock className="w-3 h-3 text-sky-600 animate-spin" />
            Sedang Ditinjau
          </span>
        );
      case 'resolved':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Selesai Ditangani
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Ditolak
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <h1 className="font-headline-page text-[22px] sm:text-[24px] font-bold text-text-primary tracking-tight flex items-center gap-2.5">
            <MessageSquareWarning className="w-6 h-6 text-primary" />
            <span>Pusat Keluhan & Bantuan Karyawan</span>
          </h1>
          <p className="font-body-default text-[13px] text-text-muted mt-1">
            Sampaikan keluhan terkait slip gaji, absensi, atau kendala kerja lainnya dengan tulisan dan lampiran foto
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Tulis Keluhan Baru
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-border-subtle bg-surface-panel shadow-xs space-y-1">
          <span className="text-[11.5px] font-medium text-text-muted">Total Laporan</span>
          <div className="text-xl font-bold text-text-primary">{summary.total}</div>
        </div>
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 shadow-xs space-y-1">
          <span className="text-[11.5px] font-medium text-amber-800">Menunggu Respon</span>
          <div className="text-xl font-bold text-amber-900">{summary.pending}</div>
        </div>
        <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/50 shadow-xs space-y-1">
          <span className="text-[11.5px] font-medium text-sky-800">Sedang Ditinjau</span>
          <div className="text-xl font-bold text-sky-900">{summary.in_progress}</div>
        </div>
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-xs space-y-1">
          <span className="text-[11.5px] font-medium text-emerald-800">Selesai Ditangani</span>
          <div className="text-xl font-bold text-emerald-900">{summary.resolved}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'Semua Status' },
          { key: 'pending', label: 'Menunggu Respon' },
          { key: 'in_progress', label: 'Sedang Ditinjau' },
          { key: 'resolved', label: 'Selesai' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSelectedStatus(tab.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedStatus === tab.key
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface-panel hover:bg-surface-container border border-border-subtle text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List Complaints */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-32 bg-surface-container rounded-2xl w-full" />
          <div className="h-32 bg-surface-container rounded-2xl w-full" />
        </div>
      ) : complaints.length === 0 ? (
        <Card className="p-10 text-center space-y-3 border-border-subtle bg-surface-panel">
          <MessageSquareWarning className="w-12 h-12 text-text-muted mx-auto opacity-40" />
          <h3 className="text-base font-bold text-text-primary">Belum Ada Keluhan</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            {selectedStatus !== 'all'
              ? 'Tidak ada data keluhan pada filter status ini.'
              : 'Anda belum pernah mengirimkan keluhan. Jika terdapat ketidaksesuaian gaji atau kendala absensi, klik tombol di bawah.'}
          </p>
          <div className="pt-2">
            <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
              + Tulis Keluhan Sekarang
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {complaints.map((item) => (
            <Card
              key={item.id}
              className="p-5 sm:p-6 border-border-subtle bg-surface-panel shadow-xs space-y-4 hover:border-primary/30 transition-all"
            >
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border-subtle">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                    {item.ticket_number}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-surface-container border border-border-subtle text-text-secondary uppercase">
                    {item.category_label || item.category}
                  </span>
                  {getStatusBadge(item.status)}
                </div>

                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {new Date(item.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h3 className="font-bold text-base text-text-primary">{item.title}</h3>
                <p className="text-[13px] text-text-primary whitespace-pre-line leading-relaxed">
                  {item.description}
                </p>
              </div>

              {/* Photo Evidence */}
              {item.photo_full_url && (
                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-text-muted block mb-1.5 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-primary" />
                    <span>Lampiran Foto Bukti:</span>
                  </span>
                  <div
                    onClick={() => setPreviewPhotoUrl(item.photo_full_url || null)}
                    className="relative inline-block border border-border-subtle rounded-xl overflow-hidden cursor-pointer group bg-surface"
                  >
                    <img
                      src={item.photo_full_url}
                      alt={item.title}
                      className="w-44 h-28 object-cover rounded-xl group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-semibold gap-1">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Perbesar</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Feedback Box */}
              {item.admin_notes && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2 mt-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-primary">
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4" />
                      <span>Tanggapan & Solusi dari Tim HRD:</span>
                    </span>
                    {item.resolved_at && (
                      <span className="text-[11px] text-text-muted font-normal">
                        {new Date(item.resolved_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-primary leading-relaxed whitespace-pre-line">
                    {item.admin_notes}
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal Tulis Keluhan */}
      <CreateComplaintModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchComplaints}
      />

      {/* Modal Lightbox Foto */}
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
              alt="Foto Bukti Keluhan"
              className="w-full max-h-[85vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
