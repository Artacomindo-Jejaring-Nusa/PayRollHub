import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
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
import {
  FileSpreadsheet,
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
} from 'lucide-react';

export const DashboardOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

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

  // Filter states
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [wilayahTab, setWilayahTab] = useState<'top5' | 'all'>('top5');

  // Load dashboard data
  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch paginated recent list & metrics with filters
      const response = await payrollService.getPayrolls({
        province: selectedProvince,
        period: selectedPeriod,
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
        page: 1,
        per_page: 200,
      });
      setAllPayrollsForStats(statsResponse.data);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProvince, selectedPeriod]);

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
            Ringkasan operasional dan sebaran penempatan karyawan RBS Global (PT. Rimbun Buana Sejahtera).
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
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

          {/* Period Filter */}
          <div className="relative">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="h-9 pl-3 pr-8 bg-surface-panel rounded-lg text-[13px] font-medium text-text-primary border border-border-subtle outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
            >
              <option value="">Semua Periode</option>
              {periodOptions.map((per) => (
                <option key={per} value={per}>
                  Periode: {per}
                </option>
              ))}
            </select>
          </div>

          {/* Reset / Refresh */}
          <button
            onClick={() => {
              setSelectedProvince('');
              setSelectedPeriod('');
            }}
            className="h-9 px-3 flex items-center justify-center rounded-lg border border-border-subtle bg-surface-panel hover:bg-surface-container text-text-muted hover:text-text-primary transition-colors text-[13px]"
            title="Reset Filter"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <SummaryCards metrics={metrics} isLoading={isLoading} isAdmin={isAdmin} />

      {/* Quick Actions Action Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                {isAdmin ? 'Lihat Data Penggajian' : 'Lihat Data Karyawan'}
              </div>
              <div className="text-[12px] text-text-muted">
                {isAdmin ? 'Buka tabel lengkap dan cetak slip' : 'Buka tabel data karyawan dan penempatan'}
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </button>

        {isAdmin ? (
          <>
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
                    Tambah Data Gaji Baru
                  </div>
                  <div className="text-[12px] text-text-muted">
                    Input manual slip gaji karyawan
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
                    Upload format .xlsx / .csv
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </button>
          </>
        ) : (
          <div className="md:col-span-2 flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface-container/50 text-[13px] text-text-muted">
            <span>Status Hak Akses: Mode Pemantau (Viewer) — Data Read-Only</span>
            <span className="font-mono text-[11px]">v1.0.0</span>
          </div>
        )}
      </div>

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
                        <div className="flex items-center gap-2 min-w-0">
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
                            className="font-semibold text-[11px] whitespace-nowrap"
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
                  className="py-2.5 px-2 flex items-center justify-between hover:bg-surface-container/60 rounded-lg cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-[12px] shrink-0">
                      {item.employee_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-body-semibold text-[13px] text-text-primary group-hover:text-primary transition-colors">
                        {item.employee_name}
                      </div>
                      <div className="text-[11px] text-text-muted font-mono truncate max-w-[280px]">
                        {item.position ? `${item.position} • ` : ''}{item.school_unit || item.province} • {item.period}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge variant="province" className="text-[11px]">
                        {item.province}
                      </Badge>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {item.join_date ? `Masuk: ${item.join_date}` : 'Aktif'}
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
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
