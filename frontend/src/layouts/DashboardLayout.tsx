import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../features/auth/services/authService';
import { useTenantTheme, isValidationSubdomain } from '../lib/theme';
import { TenantSwitcher } from '../components/shared/TenantSwitcher';
import { NotificationBell } from '../components/shared/NotificationBell';
import { Badge } from '../components/ui/Badge';
import {
  Wallet,
  Users,
  LogOut,
  Menu,
  X,
  Building2,
  FileSpreadsheet,
  LayoutDashboard,
  ClipboardList,
  Bell,
  Clock,
  ChevronDown,
  ShieldAlert,
  CheckCircle2,
  MessageSquareWarning,
  MessageSquarePlus,
  Sparkles,
  Headphones,
} from 'lucide-react';
import { LiveChatWidget } from '../features/chat/components/LiveChatWidget';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { tenant, tenantId } = useTenantTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [absensiDropdownOpen, setAbsensiDropdownOpen] = useState(false);
  const [systemDropdownOpen, setSystemDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const absensiRef = useRef<HTMLDivElement>(null);
  const systemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (absensiRef.current && !absensiRef.current.contains(e.target as Node)) {
        setAbsensiDropdownOpen(false);
      }
      if (systemRef.current && !systemRef.current.contains(e.target as Node)) {
        setSystemDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setProfileDropdownOpen(false);
    setAbsensiDropdownOpen(false);
    setSystemDropdownOpen(false);
  }, [location.pathname]);

  const isTopNavLayout = tenantId === 'rimamandiri';
  const isRima = tenantId === 'rimamandiri';

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await authService.logout();
    logout();
    navigate('/login');
  };

  interface NavItem {
    label: string;
    path: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
    superAdminOnly?: boolean;
    userOnly?: boolean;
    badge?: string;
    isHold?: boolean;
    validationSubdomainOnly?: boolean;
  }

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      adminOnly: false,
    },
    {
      label: 'Absensi',
      path: '/attendances',
      icon: <Clock className="w-4 h-4" />,
      adminOnly: true,
    },
    {
      label: 'Presensi Saya',
      path: '/my-attendance',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      adminOnly: true,
    },
    {
      label: 'Data Penggajian',
      path: '/payrolls',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      adminOnly: false,
    },
    {
      label: 'Validasi Data',
      path: '/validasi-data',
      icon: <Sparkles className="w-4 h-4 text-indigo-500" />,
      badge: 'AI Hub',
      adminOnly: true,
      validationSubdomainOnly: true,
    },
    {
      label: isRima ? 'Laporan Kegiatan' : 'Laporan Kerja',
      path: '/work-reports',
      icon: <ClipboardList className="w-4 h-4" />,
      adminOnly: true, // Khusus Admin & Super Admin (Role User disembunyikan)
    },
    {
      label: 'Pengumuman',
      path: '/announcements',
      icon: <Bell className="w-4 h-4" />,
      adminOnly: false,
    },
    {
      label: 'Feedback',
      path: '/feedback',
      icon: <MessageSquarePlus className="w-4 h-4 text-amber-500" />,
      userOnly: true, // Khusus tampil untuk role 'user' / 'viewer'
    },
    {
      label: 'Feedback & Keluhan',
      path: '/complaints',
      icon: <MessageSquareWarning className="w-4 h-4 text-amber-500" />,
      adminOnly: true, // Untuk Admin & Super Admin melihat rekap feedback dari user
    },
    {
      label: 'Live Chat CS',
      path: '/live-chat',
      icon: <Headphones className="w-4 h-4 text-amber-500" />,
      adminOnly: true,
      badge: 'Maintenance',
    },
    {
      label: 'Manajemen Pengguna',
      path: '/users',
      icon: <Users className="w-4 h-4" />,
      adminOnly: true,
      superAdminOnly: false,
    },
    {
      label: 'Log Aktivitas',
      path: '/activity-logs',
      icon: <ShieldAlert className="w-4 h-4" />,
      adminOnly: true,
      superAdminOnly: false,
    },
  ];

  const isLordAdmin = user?.role === 'lord_admin';
  const isSuperAdmin = user?.role === 'super_admin' || isLordAdmin;
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const isUserOnly = user?.role === 'user' || user?.role === 'viewer';

  const visibleNavItems = navItems.filter((item) => {
    // Sembunyikan item yang statusnya di-hold sementara
    if (item.isHold) {
      return false;
    }
    // HANYA tampil jika sedang diakses via subdomain (valid.* / validasi.*)
    if (item.validationSubdomainOnly && !isValidationSubdomain()) {
      return false;
    }
    if (item.superAdminOnly) {
      return isSuperAdmin;
    }
    if (item.adminOnly) {
      return isAdmin;
    }
    if (item.userOnly) {
      return isUserOnly;
    }
    return true;
  });

  const isItemActive = (path: string) => {
    return path === '/dashboard'
      ? location.pathname === '/' || location.pathname === '/dashboard'
      : location.pathname === path ||
        (path !== '/' && location.pathname.startsWith(path + '/'));
  };

  // ==============================================================
  // 1. TOP NAVIGATION BAR LAYOUT (Untuk riamamandiripratama.com / Riama Mandiri)
  //    Sidebar pindah ke atas / menu-menu horizontal di atas
  // ==============================================================
  if (isTopNavLayout) {
    return (
      <div className="min-h-screen bg-surface flex flex-col text-on-surface w-full overflow-x-hidden">
        {/* Top Navbar Sticky */}
        <header className="bg-surface-panel border-b border-border-subtle sticky top-0 z-30 shadow-xs">
          <div className="w-full px-3 sm:px-4 lg:px-6 h-16 flex items-center justify-between gap-2">
            {/* Brand Logo & Title */}
            <div className="flex items-center space-x-2 sm:space-x-2.5 flex-shrink-0">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${isRima ? 'from-emerald-600 to-teal-700 shadow-emerald-700/20' : 'from-primary to-blue-700 shadow-primary/20'} flex items-center justify-center text-white shadow-md shrink-0`}>
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-headline-page text-[15px] sm:text-[16px] font-bold text-text-primary tracking-tight whitespace-nowrap">
                    {tenant.appName}
                  </span>
                  {isRima && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wide whitespace-nowrap">
                      {tenant.badgeText}
                    </span>
                  )}
                </div>
                <span className="hidden 2xl:block text-[10.5px] text-text-muted font-medium truncate max-w-[160px]">
                  {tenant.companyLegalName}
                </span>
              </div>
            </div>

            {/* Desktop Horizontal Navigation Links (Menu di atas dengan Dropdown Rapi) */}
            <nav className="hidden lg:flex items-center gap-1.5 xl:gap-2 mx-3 flex-1 min-w-0 justify-start 2xl:justify-center py-1">
              {/* 1. Dashboard */}
              <Link
                to="/dashboard"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] xl:text-[12.5px] font-medium transition-all whitespace-nowrap shrink-0 ${
                  isItemActive('/dashboard')
                    ? 'bg-primary text-white shadow-xs font-semibold'
                    : 'text-text-primary hover:bg-surface-container hover:text-primary'
                }`}
              >
                <LayoutDashboard className={`w-4 h-4 shrink-0 ${isItemActive('/dashboard') ? 'text-white' : 'text-text-muted'}`} />
                <span>Dashboard</span>
              </Link>

              {/* 2. Data Penggajian */}
              <Link
                to="/payrolls"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] xl:text-[12.5px] font-medium transition-all whitespace-nowrap shrink-0 ${
                  isItemActive('/payrolls')
                    ? 'bg-primary text-white shadow-xs font-semibold'
                    : 'text-text-primary hover:bg-surface-container hover:text-primary'
                }`}
              >
                <FileSpreadsheet className={`w-4 h-4 shrink-0 ${isItemActive('/payrolls') ? 'text-white' : 'text-text-muted'}`} />
                <span>Data Penggajian</span>
              </Link>

              {/* 2b. Validasi Data (AI Hub) - Hanya muncul di subdomain */}
              {isAdmin && isValidationSubdomain() && (
                <Link
                  to="/validasi-data"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] xl:text-[12.5px] font-medium transition-all whitespace-nowrap shrink-0 ${
                    isItemActive('/validasi-data')
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-text-primary hover:bg-surface-container hover:text-primary'
                  }`}
                >
                  <Sparkles className={`w-4 h-4 shrink-0 ${isItemActive('/validasi-data') ? 'text-white' : 'text-indigo-500'}`} />
                  <span>Validasi Data</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                      isItemActive('/validasi-data')
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}
                  >
                    AI Hub
                  </span>
                </Link>
              )}

              {/* 3. Absensi (Dropdown untuk Admin, Link untuk Staf) */}
              {isAdmin ? (
                <div className="relative shrink-0" ref={absensiRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setAbsensiDropdownOpen(!absensiDropdownOpen);
                      setSystemDropdownOpen(false);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] xl:text-[12.5px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                      isItemActive('/attendances') || isItemActive('/my-attendance')
                        ? 'bg-primary text-white shadow-xs font-semibold'
                        : 'text-text-primary hover:bg-surface-container hover:text-primary'
                    }`}
                  >
                    <Clock className={`w-4 h-4 shrink-0 ${isItemActive('/attendances') || isItemActive('/my-attendance') ? 'text-white' : 'text-text-muted'}`} />
                    <span>Absensi</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${absensiDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {absensiDropdownOpen && (
                    <div className="absolute left-0 top-full mt-2 w-64 rounded-xl bg-white bg-surface-panel border border-border-subtle shadow-2xl z-50 py-1.5 divide-y divide-border-row animate-in fade-in zoom-in-95 duration-100">
                      <div className="py-1">
                        <Link
                          to="/attendances"
                          onClick={() => setAbsensiDropdownOpen(false)}
                          className={`flex items-start gap-2.5 px-3 py-2 text-[12.5px] transition-colors ${
                            isItemActive('/attendances')
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-text-primary hover:bg-surface-container hover:text-primary'
                          }`}
                        >
                          <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <div>
                            <div className="leading-tight">Rekap Absensi Karyawan</div>
                            <div className="text-[10.5px] text-text-muted mt-0.5">Pantau status & lokasi hadir staf</div>
                          </div>
                        </Link>
                        <Link
                          to="/my-attendance"
                          onClick={() => setAbsensiDropdownOpen(false)}
                          className={`flex items-start gap-2.5 px-3 py-2 text-[12.5px] transition-colors ${
                            isItemActive('/my-attendance')
                              ? 'bg-emerald-50 text-emerald-700 font-semibold'
                              : 'text-text-primary hover:bg-surface-container hover:text-primary'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="leading-tight">Presensi Harian Saya</div>
                            <div className="text-[10.5px] text-text-muted mt-0.5">Check-in & Check-out GPS</div>
                          </div>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/my-attendance"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] xl:text-[12.5px] font-medium transition-all whitespace-nowrap shrink-0 ${
                    isItemActive('/my-attendance')
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-text-primary hover:bg-surface-container hover:text-primary'
                  }`}
                >
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${isItemActive('/my-attendance') ? 'text-white' : 'text-emerald-500'}`} />
                  <span>Presensi Saya</span>
                </Link>
              )}

              {/* 4. Pengumuman (Hanya jika non-admin; untuk Admin dimasukkan ke dropdown Kelola Sistem) */}
              {!isAdmin && (
                <Link
                  to="/announcements"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] xl:text-[12.5px] font-medium transition-all whitespace-nowrap shrink-0 ${
                    isItemActive('/announcements')
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-text-primary hover:bg-surface-container hover:text-primary'
                  }`}
                >
                  <Bell className={`w-4 h-4 shrink-0 ${isItemActive('/announcements') ? 'text-white' : 'text-text-muted'}`} />
                  <span>Pengumuman</span>
                </Link>
              )}

              {/* 4b. Laporan Kerja (Khusus Admin & Super Admin untuk review laporan staf/karyawan) */}
              {isAdmin && (
                <Link
                  to="/work-reports"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] xl:text-[12.5px] font-medium transition-all whitespace-nowrap shrink-0 ${
                    isItemActive('/work-reports')
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-text-primary hover:bg-surface-container hover:text-primary'
                  }`}
                >
                  <ClipboardList className={`w-4 h-4 shrink-0 ${isItemActive('/work-reports') ? 'text-white' : 'text-text-muted'}`} />
                  <span>{isRima ? 'Laporan Kegiatan' : 'Laporan Kerja'}</span>
                </Link>
              )}

              {/* 5. Feedback / Keluhan */}
              {isAdmin ? (
                <Link
                  to="/complaints"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] xl:text-[12.5px] font-medium transition-all whitespace-nowrap shrink-0 ${
                    isItemActive('/complaints')
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-text-primary hover:bg-surface-container hover:text-primary'
                  }`}
                >
                  <MessageSquareWarning className={`w-4 h-4 shrink-0 ${isItemActive('/complaints') ? 'text-white' : 'text-amber-500'}`} />
                  <span>Feedback & Keluhan</span>
                </Link>
              ) : (
                <Link
                  to="/feedback"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] xl:text-[12.5px] font-medium transition-all whitespace-nowrap shrink-0 ${
                    isItemActive('/feedback')
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-text-primary hover:bg-surface-container hover:text-primary'
                  }`}
                >
                  <MessageSquarePlus className={`w-4 h-4 shrink-0 ${isItemActive('/feedback') ? 'text-white' : 'text-amber-500'}`} />
                  <span>Feedback</span>
                </Link>
              )}

              {/* 5b. Live Chat CS */}
              {isAdmin && (
                <Link
                  to="/live-chat"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] xl:text-[12.5px] font-medium transition-all whitespace-nowrap shrink-0 ${
                    isItemActive('/live-chat')
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-text-primary hover:bg-surface-container hover:text-primary'
                  }`}
                >
                  <Headphones className={`w-4 h-4 shrink-0 ${isItemActive('/live-chat') ? 'text-white' : 'text-emerald-500'}`} />
                  <span>Live Chat</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                      isItemActive('/live-chat')
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    CS Desk
                  </span>
                </Link>
              )}

              {/* 6. Kelola Sistem (Dropdown untuk Manajemen Pengguna, Pengumuman, & Log Aktivitas) */}
              {isAdmin && (
                <div className="relative shrink-0" ref={systemRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setSystemDropdownOpen(!systemDropdownOpen);
                      setAbsensiDropdownOpen(false);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] xl:text-[12.5px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                      isItemActive('/users') || isItemActive('/activity-logs') || isItemActive('/announcements')
                        ? 'bg-primary text-white shadow-xs font-semibold'
                        : 'text-text-primary hover:bg-surface-container hover:text-primary'
                    }`}
                  >
                    <Users className={`w-4 h-4 shrink-0 ${isItemActive('/users') || isItemActive('/activity-logs') || isItemActive('/announcements') ? 'text-white' : 'text-text-muted'}`} />
                    <span>Kelola Sistem</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${systemDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {systemDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-white bg-surface-panel border border-border-subtle shadow-2xl z-50 py-1.5 divide-y divide-border-row animate-in fade-in zoom-in-95 duration-100">
                      <div className="py-1">
                        <Link
                          to="/users"
                          onClick={() => setSystemDropdownOpen(false)}
                          className={`flex items-start gap-2.5 px-3 py-2 text-[12.5px] transition-colors ${
                            isItemActive('/users')
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-text-primary hover:bg-surface-container hover:text-primary'
                          }`}
                        >
                          <Users className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <div>
                            <div className="leading-tight">Manajemen Pengguna</div>
                            <div className="text-[10.5px] text-text-muted mt-0.5">Kelola akun admin & staf</div>
                          </div>
                        </Link>
                        <Link
                          to="/announcements"
                          onClick={() => setSystemDropdownOpen(false)}
                          className={`flex items-start gap-2.5 px-3 py-2 text-[12.5px] transition-colors ${
                            isItemActive('/announcements')
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-text-primary hover:bg-surface-container hover:text-primary'
                          }`}
                        >
                          <Bell className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <div>
                            <div className="leading-tight">Pengumuman</div>
                            <div className="text-[10.5px] text-text-muted mt-0.5">Kelola informasi & edaran</div>
                          </div>
                        </Link>
                        {isSuperAdmin && (
                          <Link
                            to="/activity-logs"
                            onClick={() => setSystemDropdownOpen(false)}
                            className={`flex items-start gap-2.5 px-3 py-2 text-[12.5px] transition-colors ${
                              isItemActive('/activity-logs')
                                ? 'bg-amber-50 text-amber-800 font-semibold'
                                : 'text-text-primary hover:bg-surface-container hover:text-primary'
                            }`}
                          >
                            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <div className="leading-tight">Log Aktivitas</div>
                              <div className="text-[10.5px] text-text-muted mt-0.5">Audit trail & riwayat sistem</div>
                            </div>
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </nav>

            {/* Right Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-auto">
              <TenantSwitcher variant="compact" />
              <NotificationBell />

              <div className="hidden sm:block h-5 w-px bg-border-subtle" />

              {/* User Profile Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-1.5 sm:gap-2 py-1 px-1.5 sm:px-2 rounded-xl hover:bg-surface-container border border-transparent hover:border-border-subtle transition-all cursor-pointer"
                  title="Menu Profil & Akun"
                >
                  <div className="text-right hidden 2xl:block">
                    <div className="font-semibold text-[12.5px] text-text-primary leading-tight truncate max-w-[120px]">
                      {user?.name}
                    </div>
                    <div className="text-[10.5px] leading-tight">
                      {isLordAdmin ? (
                        <span className="font-black text-amber-600 dark:text-amber-400 tracking-wide">
                          👑 Lord Admin
                        </span>
                      ) : (
                        <span className="text-text-muted">
                          {isSuperAdmin ? 'Super Admin' : (isAdmin ? 'Admin' : 'Staf')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm shrink-0 ${
                      isLordAdmin
                        ? 'bg-gradient-to-tr from-purple-950 via-indigo-950 to-slate-900 text-amber-300 ring-2 ring-amber-400/80 shadow-amber-500/20'
                        : 'bg-emerald-700 text-white ring-2 ring-emerald-100'
                    }`}
                  >
                    {isLordAdmin ? '👑' : (user?.name?.charAt(0).toUpperCase() || 'U')}
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-text-muted transition-transform duration-150 ${
                      profileDropdownOpen ? 'rotate-180 text-primary' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-surface-panel border border-border-subtle shadow-xl z-50 py-1 divide-y divide-border-row animate-in fade-in zoom-in-95 duration-100">
                    {/* User Header Info */}
                    <div className="px-3.5 py-2.5">
                      <div className="font-semibold text-[13px] text-text-primary leading-tight truncate">
                        {user?.name}
                      </div>
                      <div className="text-[11px] text-text-muted truncate mt-0.5">
                        {user?.email || '-'}
                      </div>
                      <div className="mt-1.5">
                        {isLordAdmin ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-amber-300 border border-amber-400/60 ring-1 ring-amber-400/40 shadow-xs">
                            👑 Lord Admin (Owner)
                          </span>
                        ) : (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isSuperAdmin
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : (isAdmin
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200')
                          }`}>
                            {isSuperAdmin ? '⭐ Super Administrator' : (isAdmin ? 'Admin Perusahaan' : 'Staf User')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Items */}
                    <div className="p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          handleLogout();
                        }}
                        disabled={isLoggingOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50 text-left"
                      >
                        <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>Keluar (Logout)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Menu Toggle Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-container transition-colors shrink-0"
                aria-label="Toggle navigation"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Drawer Navigation */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-border-row bg-surface-panel px-4 py-3 space-y-2 animate-in slide-in-from-top-2 duration-150">
              <div className="px-2 pb-1 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                Menu Utama — {tenant.shortName}
              </div>
              {visibleNavItems.map((item) => {
                const active = isItemActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all ${
                      active
                        ? 'bg-primary text-white font-semibold'
                        : 'text-text-primary hover:bg-surface-container'
                    }`}
                  >
                    <span className={active ? 'text-white' : 'text-text-muted'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                    {item.badge && <span className="text-[10px] ml-0.5">{item.badge}</span>}
                  </Link>
                );
              })}

              <div className="pt-2 border-t border-border-row flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[13px] text-text-primary">{user?.name}</div>
                  <div className="text-[11px] text-text-muted">{user?.email}</div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-rose-600 hover:text-rose-700 bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200/80 rounded-lg transition-all shadow-2xs"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Page Content */}
        <main className="flex-1 px-3 sm:px-4 lg:px-6 py-4 sm:py-6 pb-20 w-full max-w-[1780px] 2xl:max-w-[1920px] mx-auto overflow-x-hidden">
          <Outlet />
        </main>

        {/* Floating Live Chat & AI Bot Widget */}
        <LiveChatWidget />
      </div>
    );
  }

  // ==============================================================
  // 2. VERTICAL SIDEBAR LAYOUT (Untuk rimbunbuanasejahtera.com / RBS Global)
  //    Sidebar tetap di samping kiri
  // ==============================================================
  return (
    <div className="min-h-screen bg-surface flex flex-col lg:flex-row text-on-surface w-full overflow-x-hidden">
      {/* Mobile Header Bar */}
      <div className="lg:hidden bg-surface-panel border-b border-border-subtle px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-2.5">
          <div className={`w-9 h-9 rounded-lg ${isRima ? 'bg-emerald-600' : 'bg-primary-container'} flex items-center justify-center text-white shadow-sm`}>
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <span className="font-headline-page text-[15px] font-semibold text-text-primary tracking-tight">
              {tenant.appName}
            </span>
            <span className="block text-[11px] text-text-muted font-medium">{tenant.companyLegalName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TenantSwitcher variant="compact" />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-container transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-surface-panel border-r border-border-subtle flex flex-col justify-between transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-0 max-lg:-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-border-row">
          <div className="flex items-center space-x-3 mb-2">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${isRima ? 'from-emerald-600 to-teal-700 shadow-emerald-700/20' : 'from-primary-container to-primary shadow-primary-container/20'} flex items-center justify-center text-white shadow-md`}>
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-headline-page text-[18px] font-bold text-text-primary tracking-tight">
                  {tenant.appName}
                </span>
              </div>
              <span className="block text-[12px] text-text-muted font-medium">
                {tenant.companyLegalName}
              </span>
            </div>
          </div>

          <div
            className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border-row/60 text-[11px] text-text-muted font-medium"
            title={tenant.companyLegalName}
          >
            <Building2 className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
            <span className="truncate">{tenant.companyLegalName}</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            Menu Utama
          </div>
          {visibleNavItems.map((item) => {
            const isActive = isItemActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-body-medium font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-primary-container text-white shadow-sm font-semibold'
                    : 'text-text-primary hover:bg-surface-container-low hover:text-primary'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-text-muted'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.badge && <span className="text-[10px] ml-auto">{item.badge}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Logout Bottom Box */}
        <div className="p-4 border-t border-border-row bg-surface-container-low/50">
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0 flex-1 pr-2">
              <div className="font-body-semibold text-[13px] text-text-primary truncate">
                {user?.name || 'Pengguna'}
              </div>
              <div className="text-[11px] text-text-muted truncate">
                {user?.email || '-'}
              </div>
            </div>
            <Badge variant={isLordAdmin ? 'lord_admin' : (isSuperAdmin ? 'super_admin' : (isAdmin ? 'admin' : 'user'))}>
              {isLordAdmin ? '👑 Lord Admin' : (isSuperAdmin ? '⭐ Super Admin' : (isAdmin ? 'Admin' : 'User'))}
            </Badge>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-medium text-rose-600 hover:text-rose-700 bg-rose-50/70 hover:bg-rose-100/80 rounded-lg transition-all border border-rose-200/80 hover:border-rose-300 shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* Backdrop for Mobile Menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Desktop Header */}
        <header className="hidden lg:flex bg-surface-panel border-b border-border-subtle h-16 px-8 items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="font-headline-page text-[18px] font-semibold text-text-primary">
              {tenant.portalTitle}
            </span>
            <span className="text-border-subtle">|</span>
            <span className="text-[12px] font-medium text-text-muted">
              {tenant.shortName}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <TenantSwitcher />
            <NotificationBell />
            <div className="h-6 w-px bg-border-subtle" />
            
            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 py-1 px-2 rounded-xl hover:bg-surface-container border border-transparent hover:border-border-subtle transition-all cursor-pointer"
              >
                <div className="text-right">
                  <div className="font-semibold text-[13px] text-text-primary">
                    {user?.name}
                  </div>
                  <div className="text-[11px] leading-tight">
                    {isLordAdmin ? (
                      <span className="font-black text-amber-600 dark:text-amber-400 tracking-wide">
                        👑 Lord Admin
                      </span>
                    ) : (
                      <span className="text-text-muted">
                        {isSuperAdmin ? 'Super Admin' : (isAdmin ? 'Admin Perusahaan' : 'Staf User')}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-sm shrink-0 ${
                    isLordAdmin
                      ? 'bg-gradient-to-tr from-purple-950 via-indigo-950 to-slate-900 text-amber-300 ring-2 ring-amber-400/80 shadow-amber-500/20'
                      : 'bg-primary-container text-white ring-2 ring-white'
                  }`}
                >
                  {isLordAdmin ? '👑' : (user?.name?.charAt(0).toUpperCase() || 'U')}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform duration-150 ${profileDropdownOpen ? 'rotate-180 text-primary' : ''}`} />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-surface-panel border border-border-subtle shadow-xl z-50 py-1 divide-y divide-border-row animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3.5 py-2.5">
                    <div className="font-semibold text-[13px] text-text-primary leading-tight truncate">
                      {user?.name}
                    </div>
                    <div className="text-[11px] text-text-muted truncate mt-0.5">
                      {user?.email || '-'}
                    </div>
                    <div className="mt-1.5">
                      {isLordAdmin ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-amber-300 border border-amber-400/60 ring-1 ring-amber-400/40 shadow-xs">
                          👑 Lord Admin (Owner)
                        </span>
                      ) : (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isSuperAdmin
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : (isAdmin
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200')
                        }`}>
                          {isSuperAdmin ? '⭐ Super Administrator' : (isAdmin ? 'Admin Perusahaan' : 'Staf User')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }}
                      disabled={isLoggingOut}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50 text-left"
                    >
                      <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>Keluar (Logout)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-3 sm:px-4 lg:px-6 py-4 sm:py-6 pb-20 w-full max-w-[1780px] 2xl:max-w-[1920px] mx-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Floating Live Chat & AI Bot Widget */}
      <LiveChatWidget />
    </div>
  );
};
