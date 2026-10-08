import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | undefined | null): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (num === null || num === undefined || isNaN(num)) {
    return 'Rp 0';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatPeriod(period: string | undefined): string {
  if (!period) {
    return '-';
  }
  const clean = period.trim();
  if (/^SP\s*\d+/i.test(clean)) {
    return clean;
  }
  if (/^\d{4}-\d{2}$/.test(clean)) {
    const [year, month] = clean.split('-');
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    const mIndex = parseInt(month, 10) - 1;
    return `${monthNames[mIndex] || month} ${year}`;
  }
  return clean;
}
