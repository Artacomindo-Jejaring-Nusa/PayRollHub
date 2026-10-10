import React, { useEffect, useState, useCallback } from 'react';
import { activityLogService } from '../services/activityLogService';
import { ActivityLogItem, ActivityLogStats } from '../types';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Pagination } from '../../../components/shared/Pagination';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Building2,
  Calendar,
  Globe,
  Terminal,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info,
  Laptop,
} from 'lucide-react';

export const ActivityLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [stats, setStats] = useState<ActivityLogStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [meta, setMeta] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });

  // Modal Detail
  const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await activityLogService.getLogs({
        search: search.trim() || undefined,
        module: selectedModule !== 'all' ? selectedModule : undefined,
        company: selectedCompany !== 'all' ? selectedCompany : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        per_page: perPage,
      });
      setLogs(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedModule, selectedCompany, startDate, endDate, page, perPage]);

  const fetchStats = useCallback(async () => {
    setIsStatsLoading(true);
    try {
      const res = await activityLogService.getStats(
        selectedCompany !== 'all' ? selectedCompany : undefined
      );
      setStats(res);
    } catch (err) {
      console.error('Failed to load activity stats:', err);
    } finally {
      setIsStatsLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedModule('all');
    setSelectedCompany('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE_PAYROLL':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            + Tambah Gaji
          </span>
        );
      case 'UPDATE_PAYROLL':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            ✏️ Ubah Gaji
          </span>
        );
      case 'DELETE_PAYROLL':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-300">
            🗑️ Hapus Gaji
          </span>
        );
      case 'UPDATE_STATUS':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            🔄 Status Aktif/Off
          </span>
        );
      case 'IMPORT_EXCEL':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            📥 Import Excel
          </span>
        );
      case 'LOGIN':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            🔑 Login Akun
          </span>
        );
      case 'UPDATE_ATTENDANCE_SETTING':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
            📍 Pengaturan Absensi
          </span>
        );
      case 'CREATE_USER':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
            👤 Tambah User
          </span>
        );
      case 'UPDATE_USER':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
            🛠️ Ubah User
          </span>
        );
      case 'DELETE_USER':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
            ❌ Hapus User
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {action}
          </span>
        );
    }
  };

  const getCompanyBadge = (company?: string | null) => {
    if (!company) return <span className="text-text-muted text-[11px]">-</span>;
    const isRima = company.toLowerCase().includes('riama') || company.toLowerCase() === 'rimamandiri';
    return (
      <span
        className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${
          isRima
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-blue-50 text-blue-800 border border-blue-200'
        }`}
      >
        {isRima ? 'Riama Mandiri' : 'RBS'}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-headline-page text-headline-page text-text-primary tracking-tight">
                  Audit Trail & Log Aktivitas Admin
                </h1>
                <Badge variant="super_admin">Khusus Super Admin</Badge>
              </div>
              <p className="font-body-default text-body-default text-text-muted">
                Rekaman forensik seluruh tindakan admin untuk transparansi sistem dan mencegah sabotase data.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchLogs();
              fetchStats();
            }}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Log
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border border-border-subtle bg-surface-panel shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">
              Aktivitas Hari Ini
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-text-primary">
              {isStatsLoading ? '...' : (stats?.today_count ?? 0)}
            </span>
            <span className="text-[11px] text-text-muted">tindakan tercatat</span>
          </div>
        </Card>

        <Card className="p-4 border border-border-subtle bg-surface-panel shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">
              Aktivitas Pekan Ini
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-text-primary">
              {isStatsLoading ? '...' : (stats?.this_week_count ?? 0)}
            </span>
            <span className="text-[11px] text-text-muted">tindakan pekan ini</span>
          </div>
        </Card>

        <Card className="p-4 border border-border-subtle bg-surface-panel shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">
              Total Riwayat Log
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Terminal className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-text-primary">
              {isStatsLoading ? '...' : (stats?.total_count ?? 0)}
            </span>
            <span className="text-[11px] text-text-muted">total peristiwa</span>
          </div>
        </Card>

        <Card className="p-4 border border-border-subtle bg-surface-panel shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">
              Integritas & Audit
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-emerald-600 font-semibold text-[13px]">
            <span>Aktif & Terlindungi</span>
          </div>
          <span className="text-[11px] text-text-muted">Audit log tidak dapat dihapus</span>
        </Card>
      </div>

      {/* Filter and Search Box */}
      <div className="bg-surface-panel rounded-xl border border-border-subtle p-3.5 sm:p-4 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3">
          {/* Search Input */}
          <div className="sm:col-span-2 lg:col-span-4 relative flex items-center">
            <Search className="w-4 h-4 text-text-muted absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari admin, aksi, nama karyawan, IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 bg-surface-panel rounded-lg text-body-default text-text-primary placeholder:text-text-muted border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[12.5px]"
            />
          </div>

          {/* Module Filter */}
          <div className="sm:col-span-1 lg:col-span-2">
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-2.5 bg-surface-panel rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[12.5px] cursor-pointer"
            >
              <option value="all">Semua Modul</option>
              <option value="payroll">Modul Gaji (Payroll)</option>
              <option value="attendance">Modul Absensi</option>
              <option value="user">Modul User</option>
              <option value="auth">Modul Otentikasi</option>
            </select>
          </div>

          {/* Company Filter */}
          <div className="sm:col-span-1 lg:col-span-2">
            <select
              value={selectedCompany}
              onChange={(e) => {
                setSelectedCompany(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-2.5 bg-surface-panel rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[12.5px] cursor-pointer"
            >
              <option value="all">Semua Entitas</option>
              <option value="rbs">PT Rimbun Buana Sejahtera</option>
              <option value="rimamandiri">PT Riama Mandiri Pratama</option>
            </select>
          </div>

          {/* Date Range Start */}
          <div className="sm:col-span-1 lg:col-span-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-2 bg-surface-panel rounded-lg text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[11.5px]"
              title="Tanggal Mulai"
            />
          </div>

          {/* Date Range End & Reset */}
          <div className="sm:col-span-1 lg:col-span-2 flex items-center gap-1.5">
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-2 bg-surface-panel rounded-lg text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[11.5px]"
              title="Tanggal Sampai"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              title="Reset Filter"
              className="px-2.5 h-9 shrink-0 text-xs"
            >
              Reset
            </Button>
          </div>
        </form>
      </div>

      {/* Activity Log Data Table */}
      <div className="w-full bg-surface-panel rounded-xl border border-border-subtle shadow-sm overflow-hidden">
        <div className="px-4 py-2 bg-slate-50/70 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-text-muted">
          <span>Daftar kronologis audit aktivitas administrator sistem</span>
          <span className="hidden sm:inline-block text-slate-400">Geser ke samping jika kolom terpotong →</span>
        </div>
        <div className="w-full overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[960px] text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-container-low text-text-secondary text-[11.5px] font-semibold uppercase tracking-wider">
                <th className="py-3 px-3 w-12 text-center">No</th>
                <th className="py-3 px-3 min-w-[130px] whitespace-nowrap">Waktu (WIB)</th>
                <th className="py-3 px-3 min-w-[170px]">Pelaksana / Admin</th>
                <th className="py-3 px-3 min-w-[100px] text-center whitespace-nowrap">Entitas</th>
                <th className="py-3 px-3 min-w-[130px] text-center whitespace-nowrap">Jenis Tindakan</th>
                <th className="py-3 px-3 min-w-[260px]">Deskripsi Aktivitas</th>
                <th className="py-3 px-3 min-w-[110px] text-center whitespace-nowrap">IP Address</th>
                <th className="py-3 px-3 w-16 text-center whitespace-nowrap">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-row text-[13px]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                      <span>Memuat catatan log aktivitas...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      <span className="font-semibold text-text-primary">
                        Tidak ada catatan log aktivitas yang cocok dengan kriteria.
                      </span>
                      <span className="text-[12px]">
                        Semua aktivitas penambahan, pengubahan, dan penghapusan admin akan otomatis tercatat di sini.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => {
                  const logDate = new Date(log.created_at);
                  const formattedDate = logDate.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });
                  const formattedTime = logDate.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-surface-container-low transition-colors"
                    >
                      <td className="py-3 px-3 text-center text-text-muted font-mono text-[11px]">
                        {(page - 1) * perPage + index + 1}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-text-primary text-[12.5px]">
                          {formattedDate}
                        </div>
                        <div className="text-[11px] font-mono text-text-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formattedTime} WIB</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-text-primary flex items-center gap-1.5">
                          <span>{log.user_name}</span>
                          {log.user_role === 'super_admin' ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-800 font-bold border border-amber-300">
                              Super Admin
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-100 text-purple-700 font-semibold border border-purple-200">
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-text-muted font-mono truncate max-w-[170px]">
                          {log.user_email}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {getCompanyBadge(log.company)}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="py-3 px-3 text-text-primary leading-snug break-words max-w-[340px]">
                        <span>{log.description}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-[11.5px] text-text-muted whitespace-nowrap">
                        {log.ip_address || '-'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 rounded-lg text-primary hover:bg-surface-container transition-colors cursor-pointer"
                          title="Lihat Detail Forensik"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {meta.total > 0 && (
          <Pagination
            meta={{
              current_page: meta.current_page,
              last_page: meta.last_page,
              per_page: meta.per_page,
              total: meta.total,
              from: (page - 1) * perPage + 1,
              to: Math.min(page * perPage, meta.total),
            }}
            onPageChange={(p) => setPage(p)}
            perPage={perPage}
            onPerPageChange={(pp) => {
              setPerPage(pp);
              setPage(1);
            }}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Modal Detail Forensik Log */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title="Detail Forensik Log Aktivitas"
          description={`ID Log: #${selectedLog.id} — Dicatat pada ${new Date(selectedLog.created_at).toLocaleString('id-ID')}`}
        >
          <div className="space-y-4">
            {/* Header info */}
            <div className="p-3.5 rounded-xl bg-surface-container border border-border-subtle space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-semibold text-text-muted uppercase tracking-wider">
                  Tindakan & Modul
                </span>
                {getActionBadge(selectedLog.action)}
              </div>
              <div className="text-[14px] font-bold text-text-primary">
                {selectedLog.description}
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-[12.5px]">
              <div className="p-3 rounded-lg border border-border-subtle bg-surface-panel space-y-1">
                <div className="text-[11px] font-semibold text-text-muted uppercase">Pelaksana</div>
                <div className="font-semibold text-text-primary">{selectedLog.user_name}</div>
                <div className="text-[11px] text-text-muted font-mono">{selectedLog.user_email}</div>
                <div className="pt-1">{getCompanyBadge(selectedLog.company)}</div>
              </div>

              <div className="p-3 rounded-lg border border-border-subtle bg-surface-panel space-y-1">
                <div className="text-[11px] font-semibold text-text-muted uppercase">Jaringan & Device</div>
                <div className="font-mono text-[12px] font-semibold text-text-primary">
                  IP: {selectedLog.ip_address || '127.0.0.1'}
                </div>
                <div className="text-[11px] text-text-muted line-clamp-2" title={selectedLog.user_agent || '-'}>
                  UA: {selectedLog.user_agent || '-'}
                </div>
              </div>
            </div>

            {/* JSON Details */}
            {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-semibold text-text-muted uppercase tracking-wider">
                  Payload & Data Terkait (JSON)
                </label>
                <pre className="p-3 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[12px] max-h-60 overflow-y-auto overflow-x-auto leading-relaxed border border-slate-800">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-border-row">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLog(null)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
