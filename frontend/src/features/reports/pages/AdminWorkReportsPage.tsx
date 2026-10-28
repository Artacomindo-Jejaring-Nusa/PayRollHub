import React, { useEffect, useState } from 'react';
import { workReportService } from '../services/workReportService';
import { WorkReport } from '../../../types/auth';
import { Pagination } from '../../../components/shared/Pagination';
import { PayrollPaginationMeta } from '../../../types/payroll';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { getStorageUrl } from '../../../lib/utils';
import { useTenantTheme } from '../../../lib/theme';
import { SP_PERIOD_LIST, usePeriodOptions } from '../../../lib/period';
import {
  ClipboardList,
  Search,
  Calendar,
  Image as ImageIcon,
  CheckCircle2,
  CheckCheck,
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
  Sparkles,
  X,
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
  const { tenant, tenantId } = useTenantTheme();
  const isRima = tenantId === 'rimamandiri';

  const [reports, setReports] = useState<WorkReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSp, setSelectedSp] = useState<string>('all');
  const { periodOptions } = usePeriodOptions();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [meta, setMeta] = useState<PayrollPaginationMeta>({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
    from: 0,
    to: 0,
  });

  // View Mode: 'table' (default for 2000+ employees) or 'cards'
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Export Loading States
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState<number | null>(null);

  // Bulk Approve States
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [isBulkApproveModalOpen, setIsBulkApproveModalOpen] = useState(false);
  const [isApproveSelectedOnly, setIsApproveSelectedOnly] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState('Disetujui');

  // Selected Report IDs for Checklist Selection
  const [selectedReportIds, setSelectedReportIds] = useState<number[]>([]);

  const handleToggleSelectReport = (id: number) => {
    setSelectedReportIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const pageIds = reports.map((r) => r.id);
    const isAllSelected = pageIds.length > 0 && pageIds.every((id) => selectedReportIds.includes(id));
    if (isAllSelected) {
      setSelectedReportIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedReportIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleClearSelectedReports = () => {
    setSelectedReportIds([]);
  };

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

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset selected reports when filters or page change
  useEffect(() => {
    setSelectedReportIds([]);
  }, [page, perPage, statusFilter, dateFilter, startDate, endDate, selectedSp, debouncedSearch]);

  // Quick Presets untuk Rentang Tanggal (Hari Ini, Bulan Ini, Tutup Absen 21-20, Semua)
  const handleSetDatePreset = (preset: 'today' | 'this_month' | 'tutup_absen' | 'all') => {
    const now = new Date();
    const toYmd = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'today') {
      const todayStr = toYmd(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
      setDateFilter('');
    } else if (preset === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toYmd(startOfMonth));
      setEndDate(toYmd(now));
      setDateFilter('');
    } else if (preset === 'tutup_absen') {
      let startCutoff: Date;
      let endCutoff: Date;
      if (now.getDate() >= 21) {
        startCutoff = new Date(now.getFullYear(), now.getMonth(), 21);
        endCutoff = new Date(now.getFullYear(), now.getMonth() + 1, 20);
      } else {
        startCutoff = new Date(now.getFullYear(), now.getMonth() - 1, 21);
        endCutoff = new Date(now.getFullYear(), now.getMonth(), 20);
      }
      setStartDate(toYmd(startCutoff));
      setEndDate(toYmd(endCutoff));
      setDateFilter('');
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      setDateFilter('');
    }
    setPage(1);
  };

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await workReportService.getAdminWorkReports({
        page,
        per_page: perPage,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        date: dateFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        sp_period: selectedSp !== 'all' ? selectedSp : undefined,
        search: debouncedSearch.trim() || undefined,
      });
      setReports(res.data);
      if (res.meta) {
        setMeta(res.meta);
      }
    } catch (err) {
      console.error('Failed to load work reports', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [page, perPage, statusFilter, dateFilter, startDate, endDate, selectedSp, debouncedSearch]);

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      await workReportService.exportReports(
        {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          date: dateFilter || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          sp_period: selectedSp !== 'all' ? selectedSp : undefined,
          search: search.trim() || undefined,
          ids: selectedReportIds.length > 0 ? selectedReportIds : undefined,
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
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          sp_period: selectedSp !== 'all' ? selectedSp : undefined,
          search: search.trim() || undefined,
          ids: selectedReportIds.length > 0 ? selectedReportIds : undefined,
        },
        'pdf'
      );
    } catch (err) {
      alert('Gagal mengekspor rekap laporan ke PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExecuteBulkApprove = async () => {
    setIsBulkApproving(true);
    try {
      const payload: any = {
        feedback: bulkFeedback.trim() || 'Disetujui oleh admin',
      };

      if (isApproveSelectedOnly) {
        payload.ids = selectedReportIds;
      } else {
        payload.sp_period = selectedSp !== 'all' ? selectedSp : undefined;
        payload.status = statusFilter !== 'all' ? statusFilter : 'pending';
        payload.date = dateFilter || undefined;
        payload.start_date = startDate || undefined;
        payload.end_date = endDate || undefined;
        payload.search = debouncedSearch.trim() || undefined;
      }

      const res = await workReportService.bulkApproveReports(payload);
      alert(res.message || 'Laporan kerja berhasil disetujui.');
      setIsBulkApproveModalOpen(false);
      setSelectedReportIds([]);
      fetchReports();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyetujui laporan kerja.');
    } finally {
      setIsBulkApproving(false);
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
            {isRima ? 'Laporan Kegiatan Karyawan' : 'Laporan Kerja Karyawan'}
          </h1>
          <p className="font-body-default text-body-default text-text-muted mt-1">
            {isRima
              ? 'Kelola rekap 4 aktivitas kegiatan harian unit sekolah, evaluasi bukti foto kegiatan, dan ekspor data laporan'
              : 'Kelola rekap 4 aktivitas harian, evaluasi bukti foto kerja, dan ekspor data laporan'}
          </p>
        </div>

        {/* Action Buttons: Terima Semua Laporan, Export Excel, Cetak PDF, View Mode */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setIsApproveSelectedOnly(false);
              setBulkFeedback('Disetujui');
              setIsBulkApproveModalOpen(true);
            }}
            disabled={isBulkApproving}
            className="px-3.5 py-2 rounded-xl text-white text-[12.5px] font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
            title="Setujui seluruh laporan berstatus Menunggu (Pending) sesuai filter saat ini tanpa harus ceklis satu per satu"
          >
            <CheckCheck className="w-4 h-4" />
            <span>{isBulkApproving ? 'Memproses...' : 'Terima Semua Laporan'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className={`px-3.5 py-2 rounded-xl text-white text-[12.5px] font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50 ${
              selectedReportIds.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-400'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>
              {isExportingExcel
                ? 'Mengekspor...'
                : selectedReportIds.length > 0
                ? `Export Excel (${selectedReportIds.length} Terpilih)`
                : 'Export Excel'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className={`px-3.5 py-2 rounded-xl text-white text-[12.5px] font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50 ${
              selectedReportIds.length > 0
                ? 'bg-rose-600 hover:bg-rose-700 ring-2 ring-rose-400'
                : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>
              {isExportingPdf
                ? 'Mencetak...'
                : selectedReportIds.length > 0
                ? `Cetak PDF (${selectedReportIds.length} Terpilih)`
                : 'Cetak Rekap PDF'}
            </span>
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
          {/* Surat Pesanan (SP 1 - 12) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-muted font-medium">Surat Pesanan:</span>
            <select
              value={selectedSp}
              onChange={(e) => {
                setSelectedSp(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-border-subtle bg-surface text-[12.5px] text-text-primary font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="all">Semua Periode SP</option>
              {periodOptions.map((sp) => (
                <option key={sp.code} value={sp.code}>
                  {sp.fullLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-border-subtle bg-surface text-[12.5px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu Review</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Perlu Revisi</option>
          </select>

          {/* Rentang Tanggal (Dari Kapan Sampai Kapan) */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-surface-container/60 rounded-xl border border-border-subtle">
            <div className="flex items-center gap-1 pl-1 text-xs text-text-muted font-medium">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Rentang:</span>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                const newStart = e.target.value;
                setStartDate(newStart);
                if (endDate && newStart > endDate) setEndDate(newStart);
                setDateFilter('');
                setPage(1);
              }}
              className="px-2.5 py-1 text-xs bg-surface border border-border-subtle rounded-lg text-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs"
              title="Dari Tanggal (Mulai)"
            />
            <span className="text-xs text-text-muted font-semibold">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                const newEnd = e.target.value;
                setEndDate(newEnd);
                if (startDate && newEnd < startDate) setStartDate(newEnd);
                setDateFilter('');
                setPage(1);
              }}
              className="px-2.5 py-1 text-xs bg-surface border border-border-subtle rounded-lg text-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs"
              title="Sampai Tanggal (Selesai)"
            />

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1 pl-1">
              <button
                type="button"
                onClick={() => handleSetDatePreset('today')}
                className={`text-[10.5px] font-semibold px-2 py-1 rounded-md transition-all cursor-pointer ${
                  startDate === new Date().toISOString().split('T')[0] && endDate === new Date().toISOString().split('T')[0]
                    ? 'bg-primary text-white shadow-2xs font-bold'
                    : 'bg-surface hover:bg-surface-container text-text-muted hover:text-text-primary border border-border-subtle'
                }`}
                title="Setel ke Tanggal Hari Ini"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => handleSetDatePreset('this_month')}
                className="text-[10.5px] font-semibold px-2 py-1 rounded-md bg-surface hover:bg-surface-container text-text-muted hover:text-text-primary border border-border-subtle transition-all cursor-pointer"
                title="Setel ke Bulan Berjalan (Tgl 1 s/d Hari ini)"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => handleSetDatePreset('tutup_absen')}
                className="text-[10.5px] font-bold px-2 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700/40 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                title="Setel Rentang Periode Tutup Absen (Tgl 21 s/d 20)"
              >
                <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Tutup Absen (21-20)</span>
              </button>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('all')}
                  className="text-[10.5px] font-medium px-1.5 py-1 rounded-md text-text-muted hover:text-rose-500 transition-all cursor-pointer"
                  title="Reset rentang tanggal (tampilkan semua)"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama, NIK, atau tugas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setDebouncedSearch(search);
                setPage(1);
              }
            }}
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
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={reports.length > 0 && reports.every((r) => selectedReportIds.includes(r.id))}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded border-border-subtle text-primary focus:ring-primary cursor-pointer accent-primary"
                      title="Pilih Semua Laporan pada Halaman Ini"
                    />
                  </th>
                  <th className="py-3 px-3 w-12 text-center">No</th>
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
                  const isSelected = selectedReportIds.includes(report.id);
                  const activities = getReportActivities(report);

                  return (
                    <tr
                      key={report.id}
                      className={`hover:bg-surface-container/30 transition-colors ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectReport(report.id)}
                          className="w-4 h-4 rounded border-border-subtle text-primary focus:ring-primary cursor-pointer accent-primary"
                          title={`Pilih laporan ${report.user?.name || 'karyawan'}`}
                        />
                      </td>

                      {/* No */}
                      <td className="py-3 px-3 text-center text-text-muted font-mono text-[11.5px]">
                        {(meta.from || 1) + idx}
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

          {/* Pagination Footer */}
          <Pagination
            meta={meta}
            onPageChange={(p) => setPage(p)}
            perPage={perPage}
            onPerPageChange={(newPerPage) => {
              setPerPage(newPerPage);
              setPage(1);
            }}
            isLoading={isLoading}
          />
        </div>
      ) : (
        /* MODE KARTU GRID: Tampilan Visual 4 Kolom Penuh */
        <div className="space-y-4">
          {reports.map((report) => {
            const isApproved = report.status === 'approved';
            const isRejected = report.status === 'rejected';
            const isSelected = selectedReportIds.includes(report.id);
            const activities = getReportActivities(report);

            return (
              <div
                key={report.id}
                className={`bg-surface-panel rounded-2xl border p-5 shadow-xs space-y-4 transition-all ${
                  isSelected ? 'border-primary ring-1 ring-primary/30 bg-primary/5' : 'border-border-subtle'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-row">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectReport(report.id)}
                      className="w-4 h-4 rounded border-border-subtle text-primary focus:ring-primary cursor-pointer accent-primary mr-1"
                      title={`Pilih laporan ${report.user?.name || 'karyawan'}`}
                    />
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

          {/* Pagination for Card Mode */}
          <div className="bg-surface-panel rounded-2xl border border-border-subtle shadow-xs overflow-hidden">
            <Pagination
              meta={meta}
              onPageChange={(p) => setPage(p)}
              perPage={perPage}
              onPerPageChange={(newPerPage) => {
                setPerPage(newPerPage);
                setPage(1);
              }}
              isLoading={isLoading}
            />
          </div>
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

      {/* Floating Action Bar Saat Laporan Dipilih */}
      {selectedReportIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface-panel/95 backdrop-blur-md border border-primary/40 shadow-xl rounded-2xl px-5 py-3 flex flex-wrap items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-text-primary">
              {selectedReportIds.length} Laporan Kerja Dipilih
            </span>
            {startDate && endDate ? (
              <span className="text-[11px] text-text-muted hidden sm:inline">
                ({startDate} s/d {endDate})
              </span>
            ) : dateFilter ? (
              <span className="text-[11px] text-text-muted hidden sm:inline">
                (Tanggal {dateFilter})
              </span>
            ) : null}
          </div>
          <div className="h-4 w-px bg-border-subtle hidden sm:block" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsApproveSelectedOnly(true);
                setBulkFeedback('Disetujui');
                setIsBulkApproveModalOpen(true);
              }}
              disabled={isBulkApproving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Setujui laporan kerja yang dipilih"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>{isBulkApproving ? 'Memproses...' : `Terima (${selectedReportIds.length}) Laporan`}</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Export laporan yang dipilih ke Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isExportingExcel ? 'Mengekspor...' : `Export Excel (${selectedReportIds.length})`}</span>
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Cetak rekap laporan yang dipilih ke PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Mencetak...' : `Cetak PDF (${selectedReportIds.length})`}</span>
            </button>
            <button
              type="button"
              onClick={handleClearSelectedReports}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-container rounded-lg transition-all cursor-pointer ml-1"
              title="Batalkan Pilihan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Bulk Approve (Terima Semua / Terima Terpilih) */}
      <Modal
        isOpen={isBulkApproveModalOpen}
        onClose={() => !isBulkApproving && setIsBulkApproveModalOpen(false)}
        title={isApproveSelectedOnly ? 'Konfirmasi Setujui Laporan Terpilih' : 'Konfirmasi Terima Semua Laporan'}
        description="Persetujuan laporan kerja massal secara otomatis"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-teal-500/10 border border-teal-500/20 rounded-xl text-[12.5px] text-teal-800 dark:text-teal-200 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-text-primary">
                {isApproveSelectedOnly
                  ? `Anda akan menyetujui ${selectedReportIds.length} laporan kerja yang telah dipilih.`
                  : 'Anda akan menyetujui seluruh laporan berstatus Menunggu (Pending) sesuai filter aktif:'}
              </p>
              {!isApproveSelectedOnly && (
                <ul className="text-[12px] list-disc list-inside space-y-0.5 text-text-muted">
                  <li>
                    Periode Surat Pesanan: <strong className="text-text-primary">{selectedSp !== 'all' ? selectedSp : 'Semua SP (1-12)'}</strong>
                  </li>
                  {dateFilter && (
                    <li>
                      Tanggal: <strong className="text-text-primary">{dateFilter}</strong>
                    </li>
                  )}
                  {debouncedSearch && (
                    <li>
                      Pencarian: <strong className="text-text-primary">"{debouncedSearch}"</strong>
                    </li>
                  )}
                </ul>
              )}
              <p className="text-[11.5px] text-text-muted mt-1">
                Status laporan akan berubah menjadi <span className="font-semibold text-emerald-600">Disetujui</span> dan notifikasi dikirimkan ke ponsel karyawan terkait.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Catatan / Evaluasi Persetujuan (Opsional):
            </label>
            <textarea
              value={bulkFeedback}
              onChange={(e) => setBulkFeedback(e.target.value)}
              rows={3}
              placeholder="Contoh: Disetujui, pekerjaan harian telah selesai dengan baik."
              className="w-full px-3 py-2 text-xs bg-surface border border-border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-text-primary"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border-row">
            <Button
              variant="outline"
              onClick={() => setIsBulkApproveModalOpen(false)}
              disabled={isBulkApproving}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleExecuteBulkApprove}
              disabled={isBulkApproving}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              <CheckCheck className="w-4 h-4 mr-1.5" />
              <span>{isBulkApproving ? 'Menyetujui...' : 'Ya, Setujui Sekarang'}</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
