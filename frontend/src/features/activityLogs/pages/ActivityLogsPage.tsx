import React, { useEffect, useState, useCallback } from 'react';
import { activityLogService } from '../services/activityLogService';
import { ActivityLogItem, ActivityLogStats, UserLoginTrackingItem } from '../types';
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
  Users,
  UserCheck,
  UserX,
  ArrowRight,
  Eye,
} from 'lucide-react';

export const ActivityLogsPage: React.FC = () => {
  // Navigation Tabs: 'logs' = Audit Trail Aktivitas, 'logins' = Monitoring Login User & Admin (Point 18)
  const [activeTab, setActiveTab] = useState<'logs' | 'logins'>('logins');

  // ==========================================
  // TAB 1: System Activity Logs State
  // ==========================================
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [stats, setStats] = useState<ActivityLogStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  // Filters & Pagination for Logs
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

  // Modal Detail Log
  const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null);

  // ==========================================
  // TAB 2: Monitoring Login User/Admin (Point 18)
  // ==========================================
  const [loginUsers, setLoginUsers] = useState<UserLoginTrackingItem[]>([]);
  const [isLoginsLoading, setIsLoginsLoading] = useState(true);
  const [loginSummary, setLoginSummary] = useState({
    total_users: 0,
    active_recently: 0,
    inactive_over_7_days: 0,
    never_logged_in: 0,
  });

  // Filters & Pagination for Login Tracking
  const [loginSearch, setLoginSearch] = useState('');
  const [loginRole, setLoginRole] = useState('all');
  const [loginStatus, setLoginStatus] = useState('all');
  const [loginCompany, setLoginCompany] = useState('all');
  const [loginSortOrder, setLoginSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loginPage, setLoginPage] = useState(1);
  const [loginPerPage, setLoginPerPage] = useState(15);
  const [loginMeta, setLoginMeta] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  });

  // Fetch Activity Logs
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

  // Fetch Log Stats
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

  // Fetch User Login Tracking (Point 18)
  const fetchUserLogins = useCallback(async () => {
    setIsLoginsLoading(true);
    try {
      const res = await activityLogService.getUserLogins({
        search: loginSearch.trim() || undefined,
        role: loginRole !== 'all' ? loginRole : undefined,
        status: loginStatus !== 'all' ? loginStatus : undefined,
        company: loginCompany !== 'all' ? loginCompany : undefined,
        sort_by: 'last_login_at',
        sort_order: loginSortOrder,
        page: loginPage,
        per_page: loginPerPage,
      });
      setLoginUsers(res.data);
      setLoginMeta(res.meta);
      if (res.summary) {
        setLoginSummary(res.summary);
      }
    } catch (err) {
      console.error('Failed to load user logins tracking:', err);
    } finally {
      setIsLoginsLoading(false);
    }
  }, [loginSearch, loginRole, loginStatus, loginCompany, loginSortOrder, loginPage, loginPerPage]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchStats();
    }
  }, [activeTab, fetchStats]);

  useEffect(() => {
    if (activeTab === 'logins') {
      fetchUserLogins();
    }
  }, [activeTab, fetchUserLogins]);

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

  const handleLoginSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginPage(1);
    fetchUserLogins();
  };

  const handleResetLoginFilters = () => {
    setLoginSearch('');
    setLoginRole('all');
    setLoginStatus('all');
    setLoginCompany('all');
    setLoginSortOrder('asc');
    setLoginPage(1);
  };

  // Inspect user logs directly from login tracking
  const handleInspectUserLogs = (userItem: UserLoginTrackingItem) => {
    setSearch(userItem.email || userItem.name);
    setPage(1);
    setActiveTab('logs');
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

  const getInactivityBadge = (item: UserLoginTrackingItem) => {
    switch (item.status_label) {
      case 'never':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <UserX className="w-3 h-3 text-rose-600" />
            <span>Belum Pernah Login</span>
          </span>
        );
      case 'inactive_30':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-700" />
            <span>Tidak Aktif &gt; 30 Hari ({item.days_since_login} hari)</span>
          </span>
        );
      case 'inactive_7':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-yellow-50 text-yellow-800 border border-yellow-300">
            <Clock className="w-3 h-3 text-yellow-700" />
            <span>Tidak Aktif &gt; 7 Hari ({item.days_since_login} hari)</span>
          </span>
        );
      case 'active':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
            <UserCheck className="w-3 h-3 text-emerald-600" />
            <span>Aktif ({item.days_since_login === 0 ? 'Hari ini' : `${item.days_since_login} hari lalu`})</span>
          </span>
        );
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'lord_admin':
        return <Badge variant="lord_admin">👑 Lord Admin</Badge>;
      case 'super_admin':
        return <Badge variant="super_admin">⭐ Super Admin</Badge>;
      case 'admin':
        return <Badge variant="admin">Admin</Badge>;
      case 'karyawan':
      default:
        return <Badge variant="role">Karyawan</Badge>;
    }
  };

  return (
    <div className="space-y-6 w-full">
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
                <Badge variant="admin">Admin & Super Admin</Badge>
              </div>
              <p className="font-body-default text-body-default text-text-muted">
                Monitoring keaktifan login pengguna, audit trail forensik sistem, dan transparansi operasional.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === 'logs') {
                fetchLogs();
                fetchStats();
              } else {
                fetchUserLogins();
              }
            }}
            isLoading={activeTab === 'logs' ? isLoading : isLoginsLoading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border-subtle gap-2">
        <button
          onClick={() => setActiveTab('logins')}
          className={`flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'logins'
              ? 'border-primary text-primary bg-primary/5 rounded-t-lg'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Monitoring Login User / Admin (Poin 18)</span>
          {loginSummary.never_logged_in > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
              {loginSummary.never_logged_in}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'logs'
              ? 'border-primary text-primary bg-primary/5 rounded-t-lg'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Log Aktivitas Sistem (Audit Trail)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 2: MONITORING LOGIN USER & ADMIN (POIN 18)                           */}
      {/* ========================================================================= */}
      {activeTab === 'logins' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 border border-border-subtle bg-surface-panel shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">
                  Total Pengguna Terdaftar
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-text-primary">
                  {isLoginsLoading ? '...' : loginSummary.total_users}
                </span>
                <span className="text-[11px] text-text-muted">akun di sistem</span>
              </div>
            </Card>

            <Card className="p-4 border border-rose-200 bg-rose-50/40 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-rose-700 uppercase tracking-wider">
                  Belum Pernah Login
                </span>
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                  <UserX className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-rose-700">
                  {isLoginsLoading ? '...' : loginSummary.never_logged_in}
                </span>
                <span className="text-[11px] text-rose-600 font-medium">user/admin pasif</span>
              </div>
            </Card>

            <Card className="p-4 border border-amber-200 bg-amber-50/40 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-amber-700 uppercase tracking-wider">
                  Tidak Aktif &gt; 7 Hari
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-amber-800">
                  {isLoginsLoading ? '...' : loginSummary.inactive_over_7_days}
                </span>
                <span className="text-[11px] text-amber-700 font-medium">jarang login</span>
              </div>
            </Card>

            <Card className="p-4 border border-emerald-200 bg-emerald-50/40 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-emerald-700 uppercase tracking-wider">
                  Aktif Pekan Ini
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-emerald-700">
                  {isLoginsLoading ? '...' : loginSummary.active_recently}
                </span>
                <span className="text-[11px] text-emerald-600 font-medium">login &lt; 7 hari</span>
              </div>
            </Card>
          </div>

          {/* Filter Bar */}
          <div className="bg-surface-panel rounded-xl border border-border-subtle p-4 shadow-sm space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
              {/* Search */}
              <form
                onSubmit={handleLoginSearchSubmit}
                className="md:col-span-4 relative flex items-center"
              >
                <Search className="w-4 h-4 text-text-muted absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari Nama, Email, NIK..."
                  value={loginSearch}
                  onChange={(e) => setLoginSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 bg-surface-panel rounded-lg text-body-default text-text-primary placeholder:text-text-muted border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px]"
                />
              </form>

              {/* Role Filter */}
              <div className="md:col-span-2 relative flex items-center">
                <select
                  value={loginRole}
                  onChange={(e) => {
                    setLoginRole(e.target.value);
                    setLoginPage(1);
                  }}
                  className="w-full h-10 px-3 bg-surface-panel rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px] appearance-none cursor-pointer"
                >
                  <option value="all">Semua Role</option>
                  <option value="all_admins">⭐ Semua Admin & Lord Admin</option>
                  <option value="lord_admin">👑 Lord Admin Saja</option>
                  <option value="super_admin">⭐ Super Admin Saja</option>
                  <option value="admin">Admin Saja</option>
                  <option value="karyawan">Karyawan Saja</option>
                </select>
              </div>

              {/* Login Status Filter */}
              <div className="md:col-span-3 relative flex items-center">
                <select
                  value={loginStatus}
                  onChange={(e) => {
                    setLoginStatus(e.target.value);
                    setLoginPage(1);
                  }}
                  className="w-full h-10 px-3 bg-surface-panel rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px] appearance-none cursor-pointer"
                >
                  <option value="all">Semua Status Login</option>
                  <option value="never">❌ Belum Pernah Login</option>
                  <option value="inactive_30">⚠️ Tidak Aktif &gt; 30 Hari</option>
                  <option value="inactive_7">⏱️ Tidak Aktif &gt; 7 Hari</option>
                  <option value="active">🟢 Aktif Baru-baru Ini</option>
                </select>
              </div>

              {/* Company Filter */}
              <div className="md:col-span-2 relative flex items-center">
                <select
                  value={loginCompany}
                  onChange={(e) => {
                    setLoginCompany(e.target.value);
                    setLoginPage(1);
                  }}
                  className="w-full h-10 px-3 bg-surface-panel rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px] appearance-none cursor-pointer"
                >
                  <option value="all">Semua Entitas</option>
                  <option value="rbs">PT RBS</option>
                  <option value="rimamandiri">Riama Mandiri</option>
                </select>
              </div>

              {/* Reset */}
              <div className="md:col-span-1 flex items-center">
                <button
                  type="button"
                  onClick={handleResetLoginFilters}
                  className="w-full h-10 flex items-center justify-center rounded-lg border border-border-subtle hover:bg-surface-container text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                  title="Reset Filter"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Sort & Preset Buttons */}
            <div className="pt-2 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <div className="flex items-center gap-1.5 text-text-muted">
                <span>Filter Cepat:</span>
                <button
                  type="button"
                  onClick={() => {
                    setLoginRole('all_admins');
                    setLoginStatus('never');
                    setLoginPage(1);
                  }}
                  className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-medium transition-colors"
                >
                  Admin Belum Pernah Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginRole('all_admins');
                    setLoginStatus('inactive_7');
                    setLoginPage(1);
                  }}
                  className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 font-medium transition-colors"
                >
                  Admin Tidak Login &gt; 7 Hari
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-text-muted">Urutan:</span>
                <select
                  value={loginSortOrder}
                  onChange={(e) => {
                    setLoginSortOrder(e.target.value as 'asc' | 'desc');
                    setLoginPage(1);
                  }}
                  className="px-2 py-1 rounded bg-surface border border-border-subtle text-[11.5px] font-semibold text-text-primary outline-none cursor-pointer"
                >
                  <option value="asc">Paling Lama / Belum Login Dulu</option>
                  <option value="desc">Baru Login Terakhir Dulu</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-surface-panel rounded-xl border border-border-subtle shadow-sm overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[1000px] text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-border-subtle text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                    <th className="py-3.5 px-3 text-center w-12">No</th>
                    <th className="py-3.5 px-3 min-w-[200px]">Nama & Email Pengguna</th>
                    <th className="py-3.5 px-3 min-w-[120px] text-center">Peran</th>
                    <th className="py-3.5 px-3 min-w-[110px] text-center">Entitas</th>
                    <th className="py-3.5 px-3 min-w-[180px]">Terakhir Login</th>
                    <th className="py-3.5 px-3 min-w-[120px]">IP Login</th>
                    <th className="py-3.5 px-3 min-w-[180px]">Status Keaktifan</th>
                    <th className="py-3.5 px-3 min-w-[200px]">Aktivitas Terakhir di Sistem</th>
                    <th className="py-3.5 px-3 text-center min-w-[110px]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-row text-[13px]">
                  {isLoginsLoading ? (
                    Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={`login-skel-${idx}`} className="animate-pulse">
                        <td className="py-3.5 px-3 text-center">
                          <div className="h-4 w-5 bg-slate-200 rounded mx-auto" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-4 w-36 bg-slate-200 rounded mb-1" />
                          <div className="h-3 w-28 bg-slate-100 rounded" />
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <div className="h-5 w-20 bg-slate-200 rounded-full mx-auto" />
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <div className="h-5 w-16 bg-slate-200 rounded mx-auto" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-4 w-28 bg-slate-200 rounded" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-4 w-20 bg-slate-200 rounded" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-5 w-28 bg-slate-200 rounded" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-4 w-32 bg-slate-200 rounded" />
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <div className="h-7 w-16 bg-slate-200 rounded mx-auto" />
                        </td>
                      </tr>
                    ))
                  ) : loginUsers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-text-muted">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Users className="w-8 h-8 text-slate-300" />
                          <span className="font-medium text-text-primary">
                            Tidak ada data pengguna yang sesuai dengan filter.
                          </span>
                          <span className="text-[12px]">
                            Coba sesuaikan kata kunci pencarian atau reset filter status login.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    loginUsers.map((item, index) => {
                      const rowNumber = (loginMeta.current_page - 1) * loginMeta.per_page + index + 1;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 text-center font-mono text-[12px] text-text-muted">
                            {rowNumber}
                          </td>

                          {/* Nama & Email */}
                          <td className="py-3 px-3">
                            <div className="font-semibold text-text-primary text-[13px]">
                              {item.name}
                            </div>
                            <div className="text-[11.5px] text-text-muted font-mono">
                              {item.email}
                            </div>
                            {item.nik && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                NIK: {item.nik}
                              </div>
                            )}
                          </td>

                          {/* Role */}
                          <td className="py-3 px-3 text-center">
                            {getRoleBadge(item.role)}
                          </td>

                          {/* Company */}
                          <td className="py-3 px-3 text-center">
                            {getCompanyBadge(item.company)}
                          </td>

                          {/* Last Login At */}
                          <td className="py-3 px-3">
                            {item.last_login_at ? (
                              <div>
                                <div className="font-medium text-text-primary text-[12.5px] font-mono">
                                  {new Date(item.last_login_at).toLocaleString('id-ID', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                                <div className="text-[11px] text-text-muted">
                                  {item.last_login_human}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-rose-600 text-[11.5px]">
                                <span>Belum pernah</span>
                              </span>
                            )}
                          </td>

                          {/* Last Login IP */}
                          <td className="py-3 px-3 font-mono text-[11.5px] text-text-muted">
                            {item.last_login_ip || '-'}
                          </td>

                          {/* Inactivity Status Badge */}
                          <td className="py-3 px-3">
                            {getInactivityBadge(item)}
                          </td>

                          {/* Last System Activity */}
                          <td className="py-3 px-3">
                            {item.last_activity ? (
                              <div className="max-w-[240px]">
                                <div className="text-[11.5px] font-medium text-text-primary truncate" title={item.last_activity.description}>
                                  {item.last_activity.description}
                                </div>
                                <div className="text-[10.5px] text-text-muted">
                                  {item.last_activity.human}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Tidak ada rekaman</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleInspectUserLogs(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all cursor-pointer"
                              title="Lihat riwayat aktivitas user ini di Log Sistem"
                            >
                              <span>Cek Log</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {loginMeta.total > 0 && (
              <Pagination
                meta={{
                  current_page: loginMeta.current_page,
                  last_page: loginMeta.last_page,
                  per_page: loginMeta.per_page,
                  total: loginMeta.total,
                  from: (loginPage - 1) * loginPerPage + 1,
                  to: Math.min(loginPage * loginPerPage, loginMeta.total),
                }}
                onPageChange={(p) => setLoginPage(p)}
                perPage={loginPerPage}
                onPerPageChange={(pp) => {
                  setLoginPerPage(pp);
                  setLoginPage(1);
                }}
                isLoading={isLoginsLoading}
              />
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: LOG AKTIVITAS SISTEM (AUDIT TRAIL)                                 */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
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

          {/* Filter Bar */}
          <div className="bg-surface-panel rounded-xl border border-border-subtle p-4 shadow-sm space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
              {/* Search */}
              <form
                onSubmit={handleSearchSubmit}
                className="md:col-span-4 relative flex items-center"
              >
                <Search className="w-4 h-4 text-text-muted absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari User, Deskripsi, IP Address..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 bg-surface-panel rounded-lg text-body-default text-text-primary placeholder:text-text-muted border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px]"
                />
              </form>

              {/* Modul Filter */}
              <div className="md:col-span-2 relative flex items-center">
                <select
                  value={selectedModule}
                  onChange={(e) => {
                    setSelectedModule(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-10 px-3 bg-surface-panel rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px] appearance-none cursor-pointer"
                >
                  <option value="all">Semua Modul</option>
                  <option value="PAYROLL">Penggajian</option>
                  <option value="AUTH">Autentikasi</option>
                  <option value="ATTENDANCE">Absensi</option>
                  <option value="USER_MANAGEMENT">Manajemen User</option>
                  <option value="SYSTEM">Sistem</option>
                </select>
              </div>

              {/* Perusahaan Filter */}
              <div className="md:col-span-2 relative flex items-center">
                <select
                  value={selectedCompany}
                  onChange={(e) => {
                    setSelectedCompany(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-10 px-3 bg-surface-panel rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px] appearance-none cursor-pointer"
                >
                  <option value="all">Semua Entitas</option>
                  <option value="rbs">PT RBS</option>
                  <option value="rimamandiri">Riama Mandiri</option>
                </select>
              </div>

              {/* Tanggal */}
              <div className="md:col-span-3 flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-10 px-2 rounded-lg border border-border-subtle bg-surface-panel text-text-primary text-[12px] outline-none focus:ring-2 focus:ring-primary"
                  title="Dari Tanggal"
                />
                <span className="text-text-muted text-[11px]">s/d</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-10 px-2 rounded-lg border border-border-subtle bg-surface-panel text-text-primary text-[12px] outline-none focus:ring-2 focus:ring-primary"
                  title="Sampai Tanggal"
                />
              </div>

              {/* Reset */}
              <div className="md:col-span-1 flex items-center">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="w-full h-10 flex items-center justify-center rounded-lg border border-border-subtle hover:bg-surface-container text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                  title="Reset Filter"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-surface-panel rounded-xl border border-border-subtle shadow-sm overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[1000px] text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-border-subtle text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                    <th className="py-3.5 px-3 text-center w-12">No</th>
                    <th className="py-3.5 px-3 min-w-[150px]">Waktu & Tanggal</th>
                    <th className="py-3.5 px-3 min-w-[180px]">Pelaksana (Admin)</th>
                    <th className="py-3.5 px-3 min-w-[100px] text-center">Entitas</th>
                    <th className="py-3.5 px-3 min-w-[130px]">Tindakan</th>
                    <th className="py-3.5 px-3 min-w-[100px]">Modul</th>
                    <th className="py-3.5 px-3 min-w-[280px]">Deskripsi Peristiwa</th>
                    <th className="py-3.5 px-3 min-w-[110px]">IP Address</th>
                    <th className="py-3.5 px-3 text-center min-w-[80px]">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-row text-[13px]">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={`log-skel-${idx}`} className="animate-pulse">
                        <td className="py-3.5 px-3 text-center">
                          <div className="h-4 w-5 bg-slate-200 rounded mx-auto" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-4 w-28 bg-slate-200 rounded" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-4 w-32 bg-slate-200 rounded" />
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <div className="h-5 w-16 bg-slate-200 rounded mx-auto" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-5 w-24 bg-slate-200 rounded" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-4 w-16 bg-slate-200 rounded" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-4 w-48 bg-slate-200 rounded" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-4 w-20 bg-slate-200 rounded" />
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <div className="h-6 w-8 bg-slate-200 rounded mx-auto" />
                        </td>
                      </tr>
                    ))
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-text-muted">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Terminal className="w-8 h-8 text-slate-300" />
                          <span className="font-medium text-text-primary">
                            Tidak ada catatan aktivitas yang ditemukan.
                          </span>
                          <span className="text-[12px]">
                            Coba sesuaikan kata kunci pencarian atau tanggal.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, index) => {
                      const rowNumber = (meta.current_page - 1) * meta.per_page + index + 1;
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 text-center font-mono text-[12px] text-text-muted">
                            {rowNumber}
                          </td>

                          {/* Waktu */}
                          <td className="py-3 px-3 font-mono text-[12px] text-text-primary whitespace-nowrap">
                            <div>
                              {new Date(log.created_at).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                            <div className="text-[11px] text-text-muted">
                              {new Date(log.created_at).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}{' '}
                              WIB
                            </div>
                          </td>

                          {/* Pelaksana */}
                          <td className="py-3 px-3">
                            <div className="font-semibold text-text-primary text-[12.5px]">
                              {log.user_name || 'System'}
                            </div>
                            <div className="text-[11px] text-text-muted font-mono truncate max-w-[180px]">
                              {log.user_email}
                            </div>
                          </td>

                          {/* Perusahaan */}
                          <td className="py-3 px-3 text-center">
                            {getCompanyBadge(log.company)}
                          </td>

                          {/* Tindakan */}
                          <td className="py-3 px-3">
                            {getActionBadge(log.action)}
                          </td>

                          {/* Modul */}
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-surface-container border border-border-subtle text-text-secondary">
                              {log.module}
                            </span>
                          </td>

                          {/* Deskripsi */}
                          <td className="py-3 px-3">
                            <div className="font-medium text-text-primary text-[12.5px] line-clamp-2" title={log.description}>
                              {log.description}
                            </div>
                          </td>

                          {/* IP Address */}
                          <td className="py-3 px-3 font-mono text-[11px] text-text-muted">
                            {log.ip_address || '-'}
                          </td>

                          {/* Detail Button */}
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
        </div>
      )}

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
