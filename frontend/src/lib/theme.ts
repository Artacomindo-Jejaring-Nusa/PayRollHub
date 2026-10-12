import { useState, useEffect } from 'react';

export type TenantId = 'rbs' | 'rimamandiri';

export interface TenantConfig {
  id: TenantId;
  name: string;
  companyLegalName: string;
  shortName: string;
  appName: string;
  tagline: string;
  portalTitle: string;
  badgeText: string;
  domainHint: string;
  primaryColor: string;
  primaryContainer: string;
  badgeColorClass: string;
  cardHighlightBorder: string;
  cardHighlightBg: string;
}

export const TENANT_CONFIGS: Record<TenantId, TenantConfig> = {
  rbs: {
    id: 'rbs',
    name: 'PT. Rimbun Buana Sejahtera',
    companyLegalName: 'PT. Rimbun Buana Sejahtera',
    shortName: 'RBS Global',
    appName: 'RBS HRD - Global',
    tagline: 'Sistem Penggajian & HRD Sekolah Rakyat RBS Global',
    portalTitle: 'Portal Administrasi Gaji RBS HRD - Global',
    badgeText: 'RBS Global',
    domainHint: 'rimbunbuanasejahtera.com',
    primaryColor: '#004ac6',
    primaryContainer: '#2563eb',
    badgeColorClass: 'bg-blue-50 text-blue-700 border-blue-200',
    cardHighlightBorder: 'border-blue-300 ring-blue-500/10',
    cardHighlightBg: 'from-white to-blue-50/50',
  },
  rimamandiri: {
    id: 'rimamandiri',
    name: 'PT. Riama Mandiri Pratama',
    companyLegalName: 'PT. Riama Mandiri Pratama',
    shortName: 'Riama Mandiri Pratama',
    appName: 'HRD Riama Mandiri',
    tagline: 'Sistem Manajemen Kompensasi & Operasional PT. Riama Mandiri Pratama',
    portalTitle: 'Portal Administrasi Gaji Riama Mandiri Pratama',
    badgeText: 'Riama Mandiri',
    domainHint: 'riamamandiripratama.com',
    primaryColor: '#065f46',
    primaryContainer: '#059669',
    badgeColorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    cardHighlightBorder: 'border-emerald-300 ring-emerald-500/10',
    cardHighlightBg: 'from-white to-emerald-50/50',
  },
};

export const isLockedDomain = (): TenantId | null => {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.toLowerCase();
  if (
    host.includes('riamamandiripratama') ||
    host.includes('rimamandiripratama') ||
    host.includes('rimamandiri') ||
    host.includes('riama')
  ) {
    return 'rimamandiri';
  }
  if (host.includes('rimbunbuanasejahtera')) {
    return 'rbs';
  }
  return null;
};

export const detectInitialTenant = (): TenantId => {
  if (typeof window !== 'undefined') {
    // 1. PRIORITAS #1: Domain Hostname!
    // Domain riamamandiripratama.com WAJIB 100% rimamandiri!
    // Domain rimbunbuanasejahtera.com WAJIB 100% rbs!
    const locked = isLockedDomain();
    if (locked) {
      localStorage.setItem('payrollhub_active_tenant', locked);
      return locked;
    }

    // 2. Akun user yang sedang login jika bukan super_admin
    try {
      const userStr = localStorage.getItem('payrollhub_user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u && u.role !== 'super_admin' && u.company) {
          const comp = u.company.toLowerCase();
          const lockedTenant: TenantId = comp.includes('riama') || comp.includes('rimamandiri') ? 'rimamandiri' : 'rbs';
          localStorage.setItem('payrollhub_active_tenant', lockedTenant);
          return lockedTenant;
        }
      }
    } catch {}

    // 3. URL query param (misal di localhost: ?tenant=rimamandiri atau ?tenant=rbs)
    const urlParams = new URLSearchParams(window.location.search);
    const tenantParam = (urlParams.get('tenant') || urlParams.get('theme') || '').toLowerCase();
    if (
      tenantParam === 'rimamandiri' ||
      tenantParam === 'riamamandiripratama' ||
      tenantParam === 'rimamandiripratama' ||
      tenantParam === 'rima'
    ) {
      localStorage.setItem('payrollhub_active_tenant', 'rimamandiri');
      return 'rimamandiri';
    }
    if (tenantParam === 'rbs' || tenantParam === 'rimbunbuanasejahtera' || tenantParam === 'rimbun') {
      localStorage.setItem('payrollhub_active_tenant', 'rbs');
      return 'rbs';
    }

    // 4. Stored selection (hanya berlaku jika di localhost tanpa domain locking)
    const stored = localStorage.getItem('payrollhub_active_tenant');
    if (stored === 'rbs' || stored === 'rimamandiri') {
      return stored;
    }
  }

  return 'rbs';
};

export const applyTenantThemeToDom = (tenantId: TenantId) => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', tenantId);
    localStorage.setItem('payrollhub_active_tenant', tenantId);
    const config = TENANT_CONFIGS[tenantId];
    if (config) {
      document.title = `${config.portalTitle} — ${config.appName}`;
    }
  }
};

export const useTenantTheme = () => {
  const [tenantId, setTenantId] = useState<TenantId>(() => {
    const initial = detectInitialTenant();
    applyTenantThemeToDom(initial);
    return initial;
  });

  useEffect(() => {
    // Pastikan jika berada di domain terkunci, langsung sinkronkan tema
    const locked = isLockedDomain();
    if (locked && locked !== tenantId) {
      setTenantId(locked);
      applyTenantThemeToDom(locked);
    }

    const handleStorage = () => {
      // Prioritas 1: Domain Terkunci
      const lockedDomain = isLockedDomain();
      if (lockedDomain) {
        setTenantId(lockedDomain);
        applyTenantThemeToDom(lockedDomain);
        return;
      }

      // Prioritas 2: User login non-superadmin
      try {
        const userStr = localStorage.getItem('payrollhub_user');
        if (userStr) {
          const u = JSON.parse(userStr);
          if (u && u.role !== 'super_admin' && u.company) {
            const comp = u.company.toLowerCase();
            const lockedTenant: TenantId = comp.includes('riama') || comp.includes('rimamandiri') ? 'rimamandiri' : 'rbs';
            setTenantId(lockedTenant);
            applyTenantThemeToDom(lockedTenant);
            return;
          }
        }
      } catch {}

      // Prioritas 3: Stored selection di localhost
      const current = (localStorage.getItem('payrollhub_active_tenant') as TenantId);
      if (current === 'rbs' || current === 'rimamandiri') {
        setTenantId(current);
        applyTenantThemeToDom(current);
        return;
      }

      setTenantId('rbs');
      applyTenantThemeToDom('rbs');
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('payrollhub_tenant_changed', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('payrollhub_tenant_changed', handleStorage);
    };
  }, [tenantId]);

  const switchTenant = (newTenant: TenantId) => {
    // Hanya Super Admin yang berhak memindahkan tenant secara aktif
    try {
      const userStr = localStorage.getItem('payrollhub_user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u && u.role !== 'super_admin') {
          return; // Blocked for normal admin / employee
        }
      }
    } catch {}

    setTenantId(newTenant);
    applyTenantThemeToDom(newTenant);
    window.dispatchEvent(new Event('payrollhub_tenant_changed'));
  };

  return {
    tenant: TENANT_CONFIGS[tenantId],
    tenantId,
    switchTenant,
  };
};
