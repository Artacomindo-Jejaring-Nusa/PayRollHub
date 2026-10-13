import React, { useEffect, useState } from 'react';
import { complaintService } from '../services/complaintService';
import { Complaint, ComplaintStatus, ComplaintSummary } from '../types/complaint';
import { useAuthStore } from '../../../store/authStore';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Pagination } from '../../../components/shared/Pagination';
import { getStorageUrl } from '../../../lib/utils';
import {
  MessageSquareWarning,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  ExternalLink,
  MessageCircle,
  Trash2,
  Edit2,
  X,
  User,
  Building,
  Calendar,
  Save,
} from 'lucide-react';

export const AdminComplaintsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [summary, setSummary] = useState<ComplaintSummary>({
    total: 0,
    pending: 0,
    in_progress: 0,
    resolved: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<any>(null);

  // Response Modal State
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [responseStatus, setResponseStatus] = useState<ComplaintStatus>('in_progress');
  const [responseNotes, setResponseNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Lightbox Photo State
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchComplaints();
    fetchSummary();
  }, [page, selectedStatus, selectedCategory, selectedCompany]);

  const fetchComplaints = async () => {
    setIsLoading(true);
    try {
      const res = await complaintService.getAdminComplaints({
        page,
        search: search.trim() || undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        company: selectedCompany !== 'all' ? selectedCompany : undefined,
      });
      setComplaints(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Failed to load admin complaints', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await complaintService.getAdminComplaintsSummary(
        selectedCompany !== 'all' ? selectedCompany : undefined
      );
      setSummary(res);
    } catch (err) {
      console.error('Failed to load summary', err);
    }
  };

  const handleOpenResponse = (comp: Complaint) => {
    setSelectedComplaint(comp);
    setResponseStatus(comp.status === 'pending' ? 'in_progress' : comp.status);
    setResponseNotes(comp.admin_notes || '');
  };

  const handleSaveResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    try {
      setIsUpdating(true);
      await complaintService.updateComplaint(selectedComplaint.id, {
        status: responseStatus,
        admin_notes: responseNotes.trim() || undefined,
      });
      setSelectedComplaint(null);
      fetchComplaints();
      fetchSummary();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyimpan tanggapan.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteComplaint = async (comp: Complaint) => {
    if (!window.confirm(`Hapus tiket keluhan '${comp.ticket_number}'?`)) return;
    try {
      await complaintService.deleteComplaint(comp.id);
      fetchComplaints();
      fetchSummary();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menghapus keluhan.');
    }
  };

  const getStatusBadge = (status: ComplaintStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" />
            Menunggu Respon
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
            <Clock className="w-3 h-3 text-sky-600" />
            Sedang Ditinjau
          </span>
        );
      case 'resolved':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Selesai
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <h1 className="font-headline-page text-headline-page text-text-primary tracking-tight flex items-center gap-2.5">
            <MessageSquareWarning className="w-6 h-6 text-primary" />
            <span>Manajemen Feedback & Keluhan Pengguna</span>
          </h1>
          <p className="font-body-default text-body-default text-text-muted mt-1">
            Tinjau masukan, saran, dan kendala dari pengguna (role User) serta berikan solusi & tanggapan resmi dari Admin / Super Admin
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border-subtle bg-surface-panel shadow-xs space-y-1">
          <span className="text-xs font-semibold text-text-muted">Total Keluhan</span>
          <div className="text-2xl font-bold text-text-primary">{summary.total}</div>
        </div>
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-amber-800">Menunggu Respon</span>
          <div className="text-2xl font-bold text-amber-900">{summary.pending}</div>
        </div>
        <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/60 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-sky-800">Sedang Ditinjau</span>
          <div className="text-2xl font-bold text-sky-900">{summary.in_progress}</div>
        </div>
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-emerald-800">Selesai Ditangani</span>
          <div className="text-2xl font-bold text-emerald-900">{summary.resolved}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface-panel rounded-xl border border-border-subtle p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            fetchComplaints();
          }}
          className="relative w-full md:w-80"
        >
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari tiket, nama karyawan, NIK..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs bg-surface border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 text-xs bg-surface border border-border-subtle rounded-xl text-text-primary focus:outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu Respon</option>
            <option value="in_progress">Sedang Ditinjau</option>
            <option value="resolved">Selesai Ditangani</option>
            <option value="rejected">Ditolak</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 text-xs bg-surface border border-border-subtle rounded-xl text-text-primary focus:outline-none"
          >
            <option value="all">Semua Kategori</option>
            <option value="saran">💡 Saran & Masukan</option>
            <option value="sistem">⚙️ Kendala Sistem</option>
            <option value="gaji">💵 Gaji & Slip</option>
            <option value="absensi">📍 Absensi & Lokasi</option>
            <option value="fasilitas">🏢 Fasilitas & Operasional</option>
            <option value="teknis">🔧 Kendala Teknis</option>
            <option value="lainnya">📝 Lainnya</option>
          </select>

          {user?.role === 'super_admin' && (
            <select
              value={selectedCompany}
              onChange={(e) => {
                setSelectedCompany(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 text-xs bg-surface border border-border-subtle rounded-xl text-text-primary focus:outline-none"
            >
              <option value="all">Semua Perusahaan</option>
              <option value="rbs">PT. RBS</option>
              <option value="rimamandiri">PT. Riama Mandiri</option>
            </select>
          )}
        </div>
      </div>

      {/* Complaints Table */}
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-text-primary">
            <thead className="bg-surface-container/40 border-b border-border-subtle text-text-secondary font-semibold">
              <tr>
                <th className="py-3 px-4">No. Tiket & Tanggal</th>
                <th className="py-3 px-4">Pengirim / Akun</th>
                <th className="py-3 px-4">Kategori & Judul</th>
                <th className="py-3 px-4">Foto Bukti</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Tanggapan HR</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted">
                    Memuat data keluhan...
                  </td>
                </tr>
              ) : complaints.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted">
                    Tidak ada keluhan karyawan yang sesuai filter.
                  </td>
                </tr>
              ) : (
                complaints.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-container/20 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-primary">{item.ticket_number}</div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {new Date(item.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-text-primary">{item.user?.name || '-'}</span>
                        {item.user?.role === 'user' || item.user?.role === 'viewer' ? (
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase">
                            User
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {item.user?.role || 'Karyawan'}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {item.user?.email || (item.user?.nik ? `NIK: ${item.user.nik}` : '-')}
                      </div>
                      {item.school_unit && (
                        <div className="text-[10.5px] text-text-secondary font-medium mt-0.5">
                          {item.school_unit}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-surface-container border border-border-subtle text-text-secondary uppercase mb-1">
                        {item.category_label || item.category}
                      </span>
                      <div className="font-bold text-text-primary line-clamp-1">{item.title}</div>
                      <div className="text-text-muted text-[11.5px] line-clamp-2 mt-0.5 leading-snug">
                        {item.description}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.photo_path || item.photo_full_url ? (
                        (() => {
                          const rawPhoto = item.photo_path || item.photo_full_url;
                          const photoSrc = getStorageUrl(rawPhoto);
                          return (
                            <div
                              onClick={() => setPreviewPhotoUrl(photoSrc)}
                              className="relative inline-block border border-border-subtle rounded-lg overflow-hidden cursor-pointer group"
                            >
                              <img
                                src={photoSrc}
                                alt="Bukti"
                                className="w-14 h-11 object-cover group-hover:scale-105 transition-transform"
                                onError={(e) => {
                                  const target = e.currentTarget as HTMLImageElement;
                                  if (!target.dataset.triedFallback && rawPhoto) {
                                    target.dataset.triedFallback = 'true';
                                    const clean = rawPhoto.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?storage\/?/, '');
                                    target.src = `/storage/${clean}`;
                                  }
                                }}
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <ExternalLink className="w-3 h-3" />
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-text-muted text-[11px] italic">Tanpa Foto</span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(item.status)}
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      {item.admin_notes ? (
                        <div>
                          <div className="text-[11.5px] text-emerald-800 line-clamp-2 font-medium">
                            {item.admin_notes}
                          </div>
                          {item.resolver?.name && (
                            <div className="text-[10px] text-text-muted mt-0.5">
                              Oleh: {item.resolver.name}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-muted text-[11px] italic">Belum ditanggapi</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenResponse(item)}
                        className="px-3 py-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-white rounded-lg shadow-xs transition-all cursor-pointer mr-1.5 inline-flex items-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>Tanggapi</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteComplaint(item)}
                        className="p-1.5 text-text-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer inline-flex items-center"
                        title="Hapus Tiket"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && (
          <Pagination
            meta={meta}
            onPageChange={(p) => setPage(p)}
            perPage={15}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Modal Tanggapi Keluhan */}
      {selectedComplaint && (
        <Modal
          isOpen={!!selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          title={`Tanggapi Keluhan: ${selectedComplaint.ticket_number}`}
          description={`Pelapor: ${selectedComplaint.user?.name || '-'} (${selectedComplaint.school_unit || '-'})`}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveResponse} className="space-y-4">
            <div className="p-3.5 bg-surface-container/30 border border-border-subtle rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-text-primary">
                  {selectedComplaint.title}
                </span>
                <span className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-surface border border-border-subtle text-text-secondary uppercase">
                  {selectedComplaint.category_label || selectedComplaint.category}
                </span>
              </div>
              <p className="text-xs text-text-primary leading-relaxed whitespace-pre-line">
                {selectedComplaint.description}
              </p>

              {selectedComplaint.photo_full_url && (
                <div className="pt-2 border-t border-border-subtle/50">
                  <span className="text-[11px] font-semibold text-text-muted block mb-1">
                    Foto Bukti Pelapor:
                  </span>
                  <div
                    onClick={() => setPreviewPhotoUrl(selectedComplaint.photo_full_url || null)}
                    className="relative inline-block border border-border-subtle rounded-xl overflow-hidden cursor-pointer group"
                  >
                    <img
                      src={selectedComplaint.photo_full_url}
                      alt="Foto Bukti"
                      className="w-48 h-32 object-cover rounded-xl group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Klik untuk Zoom</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Perbarui Status Tiket *
              </label>
              <select
                value={responseStatus}
                onChange={(e) => setResponseStatus(e.target.value as ComplaintStatus)}
                className="w-full h-10 px-3.5 rounded-xl border border-border-subtle bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="pending">Menunggu Respon (Pending)</option>
                <option value="in_progress">Sedang Ditinjau / Dalam Proses (In Progress)</option>
                <option value="resolved">Selesai Ditangani & Dijawab (Resolved)</option>
                <option value="rejected">Ditolak / Tidak Valid (Rejected)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Tanggapan / Catatan Solusi HRD (Akan Tampil di Akun Karyawan)
              </label>
              <textarea
                rows={4}
                placeholder="Tuliskan jawaban penjelasan, instruksi perbaikan slip, atau konfirmasi penyesuaian..."
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
                className="w-full p-3 rounded-xl border border-border-subtle bg-surface text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
              />
            </div>

            <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                type="button"
                onClick={() => setSelectedComplaint(null)}
                disabled={isUpdating}
              >
                Batal
              </Button>
              <Button variant="primary" type="submit" disabled={isUpdating}>
                {isUpdating ? 'Menyimpan...' : 'Simpan Tanggapan'}
              </Button>
            </div>
          </form>
        </Modal>
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
              src={getStorageUrl(previewPhotoUrl)}
              alt="Foto Bukti"
              className="w-full max-h-[85vh] object-contain rounded-xl"
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
        </div>
      )}
    </div>
  );
};
