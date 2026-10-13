export interface SPPeriodItem {
  code: string;
  name: string;
  fullLabel: string;
  isCurrent?: boolean;
}

export const MONTH_NAMES: { [key: number]: string } = {
  1: 'Januari',
  2: 'Februari',
  3: 'Maret',
  4: 'April',
  5: 'Mei',
  6: 'Juni',
  7: 'Juli',
  8: 'Agustus',
  9: 'September',
  10: 'Oktober',
  11: 'November',
  12: 'Desember',
};

export const SP_PERIOD_LIST: SPPeriodItem[] = [
  { code: 'SP 1', name: 'Surat Pesanan 1', fullLabel: 'Januari 2026 (SP 1)' },
  { code: 'SP 2', name: 'Surat Pesanan 2', fullLabel: 'Februari 2026 (SP 2)' },
  { code: 'SP 3', name: 'Surat Pesanan 3', fullLabel: 'Maret 2026 (SP 3)' },
  { code: 'SP 4', name: 'Surat Pesanan 4', fullLabel: 'April 2026 (SP 4)' },
  { code: 'SP 5', name: 'Surat Pesanan 5', fullLabel: 'Mei 2026 (SP 5)' },
  { code: 'SP 6', name: 'Surat Pesanan 6', fullLabel: 'Juni 2026 (SP 6)' },
  { code: 'SP 7', name: 'Surat Pesanan 7', fullLabel: 'Juli 2026 (SP 7)' },
  { code: 'SP 8', name: 'Surat Pesanan 8', fullLabel: 'Agustus 2026 (SP 8)' },
  { code: 'SP 9', name: 'Surat Pesanan 9', fullLabel: 'September 2026 (SP 9)' },
  { code: 'SP 10', name: 'Surat Pesanan 10', fullLabel: 'Oktober 2026 (SP 10)' },
  { code: 'SP 11', name: 'Surat Pesanan 11', fullLabel: 'November 2026 (SP 11)' },
  { code: 'SP 12', name: 'Surat Pesanan 12', fullLabel: 'Desember 2026 (SP 12)' },
];

export const MONTH_PERIOD_OPTIONS = [
  { code: 'SP 1', label: 'Januari 2026 (SP 1)' },
  { code: 'SP 2', label: 'Februari 2026 (SP 2)' },
  { code: 'SP 3', label: 'Maret 2026 (SP 3)' },
  { code: 'SP 4', label: 'April 2026 (SP 4)' },
  { code: 'SP 5', label: 'Mei 2026 (SP 5)' },
  { code: 'SP 6', label: 'Juni 2026 (SP 6)' },
  { code: 'SP 7', label: 'Juli 2026 (SP 7)' },
  { code: 'SP 8', label: 'Agustus 2026 (SP 8)' },
  { code: 'SP 9', label: 'September 2026 (SP 9)' },
  { code: 'SP 10', label: 'Oktober 2026 (SP 10)' },
  { code: 'SP 11', label: 'November 2026 (SP 11)' },
  { code: 'SP 12', label: 'Desember 2026 (SP 12)' },
];

export const normalizePeriodToSP = (period?: string | null): string => {
  if (!period) return 'SP 1';
  const clean = period.trim();

  // Jika sudah format SP, e.g. "SP 1", "SP1", "sp 2"
  const spMatch = clean.match(/^SP\s*(\d+)$/i);
  if (spMatch) {
    return `SP ${spMatch[1]}`;
  }

  // Format tanggal YYYY-MM lama dari import awal e.g. "2026-08", "2026-03", "2026-09", "2026-01" -> SP 1
  if (/^2026-(08|03|09|01)$/.test(clean)) {
    return 'SP 1';
  }

  // Format tanggal bulan lainnya: "2026-02" -> "SP 2", dst.
  const ymMatch = clean.match(/^\d{4}-(\d{2})$/);
  if (ymMatch) {
    const monthNum = parseInt(ymMatch[1], 10);
    return `SP ${monthNum}`;
  }

  // Jika formatnya "Surat Pesanan X"
  const suratPesananMatch = clean.match(/^Surat\s+Pesanan\s*(\d+)/i);
  if (suratPesananMatch) {
    return `SP ${suratPesananMatch[1]}`;
  }

  const found = SP_PERIOD_LIST.find((item) => item.code.toLowerCase() === clean.toLowerCase());
  if (found) return found.code;

  return clean;
};

export const formatPeriodDisplay = (period?: string | null): string => {
  if (!period) return '-';
  const clean = period.trim();

  // Jika formatnya SP X e.g. "SP 9", "SP9", "SP 1"
  const spMatch = clean.match(/^SP\s*(\d+)$/i);
  if (spMatch) {
    const num = parseInt(spMatch[1], 10);
    const month = MONTH_NAMES[num];
    return month ? `${month} 2026 (SP ${num})` : `SP ${num}`;
  }

  // Jika formatnya "Surat Pesanan X"
  const suratPesananMatch = clean.match(/^Surat\s+Pesanan\s*(\d+)/i);
  if (suratPesananMatch) {
    const num = parseInt(suratPesananMatch[1], 10);
    const month = MONTH_NAMES[num];
    return month ? `${month} 2026 (SP ${num})` : `SP ${num}`;
  }

  // Format tanggal YYYY-MM e.g. "2026-08", "2026-09"
  const ymMatch = clean.match(/^(\d{4})-(\d{2})$/);
  if (ymMatch) {
    const year = ymMatch[1];
    const monthNum = parseInt(ymMatch[2], 10);
    const month = MONTH_NAMES[monthNum];
    return month ? `${month} ${year} (SP ${monthNum})` : clean;
  }

  const match = SP_PERIOD_LIST.find((item) => item.code.toLowerCase() === clean.toLowerCase());
  return match ? match.fullLabel : clean;
};

export const isStandardSP = (period?: string | null): boolean => {
  if (!period) return false;
  return /^SP\s*\d+$/i.test(period.trim()) || /^Surat\s+Pesanan/i.test(period.trim());
};

export const isOutsideSP = (period?: string | null): boolean => {
  if (!period) return false;
  return !isStandardSP(period);
};
