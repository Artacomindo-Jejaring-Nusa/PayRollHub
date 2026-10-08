import React, { useState } from 'react';
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
} from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { tenant, tenantId } = useTenantTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isTopNavLayout = tenantId === 'rimamandiri';

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await authService.logout();
    logout();
    navigate('/login');
  };

  const navItems = [
    {
      label: 'Dashboard Overview',
      path: '/dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      adminOnly: false,
    },
    {
      label: 'Data Penggajian',
      path: '/payrolls',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      adminOnly: false,
    },
    {
      label: 'Manajemen Pengguna',
      path: '/users',
      icon: <Users className="w-4 h-4" />,
      adminOnly: true,
    },
  ];

  const visibleNavItems = navItems.filter(
    (item) => !item.adminOnly || user?.role === 'admin'
  );

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
      <div className="min-h-screen bg-surface flex flex-col text-on-surface">
        {/* Top Navbar Sticky */}
        <header className="bg-surface-panel border-b border-border-subtle sticky top-0 z-30 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            {/* Brand Logo & Title */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-700/20">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-headline-page text-[17px] sm:text-[18px] font-bold text-text-primary tracking-tight">
                    HRD Mandiri
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wide">
                    {tenant.badgeText}
                  </span>
                </div>
                <span className="block text-[11px] text-text-muted font-medium truncate max-w-[180px] sm:max-w-none">
                  {tenant.companyLegalName}
                </span>
              </div>
            </div>

            {/* Desktop Horizontal Navigation Links (Menu di atas) */}
            <nav className="hidden md:flex items-center gap-1.5 mx-4">
              {visibleNavItems.map((item) => {
                const active = isItemActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all ${
                      active
                        ? 'bg-primary text-white shadow-xs font-semibold'
                        : 'text-text-primary hover:bg-surface-container hover:text-primary'
                    }`}
                  >
                    <span className={active ? 'text-white' : 'text-text-muted'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Controls */}
            <div className="flex items-center gap-2 sm:gap-3.5 flex-shrink-0">
              <TenantSwitcher variant="compact" />

              <div className="hidden lg:block h-6 w-px bg-border-subtle" />

              {/* User Profile Info */}
              <div className="hidden lg:flex items-center gap-2.5">
                <div className="text-right">
                  <div className="font-body-semibold text-[13px] text-text-primary leading-tight">
                    {user?.name}
                  </div>
                  <div className="text-[11px] text-text-muted">
                    {user?.role === 'admin' ? 'Super Administrator' : 'Staf User (Read-Only)'}
                  </div>
                </div>
                <div className="w-9 h-9 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium text-status-danger-text hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                title="Keluar Akun"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Keluar</span>
              </button>

              {/* Mobile Menu Toggle Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-container transition-colors"
                aria-label="Toggle navigation"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
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
                  </Link>
                );
              })}

              <div className="pt-2 border-t border-border-row flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[13px] text-text-primary">{user?.name}</div>
                  <div className="text-[11px] text-text-muted">{user?.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-status-danger-text hover:bg-red-50 rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
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
    <div className="min-h-screen bg-surface flex flex-col lg:flex-row text-on-surface">
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
            <Badge variant={user?.role === 'admin' ? 'admin' : 'user'}>
              {user?.role === 'admin' ? 'Admin' : 'User'}
            </Badge>
          </div>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-medium text-status-danger-text hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
          >
            <LogOut className="w-4 h-4" />
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

          <div className="flex items-center gap-4">
            <TenantSwitcher />
            <div className="h-6 w-px bg-border-subtle" />
            <div className="text-right">
              <div className="font-body-semibold text-[13px] text-text-primary">
                {user?.name}
              </div>
              <div className="text-[11px] text-text-muted">
                {user?.role === 'admin' ? 'Super Administrator' : 'Staf User (View & Search)'}
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
