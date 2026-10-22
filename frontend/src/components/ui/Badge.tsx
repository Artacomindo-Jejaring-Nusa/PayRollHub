import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'lord_admin' | 'super_admin' | 'province' | 'admin' | 'user' | 'viewer' | 'karyawan' | 'success' | 'danger' | 'info' | 'role' | 'active' | 'off' | 'default';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'default',
  ...props
}) => {
  const variants = {
    lord_admin: 'bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900 text-amber-300 border border-amber-400/60 font-black shadow-sm ring-1 ring-amber-400/40 tracking-wider',
    super_admin: 'bg-amber-50 text-amber-800 border border-amber-300 font-bold shadow-2xs',
    province: 'bg-badge-province-bg text-badge-province-text border border-blue-200/60 font-semibold tracking-wide uppercase',
    role: 'bg-teal-50 text-teal-700 border border-teal-200 font-medium',
    admin: 'bg-purple-50 text-purple-700 border border-purple-200 font-semibold',
    user: 'bg-blue-50 text-blue-700 border border-blue-200 font-medium',
    viewer: 'bg-slate-100 text-slate-700 border border-slate-200',
    karyawan: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium',
    active: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium',
    off: 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold',
    success: 'bg-status-success-bg text-status-success-text border border-emerald-200',
    danger: 'bg-red-50 text-status-danger-text border border-red-200',
    info: 'bg-blue-50 text-blue-700 border border-blue-200',
    default: 'bg-surface-container text-on-surface-variant border border-border-subtle',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded text-[11px] whitespace-nowrap shrink-0 transition-colors select-none',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
