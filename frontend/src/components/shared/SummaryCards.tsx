import React from 'react';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { formatCurrency } from '../../lib/utils';
import { PayrollMetrics } from '../../types/payroll';
import { Users, DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

export interface SummaryCardsProps {
  metrics: PayrollMetrics;
  isLoading?: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ metrics, isLoading }) => {
  const cards = [
    {
      title: 'Total Karyawan',
      value: `${metrics.total_employees} Orang`,
      icon: <Users className="w-5 h-5 text-blue-600" />,
      bgIcon: 'bg-blue-50',
      description: 'Dalam periode/filter aktif',
    },
    {
      title: 'Total Gaji Pokok',
      value: formatCurrency(metrics.total_basic_salary),
      icon: <DollarSign className="w-5 h-5 text-indigo-600" />,
      bgIcon: 'bg-indigo-50',
      description: 'Akumulasi dasar',
    },
    {
      title: 'Total Tunjangan',
      value: formatCurrency(metrics.total_allowance),
      icon: <TrendingUp className="w-5 h-5 text-emerald-600" />,
      bgIcon: 'bg-emerald-50',
      description: 'Tunjangan & lembur',
    },
    {
      title: 'Total Potongan',
      value: formatCurrency(metrics.total_deduction),
      icon: <TrendingDown className="w-5 h-5 text-red-600" />,
      bgIcon: 'bg-red-50',
      description: 'BPJS, PPh21, absensi',
    },
    {
      title: 'Total Take Home Pay',
      value: formatCurrency(metrics.total_take_home_pay),
      icon: <Wallet className="w-5 h-5 text-primary" />,
      bgIcon: 'bg-primary-fixed',
      highlight: true,
      description: 'Total dana dicairkan',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card, idx) => (
        <Card
          key={idx}
          className={`p-4 flex flex-col justify-between transition-all duration-200 ${
            card.highlight
              ? 'border-primary/30 bg-gradient-to-br from-white to-blue-50/40 shadow-sm ring-1 ring-primary/10'
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
                <div
                  className={`font-display-kpi text-[20px] lg:text-[22px] font-bold tracking-tight truncate ${
                    card.highlight ? 'text-primary' : 'text-text-primary'
                  }`}
                >
                  {card.value}
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
