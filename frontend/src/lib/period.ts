import { useState, useEffect, useCallback } from 'react';
import { payrollPeriodService } from '../features/payroll/services/payrollPeriodService';
import { PayrollPeriodItem } from '../types/payroll';

export interface SPPeriodItem {
  code: string;
  name: string;
  fullLabel: string;
  isCurrent?: boolean;
  isSp?: boolean;
  isVisibleToUser?: boolean;
  startDate?: string | null;
  endDate?: string | null;
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

// Khusus Admin Dashboard: Menampilkan Surat Pesanan (SP)
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
  { code: 'SP 10', name: 'Surat Pesanan 10', fullLabel: 'SP 10 (Surat Pesanan 10)' },
  { code: 'SP 11', name: 'Surat Pesanan 11', fullLabel: 'SP 11 (Surat Pesanan 11)' },
  { code: 'SP 12', name: 'Surat Pesanan 12', fullLabel: 'SP 12 (Surat Pesanan 12)' },
];

/**
 * Merge standard SP 1..12 with any dynamic periods from backend/database
 */
export const buildPeriodOptions = (
  dynamicPeriods: Array<{
    code: string;
    name?: string;
    is_sp?: boolean;
    is_visible_to_user?: boolean;
    start_date?: string | null;
    end_date?: string | null;
  }> = []
): SPPeriodItem[] => {
  const optionsMap = new Map<string, SPPeriodItem>();

  // 1. Initial base: SP 1 to SP 12
  SP_PERIOD_LIST.forEach((sp) => {
    optionsMap.set(sp.code.trim().toLowerCase(), {
      ...sp,
      isSp: true,
      isVisibleToUser: true,
    });
  });

  // 2. Merge dynamic periods from database
  if (Array.isArray(dynamicPeriods)) {
    dynamicPeriods.forEach((dp) => {
      if (!dp || !dp.code) return;
      const cleanCode = dp.code.trim();
      const key = cleanCode.toLowerCase();
      const existing = optionsMap.get(key);

      let fullLabel = existing?.fullLabel;
      if (!fullLabel) {
        if (dp.name && dp.name.trim() && dp.name.trim().toLowerCase() !== cleanCode.toLowerCase()) {
          fullLabel = `${cleanCode} (${dp.name.trim()})`;
        } else {
          fullLabel = cleanCode;
        }
      }

      optionsMap.set(key, {
        code: existing ? existing.code : cleanCode,
        name: dp.name || (existing ? existing.name : cleanCode),
        fullLabel,
        isSp: dp.is_sp ?? existing?.isSp ?? true,
        isVisibleToUser: dp.is_visible_to_user ?? existing?.isVisibleToUser ?? true,
        startDate: dp.start_date || existing?.startDate || null,
        endDate: dp.end_date || existing?.endDate || null,
      });
    });
  }

  return Array.from(optionsMap.values());
};

/**
 * React hook to load dynamic periods from backend database,
 * falling back to standard SP 1..12 while loading or on error.
 */
export const usePeriodOptions = (company?: string) => {
  const [periodOptions, setPeriodOptions] = useState<SPPeriodItem[]>(() => buildPeriodOptions([]));
  const [rawPeriods, setRawPeriods] = useState<PayrollPeriodItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPeriods = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await payrollPeriodService.getPeriods({ company });
      if (Array.isArray(data) && data.length > 0) {
        setRawPeriods(data);
        setPeriodOptions(buildPeriodOptions(data));
      }
    } catch {
      try {
        const publicData = await payrollPeriodService.getPublicPeriods({ company });
        if (Array.isArray(publicData) && publicData.length > 0) {
          setRawPeriods(publicData);
          setPeriodOptions(buildPeriodOptions(publicData));
        }
      } catch (err2) {
        console.error('Failed to fetch period options:', err2);
      }
    } finally {
      setIsLoading(false);
    }
  }, [company]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  return { periodOptions, rawPeriods, isLoading, refreshPeriods: fetchPeriods };
};

// Opsi untuk filter admin
export const MONTH_PERIOD_OPTIONS = SP_PERIOD_LIST.map((sp) => ({
  code: sp.code,
  label: sp.fullLabel,
}));

// Khusus Tampilan Karyawan / Gaji: Murni nama bulan tanpa kata SP
export const EMPLOYEE_MONTH_OPTIONS = [
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
  const ymMatch = clean.match(/^(\d{4})-(\d{2})$/);
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

/**
 * Format untuk Portal Karyawan & Slip Gaji:
 * Murni hanya bulan & tahun (contoh: "September 2026") tanpa kata SP.
 */
export const formatEmployeePeriod = (period?: string | null): string => {
  if (!period) return '-';
  const clean = period.trim();

  const spMatch = clean.match(/^SP\s*(\d+)$/i);
  if (spMatch) {
    const num = parseInt(spMatch[1], 10);
    const month = MONTH_NAMES[num];
    return month ? `${month} 2026` : clean;
  }

  const suratPesananMatch = clean.match(/^Surat\s+Pesanan\s*(\d+)/i);
  if (suratPesananMatch) {
    const num = parseInt(suratPesananMatch[1], 10);
    const month = MONTH_NAMES[num];
    return month ? `${month} 2026` : clean;
  }

  const ymMatch = clean.match(/^(\d{4})-(\d{2})$/);
  if (ymMatch) {
    const year = ymMatch[1];
    const monthNum = parseInt(ymMatch[2], 10);
    const month = MONTH_NAMES[monthNum];
    return month ? `${month} ${year}` : clean;
  }

  return clean;
};

/**
 * Format untuk Admin Dashboard:
 * Menampilkan Surat Pesanan (SP) atau Nama Periode Custom
 */
export const formatPeriodDisplay = (period?: string | null, dynamicPeriods?: SPPeriodItem[]): string => {
  if (!period) return '-';
  const clean = period.trim();

  // Jika formatnya SP X e.g. "SP 9", "SP9", "SP 1"
  const spMatch = clean.match(/^SP\s*(\d+)$/i);
  if (spMatch) {
    const num = parseInt(spMatch[1], 10);
    return `SP ${num} (Surat Pesanan ${num})`;
  }

  // Jika formatnya "Surat Pesanan X"
  const suratPesananMatch = clean.match(/^Surat\s+Pesanan\s*(\d+)/i);
  if (suratPesananMatch) {
    const num = parseInt(suratPesananMatch[1], 10);
    return `SP ${num} (Surat Pesanan ${num})`;
  }

  // Format tanggal YYYY-MM e.g. "2026-08", "2026-09"
  const ymMatch = clean.match(/^(\d{4})-(\d{2})$/);
  if (ymMatch) {
    const monthNum = parseInt(ymMatch[2], 10);
    return `SP ${monthNum} (Surat Pesanan ${monthNum})`;
  }

  const list = dynamicPeriods && dynamicPeriods.length > 0 ? dynamicPeriods : SP_PERIOD_LIST;
  const match = list.find((item) => item.code.toLowerCase() === clean.toLowerCase());
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
