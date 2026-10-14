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
  { code: 'SP 1', name: 'Januari 2026', fullLabel: 'Januari 2026' },
  { code: 'SP 2', name: 'Februari 2026', fullLabel: 'Februari 2026' },
  { code: 'SP 3', name: 'Maret 2026', fullLabel: 'Maret 2026' },
  { code: 'SP 4', name: 'April 2026', fullLabel: 'April 2026' },
  { code: 'SP 5', name: 'Mei 2026', fullLabel: 'Mei 2026' },
  { code: 'SP 6', name: 'Juni 2026', fullLabel: 'Juni 2026' },
  { code: 'SP 7', name: 'Juli 2026', fullLabel: 'Juli 2026' },
  { code: 'SP 8', name: 'Agustus 2026', fullLabel: 'Agustus 2026' },
  { code: 'SP 9', name: 'September 2026', fullLabel: 'September 2026' },
  { code: 'SP 10', name: 'Oktober 2026', fullLabel: 'Oktober 2026' },
  { code: 'SP 11', name: 'November 2026', fullLabel: 'November 2026' },
  { code: 'SP 12', name: 'Desember 2026', fullLabel: 'Desember 2026' },
];

export const MONTH_PERIOD_OPTIONS = [
  { code: 'SP 1', label: 'Januari 2026' },
  { code: 'SP 2', label: 'Februari 2026' },
  { code: 'SP 3', label: 'Maret 2026' },
  { code: 'SP 4', label: 'April 2026' },
  { code: 'SP 5', label: 'Mei 2026' },
  { code: 'SP 6', label: 'Juni 2026' },
  { code: 'SP 7', label: 'Juli 2026' },
  { code: 'SP 8', label: 'Agustus 2026' },
  { code: 'SP 9', label: 'September 2026' },
  { code: 'SP 10', label: 'Oktober 2026' },
  { code: 'SP 11', label: 'November 2026' },
  { code: 'SP 12', label: 'Desember 2026' },
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
    return month ? `${month} 2026` : clean;
  }

  // Jika formatnya "Surat Pesanan X"
  const suratPesananMatch = clean.match(/^Surat\s+Pesanan\s*(\d+)/i);
  if (suratPesananMatch) {
    const num = parseInt(suratPesananMatch[1], 10);
    const month = MONTH_NAMES[num];
    return month ? `${month} 2026` : clean;
  }

  // Format tanggal YYYY-MM e.g. "2026-08", "2026-09"
  const ymMatch = clean.match(/^(\d{4})-(\d{2})$/);
  if (ymMatch) {
    const year = ymMatch[1];
    const monthNum = parseInt(ymMatch[2], 10);
    const month = MONTH_NAMES[monthNum];
    return month ? `${month} ${year}` : clean;
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
