import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../features/auth/services/authService';
import { useTenantTheme } from '../lib/theme';
import { TenantSwitcher } from '../components/shared/TenantSwitcher';
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
} from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { tenant, tenantId } = useTenantTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isTopNavLayout = tenantId === 'rimamandiri';

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await authService.logout();
    logout();
    navigate('/login');
  };

  const isWorkReportUnlocked = typeof window !== 'undefined' && localStorage.getItem('dev_unlocked_work_reports') === 'true';

  const navItems = [
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
      label: 'Data Penggajian',
      path: '/payrolls',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      adminOnly: false,
    },
    {
      label: 'Laporan Kerja',
      path: '/work-reports',
      icon: <ClipboardList className="w-4 h-4" />,
      adminOnly: false,
      badge: isWorkReportUnlocked ? undefined : '🔒',
    },
    {
      label: 'Pengumuman',
      path: '/announcements',
      icon: <Bell className="w-4 h-4" />,
      adminOnly: false,
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
      superAdminOnly: true,
    },
  ];

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;

  const visibleNavItems = navItems.filter((item) => {
    if (item.superAdminOnly) {
      return isSuperAdmin;
    }
    if (item.adminOnly) {
      return isAdmin;
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
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-700/20 shrink-0">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-headline-page text-[15px] sm:text-[16px] font-bold text-text-primary tracking-tight whitespace-nowrap">
                    HRD Mandiri
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wide whitespace-nowrap">
                    {tenant.badgeText}
                  </span>
                </div>
                <span className="hidden 2xl:block text-[10.5px] text-text-muted font-medium truncate max-w-[160px]">
                  {tenant.companyLegalName}
                </span>
              </div>
            </div>

            {/* Desktop Horizontal Navigation Links (Menu di atas) */}
            <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 2xl:gap-1.5 mx-1 flex-1 min-w-0 justify-center overflow-x-auto no-scrollbar scrollbar-none py-1">
              {visibleNavItems.map((item) => {
                const active = isItemActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-1.5 px-2 xl:px-2.5 py-1.5 rounded-lg text-[12px] xl:text-[12.5px] 2xl:text-[13px] font-medium transition-all whitespace-nowrap ${
                      active
                        ? 'bg-primary text-white shadow-xs font-semibold'
                        : 'text-text-primary hover:bg-surface-container hover:text-primary'
                    }`}
                  >
                    <span className={active ? 'text-white' : 'text-text-muted'}>
                      {item.icon}
                    </span>
                    <span>
                      {item.label === 'Data Penggajian' ? (
                        <>
                          <span className="hidden 2xl:inline">Data </span>
                          <span>Penggajian</span>
                        </>
                      ) : item.label === 'Laporan Kerja' ? (
                        <>
                          <span className="hidden 2xl:inline">Laporan </span>
                          <span>Kerja</span>
                        </>
                      ) : item.label === 'Manajemen Pengguna' ? (
                        <>
                          <span className="hidden 2xl:inline">Manajemen </span>
                          <span>Pengguna</span>
                        </>
                      ) : item.label === 'Log Aktivitas' ? (
                        <>
                          <span className="hidden 2xl:inline">Log </span>
                          <span>Aktivitas</span>
                        </>
                      ) : (
                        item.label
                      )}
                    </span>
                    {item.badge && <span className="text-[10px] ml-0.5">{item.badge}</span>}
                  </Link>
                );
              })}
            </nav>

            {/* Right Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-auto">
              <TenantSwitcher variant="compact" />

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
                    <div className="text-[10.5px] text-text-muted leading-tight">
                      {isSuperAdmin ? 'Super Admin' : (isAdmin ? 'Admin' : 'Staf')}
                    </div>
                  </div>
                  <div
                    className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-emerald-100 shrink-0"
                  >
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
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
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isSuperAdmin
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : (isAdmin
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200')
                        }`}>
                          {isSuperAdmin ? '⭐ Super Administrator' : (isAdmin ? 'Admin Perusahaan' : 'Staf User')}
                        </span>
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
            <div className="md:hidden border-t border-border-row bg-surface-panel px-4 py-3 space-y-2 animate-in slide-in-from-top-2 duration-150">
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
        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-7xl w-full mx-auto overflow-x-hidden">
          <Outlet />
        </main>
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
          <div className="w-9 h-9 rounded-lg bg-primary-container flex items-center justify-center text-white shadow-sm">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <span className="font-headline-page text-[15px] font-semibold text-text-primary tracking-tight">
              HRD Mandiri
            </span>
            <span className="block text-[11px] text-text-muted font-medium">{tenant.shortName}</span>
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-container to-primary flex items-center justify-center text-white shadow-md shadow-primary-container/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-headline-page text-[18px] font-bold text-text-primary tracking-tight">
                  HRD Mandiri
                </span>
              </div>
              <span className="block text-[12px] text-text-muted font-medium">
                {tenant.shortName}
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
            <Badge variant={isSuperAdmin ? 'super_admin' : (isAdmin ? 'admin' : 'user')}>
              {isSuperAdmin ? '⭐ Super Admin' : (isAdmin ? 'Admin' : 'User')}
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
                  <div className="text-[11px] text-text-muted">
                    {isSuperAdmin ? 'Super Admin' : (isAdmin ? 'Admin Perusahaan' : 'Staf User')}
                  </div>
                </div>
                <div className="w-9 h-9 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white shrink-0">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
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
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        isSuperAdmin
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : (isAdmin
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200')
                      }`}>
                        {isSuperAdmin ? '⭐ Super Administrator' : (isAdmin ? 'Admin Perusahaan' : 'Staf User')}
                      </span>
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
        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-7xl w-full mx-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
