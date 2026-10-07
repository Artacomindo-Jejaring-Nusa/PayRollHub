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
        totalTHP: prev.totalTHP + Number(p.take_home_pay),
      });
    });

    const list = Array.from(map.entries()).map(([province, stat]) => ({
      province,
      count: stat.count,
      totalTHP: stat.totalTHP,
      percentage:
        metrics.total_take_home_pay > 0
          ? ((stat.totalTHP / metrics.total_take_home_pay) * 100).toFixed(1)
          : '0',
    }));

    return list.sort((a, b) => b.totalTHP - a.totalTHP);
  }, [allPayrollsForStats, metrics.total_take_home_pay]);

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
            Ringkasan eksekutif dan distribusi kompensasi karyawan RBS Global (PT. Rimbun Buana Sejahtera).
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

      {/* 5 KPI Summary Cards (with Skeleton effect) */}
      <SummaryCards metrics={metrics} isLoading={isLoading} />

      {/* Middle Grid: Cost Composition & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cost Composition Card */}
        <Card className="lg:col-span-2 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-row">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Percent className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-body-semibold text-[15px] text-text-primary">
                  Komposisi Beban Penggajian
                </h2>
                <p className="text-[11px] text-text-muted">
                  Rasio alokasi Gaji Pokok, Tunjangan, dan Potongan operasional
                </p>
              </div>
            </div>
            <span className="font-mono text-[12px] text-text-muted">
              Gross: {formatCurrency(totalGross)}
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-4 py-2">
              <Skeleton className="h-4 w-full rounded-full" />
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Proportional Multi-color Progress Bar */}
              <div className="space-y-1.5">
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                  <div
                    style={{ width: `${basicSalaryPercent}%` }}
                    className="bg-indigo-600 transition-all duration-500"
                    title={`Gaji Pokok: ${basicSalaryPercent}%`}
                  />
                  <div
                    style={{ width: `${allowancePercent}%` }}
                    className="bg-emerald-500 transition-all duration-500"
                    title={`Tunjangan: ${allowancePercent}%`}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-text-muted px-0.5">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-600" /> Gaji Pokok ({basicSalaryPercent}%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Tunjangan ({allowancePercent}%)
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    <span className="w-2 h-2 rounded-full bg-red-500" /> Potongan Efektif ({deductionRate}%)
                  </span>
                </div>
              </div>

              {/* 3 Metric Mini Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-indigo-50/60 border border-indigo-100/80">
                  <span className="text-[11px] font-medium text-indigo-700">Akumulasi Pokok</span>
                  <div className="font-mono text-[16px] font-bold text-indigo-950 mt-1">
                    {formatCurrency(metrics.total_basic_salary)}
                  </div>
                  <span className="text-[10px] text-indigo-600">Porsi dasar terikat kontrak</span>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-100/80">
                  <span className="text-[11px] font-medium text-emerald-700">Tunjangan & Bonus</span>
                  <div className="font-mono text-[16px] font-bold text-emerald-950 mt-1">
                    +{formatCurrency(metrics.total_allowance)}
                  </div>
                  <span className="text-[10px] text-emerald-600">Insentif & fasilitas</span>
                </div>

                <div className="p-3 rounded-lg bg-red-50/60 border border-red-100/80">
                  <span className="text-[11px] font-medium text-red-700">Total Pemotongan</span>
                  <div className="font-mono text-[16px] font-bold text-red-950 mt-1">
                    -{formatCurrency(metrics.total_deduction)}
                  </div>
                  <span className="text-[10px] text-red-600">BPJS, PPh21 & absensi</span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Quick Actions & Navigation Card */}
        <Card className="p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border-row">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-primary">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-body-semibold text-[15px] text-text-primary">
                Aksi Cepat
              </h2>
              <p className="text-[11px] text-text-muted">
                Pintasan navigasi dan operasional payroll
              </p>
            </div>
          </div>

          <div className="space-y-2 flex-1">
            <button
              onClick={() => navigate('/payrolls')}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-border-subtle bg-surface hover:bg-surface-container transition-all group text-left"
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <div>
                  <div className="text-[13px] font-semibold text-text-primary group-hover:text-primary transition-colors">
                    Lihat Data Penggajian
                  </div>
                  <div className="text-[11px] text-text-muted">
                    Buka tabel lengkap dan cetak slip
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => navigate('/payrolls/create')}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-border-subtle bg-surface hover:bg-surface-container transition-all group text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Plus className="w-4 h-4 text-primary" />
                    <div>
                      <div className="text-[13px] font-semibold text-text-primary group-hover:text-primary transition-colors">
                        Tambah Data Gaji Baru
                      </div>
                      <div className="text-[11px] text-text-muted">
                        Input manual slip gaji karyawan
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  onClick={() => navigate('/payrolls/import')}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-border-subtle bg-surface hover:bg-surface-container transition-all group text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Upload className="w-4 h-4 text-indigo-600" />
                    <div>
                      <div className="text-[13px] font-semibold text-text-primary group-hover:text-primary transition-colors">
                        Import Excel Masal
                      </div>
                      <div className="text-[11px] text-text-muted">
                        Upload format .xlsx / .csv
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </button>
              </>
            )}
          </div>

          <div className="pt-2 border-t border-border-row">
            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span>Status Sistem: Aktif</span>
              <span className="font-mono">v1.0.0</span>
            </div>
          </div>
        </Card>
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
                    Sebaran Penggajian per Wilayah
                  </h2>
                  <p className="text-[11px] text-text-muted">
                    Beban Take Home Pay dan proporsi per cabang provinsi
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
                  const maxTHP = provinceStats[0]?.totalTHP || 1;
                  const relativePercent = Math.min(
                    100,
                    Math.max(4, Math.round((item.totalTHP / maxTHP) * 100))
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
                          <span className="text-[11px] text-text-muted flex items-center gap-1 shrink-0">
                            <Users className="w-3 h-3" />
                            {item.count} staf
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono text-[12.5px] font-bold text-text-primary">
                            {formatCurrency(item.totalTHP)}
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

        {/* Recent Payroll Records Card */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-row">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-primary">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-body-semibold text-[15px] text-text-primary">
                  Penggajian Terkini
                </h2>
                <p className="text-[11px] text-text-muted">
                  Catatan transaksi gaji terbaru dalam sistem
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
              Belum ada data penggajian.
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
                      <div className="font-mono text-[13px] font-bold text-primary">
                        {item.formatted_take_home_pay}
                      </div>
                      <span className="text-[10px] text-text-muted">Net Disbursed</span>
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
