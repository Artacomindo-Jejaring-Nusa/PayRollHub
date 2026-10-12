import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../features/auth/services/authService';
import { useTenantTheme } from '../lib/theme';
import {
  Wallet,
  Home,
  Clock,
  FileText,
  ClipboardList,
  Bell,
  User,
  LogOut,
  MessageSquareWarning,
} from 'lucide-react';

export const EmployeeLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { tenant } = useTenantTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      // ignore
    }
    logout();
    navigate('/login');
  };

  const isWorkReportUnlocked = typeof window !== 'undefined' && localStorage.getItem('dev_unlocked_work_reports') === 'true';

  const navItems = [
    { label: 'Beranda', path: '/employee/dashboard', icon: Home },
    { label: 'Absensi', path: '/employee/attendance', icon: Clock },
    { label: 'Slip Gaji', path: '/employee/payrolls', icon: FileText },
    {
      label: 'Laporan Kerja',
      path: '/employee/reports',
      icon: ClipboardList,
      badge: isWorkReportUnlocked ? undefined : '🔒',
      isHold: true, // Di-hold sementara
    },
    { label: 'Pengumuman', path: '/employee/announcements', icon: Bell },
    { label: 'Keluhan & Bantuan', path: '/employee/complaints', icon: MessageSquareWarning },
    { label: 'Profil Saya', path: '/employee/profile', icon: User },
  ];

  const visibleNavItems = navItems.filter((item) => !(item as any).isHold);

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'K';

  return (
    <div className="min-h-screen bg-surface flex flex-col text-on-surface antialiased pb-20 md:pb-0">
      {/* ============================================================== */}
      {/* 1. TOP HEADER BAR (Logo, Brand Title, & User Account Profile) */}
      {/* ============================================================== */}
      <header className="bg-surface-panel border-b border-border-subtle sticky top-0 z-40 shadow-xs">
        {/* Tier 1: Brand & User Controls */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 sm:pt-9 pb-5 sm:pb-6 min-h-[92px] sm:min-h-[98px] flex items-center justify-between gap-4">
          {/* Brand Logo & Company Title */}
          <div className="flex items-center space-x-3.5 flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-headline-page text-[17px] sm:text-[18px] font-bold text-text-primary tracking-tight">
                  Portal Karyawan
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                  {tenant.badgeText}
                </span>
              </div>
              <span className="block text-[12px] text-text-muted font-medium mt-0.5">
                {tenant.companyLegalName}
              </span>
            </div>
          </div>

          {/* Right Section: User Profile Chip & Logout */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* User Chip */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="font-semibold text-[13.5px] text-text-primary leading-tight">
                  {user?.name}
                </div>
                <div className="text-[11.5px] text-text-muted font-mono mt-0.5">
                  NIK: {user?.nik || '-'}
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                {userInitial}
              </div>
            </div>

            <div className="h-6 w-px bg-border-subtle" />

            {/* Logout Button (Always clearly visible on Mobile & Desktop) */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-[12.5px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all border border-rose-200 shadow-2xs cursor-pointer active:scale-95 shrink-0"
              title="Keluar dari Akun"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="font-semibold text-[11px] sm:text-xs">Keluar</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Dedicated Navigation Tab Bar (Desktop & Tablet) */}
        <div className="hidden md:block border-t border-border-subtle bg-surface-panel/80 backdrop-blur-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2.5 py-2.5 sm:py-3 overflow-x-auto">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg text-[13.5px] font-medium transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-primary text-white shadow-xs font-semibold'
                        : 'text-text-primary hover:bg-surface-container hover:text-primary'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-text-muted'}`} />
                      <span>{item.label}</span>
                      {item.badge && <span className="text-[10px] ml-0.5">{item.badge}</span>}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. MAIN PAGE CONTENT (Generous Padding & Standard Container)  */}
      {/* ============================================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <Outlet />
      </main>

      {/* ============================================================== */}
      {/* 3. MOBILE BOTTOM NAVIGATION (Only for screens < 768px)        */}
      {/* ============================================================== */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface-panel border-t border-border-subtle z-40 px-3 py-2 shadow-lg flex items-center justify-around">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[11px] transition-colors ${
                  isActive
                    ? 'text-primary font-bold'
                    : 'text-text-muted hover:text-text-primary font-medium'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="flex items-center gap-0.5">
                <span>{item.label}</span>
                {item.badge && <span className="text-[9px]">{item.badge}</span>}
              </span>
            </NavLink>
          );
        })}

        {/* Quick Logout for Mobile Bottom Navigation */}
        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[11px] text-rose-600 hover:text-rose-700 font-semibold active:scale-95 transition-all cursor-pointer"
          title="Keluar dari Akun"
        >
          <LogOut className="w-5 h-5 mb-1 text-rose-500" />
          <span>Keluar</span>
        </button>
      </nav>
    </div>
  );
};
