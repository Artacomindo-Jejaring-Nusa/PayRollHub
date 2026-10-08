export interface SPPeriodItem {
  code: string;
  name: string;
  fullLabel: string;
  isCurrent?: boolean;
}

export const SP_PERIOD_LIST: SPPeriodItem[] = [
  { code: 'SP 1', name: 'Surat Pesanan 1', fullLabel: 'SP 1 (Surat Pesanan 1)' },
  { code: 'SP 2', name: 'Surat Pesanan 2', fullLabel: 'SP 2 (Surat Pesanan 2)' },
  { code: 'SP 3', name: 'Surat Pesanan 3', fullLabel: 'SP 3 (Surat Pesanan 3)' },
  { code: 'SP 4', name: 'Surat Pesanan 4', fullLabel: 'SP 4 (Surat Pesanan 4)' },
  { code: 'SP 5', name: 'Surat Pesanan 5', fullLabel: 'SP 5 (Surat Pesanan 5)' },
  { code: 'SP 6', name: 'Surat Pesanan 6', fullLabel: 'SP 6 (Surat Pesanan 6)' },
  { code: 'SP 7', name: 'Surat Pesanan 7', fullLabel: 'SP 7 (Surat Pesanan 7)' },
  { code: 'SP 8', name: 'Surat Pesanan 8', fullLabel: 'SP 8 (Surat Pesanan 8)' },
  { code: 'SP 9', name: 'Surat Pesanan 9', fullLabel: 'SP 9 (Surat Pesanan 9)' },
  { code: 'SP 10', name: 'Surat Pesanan 10', fullLabel: 'SP 10 (Surat Pesanan 10 — Sekarang)', isCurrent: true },
];

export const formatPeriodDisplay = (period?: string | null): string => {
  if (!period) return '-';
  const clean = period.trim();
  const match = SP_PERIOD_LIST.find(
    (item) =>
      item.code.toLowerCase() === clean.toLowerCase() ||
      item.code.replace(' ', '').toLowerCase() === clean.toLowerCase() ||
      clean.toUpperCase().startsWith(item.code.toUpperCase())
  );
  return match ? match.fullLabel : clean;
};
