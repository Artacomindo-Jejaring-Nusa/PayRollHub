import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
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
} from 'lucide-react';

export const PayrollListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

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
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Restricted export modal state for user
  const [isExportRestrictedModalOpen, setIsExportRestrictedModalOpen] = useState(false);

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
  }, [search, selectedProvince, selectedPosition, selectedPeriod, page, perPage]);

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
            Data operasional resmi Sekolah Rakyat RBS Global (PT. Rimbun Buana Sejahtera).
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
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <form
            onSubmit={handleSearchSubmit}
            className="md:col-span-4 relative flex items-center"
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

          {/* Province / Wilayah Filter */}
          <div className="md:col-span-3 relative flex items-center">
            <Filter className="w-4 h-4 text-text-muted absolute left-3 pointer-events-none" />
            <select
              value={selectedProvince}
              onChange={(e) => {
                setSelectedProvince(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 pl-9 pr-8 bg-surface-panel rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px] appearance-none"
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
              className="w-full h-10 pl-9 pr-8 bg-surface-panel rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px] appearance-none"
            >
              <option value="">Semua Jabatan</option>
              {positionOptions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>

          {/* Period Filter */}
          <div className="md:col-span-2 relative flex items-center">
            <Calendar className="w-4 h-4 text-text-muted absolute left-3 pointer-events-none" />
            <select
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 pl-9 pr-8 bg-surface-panel rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px] appearance-none"
            >
              <option value="">Semua Periode</option>
              {periodOptions.map((per) => (
                <option key={per} value={per}>
                  Periode: {per}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Button */}
          <div className="md:col-span-1 flex items-center">
            <button
              onClick={() => {
                setSearch('');
                setSelectedProvince('');
                setSelectedPosition('');
                setSelectedPeriod('');
                setPage(1);
              }}
              className="w-full h-10 flex items-center justify-center rounded-lg border border-border-subtle hover:bg-surface-container text-text-muted hover:text-text-primary transition-colors"
              title="Reset Filter"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Payroll Table (Matching Exact contoh(1).xlsx Columns) */}
      <div className="bg-surface-panel rounded-xl border border-border-subtle shadow-sm overflow-hidden">
        {/* Subtle horizontal scroll tip for smaller screens */}
        <div className="px-4 py-2 bg-slate-50/70 border-b border-border-subtle flex items-center justify-between text-[11px] text-text-muted">
          <span>
            {isAdmin
              ? 'Format data lengkap: Wilayah, Sekolah Rakyat, NIK, Nama, Jabatan, Tgl Masuk, Gaji, Rekening Bank, dan Aksi'
              : 'Format data lengkap: Wilayah, Sekolah Rakyat, NIK, Nama, Jabatan, Tgl Masuk, dan Aksi'}
          </span>
          <span className="hidden sm:inline-block text-slate-400">Geser tabel ke samping untuk melihat seluruh kolom →</span>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className={`w-full ${isAdmin ? 'min-w-[1440px]' : 'min-w-[1050px]'} text-left border-collapse`}>
            <thead>
              <tr className="bg-surface-container-low border-b border-border-subtle text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                <th className="py-3.5 px-3 text-center w-14">No</th>
                <th className="py-3.5 px-3 min-w-[130px] whitespace-nowrap">Wilayah</th>
                <th className="py-3.5 px-3 min-w-[240px]">Sekolah Rakyat Permanen</th>
                <th className="py-3.5 px-3 min-w-[140px] whitespace-nowrap">NIK</th>
                <th className="py-3.5 px-3 min-w-[180px] whitespace-nowrap">Nama Lengkap</th>
                <th className="py-3.5 px-3 min-w-[150px] whitespace-nowrap">Fungsi / Jabatan</th>
                <th className="py-3.5 px-3 min-w-[130px] whitespace-nowrap">Tgl Masuk</th>
                {isAdmin && (
                  <th className="py-3.5 px-3 text-right min-w-[140px] whitespace-nowrap font-bold text-primary">
                    Gaji
                  </th>
                )}
                {isAdmin && (
                  <th className="py-3.5 px-3 min-w-[180px] whitespace-nowrap">No Rekening & Bank</th>
                )}
                <th className="py-3.5 px-3 text-center min-w-[130px] whitespace-nowrap">
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
                    {isAdmin && (
                      <td className="py-3.5 px-3 text-right">
                        <Skeleton className="h-6 w-24 ml-auto rounded" />
                      </td>
                    )}
                    {isAdmin && (
                      <td className="py-3.5 px-3">
                        <Skeleton className="h-4 w-28 rounded" />
                      </td>
                    )}
                    <td className="py-3.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Skeleton className="h-7 w-16 rounded" />
                        {isAdmin && <Skeleton className="h-7 w-12 rounded" />}
                      </div>
                    </td>
                  </tr>
                ))
              ) : payrolls.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 8} className="py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 text-slate-300" />
                      <span className="font-medium text-text-primary">
                        Tidak ada data yang ditemukan.
                      </span>
                      <span className="text-[12px]">
                        Coba sesuaikan kata kunci pencarian atau filter wilayah/jabatan.
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
                          className="font-medium text-text-primary text-[12.5px] max-w-[260px] truncate"
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

                      {/* Gaji - Admin only */}
                      {isAdmin && (
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span className="inline-flex items-center font-mono font-bold text-[13px] text-primary bg-blue-50/80 border border-blue-200/70 px-2.5 py-1 rounded-md tracking-tight shadow-2xs">
                            {item.formatted_take_home_pay}
                          </span>
                        </td>
                      )}

                      {/* No Rekening & Bank - Admin only */}
                      {isAdmin && (
                        <td className="py-3 px-3 text-[12px] whitespace-nowrap">
                          <div className="font-semibold text-text-primary">
                            {item.bank_name || '-'}
                          </div>
                          <div className="font-mono text-[11px] text-text-muted">
                            {item.bank_account || '-'}
                          </div>
                        </td>
                      )}

                      {/* Aksi - Clean Right Column with Prominent VIEW button */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div
                          className="flex items-center justify-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Dedicated View Action Button */}
                          <button
                            onClick={() => navigate(`/payrolls/${item.id}`)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11.5px] font-semibold bg-primary text-white hover:bg-primary-hover shadow-2xs transition-all active:scale-95 cursor-pointer"
                            title={isAdmin ? 'Lihat Detail & Slip Gaji' : 'Lihat Detail Karyawan'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

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
