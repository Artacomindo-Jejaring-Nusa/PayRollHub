import { useState, useEffect } from 'react';

export type TenantId = 'rbs' | 'rimamandiri';

export interface TenantConfig {
  id: TenantId;
  name: string;
  companyLegalName: string;
  shortName: string;
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
    tagline: 'Sistem Penggajian & HRD Sekolah Rakyat RBS Global',
    portalTitle: 'Portal Administrasi Gaji RBS Global',
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
  // 1. Strictly lock by domain hostname first
  const locked = isLockedDomain();
  if (locked) {
    return locked;
  }

  // 2. Check URL query param (e.g. ?tenant=riamamandiripratama or ?tenant=rimamandiri)
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const tenantParam = (urlParams.get('tenant') || urlParams.get('theme') || '').toLowerCase();
    if (
      tenantParam === 'rimamandiri' ||
      tenantParam === 'riamamandiripratama' ||
      tenantParam === 'rimamandiripratama' ||
      tenantParam === 'rima'
    ) {
      return 'rimamandiri';
    }
    if (tenantParam === 'rbs' || tenantParam === 'rimbunbuanasejahtera') {
      return 'rbs';
    }

    // 3. Local storage only on localhost
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
  }
};

export const useTenantTheme = () => {
  const [tenantId, setTenantId] = useState<TenantId>(() => {
    const initial = detectInitialTenant();
    applyTenantThemeToDom(initial);
    return initial;
  });

  useEffect(() => {
    const handleStorage = () => {
      const locked = isLockedDomain();
      if (locked) {
        setTenantId(locked);
        applyTenantThemeToDom(locked);
        return;
      }
      const current = (localStorage.getItem('payrollhub_active_tenant') as TenantId) || 'rbs';
      setTenantId(current);
      applyTenantThemeToDom(current);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('payrollhub_tenant_changed', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('payrollhub_tenant_changed', handleStorage);
    };
  }, []);

  const switchTenant = (newTenant: TenantId) => {
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
