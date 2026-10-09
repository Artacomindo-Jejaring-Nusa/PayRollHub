import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { KeyRound, Lock, Unlock, Eye, EyeOff, ShieldAlert, CheckCircle2, RotateCcw } from 'lucide-react';

interface DevFeatureLockProps {
  featureName: string;
  featureKey?: string;
  children: React.ReactNode;
}

export const DevFeatureLock: React.FC<DevFeatureLockProps> = ({
  featureName,
  featureKey = 'work_reports',
  children,
}) => {
  const storageKey = `dev_unlocked_${featureKey}`;
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return localStorage.getItem(storageKey) === 'true';
  });

  const [inputKey, setInputKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  // Accepted keys client-side fallback
  const fallbackKeys = ['DEV-REPORT-2026', 'ARTAC-DEV-2026', 'DEV-2026'];

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = inputKey.trim();
    if (!cleanKey) {
      setErrorMsg('Harap masukkan Developer Access Key.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      // 1. Try server verification
      let isValid = false;
      try {
        const res = await api.post('/dev/verify-key', { key: cleanKey });
        if (res.data?.valid) {
          isValid = true;
        }
      } catch (serverErr: any) {
        // Fallback to client-side verification if server endpoint not reachable or network issue
        if (fallbackKeys.includes(cleanKey.toUpperCase())) {
          isValid = true;
        } else {
          setErrorMsg(serverErr.response?.data?.message || 'Developer Access Key tidak valid.');
        }
      }

      if (isValid || fallbackKeys.includes(cleanKey.toUpperCase())) {
        localStorage.setItem(storageKey, 'true');
        localStorage.setItem('dev_report_key', cleanKey);
        setIsUnlocked(true);
        setSuccessNotice(true);
        setTimeout(() => setSuccessNotice(false), 3000);
      } else if (!errorMsg) {
        setErrorMsg('Developer Access Key salah. Silakan hubungi tim pengembang.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLockAgain = () => {
    if (confirm('Kunci kembali fitur ini? Anda harus memasukkan Developer Key lagi untuk mengakses.')) {
      localStorage.removeItem(storageKey);
      localStorage.removeItem('dev_report_key');
      setIsUnlocked(false);
      setInputKey('');
      setErrorMsg('');
    }
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
        <div className="max-w-md w-full bg-surface-panel rounded-3xl border border-border-subtle shadow-xl p-6 sm:p-8 space-y-6 text-center">
          {/* Header Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-inner">
            <Lock className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-200">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Akses Terkunci Sementara (Developer Only)</span>
            </div>

            <h2 className="font-headline-page text-[20px] sm:text-[22px] font-bold text-text-primary tracking-tight">
              {featureName} Dikunci
            </h2>

            <p className="font-body-default text-[12.5px] text-text-muted leading-relaxed">
              Fitur ini sementara sedang dikunci oleh tim pengembang untuk keperluan pemeliharaan dan pengujian.
              Silakan masukkan <strong>Developer Access Key</strong> untuk membuka fitur ini.
            </p>
          </div>

          {/* Form Unlock */}
          <form onSubmit={handleUnlock} className="space-y-4 text-left">
            <div>
              <label className="block text-[12px] font-semibold text-text-primary mb-1.5">
                Developer Access Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  required
                  placeholder="Masukkan kunci pengembang..."
                  value={inputKey}
                  onChange={(e) => {
                    setInputKey(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full h-11 pl-4 pr-11 rounded-xl border border-border-subtle bg-surface text-[13px] text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors p-1"
                  title={showKey ? 'Sembunyikan' : 'Lihat'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[12px] font-medium flex items-center gap-2 animate-in fade-in">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white text-[13px] font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isLoading ? 'Memverifikasi...' : 'Buka Kunci Akses (Unlock)'}</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Floating Developer Bar */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-150">
        <div className="flex items-center gap-2 text-emerald-800 text-[12.5px] font-medium">
          <Unlock className="w-4 h-4 text-emerald-600" />
          <span>
            <strong>Mode Pengembang Aktif:</strong> Akses ke fitur <strong>{featureName}</strong> sedang terbuka.
          </span>
        </div>

        <button
          type="button"
          onClick={handleLockAgain}
          className="px-3 py-1 rounded-lg bg-emerald-600/10 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 text-emerald-700 text-[11.5px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Kunci kembali fitur ini"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Kunci Kembali</span>
        </button>
      </div>

      {/* Main Content */}
      {children}
    </div>
  );
};
