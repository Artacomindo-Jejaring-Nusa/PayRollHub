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
 * Automatically routes via /api/storage/ so Nginx proxies properly to Laravel backend.
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
    if (window.location.port === '5173') {
      rootHost = `${window.location.protocol}//${window.location.hostname}:8000`;
    } else {
      rootHost = window.location.origin;
    }
  } else {
    rootHost = 'http://localhost:8000';
  }

  // 2. Extract path if absolute URL
  let relativePath = path;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const parsed = new URL(path);
      const isCurrentHost = typeof window !== 'undefined' && parsed.hostname === window.location.hostname;
      const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      // If it's a 3rd party external image, return directly
      if (!isCurrentHost && !isLocalhost && !parsed.hostname.includes('rimbunbuanasejahtera.com')) {
        return path;
      }
      relativePath = parsed.pathname;
    } catch {
      relativePath = path;
    }
  }

  // 3. Normalize path: strip leading slashes and storage / api prefixes
  let cleanPath = relativePath.trim().replace(/\\/g, '/');
  cleanPath = cleanPath.replace(/^\/+/, '');
  cleanPath = cleanPath.replace(/^(api\/storage\/|storage\/|api\/)/, '');
  cleanPath = cleanPath.replace(/^\/+/, '');

  // 4. Always use /api/storage/ endpoint which is guaranteed to be proxied to Laravel by Nginx
  return `${rootHost}/api/storage/${cleanPath}`;
}
