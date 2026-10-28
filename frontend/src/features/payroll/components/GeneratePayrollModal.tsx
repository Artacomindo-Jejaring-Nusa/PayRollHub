import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { usePeriodOptions } from '../../../lib/period';
import { payrollService } from '../services/payrollService';
import {
  Sparkles,
  Calendar,
  Layers,
  Users,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface GeneratePayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  company?: string;
}

export const GeneratePayrollModal: React.FC<GeneratePayrollModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  company,
}) => {
  const [targetCompany, setTargetCompany] = useState<string>(company || 'all');
  const { periodOptions, rawPeriods } = usePeriodOptions(targetCompany);

  // Form states
  const [targetPeriod, setTargetPeriod] = useState<string>('SP 2');
  const [sourcePeriod, setSourcePeriod] = useState<string>('latest');
  const [syncAttendance, setSyncAttendance] = useState<boolean>(true);
  const [isVisibleToUser, setIsVisibleToUser] = useState<boolean>(true);
  const [duplicateAction, setDuplicateAction] = useState<'update' | 'skip'>('update');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    target_period: string;
    total_processed: number;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    date_range: [string, string] | null;
  } | null>(null);

  // Sync date range based on target period or presets
  useEffect(() => {
    if (!targetPeriod) return;
    const foundPeriod = rawPeriods.find(
      (p) => p.code.toLowerCase() === targetPeriod.toLowerCase()
    );

    if (foundPeriod?.start_date && foundPeriod?.end_date) {
      setStartDate(foundPeriod.start_date.substring(0, 10));
      setEndDate(foundPeriod.end_date.substring(0, 10));
    } else {
      // Default to 21 bulan lalu s/d 20 bulan ini
      applyCutoffPreset('21-20');
    }
  }, [targetPeriod, rawPeriods]);

  const applyCutoffPreset = (preset: '21-20' | '26-25' | 'this_month') => {
    const now = new Date();
    const toYmd = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === '21-20') {
      const startCutoff = new Date(now.getFullYear(), now.getMonth() - 1, 21);
      const endCutoff = new Date(now.getFullYear(), now.getMonth(), 20);
      setStartDate(toYmd(startCutoff));
      setEndDate(toYmd(endCutoff));
    } else if (preset === '26-25') {
      const startCutoff = new Date(now.getFullYear(), now.getMonth() - 1, 26);
      const endCutoff = new Date(now.getFullYear(), now.getMonth(), 25);
      setStartDate(toYmd(startCutoff));
      setEndDate(toYmd(endCutoff));
    } else if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(toYmd(start));
      setEndDate(toYmd(end));
    }
  };

  const handleResetModal = () => {
    setSuccessData(null);
    setErrorMessage(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    handleResetModal();
    onClose();
  };

  const handleExecuteGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPeriod.trim()) {
      setErrorMessage('Pilih target Surat Pesanan / Periode yang ingin digenerate.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const res = await payrollService.generatePeriod({
        target_period: targetPeriod.trim(),
        source_period: sourcePeriod,
        company: targetCompany,
        sync_attendance: syncAttendance,
        is_visible_to_user: isVisibleToUser,
        duplicate_action: duplicateAction,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      setSuccessData(res.data);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Failed to generate payroll:', err);
      setErrorMessage(
        err.response?.data?.message || 'Gagal melakukan generate payroll. Silakan coba kembali.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Generate Payroll Periode Baru"
      description="Salin master data gaji seluruh karyawan aktif ke periode/SP baru & otomatis langsung tampil di User View (portal karyawan)."
      maxWidth="lg"
    >
      {successData ? (
        <div className="space-y-5 py-2">
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-emerald-950">
                  Generate Payroll Periode {successData.target_period} Berhasil!
                </h4>
                <p className="text-xs text-emerald-700">
                  Seluruh data penggajian telah diterbitkan dan langsung aktif di portal karyawan.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200/80">
              <div className="p-2.5 rounded-lg bg-white/70 border border-emerald-200 text-center">
                <span className="text-[11px] text-emerald-700 block">Total Diproses</span>
                <span className="text-lg font-bold font-mono text-emerald-950">
                  {successData.total_processed}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/70 border border-emerald-200 text-center">
                <span className="text-[11px] text-emerald-700 block">Data Baru Dibuat</span>
                <span className="text-lg font-bold font-mono text-emerald-700">
                  +{successData.created_count}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/70 border border-emerald-200 text-center">
                <span className="text-[11px] text-emerald-700 block">Diperbarui</span>
                <span className="text-lg font-bold font-mono text-blue-700">
                  {successData.updated_count}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/70 border border-emerald-200 text-center">
                <span className="text-[11px] text-emerald-700 block">Dilewati</span>
                <span className="text-lg font-bold font-mono text-slate-600">
                  {successData.skipped_count}
                </span>
              </div>
            </div>

            {successData.date_range && (
              <div className="text-[11.5px] text-emerald-800 flex items-center gap-1.5 pt-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Rentang Cut-off Absensi:{' '}
                  <strong>
                    {successData.date_range[0]} s/d {successData.date_range[1]}
                  </strong>
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button variant="outline" onClick={handleResetModal}>
              Generate Periode Lain
            </Button>
            <Button variant="primary" onClick={handleClose}>
              Selesai & Tutup
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleExecuteGenerate} className="space-y-4 py-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Banner Penjelasan Alur */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-blue-900 text-xs flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">
                Solusi Sekali Klik (Otomatis Tampil di Sisi Karyawan):
              </span>
              <p className="text-blue-800 leading-relaxed">
                Anda tidak perlu lagi mengedit karyawan satu per satu. Sistem akan menduplikasi
                karyawan aktif dari periode acuan ke periode baru, menghitung potongan absensi
                secara otomatis sesuai tanggal cut-off, dan <strong>langsung menerbitkan slip gaji ke User View</strong>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Target Periode Tujuan */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text-primary">
                1. Target Periode Baru (SP / Wilayah Tujuan) <span className="text-rose-500">*</span>
              </label>
              <select
                value={targetPeriod}
                onChange={(e) => setTargetPeriod(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border-subtle bg-surface text-xs font-semibold text-text-primary outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                required
              >
                {periodOptions.map((sp) => (
                  <option key={sp.code} value={sp.code}>
                    {sp.fullLabel}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-text-muted">
                Periode yang akan dibuatkan data gaji barunya.
              </span>
            </div>

            {/* Periode Sumber (Acuan Master) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text-primary">
                2. Ambil Master Data Dari (Periode Sumber)
              </label>
              <select
                value={sourcePeriod}
                onChange={(e) => setSourcePeriod(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border-subtle bg-surface text-xs font-medium text-text-primary outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="latest">⚡ Data Gaji Karyawan Aktif Terakhir</option>
                {periodOptions.map((sp) => (
                  <option key={sp.code} value={sp.code}>
                    {sp.fullLabel}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-text-muted">
                Gaji pokok, tunjangan, BPJS & rekening bank disalin dari sumber ini.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Filter Perusahaan */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text-primary">
                3. Entitas Perusahaan
              </label>
              <select
                value={targetCompany}
                onChange={(e) => setTargetCompany(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border-subtle bg-surface text-xs font-medium text-text-primary outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="all">Semua Perusahaan (RBS & Riama Mandiri)</option>
                <option value="rbs">PT. Rimbun Buana Sejahtera (RBS)</option>
                <option value="rimamandiri">PT. Riama Mandiri Pratama (Riama)</option>
              </select>
            </div>

            {/* Tindakan jika data sudah ada di SP target */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text-primary">
                4. Jika Karyawan Sudah Ada di Periode Ini
              </label>
              <select
                value={duplicateAction}
                onChange={(e) => setDuplicateAction(e.target.value as 'update' | 'skip')}
                className="w-full h-10 px-3 rounded-xl border border-border-subtle bg-surface text-xs font-medium text-text-primary outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="update">Perbarui Data Penggajian (Update)</option>
                <option value="skip">Lewati / Pertahankan Data Lama (Skip)</option>
              </select>
            </div>
          </div>

          {/* Pengaturan Cut-off Absensi */}
          <div className="p-3.5 rounded-xl border border-border-subtle bg-surface-container/30 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
                <Calendar className="w-4 h-4 text-primary" />
                <span>Rentang Tanggal Cut-off Absensi</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-text-muted mr-1">Preset:</span>
                <button
                  type="button"
                  onClick={() => applyCutoffPreset('21-20')}
                  className="px-2 py-0.5 text-[10.5px] font-bold rounded bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 cursor-pointer"
                >
                  ⏱️ 21 - 20
                </button>
                <button
                  type="button"
                  onClick={() => applyCutoffPreset('26-25')}
                  className="px-2 py-0.5 text-[10.5px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  ⏱️ 26 - 25
                </button>
                <button
                  type="button"
                  onClick={() => applyCutoffPreset('this_month')}
                  className="px-2 py-0.5 text-[10.5px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  Bulan Penuh
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                  Tanggal Mulai (Cut-off Awal)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                  Tanggal Selesai (Cut-off Akhir)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Checkbox Tarik Absensi Otomatis */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={syncAttendance}
                onChange={(e) => setSyncAttendance(e.target.checked)}
                className="w-4 h-4 rounded text-primary border-border-subtle focus:ring-primary cursor-pointer accent-primary"
              />
              <span className="text-xs font-semibold text-text-primary">
                Tarik Hari Masuk & Libur Otomatis dari Modul Absensi
              </span>
            </label>
          </div>

          {/* Visibilitas User Portal */}
          <div className="p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-950 block">
                  Langsung Tampil di User View (Portal Karyawan)
                </span>
                <span className="text-[11px] text-emerald-700">
                  Karyawan langsung dapat melihat dan mengunduh slip gaji di portal masing-masing.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsVisibleToUser(true)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  isVisibleToUser
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                👁️ Tampil
              </button>
              <button
                type="button"
                onClick={() => setIsVisibleToUser(false)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  !isVisibleToUser
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                🔒 Sembunyi
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button variant="outline" type="button" onClick={handleClose} disabled={isLoading}>
              Batal
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isLoading}
              leftIcon={<Sparkles className="w-4 h-4" />}
              className="bg-primary hover:bg-primary/90 font-bold"
            >
              Generate Sekarang
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
