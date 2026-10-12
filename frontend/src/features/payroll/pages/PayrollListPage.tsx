import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { useTenantTheme } from '../../../lib/theme';
import { payrollService } from '../services/payrollService';
import {
  PayrollItem,
  PayrollPaginationMeta,
} from '../../../types/payroll';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Modal } from '../../../components/ui/Modal';
import { Pagination } from '../../../components/shared/Pagination';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { SP_PERIOD_LIST, MONTH_PERIOD_OPTIONS, formatPeriodDisplay } from '../../../lib/period';
import {
  Search,
  Filter,
  Plus,
  Upload,
  FileSpreadsheet,
  FileText,
  Eye,
  Pencil,
  Trash2,
  Calendar,
  Briefcase,
  RefreshCw,
  Loader2,
  Download,
  Lock,
  UserX,
  UserCheck,
} from 'lucide-react';

export const PayrollListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { tenant } = useTenantTheme();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // State
  const [payrolls, setPayrolls] = useState<PayrollItem[]>([]);
  const [meta, setMeta] = useState<PayrollPaginationMeta>({
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
    from: 0,
    to: 0,
  });
  const [provinceOptions, setProvinceOptions] = useState<string[]>([]);
  const [positionOptions, setPositionOptions] = useState<string[]>([]);
  const [periodOptions, setPeriodOptions] = useState<string[]>([]);

  // Filter, Search & Pagination states
  const [search, setSearch] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [startPeriod, setStartPeriod] = useState('');
  const [endPeriod, setEndPeriod] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Restricted export modal state for user
  const [isExportRestrictedModalOpen, setIsExportRestrictedModalOpen] = useState(false);

  // Status Change Modal (Turn Off / Re-activate)
  const [statusTarget, setStatusTarget] = useState<PayrollItem | null>(null);
  const [targetStatusAction, setTargetStatusAction] = useState<'off' | 'active'>('off');
  const [resignDateInput, setResignDateInput] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<PayrollItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  // Load data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await payrollService.getPayrolls({
        search: search.trim(),
        province: selectedProvince,
        position: selectedPosition,
        period: selectedPeriod,
        start_period: startPeriod || undefined,
        end_period: endPeriod || undefined,
        status: selectedStatus,
        company: tenant.id,
        page,
        per_page: perPage,
        sort_by: 'id',
        sort_order: 'asc',
      });

      setPayrolls(response.data);
      setMeta(response.meta);
      if (response.filters?.provinces?.length) {
        setProvinceOptions(response.filters.provinces);
      }
      if (response.filters?.positions?.length) {
        setPositionOptions(response.filters.positions);
      }
      if (response.filters?.periods?.length) {
        setPeriodOptions(response.filters.periods);
      }
    } catch (err) {
      console.error('Failed to load payrolls:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedProvince, selectedPosition, selectedPeriod, startPeriod, endPeriod, selectedStatus, page, perPage, tenant.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const handleExport = async (format: 'xlsx' | 'csv' | 'pdf') => {
    if (!isAdmin) {
      setIsExportRestrictedModalOpen(true);
      return;
    }

    setIsExporting(format);
    try {
      await payrollService.exportFile(format, {
        search,
        province: selectedProvince,
        position: selectedPosition,
        period: selectedPeriod,
        status: selectedStatus,
      });
    } catch (err) {
      alert('Gagal mengekspor data: ' + err);
    } finally {
      setIsExporting(null);
    }
  };

  const handleDownloadSlip = async (e: React.MouseEvent, item: PayrollItem) => {
    e.stopPropagation();
    try {
      await payrollService.downloadSlipPdf(item.id, item.employee_name, item.period);
    } catch (err) {
      alert('Gagal mengunduh slip gaji: ' + err);
    }
  };

  const handleOpenStatusModal = (
    e: React.MouseEvent,
    item: PayrollItem,
    action: 'off' | 'active'
  ) => {
    e.stopPropagation();
    setStatusTarget(item);
    setTargetStatusAction(action);
    setResignDateInput(item.resign_date || new Date().toISOString().split('T')[0]);
  };

  const handleConfirmStatusChange = async () => {
    if (!statusTarget) return;
    setIsUpdatingStatus(true);
    try {
      await payrollService.updateStatus(
        statusTarget.id,
        targetStatusAction,
        targetStatusAction === 'off' ? resignDateInput : undefined
      );
      setStatusTarget(null);
      fetchData();
    } catch (err) {
      alert('Gagal memperbarui status karyawan: ' + err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await payrollService.deletePayroll(deleteTarget.id);
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      alert('Gagal menghapus data: ' + err);
    } finally {
      setIsDeleting(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* Page Title & Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-page text-headline-page text-text-primary tracking-tight">
            Data Penggajian Karyawan & Tenaga Kependidikan
          </h1>
          <p className="font-body-default text-body-default text-text-muted mt-1">
            Data operasional resmi Sekolah Rakyat {tenant.shortName} ({tenant.companyLegalName}).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Export Dropdown Group */}
          <div className="flex items-center rounded-lg border border-border-subtle bg-surface-panel p-0.5 shadow-sm">
            <button
              onClick={() => handleExport('xlsx')}
              disabled={!!isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-text-primary hover:bg-surface-container rounded-md transition-colors disabled:opacity-50"
              title="Export ke Excel (.xlsx)"
            >
              {isExporting === 'xlsx' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>Excel</span>
            </button>
            <div className="w-[1px] h-4 bg-border-row" />
            <button
              onClick={() => handleExport('csv')}
              disabled={!!isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-text-primary hover:bg-surface-container rounded-md transition-colors disabled:opacity-50"
              title="Export ke CSV (.csv)"
            >
              {isExporting === 'csv' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>CSV</span>
            </button>
            <div className="w-[1px] h-4 bg-border-row" />
            <button
              onClick={() => handleExport('pdf')}
              disabled={!!isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-text-primary hover:bg-surface-container rounded-md transition-colors disabled:opacity-50"
              title="Export ke PDF (.pdf)"
            >
              {isExporting === 'pdf' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              ) : (
                <Download className="w-3.5 h-3.5 text-red-600" />
              )}
              <span>PDF</span>
            </button>
          </div>

          {/* Admin-only buttons */}
          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Upload className="w-4 h-4 text-primary" />}
                onClick={() => navigate('/payrolls/import')}
              >
                Import Excel
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => navigate('/payrolls/create')}
              >
                Tambah Data
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-panel rounded-xl border border-border-subtle p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          {/* Search Input */}
          <form
            onSubmit={handleSearchSubmit}
            className="md:col-span-3 relative flex items-center"
          >
            <Search className="w-4 h-4 text-text-muted absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder={
                isAdmin
                  ? 'Cari Nama, NIK, Sekolah, No Rekening...'
                  : 'Cari Nama, NIK, Sekolah Rakyat, Wilayah...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 bg-surface-panel rounded-lg text-body-default text-text-primary placeholder:text-text-muted border border-border-subtle outline-none focus:ring-2 focus:ring-primary focus:border-primary text-[13px]"
            />
          </form>

          {/* Status Filter */}
          <div className="md:col-span-2 relative flex items-center">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 bg-surface-panel rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px] appearance-none cursor-pointer"
            >
              <option value="">Semua Status</option>
              <option value="active">🟢 Karyawan Aktif</option>
              <option value="off">🔴 Off / Keluar</option>
            </select>
          </div>

          {/* Province / Wilayah Filter */}
          <div className="md:col-span-2 relative flex items-center">
            <Filter className="w-4 h-4 text-text-muted absolute left-3 pointer-events-none" />
            <select
              value={selectedProvince}
              onChange={(e) => {
                setSelectedProvince(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 pl-9 pr-8 bg-surface-panel rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px] appearance-none cursor-pointer"
            >
              <option value="">Semua Wilayah</option>
              {provinceOptions.map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>
          </div>

          {/* Position / Jabatan Filter */}
          <div className="md:col-span-2 relative flex items-center">
            <Briefcase className="w-4 h-4 text-text-muted absolute left-3 pointer-events-none" />
            <select
              value={selectedPosition}
              onChange={(e) => {
                setSelectedPosition(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 pl-9 pr-8 bg-surface-panel rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px] appearance-none cursor-pointer"
            >
              <option value="">Semua Jabatan</option>
              {positionOptions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>

          {/* SP / Period Filter */}
          <div className="md:col-span-2 relative flex items-center">
            <select
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 bg-surface-panel rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px] appearance-none cursor-pointer"
            >
              <option value="">Semua SP / Periode</option>
              {SP_PERIOD_LIST.map((sp) => (
                <option key={sp.code} value={sp.code}>
                  {sp.fullLabel}
                </option>
              ))}
            </select>
          </div>

              {/* Reset Button */}
              <div className="md:col-span-1 flex items-center">
                <button
                  onClick={() => {
                    setSearch('');
                    setSelectedStatus('');
                    setSelectedProvince('');
                    setSelectedPosition('');
                    setSelectedPeriod('');
                    setStartPeriod('');
                    setEndPeriod('');
                    setPage(1);
                  }}
                  className="w-full h-10 flex items-center justify-center rounded-lg border border-border-subtle hover:bg-surface-container text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                  title="Reset Filter"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sub-bar: Filter Rentang Periode (Tutup Absen Bulan ke Tahun) */}
            <div className="pt-2.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2.5 text-[12px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-text-primary flex items-center gap-1.5 shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>Rentang Periode / Tutup Absen:</span>
                </span>

                <div className="flex items-center gap-1">
                  <span className="text-text-muted text-[11px]">Dari:</span>
                  <select
                    value={startPeriod}
                    onChange={(e) => {
                      setStartPeriod(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 px-2.5 bg-surface-panel rounded-lg text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[12px] font-medium cursor-pointer"
                  >
                    <option value="">Awal (Semua)</option>
                    {MONTH_PERIOD_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-text-muted text-[11px]">Sampai:</span>
                  <select
                    value={endPeriod}
                    onChange={(e) => {
                      setEndPeriod(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 px-2.5 bg-surface-panel rounded-lg text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[12px] font-medium cursor-pointer"
                  >
                    <option value="">Akhir (Semua)</option>
                    {MONTH_PERIOD_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {(startPeriod || endPeriod) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartPeriod('');
                      setEndPeriod('');
                      setPage(1);
                    }}
                    className="text-[11px] text-rose-600 hover:text-rose-700 underline font-medium cursor-pointer ml-1"
                  >
                    Hapus Rentang
                  </button>
                )}
              </div>

              {(startPeriod || endPeriod) && (
                <div className="text-[11px] text-primary bg-primary/10 px-2.5 py-0.5 rounded-md font-semibold">
                  Rentang Aktif: {startPeriod || 'Awal'} s/d {endPeriod || 'Akhir'}
                </div>
              )}
            </div>
      </div>

      {/* Main Payroll Table */}
      <div className="bg-surface-panel rounded-xl border border-border-subtle shadow-sm overflow-hidden">
        {/* Subtle horizontal scroll tip for smaller screens */}
        <div className="px-4 py-2 bg-slate-50/70 border-b border-border-subtle flex items-center justify-between text-[11px] text-text-muted">
          <span>
            {isAdmin
              ? 'Format data lengkap: Wilayah, Sekolah Rakyat, NIK, Nama, Jabatan, Tgl Masuk, Status, Rincian Gaji & BPJS, Rekening, dan Aksi'
              : 'Format data lengkap: Wilayah, Sekolah Rakyat, NIK, Nama, Jabatan, Tgl Masuk, Status, dan Aksi'}
          </span>
          <span className="hidden sm:inline-block text-slate-400">Geser tabel ke samping untuk melihat seluruh kolom →</span>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className={`w-full ${isAdmin ? 'min-w-[1780px]' : 'min-w-[1100px]'} text-left border-collapse`}>
            <thead>
              <tr className="bg-surface-container-low border-b border-border-subtle text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                <th className="py-3.5 px-3 text-center w-12">No</th>
                <th className="py-3.5 px-3 min-w-[120px] whitespace-nowrap">Wilayah</th>
                <th className="py-3.5 px-3 min-w-[220px]">Sekolah Rakyat</th>
                <th className="py-3.5 px-3 min-w-[130px] whitespace-nowrap">NIK</th>
                <th className="py-3.5 px-3 min-w-[170px] whitespace-nowrap">Nama Lengkap</th>
                <th className="py-3.5 px-3 min-w-[140px] whitespace-nowrap">Fungsi / Jabatan</th>
                <th className="py-3.5 px-3 min-w-[110px] whitespace-nowrap">Tgl Masuk</th>
                <th className="py-3.5 px-3 min-w-[120px] whitespace-nowrap text-center">Status</th>
                {isAdmin && (
                  <>
                    <th className="py-3.5 px-3 text-right min-w-[130px] whitespace-nowrap font-medium text-slate-700">
                      Gaji Pokok
                    </th>
                    <th className="py-3.5 px-3 text-right min-w-[130px] whitespace-nowrap font-medium text-slate-700">
                      BPJS Kes & TK
                    </th>
                    <th className="py-3.5 px-3 text-right min-w-[120px] whitespace-nowrap font-medium text-rose-600">
                      Pot. Absensi
                    </th>
                    <th className="py-3.5 px-3 text-right min-w-[140px] whitespace-nowrap font-bold text-primary">
                      Gaji Bersih (THP)
                    </th>
                    <th className="py-3.5 px-3 min-w-[160px] whitespace-nowrap">No Rekening & Bank</th>
                  </>
                )}
                <th className="py-3.5 px-3 text-center min-w-[180px] whitespace-nowrap">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-row text-body-default text-[13px]">
              {isLoading ? (
                /* Skeleton Effect Rows */
                Array.from({ length: Math.min(perPage, 8) }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="py-3.5 px-3 text-center">
                      <Skeleton className="h-4 w-5 mx-auto rounded" />
                    </td>
                    <td className="py-3.5 px-3">
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </td>
                    <td className="py-3.5 px-3">
                      <Skeleton className="h-4 w-36 rounded" />
                    </td>
                    <td className="py-3.5 px-3">
                      <Skeleton className="h-4 w-24 rounded" />
                    </td>
                    <td className="py-3.5 px-3">
                      <Skeleton className="h-4 w-32 rounded" />
                    </td>
                    <td className="py-3.5 px-3">
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </td>
                    <td className="py-3.5 px-3">
                      <Skeleton className="h-4 w-20 rounded" />
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <Skeleton className="h-5 w-16 mx-auto rounded-full" />
                    </td>
                    {isAdmin && (
                      <>
                        <td className="py-3.5 px-3 text-right">
                          <Skeleton className="h-5 w-20 ml-auto rounded" />
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <Skeleton className="h-5 w-20 ml-auto rounded" />
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <Skeleton className="h-5 w-16 ml-auto rounded" />
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <Skeleton className="h-6 w-24 ml-auto rounded" />
                        </td>
                        <td className="py-3.5 px-3">
                          <Skeleton className="h-4 w-28 rounded" />
                        </td>
                      </>
                    )}
                    <td className="py-3.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Skeleton className="h-7 w-14 rounded" />
                        {isAdmin && <Skeleton className="h-7 w-12 rounded" />}
                      </div>
                    </td>
                  </tr>
                ))
              ) : payrolls.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 14 : 9} className="py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 text-slate-300" />
                      <span className="font-medium text-text-primary">
                        Tidak ada data yang ditemukan.
                      </span>
                      <span className="text-[12px]">
                        Coba sesuaikan kata kunci pencarian atau filter status/wilayah/jabatan.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                payrolls.map((item, index) => {
                  const rowNumber = (meta.current_page - 1) * meta.per_page + index + 1;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/payrolls/${item.id}`)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      {/* No - Strictly starts from 1, 2, 3... */}
                      <td className="py-3 px-3 text-center text-text-muted font-mono text-[12px] font-semibold">
                        {rowNumber}
                      </td>

                      {/* Wilayah - Single line, neat badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <Badge variant="province">{item.province}</Badge>
                      </td>

                      {/* Sekolah Rakyat Permanen */}
                      <td className="py-3 px-3">
                        <div
                          className="font-medium text-text-primary text-[12.5px] max-w-[240px] truncate"
                          title={item.school_unit || ''}
                        >
                          {item.school_unit || '-'}
                        </div>
                      </td>

                      {/* NIK */}
                      <td className="py-3 px-3 font-mono text-[11px] text-text-muted whitespace-nowrap">
                        {item.nik || <span className="italic text-slate-400">Tidak ada</span>}
                      </td>

                      {/* Nama Lengkap */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-text-primary group-hover:text-primary transition-colors text-[13px]">
                          {item.employee_name}
                        </div>
                      </td>

                      {/* Fungsi Tenaga Kependidikan */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.position ? (
                          <Badge variant="role">{item.position}</Badge>
                        ) : (
                          <span className="text-[11px] text-text-muted">-</span>
                        )}
                      </td>

                      {/* Tanggal Masuk */}
                      <td className="py-3 px-3 text-[12px] text-text-muted whitespace-nowrap">
                        {item.join_date || '-'}
                      </td>

                      {/* Status (Aktif / Off + Resign Date) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center">
                          <Badge variant={item.status === 'off' ? 'off' : 'active'} className="text-[10.5px]">
                            {item.status === 'off' ? 'Off' : 'Aktif'}
                          </Badge>
                          {item.status === 'off' && item.resign_date && (
                            <span className="text-[10px] text-rose-600 font-mono mt-0.5">
                              Keluar: {item.resign_date}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Admin Detailed Financial Columns */}
                      {isAdmin && (
                        <>
                          {/* Gaji Pokok */}
                          <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-medium text-[12.5px] text-text-primary">
                            {item.formatted_basic_salary}
                          </td>

                          {/* BPJS Kes (+) & TK (-) */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="font-mono text-[11.5px] text-emerald-700">
                              +Kes: {item.formatted_bpjs_kes || '0'}
                            </div>
                            <div className="font-mono text-[11px] text-rose-600">
                              -TK: {item.formatted_bpjs_tk || '0'}
                            </div>
                          </td>

                          {/* Potongan Absensi (multiplier x rate) */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {item.absence_deduction && Number(item.absence_deduction) > 0 ? (
                              <div>
                                <span className="font-mono font-semibold text-[12px] text-rose-600">
                                  -{item.formatted_absence_deduction}
                                </span>
                                {item.absence_count ? (
                                  <div className="text-[10px] text-text-muted">
                                    {item.absence_count}x pot.
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-text-muted text-[12px]">-</span>
                            )}
                          </td>

                          {/* Gaji Bersih (Take Home Pay) */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <span className="inline-flex items-center font-mono font-bold text-[13px] text-primary bg-blue-50/80 border border-blue-200/70 px-2.5 py-1 rounded-md tracking-tight shadow-2xs">
                              {item.formatted_take_home_pay}
                            </span>
                          </td>

                          {/* No Rekening & Bank */}
                          <td className="py-3 px-3 text-[12px] whitespace-nowrap">
                            <div className="font-semibold text-text-primary">
                              {item.bank_name || '-'}
                            </div>
                            <div className="font-mono text-[11px] text-text-muted">
                              {item.bank_account || '-'}
                            </div>
                          </td>
                        </>
                      )}

                      {/* Aksi */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div
                          className="flex items-center justify-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Dedicated View Action Button */}
                          <button
                            onClick={() => navigate(`/payrolls/${item.id}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11.5px] font-semibold bg-primary text-white hover:bg-primary-hover shadow-2xs transition-all active:scale-95 cursor-pointer"
                            title={isAdmin ? 'Lihat Detail & Slip Gaji' : 'Lihat Detail Karyawan'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

                          {/* Admin-only Button Off / Aktifkan */}
                          {isAdmin && (
                            item.status === 'off' ? (
                              <button
                                onClick={(e) => handleOpenStatusModal(e, item, 'active')}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 transition-colors cursor-pointer"
                                title="Aktifkan Kembali Karyawan"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Aktifkan</span>
                              </button>
                            ) : (
                              <button
                                onClick={(e) => handleOpenStatusModal(e, item, 'off')}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300 transition-colors cursor-pointer"
                                title="Nonaktifkan Karyawan (Set Off)"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>Off</span>
                              </button>
                            )
                          )}

                          {/* PDF Slip Download Button (Admin only) */}
                          {isAdmin && (
                            <button
                              onClick={(e) => handleDownloadSlip(e, item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11.5px] font-medium border border-border-subtle bg-surface hover:bg-emerald-50 hover:border-emerald-300 text-text-primary hover:text-emerald-700 transition-colors cursor-pointer"
                              title="Unduh Slip Gaji (PDF)"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-600" />
                              <span>PDF</span>
                            </button>
                          )}

                          {/* Admin Edit & Delete Actions */}
                          {isAdmin && (
                            <div className="flex items-center gap-1 pl-1 border-l border-border-row">
                              <button
                                onClick={() => navigate(`/payrolls/${item.id}/edit`)}
                                className="p-1.5 rounded-md text-text-muted hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                title="Ubah Data Gaji"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(item)}
                                className="p-1.5 rounded-md text-text-muted hover:text-status-danger-text hover:bg-red-50 transition-colors cursor-pointer"
                                title="Hapus Data"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Konfirmasi Hapus Data Gaji"
        message={`Apakah Anda yakin ingin menghapus catatan gaji karyawan "${deleteTarget?.employee_name}" (${deleteTarget?.school_unit || ''})? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus Data"
        isLoading={isDeleting}
      />

      {/* Status Modal (Set Off / Aktifkan) */}
      <Modal
        isOpen={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        title={targetStatusAction === 'off' ? 'Nonaktifkan Karyawan (Set Off)' : 'Aktifkan Kembali Karyawan'}
        maxWidth="sm"
      >
        <div className="space-y-4 py-1">
          <div className="p-3.5 rounded-lg bg-surface-container-low border border-border-subtle text-[13px] space-y-1">
            <div className="font-semibold text-text-primary text-[14px]">
              {statusTarget?.employee_name}
            </div>
            <div className="text-text-muted text-[12px]">
              {statusTarget?.position || '-'} • {statusTarget?.school_unit || statusTarget?.province}
            </div>
            {statusTarget?.nik && (
              <div className="text-text-muted font-mono text-[11px]">
                NIK: {statusTarget.nik}
              </div>
            )}
          </div>

          {targetStatusAction === 'off' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                  Tanggal Keluar (Resign Date) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={resignDateInput}
                  onChange={(e) => setResignDateInput(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border-subtle bg-surface text-text-primary text-[13px] outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[12px] leading-relaxed">
                Karyawan ini akan dialihkan statusnya menjadi <strong>Off (Non-Aktif)</strong>. Jumlah karyawan yang off akan tercatat otomatis di kartu KPI ringkasan dashboard admin.
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] leading-relaxed">
              Karyawan ini akan dikembalikan ke status <strong>Aktif</strong> dalam operasional dan laporan penggajian.
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-row">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusTarget(null)}
              disabled={isUpdatingStatus}
            >
              Batal
            </Button>
            <Button
              variant={targetStatusAction === 'off' ? 'danger' : 'primary'}
              size="sm"
              onClick={handleConfirmStatusChange}
              isLoading={isUpdatingStatus}
            >
              {targetStatusAction === 'off' ? 'Konfirmasi Set Off' : 'Konfirmasi Aktifkan'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Only Admin For Export */}
      <Modal
        isOpen={isExportRestrictedModalOpen}
        onClose={() => setIsExportRestrictedModalOpen(false)}
        title="Akses Dibatasi: Only Admin"
        maxWidth="sm"
      >
        <div className="space-y-4 py-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h4 className="font-title-card text-[16px] font-bold text-text-primary">
              Only Admin for Export
            </h4>
            <p className="font-body-default text-[13px] text-text-muted leading-relaxed">
              Mohon maaf, fitur ekspor rekapan data (Excel, CSV, dan PDF) hanya dapat diakses oleh akun dengan peran <strong>Administrator</strong>.
            </p>
          </div>

          <div className="pt-2">
            <Button
              variant="primary"
              size="md"
              className="w-full justify-center"
              onClick={() => setIsExportRestrictedModalOpen(false)}
            >
              Saya Mengerti
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
