import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { useTenantTheme } from '../../../lib/theme';
import { employeeService, EmployeeDashboardData } from '../services/employeeService';
import { formatCurrency } from '../../../lib/utils';
import { formatEmployeePeriod } from '../../../lib/period';
import { Card } from '../../../components/ui/Card';
import {
  Wallet,
  FileText,
  Download,
  ClipboardList,
  Plus,
  Bell,
  Clock,
  ChevronRight,
  Briefcase,
  Building2,
  CreditCard,
  Image as ImageIcon,
  Paperclip,
  MessageSquareWarning,
} from 'lucide-react';

export const EmployeeDashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { tenant } = useTenantTheme();
  const navigate = useNavigate();

  const [data, setData] = useState<EmployeeDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const res = await employeeService.getDashboard();
      setData(res);
    } catch (err) {
      console.error('Failed to load employee dashboard', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadLatestSlip = async () => {
    if (!data?.latest_payroll) return;
    setIsDownloading(true);
    try {
      await employeeService.downloadSlipPdf(
        data.latest_payroll.id,
        data.latest_payroll.employee_name,
        data.latest_payroll.period
      );
    } catch (err) {
      alert('Gagal mengunduh slip gaji. Silakan coba kembali.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-24 bg-surface-container rounded-2xl w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="h-36 bg-surface-container rounded-2xl" />
          <div className="h-36 bg-surface-container rounded-2xl" />
          <div className="h-36 bg-surface-container rounded-2xl" />
          <div className="h-36 bg-surface-container rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-96 bg-surface-container rounded-2xl" />
          <div className="h-96 bg-surface-container rounded-2xl" />
        </div>
      </div>
    );
  }

  const latest = data?.latest_payroll;
  const reportsSummary = data?.work_reports_summary || { total: 0, pending: 0, approved: 0 };
  const announcements = data?.recent_announcements || [];

  return (
    <div className="space-y-8">
      {/* ============================================================== */}
      {/* 1. SECTION HEADER (Spacious Page Title & Action Controls)      */}
      {/* ============================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-border-subtle">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="font-headline-page text-[24px] sm:text-[26px] font-bold text-text-primary tracking-tight">
              Ringkasan Karyawan
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-[11.5px] font-semibold border ${
                latest?.status === 'off'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {latest?.status === 'off' ? 'Status: Non-Aktif' : 'Status: Karyawan Aktif'}
            </span>
          </div>

          <p className="font-body-default text-[13.5px] text-text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-text-primary">{user?.name}</span>
            <span>•</span>
            <span className="font-mono">NIK: {user?.nik || latest?.nik || '-'}</span>
            {latest?.position && latest.position !== 'Staf Lapangan' && (
              <>
                <span>•</span>
                <span>{latest.position}</span>
              </>
            )}
            <span>•</span>
            <span>{latest?.school_unit || user?.school_unit || latest?.province || tenant.companyLegalName}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-shrink-0 pt-2 md:pt-0">
          <button
            type="button"
            onClick={() => navigate('/employee/complaints')}
            className="px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[13px] font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <MessageSquareWarning className="w-4 h-4 text-amber-600" />
            <span>Keluhan Saya</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/employee/reports')}
            className="px-4 py-2.5 rounded-xl bg-surface-panel hover:bg-surface-container text-text-primary border border-border-subtle text-[13px] font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span>Kirim Laporan</span>
          </button>

          {latest && (
            <button
              type="button"
              onClick={handleDownloadLatestSlip}
              disabled={isDownloading}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-[13px] font-semibold inline-flex items-center gap-2 shadow-xs transition-all whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>{isDownloading ? 'Mengunduh...' : 'Unduh Slip Gaji'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. TOP KPI METRIC CARDS (Spacious 4-Column Layout with Padding) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI 1: Take Home Pay */}
        <Card
          onClick={() => navigate('/employee/payrolls')}
          role="button"
          tabIndex={0}
          title="Klik untuk membuka riwayat slip gaji lengkap"
          className="p-6 sm:p-7 flex flex-col justify-between border-border-subtle bg-surface-panel shadow-xs hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-text-muted group-hover:text-text-primary transition-colors">
              Gaji Bersih Diterima (THP)
            </span>
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Wallet className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-[26px] sm:text-[28px] font-bold text-text-primary tracking-tight leading-none group-hover:text-primary transition-colors">
              {latest ? formatCurrency(latest.take_home_pay) : 'Rp 0'}
            </div>
            <div className="flex items-center justify-between gap-1 mt-2.5">
              <p className="text-[12px] text-text-muted truncate">
                {latest ? `Periode ${formatEmployeePeriod(latest.period)}` : 'Belum ada data'}
              </p>
              <span className="text-[11px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Buka Slip →
              </span>
            </div>
          </div>
        </Card>

        {/* KPI 2: Gaji Pokok & Tunjangan */}
        <Card
          onClick={() => navigate('/employee/payrolls')}
          role="button"
          tabIndex={0}
          title="Klik untuk melihat rincian komponen gaji di slip"
          className="p-6 sm:p-7 flex flex-col justify-between border-border-subtle bg-surface-panel shadow-xs hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-text-muted group-hover:text-text-primary transition-colors">
              Gaji Pokok Terdaftar
            </span>
            <div className="w-9 h-9 rounded-xl bg-surface-container text-text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-[26px] sm:text-[28px] font-bold text-text-primary tracking-tight leading-none group-hover:text-primary transition-colors">
              {latest ? formatCurrency(latest.basic_salary) : 'Rp 0'}
            </div>
            <div className="flex items-center justify-between gap-1 mt-2.5">
              <p className="text-[12px] text-text-muted truncate">
                Tunjangan: +{latest ? formatCurrency(latest.allowance) : 'Rp 0'}
              </p>
              <span className="text-[11px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Rincian →
              </span>
            </div>
          </div>
        </Card>

        {/* KPI 3: Total Potongan */}
        <Card
          onClick={() => navigate('/employee/payrolls')}
          role="button"
          tabIndex={0}
          title="Klik untuk melihat rincian potongan di slip"
          className="p-6 sm:p-7 flex flex-col justify-between border-border-subtle bg-surface-panel shadow-xs hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-text-muted group-hover:text-text-primary transition-colors">
              Total Potongan
            </span>
            <div className="w-9 h-9 rounded-xl bg-surface-container text-text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Clock className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-[26px] sm:text-[28px] font-bold text-text-primary tracking-tight leading-none group-hover:text-rose-600 transition-colors">
              {latest ? formatCurrency(latest.deduction) : 'Rp 0'}
            </div>
            <div className="flex items-center justify-between gap-1 mt-2.5">
              <p className="text-[12px] text-text-muted truncate">
                BPJS & Potongan Kehadiran
              </p>
              <span className="text-[11px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Lihat →
              </span>
            </div>
          </div>
        </Card>

        {/* KPI 4: Laporan Kerja */}
        <Card
          onClick={() => navigate('/work-reports')}
          role="button"
          tabIndex={0}
          title="Klik untuk mengelola laporan kerja"
          className="p-6 sm:p-7 flex flex-col justify-between border-border-subtle bg-surface-panel shadow-xs hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-text-muted group-hover:text-text-primary transition-colors">
              Laporan Kerja Anda
            </span>
            <div className="w-9 h-9 rounded-xl bg-surface-container text-text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ClipboardList className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-[26px] sm:text-[28px] font-bold text-text-primary tracking-tight leading-none group-hover:text-primary transition-colors">
              {reportsSummary.total} Laporan
            </div>
            <div className="flex items-center justify-between gap-1 mt-2.5">
              <p className="text-[12px] text-text-muted truncate">
                {reportsSummary.approved} Disetujui • {reportsSummary.pending} Menunggu
              </p>
              <span className="text-[11px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Kelola →
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ============================================================== */}
      {/* 3. MAIN CONTENT GRID (Left 2/3 Details & Right 1/3 Feed)        */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Detail Slip Gaji Terakhir (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="p-6 sm:p-8 border-border-subtle bg-surface-panel shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-5 border-b border-border-subtle">
              <div>
                <h2 className="text-[16px] font-bold text-text-primary tracking-tight">
                  Rincian Komponen Gaji Terakhir
                </h2>
                <p className="text-[12.5px] text-text-muted mt-1">
                  {latest
                    ? `Periode: ${formatEmployeePeriod(latest.period)}`
                    : 'Belum ada rekapitulasi gaji'}
                </p>
              </div>

              {latest && (
                <button
                  type="button"
                  onClick={handleDownloadLatestSlip}
                  disabled={isDownloading}
                  className="px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[12.5px] font-semibold inline-flex items-center gap-2 transition-all shadow-xs whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>{isDownloading ? 'Mengunduh...' : 'Unduh PDF'}</span>
                </button>
              )}
            </div>

            {latest ? (
              <div className="space-y-6">
                {/* Employment Placement Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 sm:p-6 rounded-2xl bg-surface border border-border-subtle">
                  {/* Item 1: Jabatan / Posisi */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Briefcase className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
                        Jabatan / Posisi
                      </span>
                      <span className="text-[14px] font-bold text-text-primary block mt-0.5 truncate">
                        {latest.position && latest.position !== 'Staf Lapangan' ? latest.position : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Item 2: Unit Penempatan */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Building2 className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
                        Unit Penempatan
                      </span>
                      <span className="text-[13.5px] font-bold text-text-primary block mt-0.5 leading-snug">
                        {latest.school_unit || latest.province || '-'}
                      </span>
                    </div>
                  </div>

                  {/* Item 3: Rekening Bank */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <CreditCard className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
                        Rekening Bank
                      </span>
                      {latest.bank_name || user?.bank_name || latest.bank_account || user?.bank_account ? (
                        <span className="text-[13.5px] font-bold text-text-primary block mt-0.5 font-mono">
                          {latest.bank_name || user?.bank_name}{' '}
                          {latest.bank_account || user?.bank_account
                            ? `• ${latest.bank_account || user?.bank_account}`
                            : ''}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[13px] text-text-muted italic">Belum diisi</span>
                          <button
                            type="button"
                            onClick={() => navigate('/employee/profile')}
                            className="text-[11.5px] font-semibold text-primary hover:underline"
                          >
                            + Lengkapi
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Salary Breakdown Table */}
                <div className="divide-y divide-border-subtle text-[13.5px]">
                  <div className="py-3.5 flex items-center justify-between">
                    <span className="text-text-muted">Gaji Pokok (Basic Salary)</span>
                    <span className="font-semibold text-text-primary">
                      {formatCurrency(latest.basic_salary)}
                    </span>
                  </div>

                  <div className="py-3.5 flex items-center justify-between">
                    <span className="text-text-muted">Tunjangan & Insentif Kerja</span>
                    <span className="font-semibold text-text-primary">
                      +{formatCurrency(latest.allowance)}
                    </span>
                  </div>

                  {Number(latest.bpjs_kes || 0) > 0 && (
                    <div className="py-3.5 flex items-center justify-between text-text-muted">
                      <span>Potongan BPJS Kesehatan</span>
                      <span className="font-mono text-status-danger-text">
                        -{formatCurrency(latest.bpjs_kes)}
                      </span>
                    </div>
                  )}

                  {Number(latest.bpjs_tk || 0) > 0 && (
                    <div className="py-3.5 flex items-center justify-between text-text-muted">
                      <span>Potongan BPJS Ketenagakerjaan</span>
                      <span className="font-mono text-status-danger-text">
                        -{formatCurrency(latest.bpjs_tk)}
                      </span>
                    </div>
                  )}

                  {Number(latest.absence_deduction || 0) > 0 && (
                    <div className="py-3.5 flex items-center justify-between text-text-muted">
                      <span>Potongan Ketidakhadiran ({latest.absence_count} Hari)</span>
                      <span className="font-mono text-status-danger-text">
                        -{formatCurrency(latest.absence_deduction)}
                      </span>
                    </div>
                  )}

                  <div className="py-3.5 flex items-center justify-between">
                    <span className="text-text-muted">Total Potongan (Deduction)</span>
                    <span className="font-semibold text-status-danger-text">
                      -{formatCurrency(latest.deduction)}
                    </span>
                  </div>

                  {/* Grand Total Take Home Pay */}
                  <div className="pt-5 pb-1 flex items-center justify-between">
                    <div>
                      <div className="text-[11.5px] font-bold text-text-muted uppercase tracking-wider">
                        Take Home Pay (Gaji Bersih Diterima)
                      </div>
                      <div className="text-[12px] text-text-muted mt-1">
                        Ditransfer ke rekening penerimaan terdaftar
                      </div>
                    </div>
                    <div className="text-[26px] sm:text-[28px] font-bold text-text-primary tracking-tight">
                      {formatCurrency(latest.take_home_pay)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-text-muted text-[13.5px]">
                Data slip gaji belum tersedia untuk NIK Anda.
              </div>
            )}

            {/* Footer Navigation */}
            <div className="pt-4 border-t border-border-subtle flex items-center justify-between">
              <span className="text-[12.5px] text-text-muted">
                Total riwayat penggajian: <strong>{data?.total_payrolls || 0} Periode</strong>
              </span>
              <button
                type="button"
                onClick={() => navigate('/employee/payrolls')}
                className="text-[13px] font-semibold text-primary hover:underline flex items-center gap-1.5 transition-colors"
              >
                <span>Lihat Seluruh Riwayat Slip</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </Card>
        </div>

        {/* Right Column: Papan Pengumuman & Aksi Laporan (1/3 width) */}
        <div className="space-y-8">
          {/* Announcements Card */}
          <Card className="p-6 sm:p-7 border-border-subtle bg-surface-panel shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-border-subtle">
              <div className="flex items-center gap-2.5">
                <Bell className="w-4.5 h-4.5 text-text-muted" />
                <h3 className="font-bold text-[15px] text-text-primary">
                  Pengumuman Resmi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => navigate('/employee/announcements')}
                className="text-[12.5px] font-semibold text-primary hover:underline"
              >
                Lihat Semua
              </button>
            </div>

            {announcements.length === 0 ? (
              <div className="py-8 text-center text-text-muted text-[13px]">
                Belum ada pengumuman baru dari HR & Manajemen.
              </div>
            ) : (
              <div className="space-y-3.5">
                {announcements.slice(0, 3).map((ann) => (
                  <div
                    key={ann.id}
                    className="p-3.5 rounded-xl border border-border-subtle bg-surface hover:bg-surface-container transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {ann.is_pinned && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                            PIN
                          </span>
                        )}
                        <h4 className="font-semibold text-[13.5px] text-text-primary line-clamp-1">
                          {ann.title}
                        </h4>
                      </div>
                      <span className="text-[11px] text-text-muted whitespace-nowrap">
                        {new Date(ann.published_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-text-muted line-clamp-2 leading-relaxed">
                      {ann.content}
                    </p>
                    {ann.attachment_url && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-primary font-medium">
                        {ann.attachment_type === 'image' ? (
                          <>
                            <ImageIcon className="w-3 h-3" />
                            <span>Foto Terlampir</span>
                          </>
                        ) : (
                          <>
                            <Paperclip className="w-3 h-3" />
                            <span>Dokumen Terlampir</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick Help & Complaint Card */}
          <Card className="p-6 border-amber-200 bg-gradient-to-br from-amber-50/60 to-orange-50/40 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <MessageSquareWarning className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="font-bold text-[14px] text-amber-950">
                  Pusat Keluhan & Bantuan HRD
                </h4>
                <p className="text-[11px] text-amber-800/80">
                  Ada kendala gaji, absensi, atau fasilitas?
                </p>
              </div>
            </div>
            <p className="text-[12px] text-amber-900/90 leading-relaxed">
              Sampaikan keluhan atau kendala Anda langsung ke tim HRD secara resmi dan pantau status penyelesaiannya secara transparan.
            </p>
            <button
              type="button"
              onClick={() => navigate('/employee/complaints')}
              className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
            >
              <span>Buka Menu Keluhan</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
};
