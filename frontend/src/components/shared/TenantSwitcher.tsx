import React, { useState, useRef, useEffect } from 'react';
import { useTenantTheme, TENANT_CONFIGS, TenantId } from '../../lib/theme';
import { useAuthStore } from '../../store/authStore';
import { Building2, ChevronDown, Check, Globe, ExternalLink } from 'lucide-react';

interface TenantSwitcherProps {
  variant?: 'compact' | 'full';
}

export const TenantSwitcher: React.FC<TenantSwitcherProps> = ({ variant = 'full' }) => {
  const { tenant, tenantId, switchTenant } = useTenantTheme();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: TenantId) => {
    switchTenant(id);
    localStorage.setItem('payrollhub_active_tenant', id);
    setIsOpen(false);
    window.location.reload();
  };

  // Level admin biasa & user/staff: Kunci dan jangan tampilkan menu beralih tenant
  // Hanya Super Admin yang bisa masuk dan beralih ke kedua Dashboard
  if (!isSuperAdmin) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-panel shadow-2xs select-none ${
          variant === 'compact'
            ? 'px-2.5 py-1.5 text-[11.5px]'
            : 'px-3 py-1.5 text-[12px]'
        }`}
        title={`Entitas Aktif: ${tenant.name}`}
      >
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            tenantId === 'rimamandiri' ? 'bg-emerald-600' : 'bg-blue-600'
          }`}
        />
        <div className="flex flex-col text-left">
          <span className="font-semibold text-text-primary leading-tight whitespace-nowrap">
            {variant === 'compact' ? tenant.badgeText || tenant.shortName : tenant.shortName}
          </span>
          {variant === 'full' && (
            <span className="text-[10.5px] text-text-muted leading-none font-mono">
              {tenant.domainHint}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-panel hover:bg-surface-container transition-all cursor-pointer shadow-2xs ${
          variant === 'compact'
            ? 'px-2.5 py-1.5 text-[11.5px]'
            : 'px-3 py-1.5 text-[12px]'
        }`}
        title="Beralih Entitas / Domain Perusahaan"
        type="button"
      >
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            tenantId === 'rimamandiri' ? 'bg-emerald-600' : 'bg-blue-600'
          }`}
        />
        <div className="flex flex-col text-left">
          <span className="font-semibold text-text-primary leading-tight flex items-center gap-1.5 whitespace-nowrap">
            {variant === 'compact' ? tenant.badgeText || tenant.shortName : tenant.shortName}
          </span>
          {variant === 'full' && (
            <span className="text-[10.5px] text-text-muted leading-none font-mono">
              {tenant.domainHint}
            </span>
          )}
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-text-muted ml-0.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-72 rounded-xl bg-surface-panel border border-border-subtle shadow-xl z-50 py-1 divide-y divide-border-row animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3.5 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider flex items-center justify-between">
            <span>Entitas Domain Resmi</span>
            <Globe className="w-3.5 h-3.5 text-text-muted" />
          </div>

          <div className="p-1.5 space-y-1">
            {(Object.keys(TENANT_CONFIGS) as TenantId[]).map((id) => {
              const cfg = TENANT_CONFIGS[id];
              const isSelected = id === tenantId;
              return (
                <button
                  key={id}
                  onClick={() => handleSelect(id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-surface-container-low text-primary font-semibold ring-1 ring-border-subtle'
                      : 'hover:bg-surface-container text-text-primary font-normal'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        id === 'rimamandiri' ? 'bg-emerald-600' : 'bg-blue-600'
                      }`}
                    />
                    <div className="truncate">
                      <div className="text-[12.5px] font-medium truncate">{cfg.name}</div>
                      <div className="text-[11px] font-mono text-text-muted truncate">
                        {cfg.domainHint}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="p-2 border-t border-border-row space-y-1 bg-surface-container/30">
            <div className="px-2 py-0.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              Buka Domain Langsung
            </div>
            <a
              href="https://rimbunbuanasejahtera.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11.5px] text-blue-700 hover:bg-blue-50/80 transition-colors"
            >
              <span>🌐 rimbunbuanasejahtera.com</span>
              <ExternalLink className="w-3 h-3 text-blue-500" />
            </a>
            <a
              href="https://riamamandiripratama.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11.5px] text-emerald-700 hover:bg-emerald-50/80 transition-colors"
            >
              <span>🌐 riamamandiripratama.com</span>
              <ExternalLink className="w-3 h-3 text-emerald-500" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
