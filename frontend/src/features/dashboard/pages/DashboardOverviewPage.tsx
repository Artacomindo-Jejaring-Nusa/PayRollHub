import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { useTenantTheme } from '../../../lib/theme';
import { payrollService } from '../../payroll/services/payrollService';
import {
  PayrollItem,
  PayrollMetrics,
} from '../../../types/payroll';
import { SummaryCards } from '../../../components/shared/SummaryCards';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { formatCurrency } from '../../../lib/utils';
import { SP_PERIOD_LIST, formatPeriodDisplay } from '../../../lib/period';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  Plus,
  Upload,
  Calendar,
  Filter,
  RefreshCw,
  TrendingUp,
  MapPin,
  Clock,
  ArrowRight,
  Wallet,
  Users,
  Eye,
  Percent,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Compass,
} from 'lucide-react';
import { attendanceService } from '../../attendance/services/attendanceService';
import { AttendanceSummary, AttendanceRecord } from '../../attendance/types/attendance';

export const DashboardOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { tenant } = useTenantTheme();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Metrics and data state
  const [metrics, setMetrics] = useState<PayrollMetrics>({
    total_employees: 0,
    total_basic_salary: 0,
    total_allowance: 0,
    total_deduction: 0,
    total_take_home_pay: 0,
  });
  const [recentPayrolls, setRecentPayrolls] = useState<PayrollItem[]>([]);
  const [allPayrollsForStats, setAllPayrollsForStats] = useState<PayrollItem[]>([]);
  const [provinceOptions, setProvinceOptions] = useState<string[]>([]);
  const [periodOptions, setPeriodOptions] = useState<string[]>([]);

  // Attendance live states (Admin)
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [recentAttendances, setRecentAttendances] = useState<AttendanceRecord[]>([]);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);

  // Filter states
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [wilayahTab, setWilayahTab] = useState<'top5' | 'all'>('top5');
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExportDashboard = async (format: 'xlsx' | 'csv' | 'pdf') => {
    setIsExporting(format);
    try {
      await payrollService.exportFile(format, {
        province: selectedProvince,
        period: selectedPeriod,
        status: selectedStatus,
        company: tenant.id,
      });
    } catch (err: any) {
      alert('Gagal mengekspor data: ' + (err?.response?.data?.message || err?.message || err));
    } finally {
      setIsExporting(null);
    }
  };

  // Load dashboard data
  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch paginated recent list & metrics with filters
      const response = await payrollService.getPayrolls({
        province: selectedProvince,
        period: selectedPeriod,
        status: selectedStatus,
        company: tenant.id,
        page: 1,
        per_page: 5,
        sort_by: 'id',
        sort_order: 'desc',
      });

      setMetrics(response.metrics);
      setRecentPayrolls(response.data);

      if (response.filters?.provinces?.length) {
        setProvinceOptions(response.filters.provinces);
      }
      if (response.filters?.periods?.length) {
        setPeriodOptions(response.filters.periods);
      }

      // 2. Fetch a broader batch for provincial distribution if needed
      const statsResponse = await payrollService.getPayrolls({
        province: selectedProvince,
        period: selectedPeriod,
        status: selectedStatus,
        company: tenant.id,
        page: 1,
        per_page: 200,
      });
      setAllPayrollsForStats(statsResponse.data);

      // 3. Fetch live attendance data for Admin
      if (isAdmin) {
        setIsAttendanceLoading(true);
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          const [sumRes, attRes] = await Promise.allSettled([
            attendanceService.getAdminSummary(todayStr),
            attendanceService.getAdminAttendances({ date: todayStr, per_page: 6 }),
          ]);
          if (sumRes.status === 'fulfilled') {
            setAttendanceSummary(sumRes.value);
          }
          if (attRes.status === 'fulfilled') {
            setRecentAttendances(attRes.value?.data || []);
          }
        } catch (attErr) {
          console.warn('Attendance metrics not loaded:', attErr);
        } finally {
          setIsAttendanceLoading(false);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProvince, selectedPeriod, selectedStatus, tenant.id, isAdmin]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Aggregate provincial distribution
  const provinceStats = useMemo(() => {
    const map = new Map<string, { count: number; totalTHP: number }>();
    allPayrollsForStats.forEach((p) => {
      const prev = map.get(p.province) || { count: 0, totalTHP: 0 };
      map.set(p.province, {
        count: prev.count + 1,
        totalTHP: prev.totalTHP + Number(p.take_home_pay || 0),
      });
    });

    const totalStaff = metrics.total_employees > 0 ? metrics.total_employees : allPayrollsForStats.length;

    const list = Array.from(map.entries()).map(([province, stat]) => ({
      province,
      count: stat.count,
      totalTHP: stat.totalTHP,
      percentage: totalStaff > 0
        ? ((stat.count / totalStaff) * 100).toFixed(1)
        : '0',
    }));

    return list.sort((a, b) => b.count - a.count);
  }, [allPayrollsForStats, metrics.total_employees]);

  // Financial percentages calculation
  const totalGross = metrics.total_basic_salary + metrics.total_allowance;
  const basicSalaryPercent =
    totalGross > 0 ? Math.round((metrics.total_basic_salary / totalGross) * 100) : 0;
  const allowancePercent =
    totalGross > 0 ? Math.round((metrics.total_allowance / totalGross) * 100) : 0;
  const deductionRate =
    metrics.total_basic_salary > 0
      ? ((metrics.total_deduction / metrics.total_basic_salary) * 100).toFixed(1)
      : '0';

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline-page text-headline-page text-text-primary tracking-tight">
              Dashboard Overview
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Real-Time
            </span>
          </div>
          <p className="font-body-default text-body-default text-text-muted mt-1">
            Ringkasan operasional dan sebaran penempatan karyawan {tenant.shortName} ({tenant.companyLegalName}).
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 pl-3 pr-8 bg-surface-panel rounded-lg text-[13px] font-medium text-text-primary border border-border-subtle outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
            >
              <option value="">Semua Status</option>
              <option value="active">🟢 Karyawan Aktif</option>
              <option value="off">🔴 Off / Keluar</option>
            </select>
          </div>

          {/* Province Filter */}
          <div className="relative">
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="h-9 pl-3 pr-8 bg-surface-panel rounded-lg text-[13px] font-medium text-text-primary border border-border-subtle outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
            >
              <option value="">Semua Provinsi</option>
              {provinceOptions.map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>
          </div>

          {/* SP / Period Filter */}
          <div className="relative">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="h-9 pl-3 pr-8 bg-surface-panel rounded-lg text-[13px] font-medium text-text-primary border border-border-subtle outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
            >
              <option value="">Semua Periode / SP</option>
              {SP_PERIOD_LIST.map((sp) => (
                <option key={sp.code} value={sp.code}>
                  {sp.fullLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Reset / Refresh */}
          <button
            onClick={() => {
              setSelectedStatus('');
              setSelectedProvince('');
              setSelectedPeriod('');
            }}
            className="h-9 px-3 flex items-center justify-center rounded-lg border border-border-subtle bg-surface-panel hover:bg-surface-container text-text-muted hover:text-text-primary transition-colors text-[13px]"
            title="Reset Filter"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            <span>Reset</span>
          </button>

          {/* Export Data Sesuai Dashboard */}
          <div className="flex items-center rounded-lg border border-border-subtle bg-surface-panel p-0.5 shadow-sm h-9">
            <button
              type="button"
              onClick={() => handleExportDashboard('xlsx')}
              disabled={!!isExporting}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-semibold text-text-primary hover:bg-surface-container rounded-md transition-colors disabled:opacity-50"
              title="Export Data Tampilan Dashboard ke Excel (.xlsx)"
            >
              {isExporting === 'xlsx' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>Export</span>
            </button>
            <div className="w-[1px] h-4 bg-border-row" />
            <button
              type="button"
              onClick={() => handleExportDashboard('csv')}
              disabled={!!isExporting}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-text-muted hover:text-text-primary hover:bg-surface-container rounded-md transition-colors disabled:opacity-50"
              title="Export ke CSV (.csv)"
            >
              {isExporting === 'csv' ? (
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
              ) : (
                'CSV'
              )}
            </button>
            <div className="w-[1px] h-4 bg-border-row" />
            <button
              type="button"
              onClick={() => handleExportDashboard('pdf')}
              disabled={!!isExporting}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-text-muted hover:text-text-primary hover:bg-surface-container rounded-md transition-colors disabled:opacity-50"
              title="Export ke PDF (.pdf)"
            >
              {isExporting === 'pdf' ? (
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
              ) : (
                'PDF'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <SummaryCards metrics={metrics} isLoading={isLoading} isAdmin={isAdmin} />

      {/* Quick Actions Action Strip */}
      {isAdmin ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/payrolls')}
            className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface hover:bg-surface-container transition-all group text-left shadow-sm hover:shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-text-primary group-hover:text-primary transition-colors">
                  Data Penggajian
                </div>
                <div className="text-[12px] text-text-muted">
                  Buka tabel & cetak slip
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </button>

          <button
            onClick={() => navigate('/payrolls/create')}
            className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface hover:bg-surface-container transition-all group text-left shadow-sm hover:shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-text-primary group-hover:text-primary transition-colors">
                  Tambah Data Gaji
                </div>
                <div className="text-[12px] text-text-muted">
                  Input manual slip baru
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </button>

          <button
            onClick={() => navigate('/payrolls/import')}
            className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface hover:bg-surface-container transition-all group text-left shadow-sm hover:shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-text-primary group-hover:text-primary transition-colors">
                  Import Excel Masal
                </div>
                <div className="text-[12px] text-text-muted">
                  Upload file .xlsx / .csv
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </button>

          <button
            onClick={() => navigate('/attendances')}
            className="flex items-center justify-between p-4 rounded-xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/50 to-white hover:bg-emerald-50/80 transition-all group text-left shadow-sm hover:shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-emerald-950 group-hover:text-emerald-700 transition-colors">
                  Rekap Absensi Staf
                </div>
                <div className="text-[12px] text-emerald-700/90">
                  Radar radius & lokasi
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-1 transition-all" />
          </button>
        </div>
      ) : (
        <div className="max-w-md">
          <button
            onClick={() => navigate('/payrolls')}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface hover:bg-surface-container transition-all group text-left shadow-sm hover:shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-text-primary group-hover:text-primary transition-colors">
                  Lihat Data Karyawan
                </div>
                <div className="text-[12px] text-text-muted">
                  Buka tabel data karyawan dan penempatan
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </button>
        </div>
      )}

      {/* Live Attendance Section (Admin) */}
      {isAdmin && (
        <Card className="p-5 border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50/20 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-row">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-body-semibold text-[15px] sm:text-[16px] text-text-primary">
                    Monitoring Kehadiran Staf Hari Ini
                  </h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Live Real-Time
                  </span>
                </div>
                <p className="text-[11.5px] text-text-muted mt-0.5">
                  Laporan absensi mandiri staf berbasis verifikasi radius lokasi kantor hari ini.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/attendances')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              className="text-[12.5px] border-emerald-200 text-emerald-800 hover:bg-emerald-50 self-start sm:self-auto"
            >
              Buka Rekap & Pengaturan Kantor
            </Button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
              <div className="text-[11px] font-medium text-emerald-800">Total Hadir</div>
              <div className="text-[20px] font-bold text-emerald-900 mt-0.5">
                {isAttendanceLoading ? '...' : `${attendanceSummary?.total_present ?? 0} Staf`}
              </div>
              <div className="text-[10px] text-emerald-700 mt-0.5">Tercatat hari ini</div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100">
              <div className="text-[11px] font-medium text-blue-800">Tepat Waktu</div>
              <div className="text-[20px] font-bold text-blue-900 mt-0.5">
                {isAttendanceLoading ? '...' : `${attendanceSummary?.total_on_time ?? 0} Staf`}
              </div>
              <div className="text-[10px] text-blue-700 mt-0.5">Sebelum batas jam masuk</div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
              <div className="text-[11px] font-medium text-amber-800">Terlambat</div>
              <div className="text-[20px] font-bold text-amber-900 mt-0.5">
                {isAttendanceLoading ? '...' : `${attendanceSummary?.total_late ?? 0} Staf`}
              </div>
              <div className="text-[10px] text-amber-700 mt-0.5">Melewati toleransi</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-medium text-slate-700">Rata-rata Radius GPS</div>
              <div className="text-[20px] font-bold text-slate-900 mt-0.5">
                {isAttendanceLoading ? '...' : `${attendanceSummary?.avg_distance_meters ?? 0} m`}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Dari titik kantor</div>
            </div>
          </div>

          {/* Mini List: Siapa saja yang baru absen hari ini */}
          {recentAttendances.length > 0 ? (
            <div className="pt-2">
              <div className="text-[11.5px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                Staf Yang Baru Saja Melakukan Absensi Hari Ini:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {recentAttendances.slice(0, 6).map((att) => (
                  <div
                    key={att.id}
                    className="p-2.5 rounded-lg border border-border-subtle bg-surface hover:bg-surface-container transition-all flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[13px] text-text-primary truncate">
                        {att.user?.name || 'Karyawan'}
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        {att.user?.email || '-'}
                      </div>
                      <div className="text-[10.5px] text-text-muted mt-0.5">
                        Jam Masuk: <span className="font-semibold text-emerald-700">{att.check_in_time || '-'}</span> • Jarak: {att.check_in_distance_meters ?? '-'} m
                      </div>
                    </div>
                    <Badge variant={att.check_in_status === 'late' ? 'off' : 'active'} className="text-[10px] shrink-0">
                      {att.check_in_status === 'late' ? 'Terlambat' : 'Tepat Waktu'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : !isAttendanceLoading && (
            <div className="py-4 text-center text-text-muted text-[12.5px] bg-surface-container-low/40 rounded-lg border border-dashed border-border-subtle">
              Belum ada staf yang melakukan absensi pada hari ini.
            </div>
          )}
        </Card>
      )}

      {/* Bottom Grid: Provincial Distribution & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provincial Distribution Card */}
        <Card className="p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border-row">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-body-semibold text-[15px] text-text-primary">
                    Sebaran Karyawan per Wilayah
                  </h2>
                  <p className="text-[11px] text-text-muted">
                    Jumlah penempatan karyawan dan proporsi per cabang provinsi
                  </p>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-surface-container p-0.5 rounded-lg border border-border-subtle text-[11px] font-semibold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setWilayahTab('top5')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    wilayahTab === 'top5'
                      ? 'bg-surface-panel text-primary shadow-xs font-bold'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Top 5
                </button>
                <button
                  type="button"
                  onClick={() => setWilayahTab('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    wilayahTab === 'all'
                      ? 'bg-surface-panel text-primary shadow-xs font-bold'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Semua ({provinceStats.length})
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3 py-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-2">
                    <Skeleton className="h-5 w-28 rounded" />
                    <Skeleton className="h-5 w-32 rounded" />
                  </div>
                ))}
              </div>
            ) : provinceStats.length === 0 ? (
              <div className="py-8 text-center text-text-muted text-[13px]">
                Belum ada data wilayah tercatat pada filter aktif.
              </div>
            ) : (
              <div
                className={`pt-3 ${
                  wilayahTab === 'all'
                    ? 'space-y-2 max-h-[350px] overflow-y-auto pr-1.5 focus:outline-none'
                    : 'space-y-2.5'
                }`}
              >
                {(wilayahTab === 'top5'
                  ? provinceStats.slice(0, 5)
                  : provinceStats
                ).map((item, idx) => {
                  const maxVal = provinceStats[0]?.count || 1;
                  const currVal = item.count;
                  const relativePercent = Math.min(
                    100,
                    Math.max(4, Math.round((currVal / maxVal) * 100))
                  );

                  return (
                    <div
                      key={item.province}
                      onClick={() =>
                        setSelectedProvince(
                          selectedProvince === item.province ? '' : item.province
                        )
                      }
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer group ${
                        selectedProvince === item.province
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border-subtle bg-surface hover:bg-surface-container/60 hover:border-slate-300'
                      }`}
                      title={`Klik untuk memfilter dashboard berdasarkan ${item.province}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {/* Rank Pill */}
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              idx === 0
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : idx === 1
                                ? 'bg-slate-200 text-slate-700 border border-slate-300'
                                : idx === 2
                                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <Badge
                            variant="province"
                            className="font-semibold text-[11px] max-w-[150px] sm:max-w-[220px] truncate block"
                            title={item.province}
                          >
                            {item.province}
                          </Badge>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-body-semibold text-[13px] font-bold text-text-primary">
                            {item.count} Orang
                          </span>
                          <span className="text-[11px] text-text-muted ml-1.5 font-medium">
                            ({item.percentage}%)
                          </span>
                        </div>
                      </div>

                      {/* Visual proportion progress bar */}
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            idx === 0
                              ? 'bg-amber-500'
                              : idx === 1
                              ? 'bg-blue-600'
                              : idx === 2
                              ? 'bg-emerald-500'
                              : 'bg-indigo-600'
                          }`}
                          style={{ width: `${relativePercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer indicator / expand button */}
          {!isLoading && provinceStats.length > 5 && (
            <div className="pt-2 border-t border-border-row flex items-center justify-between text-[11px] text-text-muted">
              {wilayahTab === 'top5' ? (
                <>
                  <span>Menampilkan 5 dari {provinceStats.length} wilayah terbesar</span>
                  <button
                    type="button"
                    onClick={() => setWilayahTab('all')}
                    className="text-primary hover:text-accent-hover font-semibold flex items-center gap-1 transition-colors"
                  >
                    Lihat Semua ({provinceStats.length}) <ArrowRight className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <>
                  <span>Menampilkan seluruh {provinceStats.length} wilayah (scrollable)</span>
                  <button
                    type="button"
                    onClick={() => setWilayahTab('top5')}
                    className="text-primary hover:text-accent-hover font-semibold flex items-center gap-1 transition-colors"
                  >
                    Kembali ke Top 5
                  </button>
                </>
              )}
            </div>
          )}
        </Card>

        {/* Recent Activity Card */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-row">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-primary">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-body-semibold text-[15px] text-text-primary">
                  Data Karyawan Terkini
                </h2>
                <p className="text-[11px] text-text-muted">
                  Catatan penempatan karyawan terbaru dalam sistem
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/payrolls')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              className="text-[12px] text-primary"
            >
              Semua Data
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3 py-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-2">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-3 w-20 rounded" />
                  </div>
                  <Skeleton className="h-5 w-24 rounded" />
                </div>
              ))}
            </div>
          ) : recentPayrolls.length === 0 ? (
            <div className="py-8 text-center text-text-muted text-[13px]">
              Belum ada data penempatan karyawan.
            </div>
          ) : (
            <div className="divide-y divide-border-row">
              {recentPayrolls.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/payrolls/${item.id}`)}
                  className="py-2.5 px-2.5 flex items-center justify-between gap-3 hover:bg-surface-container/60 rounded-lg cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-[12px] shrink-0">
                      {item.employee_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-body-semibold text-[13px] text-text-primary group-hover:text-primary transition-colors truncate">
                        {item.employee_name}
                      </div>
                      <div
                        className="text-[11px] text-text-muted font-mono truncate max-w-[260px] sm:max-w-[320px]"
                        title={`${item.position ? `${item.position} • ` : ''}${item.school_unit || item.province} • ${formatPeriodDisplay(item.period)}`}
                      >
                        {item.position ? `${item.position} • ` : ''}{item.school_unit || item.province} • {formatPeriodDisplay(item.period)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                    <div className="text-right flex flex-col items-end">
                      <div className="flex items-center justify-end gap-1.5 max-w-[180px] sm:max-w-[220px]">
                        <Badge variant={item.status === 'off' ? 'off' : 'active'} className="text-[10px] shrink-0">
                          {item.status === 'off' ? 'Off' : 'Aktif'}
                        </Badge>
                        <Badge
                          variant="province"
                          className="text-[10.5px] max-w-[105px] sm:max-w-[135px] truncate block"
                          title={item.province}
                        >
                          {item.province}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5 truncate max-w-[140px]">
                        {item.status === 'off' && item.resign_date
                          ? `Keluar: ${item.resign_date}`
                          : item.join_date
                          ? `Masuk: ${item.join_date}`
                          : 'Aktif'}
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
