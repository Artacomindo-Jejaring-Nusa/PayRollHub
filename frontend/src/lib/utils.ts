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

/**
 * Build absolute storage URL pointing to the API host or origin.
 * Automatically rewrites localhost:8000 URLs when accessed from remote VPS / LAN IPs.
 */
export function getStorageUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('data:image') || path.startsWith('blob:')) {
    return path;
  }

  // 1. Determine active backend host
  let rootHost = '';
  const apiBase = import.meta.env.VITE_API_URL;
  if (apiBase && (apiBase.startsWith('http://') || apiBase.startsWith('https://'))) {
    rootHost = apiBase.replace(/\/api\/?$/, '');
  } else if (typeof window !== 'undefined') {
    // If running in browser without explicit full VITE_API_URL
    if (window.location.port === '5173') {
      rootHost = `${window.location.protocol}//${window.location.hostname}:8000`;
    } else {
      rootHost = window.location.origin;
    }
  } else {
    rootHost = 'http://localhost:8000';
  }

  // 2. If path is already an absolute URL
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const parsed = new URL(path);
      // If the URL has localhost/127.0.0.1 but the user is accessing the app from a VPS or LAN IP
      if (
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
        typeof window !== 'undefined' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        return `${rootHost}${parsed.pathname}`;
      }
      return path;
    } catch {
      return path;
    }
  }

  // 3. Normalize relative path
  let cleanPath = path.trim().replace(/\\/g, '/');
  if (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.slice(1);
  }

  if (cleanPath.startsWith('storage/')) {
    return `${rootHost}/${cleanPath}`;
  }

  return `${rootHost}/storage/${cleanPath}`;
}
