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
  { code: 'SP 11', name: 'Surat Pesanan 11', fullLabel: 'SP 11 (Surat Pesanan 11)' },
  { code: 'SP 12', name: 'Surat Pesanan 12', fullLabel: 'SP 12 (Surat Pesanan 12)' },
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
  { code: 'SP 10', label: 'Oktober 2026 (SP 10 — Tutup Absen)' },
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

  // Cek apakah format SP
  const spCode = normalizePeriodToSP(clean);
  const match = SP_PERIOD_LIST.find(
    (item) => item.code.toLowerCase() === spCode.toLowerCase()
  );

  return match ? match.fullLabel : clean;
};
