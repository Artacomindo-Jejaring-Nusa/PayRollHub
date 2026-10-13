import React, { useEffect, useState } from 'react';
import { workReportService } from '../services/workReportService';
import { WorkReport } from '../../../types/auth';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { getStorageUrl } from '../../../lib/utils';
import {
  ClipboardList,
  Search,
  Calendar,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Filter,
  ExternalLink,
  Eye,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Printer,
  Table as TableIcon,
  LayoutGrid,
  Download,
} from 'lucide-react';

interface ActivitySlot {
  key: 'absen' | 'kegiatan1' | 'kegiatan2' | 'kegiatan_lain';
  title: string;
  subtitle: string;
  photoUrl: string | null;
  description: string;
  isRequired: boolean;
}

function getReportActivities(report: WorkReport): ActivitySlot[] {
  if (report.photo_absen || report.desc_absen || report.photo_kegiatan1 || report.desc_kegiatan1) {
    return [
      {
        key: 'absen',
        title: '1. Absen Masuk',
        subtitle: 'Foto Masuk Bertugas',
        photoUrl: report.photo_absen ? getStorageUrl(report.photo_absen) : null,
        description: report.desc_absen || '-',
        isRequired: true,
      },
      {
        key: 'kegiatan1',
        title: '2. Kegiatan 1',
        subtitle: 'Aktivitas Utama',
        photoUrl: report.photo_kegiatan1 ? getStorageUrl(report.photo_kegiatan1) : null,
        description: report.desc_kegiatan1 || '-',
        isRequired: true,
      },
      {
        key: 'kegiatan2',
        title: '3. Kegiatan 2',
        subtitle: 'Aktivitas Kedua',
        photoUrl: report.photo_kegiatan2 ? getStorageUrl(report.photo_kegiatan2) : null,
        description: report.desc_kegiatan2 || '-',
        isRequired: true,
      },
      {
        key: 'kegiatan_lain',
        title: '4. Kegiatan Lain',
        subtitle: 'Tugas Lainnya (Opsional)',
        photoUrl: report.photo_kegiatan_lain ? getStorageUrl(report.photo_kegiatan_lain) : null,
        description: report.desc_kegiatan_lain || '-',
        isRequired: false,
      },
    ];
  }

  // Fallback legacy format
  return [
    {
      key: 'absen',
      title: '1. Absen Masuk',
      subtitle: 'Foto Masuk Bertugas',
      photoUrl: null,
      description: 'Laporan versi awal',
      isRequired: true,
    },
    {
      key: 'kegiatan1',
      title: '2. Kegiatan 1',
      subtitle: 'Aktivitas Utama',
      photoUrl: report.attachment_path ? getStorageUrl(report.attachment_path) : null,
      description: report.description || '-',
      isRequired: true,
    },
    {
      key: 'kegiatan2',
      title: '3. Kegiatan 2',
      subtitle: 'Aktivitas Kedua',
      photoUrl: null,
      description: '-',
      isRequired: true,
    },
    {
      key: 'kegiatan_lain',
      title: '4. Kegiatan Lain',
      subtitle: 'Opsional',
      photoUrl: null,
      description: '-',
      isRequired: false,
    },
  ];
}

export const AdminWorkReportsPage: React.FC = () => {
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // View Mode: 'table' (default for 2000+ employees) or 'cards'
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Export Loading States
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState<number | null>(null);

  // Selected Report for Full Detail Modal (4 Kolom 4 Foto)
  const [detailReport, setDetailReport] = useState<WorkReport | null>(null);

  // Preview Attachment State (Lightbox)
  const [previewAttachment, setPreviewAttachment] = useState<{
    url: string;
    title: string;
    subtitle?: string;
    isPdf: boolean;
  } | null>(null);

  // Review Modal State
  const [reviewingReport, setReviewingReport] = useState<WorkReport | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected' | 'pending'>('approved');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchReports();
  }, [statusFilter, dateFilter]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await workReportService.getAdminWorkReports({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        date: dateFilter || undefined,
        search: search.trim() || undefined,
      });
      setReports(res.data);
    } catch (err) {
      console.error('Failed to load work reports', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      await workReportService.exportReports(
        {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          date: dateFilter || undefined,
          search: search.trim() || undefined,
        },
        'xlsx'
      );
    } catch (err) {
      alert('Gagal mengekspor laporan ke Excel.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      await workReportService.exportReports(
        {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          date: dateFilter || undefined,
          search: search.trim() || undefined,
        },
        'pdf'
      );
    } catch (err) {
      alert('Gagal mengekspor rekap laporan ke PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadSinglePdf = async (report: WorkReport) => {
    setDownloadingPdfId(report.id);
    try {
      const dateStr = report.report_date ? report.report_date.replace(/-/g, '') : 'harian';
      await workReportService.downloadSinglePdf(report.id, report.user?.name || 'karyawan', dateStr);
    } catch (err) {
      alert('Gagal mengunduh lembar laporan kerja PDF.');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const handleOpenReview = (report: WorkReport) => {
    setReviewingReport(report);
    setReviewStatus(report.status === 'pending' ? 'approved' : report.status);
    setFeedback(report.feedback || '');
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingReport) return;

    setIsSubmitting(true);
    try {
      const updated = await workReportService.updateReportStatus(reviewingReport.id, {
        status: reviewStatus,
        feedback: feedback.trim(),
      });
      setReviewingReport(null);
      if (detailReport && detailReport.id === reviewingReport.id) {
        setDetailReport(updated);
      }
      fetchReports();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyimpan status review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-page text-headline-page text-text-primary tracking-tight">
            Laporan Kerja Karyawan
          </h1>
          <p className="font-body-default text-body-default text-text-muted mt-1">
            Kelola rekap 4 aktivitas harian, evaluasi bukti foto kerja, dan ekspor data laporan
          </p>
        </div>

        {/* Action Buttons: Export Excel, Cetak PDF, View Mode */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[12.5px] font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExportingExcel ? 'Mengekspor...' : 'Export Excel'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[12.5px] font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            <span>{isExportingPdf ? 'Mencetak...' : 'Cetak Rekap PDF'}</span>
          </button>

          {/* Toggle Mode Tampilan (Table vs Grid Cards) */}
          <div className="flex items-center p-1 bg-surface-container rounded-xl border border-border-subtle">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-surface shadow-xs text-primary font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              title="Mode Tabel Ringkas (Ideal untuk ribuan data)"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tabel</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-surface shadow-xs text-primary font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              title="Mode Kartu Grid Visual"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kartu</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-surface-panel rounded-xl border border-border-subtle p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border-subtle bg-surface text-[12.5px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu Review</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Perlu Revisi</option>
          </select>

          {/* Date Filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border-subtle bg-surface text-[12.5px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-[12px] text-text-muted hover:text-text-primary cursor-pointer"
            >
              Reset Tanggal
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama, NIK, atau tugas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchReports()}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border-subtle bg-surface text-[12.5px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-14 bg-surface-container rounded-xl" />
          <div className="h-14 bg-surface-container rounded-xl" />
          <div className="h-14 bg-surface-container rounded-xl" />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-surface-panel rounded-2xl border border-border-subtle p-12 text-center text-text-muted text-[13px] space-y-2">
          <ClipboardList className="w-10 h-10 mx-auto text-text-muted opacity-50" />
          <p className="font-semibold text-text-primary text-[14px]">
            Belum ada laporan kerja yang sesuai dengan filter pencarian.
          </p>
          <p className="text-[12px] text-text-muted">Coba atur ulang tanggal atau kata kunci pencarian Anda.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* MODE TABEL: Ringkas & Cepat untuk 2000-an Karyawan */
        <div className="bg-surface-panel rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container/60 border-b border-border-row text-[11.5px] font-semibold text-text-muted uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4 w-32">Tanggal</th>
                  <th className="py-3 px-4 min-w-[180px]">Karyawan</th>
                  <th className="py-3 px-4 min-w-[200px]">4 Bukti Kegiatan</th>
                  <th className="py-3 px-4 min-w-[180px]">Rincian Singkat</th>
                  <th className="py-3 px-4 w-32 text-center">Status</th>
                  <th className="py-3 px-4 w-44 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-row text-[12.5px]">
                {reports.map((report, idx) => {
                  const isApproved = report.status === 'approved';
                  const isRejected = report.status === 'rejected';
                  const activities = getReportActivities(report);

                  return (
                    <tr
                      key={report.id}
                      className="hover:bg-surface-container/30 transition-colors"
                    >
                      {/* No */}
                      <td className="py-3 px-4 text-center text-text-muted font-mono text-[11.5px]">
                        {idx + 1}
                      </td>

                      {/* Tanggal */}
                      <td className="py-3 px-4 text-text-primary whitespace-nowrap font-medium">
                        {new Date(report.report_date).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Info Karyawan */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-text-primary hover:text-primary transition-colors">
                          {report.user?.name || 'Karyawan'}
                        </div>
                        <div className="text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono">NIK: {report.nik || '-'}</span>
                          <span>•</span>
                          <span>{report.user?.company === 'rimamandiri' ? 'Riama Mandiri' : 'RBS Global'}</span>
                        </div>
                      </td>

                      {/* 4 Bukti Kegiatan Mini Badges */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {activities.map((act) => (
                            <button
                              key={act.key}
                              type="button"
                              onClick={() => {
                                if (act.photoUrl) {
                                  setPreviewAttachment({
                                    url: act.photoUrl,
                                    title: `${report.user?.name || 'Karyawan'} - ${act.title}`,
                                    subtitle: act.subtitle,
                                    isPdf: false,
                                  });
                                } else {
                                  setDetailReport(report);
                                }
                              }}
                              className={`px-2 py-0.5 rounded text-[10.5px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                                act.photoUrl
                                  ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                                  : 'bg-surface-container text-text-muted border border-border-subtle'
                              }`}
                              title={act.photoUrl ? `Klik lihat foto: ${act.title}` : `Tanpa foto: ${act.title}`}
                            >
                              {act.photoUrl ? (
                                <ImageIcon className="w-3 h-3 text-primary" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                              )}
                              <span>{act.key === 'absen' ? 'Absen' : act.key === 'kegiatan1' ? 'Keg 1' : act.key === 'kegiatan2' ? 'Keg 2' : 'Lain'}</span>
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Rincian Singkat */}
                      <td className="py-3 px-4 text-text-muted text-[11.5px] max-w-xs truncate">
                        {report.desc_kegiatan1 || report.description || report.desc_absen || '-'}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            isApproved
                              ? 'bg-emerald-100 text-emerald-800'
                              : isRejected
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isApproved ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Disetujui
                            </>
                          ) : isRejected ? (
                            <>
                              <XCircle className="w-3 h-3" /> Revisi
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" /> Menunggu
                            </>
                          )}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Tombol Lihat Detail 4 Kolom */}
                          <button
                            type="button"
                            onClick={() => setDetailReport(report)}
                            className="p-1.5 rounded-lg bg-surface hover:bg-surface-container border border-border-subtle text-primary transition-colors cursor-pointer"
                            title="Buka Detail 4 Kegiatan & Bukti Foto"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Tombol Cetak PDF Single */}
                          <button
                            type="button"
                            disabled={downloadingPdfId === report.id}
                            onClick={() => handleDownloadSinglePdf(report)}
                            className="p-1.5 rounded-lg bg-surface hover:bg-surface-container border border-border-subtle text-rose-600 transition-colors cursor-pointer disabled:opacity-50"
                            title="Cetak Lembar Laporan Kerja (PDF)"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Tombol Review */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenReview(report)}
                            className="text-[11.5px] h-7.5 px-2.5 cursor-pointer"
                          >
                            Evaluasi
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* MODE KARTU GRID: Tampilan Visual 4 Kolom Penuh */
        <div className="space-y-4">
          {reports.map((report) => {
            const isApproved = report.status === 'approved';
            const isRejected = report.status === 'rejected';
            const activities = getReportActivities(report);

            return (
              <div
                key={report.id}
                className="bg-surface-panel rounded-2xl border border-border-subtle p-5 shadow-xs space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-row">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold flex items-center gap-1 ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-800'
                          : isRejected
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isApproved ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Disetujui
                        </>
                      ) : isRejected ? (
                        <>
                          <XCircle className="w-3 h-3" /> Perlu Revisi
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" /> Menunggu Review
                        </>
                      )}
                    </span>
                    <h3 className="font-bold text-[15px] text-text-primary">
                      {report.user?.name || 'Karyawan'}
                    </h3>
                    <span className="text-text-muted text-[12px] font-mono">
                      (NIK: {report.nik || '-'})
                    </span>
                    <span className="text-[11.5px] px-2 py-0.5 rounded bg-surface border border-border-subtle text-text-muted">
                      {report.user?.company === 'rimamandiri' ? 'Riama Mandiri' : 'RBS Global'}
                    </span>
                    {report.user?.phone && (
                      <span className="text-[11.5px] text-text-muted font-mono">
                        WA: {report.user.phone}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[12px] text-text-muted">
                    <span className="flex items-center gap-1 font-medium mr-2">
                      <Calendar className="w-3.5 h-3.5 text-text-muted" />
                      <span>
                        {new Date(report.report_date).toLocaleDateString('id-ID', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </span>

                    <button
                      type="button"
                      disabled={downloadingPdfId === report.id}
                      onClick={() => handleDownloadSinglePdf(report)}
                      className="px-2.5 py-1.5 rounded-lg border border-border-subtle hover:bg-surface text-rose-600 text-[11.5px] font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                      title="Cetak Lembar Laporan Kerja PDF"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Cetak PDF</span>
                    </button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenReview(report)}
                      className="text-[12px] h-8 cursor-pointer"
                    >
                      Evaluasi / Review
                    </Button>
                  </div>
                </div>

                {/* 4 Kolom Kegiatan Harian */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {activities.map((act) => (
                    <div
                      key={act.key}
                      className="rounded-xl border border-border-subtle bg-surface p-3 flex flex-col justify-between space-y-2.5 hover:border-primary/30 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-[12.5px] text-text-primary">
                            {act.title}
                          </span>
                          <span
                            className={`text-[9.5px] font-semibold px-1.5 py-0.2 rounded ${
                              act.isRequired
                                ? 'bg-primary/10 text-primary'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {act.isRequired ? 'Wajib' : 'Opsional'}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-text-muted line-clamp-1">{act.subtitle}</p>
                      </div>

                      {/* Foto Bukti */}
                      <div className="pt-0.5">
                        {act.photoUrl ? (
                          <div
                            onClick={() =>
                              setPreviewAttachment({
                                url: act.photoUrl!,
                                title: `${report.user?.name || 'Karyawan'} - ${act.title}`,
                                subtitle: `${new Date(report.report_date).toLocaleDateString('id-ID')} (${act.subtitle})`,
                                isPdf: false,
                              })
                            }
                            className="relative rounded-lg overflow-hidden border border-border-subtle bg-slate-950/5 group h-32 cursor-pointer shadow-2xs"
                          >
                            <img
                              src={act.photoUrl}
                              alt={act.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  const errNotice = document.createElement('div');
                                  errNotice.className =
                                    'h-full flex items-center justify-center text-[10.5px] text-rose-500 font-medium p-2 text-center';
                                  errNotice.innerText = 'Gagal memuat foto';
                                  parent.appendChild(errNotice);
                                }
                              }}
                            />
                            <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-[11px] font-medium backdrop-blur-2xs">
                              <Eye className="w-3.5 h-3.5" />
                              <span>Lihat Foto</span>
                            </div>
                          </div>
                        ) : (
                          <div className="h-32 rounded-lg border border-dashed border-border-subtle bg-surface-container/20 flex flex-col items-center justify-center text-text-muted text-[11px] p-2 text-center">
                            <ImageIcon className="w-5 h-5 mb-1 opacity-40" />
                            <span>Tanpa Foto Bukti</span>
                          </div>
                        )}
                      </div>

                      {/* Rincian Laporan */}
                      <div className="bg-surface-panel p-2.5 rounded-lg border border-border-subtle min-h-[55px] flex flex-col justify-start">
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-0.5">
                          Rincian:
                        </span>
                        <p className="text-[11.5px] text-text-primary leading-relaxed whitespace-pre-line line-clamp-3 hover:line-clamp-none transition-all">
                          {act.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Feedback Review dari Admin */}
                {report.feedback && (
                  <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-[12px] space-y-1">
                    <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Feedback untuk Karyawan:
                    </div>
                    <div className="text-amber-800 leading-relaxed pl-5">{report.feedback}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Detail Lengkap 4 Kolom (Saat Klik Baris di Mode Tabel) */}
      {detailReport && (
        <Modal
          isOpen={!!detailReport}
          onClose={() => setDetailReport(null)}
          title={`Detail Laporan Kerja: ${detailReport.user?.name || 'Karyawan'}`}
          description={`NIK: ${detailReport.nik || '-'} • Tanggal: ${new Date(detailReport.report_date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
          maxWidth="4xl"
        >
          <div className="space-y-5">
            {/* 4 Kolom Kegiatan Detail */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {getReportActivities(detailReport).map((act) => (
                <div
                  key={act.key}
                  className="rounded-xl border border-border-subtle bg-surface p-3.5 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[13px] text-text-primary">{act.title}</span>
                      <span
                        className={`text-[9.5px] font-semibold px-2 py-0.5 rounded ${
                          act.isRequired ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {act.isRequired ? 'Wajib' : 'Opsional'}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted">{act.subtitle}</p>
                  </div>

                  {/* Foto Detail Box */}
                  <div>
                    {act.photoUrl ? (
                      <div
                        onClick={() =>
                          setPreviewAttachment({
                            url: act.photoUrl!,
                            title: `${detailReport.user?.name || 'Karyawan'} - ${act.title}`,
                            subtitle: `${new Date(detailReport.report_date).toLocaleDateString('id-ID')} (${act.subtitle})`,
                            isPdf: false,
                          })
                        }
                        className="relative rounded-lg overflow-hidden border border-border-subtle bg-slate-950/5 group h-36 cursor-pointer shadow-2xs"
                      >
                        <img
                          src={act.photoUrl}
                          alt={act.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-[11px] font-medium backdrop-blur-2xs">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Perbesar Foto</span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-36 rounded-lg border border-dashed border-border-subtle bg-surface-container/20 flex flex-col items-center justify-center text-text-muted text-[11.5px] p-2 text-center">
                        <ImageIcon className="w-6 h-6 mb-1 opacity-40" />
                        <span>Tanpa Foto Bukti</span>
                      </div>
                    )}
                  </div>

                  {/* Rincian Teks */}
                  <div className="bg-surface-panel p-3 rounded-lg border border-border-subtle min-h-[70px]">
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                      Rincian Laporan:
                    </span>
                    <p className="text-[12px] text-text-primary leading-relaxed whitespace-pre-line">
                      {act.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Evaluasi Info */}
            {detailReport.feedback && (
              <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-[12.5px] space-y-1">
                <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Catatan Evaluasi HR:
                </div>
                <div className="text-amber-800 leading-relaxed pl-5">{detailReport.feedback}</div>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="pt-3 border-t border-border-row flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                disabled={downloadingPdfId === detailReport.id}
                onClick={() => handleDownloadSinglePdf(detailReport)}
                className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-rose-600" />
                <span>Cetak Lembar Laporan (PDF)</span>
              </button>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setDetailReport(null)}>
                  Tutup
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    handleOpenReview(detailReport);
                  }}
                >
                  Evaluasi / Ubah Status
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Review Modal Form */}
      {reviewingReport && (
        <Modal
          isOpen={!!reviewingReport}
          onClose={() => setReviewingReport(null)}
          title={`Evaluasi Laporan Kerja: ${reviewingReport.user?.name || 'Karyawan'}`}
          description={`NIK: ${reviewingReport.nik || '-'} • Tanggal: ${new Date(reviewingReport.report_date).toLocaleDateString('id-ID')}`}
        >
          <form onSubmit={handleSaveReview} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-text-primary mb-1">
                Keputusan Status *
              </label>
              <select
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl border border-border-subtle bg-surface text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="approved">Disetujui (Approved)</option>
                <option value="pending">Menunggu Konfirmasi (Pending)</option>
                <option value="rejected">Perlu Revisi (Rejected)</option>
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-text-primary mb-1">
                Catatan / Feedback untuk Karyawan (Opsional)
              </label>
              <textarea
                rows={3}
                placeholder="Tuliskan arahan atau catatan evaluasi untuk staf..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full p-3 rounded-xl border border-border-subtle bg-surface text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>

            <div className="pt-3 border-t border-border-row flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setReviewingReport(null)}>
                Batal
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Menyimpan...' : 'Simpan Evaluasi'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Preview Attachment Modal (Lightbox Full Resolution) */}
      {previewAttachment && (
        <Modal
          isOpen={!!previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          title={`Pratinjau Foto: ${previewAttachment.title}`}
          description={previewAttachment.subtitle}
          maxWidth="3xl"
        >
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-border-subtle bg-slate-950/5 flex items-center justify-center p-2 min-h-[300px] max-h-[68vh]">
              <img
                src={previewAttachment.url}
                alt={previewAttachment.title}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-sm"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const errNotice = document.createElement('div');
                    errNotice.className = 'text-center p-6 text-[13px] text-rose-500 font-medium';
                    errNotice.innerText = 'Foto tidak dapat dimuat atau belum tersinkronisasi di server.';
                    parent.appendChild(errNotice);
                  }
                }}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border-row">
              <span className="text-[12px] text-text-muted truncate max-w-sm">
                {previewAttachment.title}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreviewAttachment(null)}>
                  Tutup
                </Button>
                <a
                  href={previewAttachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-white text-[12px] font-semibold hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Ukuran Penuh / Unduh</span>
                </a>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
