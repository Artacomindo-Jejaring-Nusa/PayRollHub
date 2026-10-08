import React from 'react';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { PayrollMetrics } from '../../types/payroll';
import { Users, UserCheck, UserX, MapPin, Building2 } from 'lucide-react';

export interface SummaryCardsProps {
  metrics: PayrollMetrics;
  isLoading?: boolean;
  isAdmin?: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  metrics,
  isLoading,
}) => {
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
    },
    {
      title: 'Karyawan Aktif',
      value: `${activeCount} Orang`,
      icon: <UserCheck className="w-5 h-5 text-emerald-600" />,
      bgIcon: 'bg-emerald-50',
      badge: `${metrics.total_employees > 0 ? Math.round((activeCount / metrics.total_employees) * 100) : 100}% Aktif`,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description: 'Tenaga kerja aktif bertugas',
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
    },
    {
      title: 'Cakupan Wilayah',
      value: `${metrics.total_provinces ?? 0} Provinsi`,
      icon: <Building2 className="w-5 h-5 text-primary" />,
      bgIcon: 'bg-primary-fixed',
      highlight: true,
      description: `${metrics.total_locations ?? 0} Unit Sekolah Rakyat`,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <Card
          key={idx}
          className={`p-4 flex flex-col justify-between transition-all duration-200 ${
            card.highlight
              ? 'border-primary/30 bg-gradient-to-br from-white to-blue-50/40 shadow-sm ring-1 ring-primary/10'
              : card.highlightDanger
              ? 'border-rose-200 bg-gradient-to-br from-white to-rose-50/20 shadow-sm'
              : ''
          }`}
        >
          <div className="flex items-center justify-between">
            {isLoading ? (
              <Skeleton className="h-4 w-24 rounded" />
            ) : (
              <span className="font-caption-medium text-caption-medium text-text-muted">
                {card.title}
              </span>
            )}
            {isLoading ? (
              <Skeleton className="w-8 h-8 rounded-lg" />
            ) : (
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.bgIcon}`}>
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
                    className={`font-display-kpi text-[20px] lg:text-[22px] font-bold tracking-tight truncate ${
                      card.highlight
                        ? 'text-primary'
                        : card.highlightDanger
                        ? 'text-rose-700'
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
                <p className="font-caption-regular text-[11px] text-text-muted mt-0.5 truncate">
                  {card.description}
                </p>
              </>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};
