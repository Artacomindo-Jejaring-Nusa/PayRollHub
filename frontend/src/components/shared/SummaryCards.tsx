import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { PayrollMetrics } from '../../types/payroll';
import { Users, UserCheck, UserX, Building2, ArrowUpRight } from 'lucide-react';

export interface SummaryCardsProps {
  metrics: PayrollMetrics;
  isLoading?: boolean;
  isAdmin?: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  metrics,
  isLoading,
}) => {
  const navigate = useNavigate();

  const activeCount =
    metrics.total_active_employees ??
    Math.max(0, metrics.total_employees - (metrics.total_off_employees ?? 0));
  const offCount = metrics.total_off_employees ?? 0;

  const cards = [
    {
      title: 'Total Karyawan',
      value: `${metrics.total_employees} Orang`,
      icon: <Users className="w-5 h-5 text-blue-600" />,
      bgIcon: 'bg-blue-50',
      description: 'Total seluruh data terdaftar',
      to: '/payrolls',
      tooltip: 'Klik untuk melihat seluruh data di tabel penggajian',
      actionText: 'Buka Tabel',
    },
    {
      title: 'Karyawan Aktif',
      value: `${activeCount} Orang`,
      icon: <UserCheck className="w-5 h-5 text-emerald-600" />,
      bgIcon: 'bg-emerald-50',
      badge: `${metrics.total_employees > 0 ? Math.round((activeCount / metrics.total_employees) * 100) : 100}% Aktif`,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description: 'Tenaga kerja aktif bertugas',
      to: '/payrolls?status=active',
      tooltip: 'Klik untuk memfilter karyawan aktif di tabel',
      actionText: 'Filter Aktif',
    },
    {
      title: 'Karyawan Off / Keluar',
      value: `${offCount} Orang`,
      icon: <UserX className="w-5 h-5 text-rose-600" />,
      bgIcon: 'bg-rose-50',
      badge: offCount > 0 ? `${offCount} Non-Aktif` : '0 Off',
      badgeColor: offCount > 0 ? 'bg-rose-50 text-rose-700 border-rose-200 font-semibold' : 'bg-slate-100 text-slate-600 border-slate-200',
      highlightDanger: offCount > 0,
      description: 'Status berhenti / non-aktif',
      to: '/payrolls?status=off',
      tooltip: 'Klik untuk memfilter karyawan off / keluar di tabel',
      actionText: 'Filter Off',
    },
    {
      title: 'Cakupan Wilayah',
      value: `${metrics.total_provinces ?? 0} Provinsi`,
      icon: <Building2 className="w-5 h-5 text-primary" />,
      bgIcon: 'bg-primary-fixed',
      highlight: true,
      description: `${metrics.total_locations ?? 0} Unit Sekolah Rakyat`,
      to: '/payrolls',
      tooltip: 'Klik untuk melihat data per wilayah di tabel',
      actionText: 'Buka Tabel',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <Card
          key={idx}
          onClick={() => !isLoading && navigate(card.to)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
              e.preventDefault();
              navigate(card.to);
            }
          }}
          title={card.tooltip}
          className={`p-4 flex flex-col justify-between transition-all duration-200 cursor-pointer group hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] select-none ${
            card.highlight
              ? 'border-primary/30 bg-gradient-to-br from-white to-blue-50/40 shadow-sm ring-1 ring-primary/10 hover:border-primary/60'
              : card.highlightDanger
              ? 'border-rose-200 bg-gradient-to-br from-white to-rose-50/20 shadow-sm hover:border-rose-400'
              : 'hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            {isLoading ? (
              <Skeleton className="h-4 w-24 rounded" />
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="font-caption-medium text-caption-medium text-text-muted group-hover:text-text-primary transition-colors">
                  {card.title}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            )}
            {isLoading ? (
              <Skeleton className="w-8 h-8 rounded-lg" />
            ) : (
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.bgIcon} group-hover:scale-105 transition-transform`}
              >
                {card.icon}
              </div>
            )}
          </div>

          <div className="mt-3">
            {isLoading ? (
              <div className="space-y-1.5 py-0.5">
                <Skeleton className="h-7 w-36 rounded" />
                <Skeleton className="h-3.5 w-24 rounded" />
              </div>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <div
                    className={`font-display-kpi text-[20px] lg:text-[22px] font-bold tracking-tight truncate group-hover:text-primary transition-colors ${
                      card.highlight
                        ? 'text-primary'
                        : card.highlightDanger
                        ? 'text-rose-700 group-hover:text-rose-800'
                        : 'text-text-primary'
                    }`}
                  >
                    {card.value}
                  </div>
                  {card.badge && (
                    <span
                      className={`text-[10.5px] px-2 py-0.5 rounded-full border ${card.badgeColor}`}
                    >
                      {card.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <p className="font-caption-regular text-[11px] text-text-muted truncate">
                    {card.description}
                  </p>
                  <span className="text-[10.5px] font-semibold text-primary/80 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {card.actionText} →
                  </span>
                </div>
              </>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};
