import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { authService } from '../services/authService';
import { Button } from '../../../components/ui/Button';
import {
  Wallet,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  BadgeAlert,
  Lock,
  UserCheck,
  KeyRound,
} from 'lucide-react';
import { useTenantTheme } from '../../../lib/theme';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { tenant } = useTenantTheme();
  const isRima = tenant.id === 'rimamandiri';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await authService.login({
        identifier: identifier.trim(),
        password,
        remember_me: rememberMe,
      });

      login(response.data.user, response.data.token);
      if (response.data.role === 'karyawan') {
        navigate('/employee/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Gagal masuk. Silakan periksa kembali email dan kata sandi Anda.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickAccount = (email: string, pass: string) => {
    setIdentifier(email);
    setPassword(pass);
    setErrorMessage(null);
  };

  return (
    <main className="w-full min-h-screen bg-surface flex flex-col justify-center items-center px-4 md:px-8 py-6">
      <div className="flex flex-col w-full">
        <div className="w-full max-w-6xl mx-auto py-4 md:py-8">
          <div className="bg-surface-panel rounded-xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px] border border-border-subtle">
            {/* Left Visual Hero Column */}
            <div
              className="lg:col-span-6 p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden text-surface-panel border-r border-white/5"
              style={{
                background: isRima
                  ? 'radial-gradient(circle, rgb(6, 78, 59) 0%, rgb(4, 47, 46) 55%, rgb(2, 44, 34) 100%)'
                  : 'radial-gradient(circle, rgb(39, 33, 102) 0%, rgb(26, 21, 72) 55%, rgb(19, 15, 56) 100%)',
              }}
            >
              {/* Ambient background glow elements */}
              <div
                className={`absolute -top-32 -left-20 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
                  isRima ? 'bg-emerald-500/20' : 'bg-primary-container/20'
                }`}
              />
              <div
                className={`absolute top-1/2 -right-28 w-80 h-80 rounded-full blur-3xl pointer-events-none ${
                  isRima ? 'bg-teal-600/15' : 'bg-indigo-600/15'
                }`}
              />
              <div
                className={`absolute -bottom-24 left-1/4 w-72 h-72 rounded-full blur-3xl pointer-events-none ${
                  isRima ? 'bg-emerald-600/25' : 'bg-primary/25'
                }`}
              />

              {/* Brand Header */}
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${
                        isRima
                          ? 'from-emerald-500 to-teal-700 shadow-emerald-900/30'
                          : 'from-primary-container to-blue-700 shadow-primary-container/30'
                      } flex items-center justify-center text-white shadow-lg ring-1 ring-white/20`}
                    >
                      <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-headline-page text-[22px] font-semibold text-white tracking-tight">
                          HRD Mandiri
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-white border border-white/15 tracking-wide uppercase">
                          {tenant.badgeText}
                        </span>
                      </div>
                      <span className="block text-[12px] text-slate-300 font-medium tracking-normal">
                        {tenant.tagline}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Central Artwork Frame */}
              <div className="relative z-10 my-6 flex flex-col items-center justify-center">
                <div className="relative w-full flex items-center justify-center">
                  <img
                    alt={`Ilustrasi Autentikasi HRD Mandiri ${tenant.shortName}`}
                    className="w-auto max-h-[350px] object-contain drop-shadow-xl transition-transform duration-300 hover:scale-[1.02]"
                    src="/assets/auth-hero-wavy.png"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>

            </div>

            {/* Right Form Column */}
            <div className="lg:col-span-6 bg-surface-panel p-8 lg:p-12 flex flex-col justify-between">
              <div>
                {/* Header Info */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-caption-medium font-caption-medium ${
                        isRima
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-badge-province-bg text-badge-province-text border border-blue-200/50'
                      } border`}
                    >
                      {tenant.shortName} • {tenant.companyLegalName}
                    </span>
                  </div>
                  <h1 className="font-headline-page text-headline-page text-text-primary tracking-tight">
                    Masuk ke Akun Anda
                  </h1>
                  <p className="font-body-default text-body-default text-text-muted mt-2">
                    Masukkan akun dinas atau NIK karyawan terdaftar untuk mengakses
                    administrasi payroll {tenant.shortName}.
                  </p>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-status-danger-text text-[13px] flex items-start gap-2.5 animate-in fade-in">
                    <BadgeAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium">{errorMessage}</div>
                  </div>
                )}

                {/* Authentication Form */}
                <form className="space-y-4" onSubmit={handleSubmit}>
                  {/* Field 1: Email Kantor / NIK */}
                  <div className="space-y-1.5">
                    <label
                      className="block font-body-semibold text-body-semibold text-text-primary"
                      htmlFor="identifier"
                    >
                      Email Kantor atau NIK
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3 text-text-muted pointer-events-none">
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <input
                        className="w-full h-11 pl-10 pr-4 bg-surface-panel rounded-lg font-body-default text-body-default text-text-primary placeholder:text-text-muted transition-all duration-200 outline-none border border-border-subtle focus:ring-2 focus:ring-primary focus:border-primary focus:bg-surface-container-low shadow-sm"
                        id="identifier"
                        name="identifier"
                        placeholder="nama@perusahaan.co.id atau NIK 16 digit"
                        required
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Field 2: Password */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        className="block font-body-semibold text-body-semibold text-text-primary"
                        htmlFor="password"
                      >
                        Kata Sandi
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          alert(
                            'Silakan hubungi Administrator IT atau HR untuk reset kata sandi Anda.'
                          )
                        }
                        className="font-caption-medium text-caption-medium text-primary hover:text-accent-hover transition-colors"
                      >
                        Lupa sandi?
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <div className="absolute left-3 text-text-muted pointer-events-none">
                        <Lock className="w-5 h-5" />
                      </div>
                      <input
                        className="w-full h-11 pl-10 pr-11 bg-surface-panel rounded-lg font-body-default text-body-default text-text-primary placeholder:text-text-muted transition-all duration-200 outline-none border border-border-subtle focus:ring-2 focus:ring-primary focus:border-primary focus:bg-surface-container-low shadow-sm"
                        id="password"
                        name="password"
                        placeholder="••••••••••••"
                        required
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                        className="absolute right-2 p-1.5 text-text-muted hover:text-text-primary transition-colors flex items-center justify-center rounded-lg focus:outline-none"
                        onClick={() => setShowPassword(!showPassword)}
                        type="button"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Remember Device */}
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        className="w-4 h-4 rounded text-primary-container border-border-subtle focus:ring-primary"
                        name="remember_me"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span className="font-body-default text-body-default text-text-primary">
                        Ingat saya pada peramban ini
                      </span>
                    </label>
                  </div>

                  {/* Primary Action Button */}
                  <Button
                    className="w-full h-11"
                    type="submit"
                    isLoading={isLoading}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Masuk
                  </Button>

                  {/* Quick Account Selector Demo Pills */}
                  {/* <div className="pt-2">
                    <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 text-center">
                      Akun Masuk Cepat (Klik untuk mengisi otomatis):
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          fillQuickAccount('admin@payrollhub.com', 'password123')
                        }
                        className="px-2.5 py-2 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                      >
                        <UserCheck className="w-4 h-4 text-primary" />
                        <span>Akun Admin</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          fillQuickAccount('viewer@payrollhub.com', 'password123')
                        }
                        className="px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                      >
                        <UserCheck className="w-4 h-4 text-slate-500" />
                        <span>Akun Viewer</span>
                      </button>
                    </div>
                  </div> */}

                  {/* Visual Divider */}
                  <div className="relative py-2 flex items-center justify-center">
                    <div className="w-full h-[1px] bg-border-row" />
                  </div>

                  <p className="font-caption-regular text-caption-regular text-text-muted text-center">
                    Protokol SAML 2.0 & Active Directory terintegrasi.
                  </p>
                </form>
              </div>

              {/* Bottom Security Notice */}
              <div className="mt-6 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-text-muted border-t border-border-row">
                <div className="flex items-center gap-1.5 font-caption-medium text-caption-medium">
                  <ShieldCheck className="w-4 h-4 text-status-success-text" />
                  <span className="text-on-surface">Koneksi terenkripsi SSL 256-bit</span>
                </div>
                
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
