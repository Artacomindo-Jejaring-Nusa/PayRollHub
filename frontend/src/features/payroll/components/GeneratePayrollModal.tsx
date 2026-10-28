import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { usePeriodOptions, CALENDAR_MONTH_OPTIONS, formatPeriodDisplay } from '../../../lib/period';
import { payrollService } from '../services/payrollService';
import {
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Eye,
  Clock,
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
  const { periodOptions, rawPeriods, refreshPeriods } = usePeriodOptions(targetCompany);

  // Form states - Default ke '2026-10' (Bulan Penggajian Oktober 2026)
  const [targetPeriod, setTargetPeriod] = useState<string>('2026-10');
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

  // Always refresh periods when modal opens so newly added SP appears immediately
  useEffect(() => {
    if (isOpen) {
      refreshPeriods();
    }
  }, [isOpen, refreshPeriods]);

  const applyCutoffPreset = (preset: '21-20' | '26-25' | 'this_month', periodRef = targetPeriod) => {
    const toYmd = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let refYear = new Date().getFullYear();
    let refMonth = new Date().getMonth(); // 0-based

    // Jika periodRef adalah format YYYY-MM (misal "2026-10")
    const ymMatch = (periodRef || '').match(/^(\d{4})-(\d{2})$/);
    if (ymMatch) {
      refYear = parseInt(ymMatch[1], 10);
      refMonth = parseInt(ymMatch[2], 10) - 1; // 0-based
    }

    if (preset === '21-20') {
      const startCutoff = new Date(refYear, refMonth - 1, 21);
      const endCutoff = new Date(refYear, refMonth, 20);
      setStartDate(toYmd(startCutoff));
      setEndDate(toYmd(endCutoff));
    } else if (preset === '26-25') {
      const startCutoff = new Date(refYear, refMonth - 1, 26);
      const endCutoff = new Date(refYear, refMonth, 25);
      setStartDate(toYmd(startCutoff));
      setEndDate(toYmd(endCutoff));
    } else if (preset === 'this_month') {
      const start = new Date(refYear, refMonth, 1);
      const end = new Date(refYear, refMonth + 1, 0);
      setStartDate(toYmd(start));
      setEndDate(toYmd(end));
    }
  };

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
      // Default to 21 bulan lalu s/d 20 bulan ini sesuai target period
      applyCutoffPreset('21-20', targetPeriod);
    }
  }, [targetPeriod, rawPeriods]);

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
        source_period: 'latest', // Otomatis ambil seluruh data karyawan aktif terkini
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
      description="Buat data gaji seluruh karyawan aktif ke periode/SP baru & otomatis langsung tampil di User View (portal karyawan)."
      maxWidth="3xl"
    >
      {successData ? (
        <div className="space-y-4 py-1">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-emerald-950">
                  Generate Payroll Periode {formatPeriodDisplay(successData.target_period)} Berhasil!
                </h4>
                <p className="text-xs text-emerald-700">
                  Seluruh data penggajian telah diterbitkan dan langsung aktif di portal karyawan.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200/80">
              <div className="p-2.5 rounded-lg bg-white/80 border border-emerald-200 text-center">
                <span className="text-[11px] text-emerald-700 block">Total Diproses</span>
                <span className="text-lg font-bold font-mono text-emerald-950">
                  {successData.total_processed}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/80 border border-emerald-200 text-center">
                <span className="text-[11px] text-emerald-700 block">Data Baru Dibuat</span>
                <span className="text-lg font-bold font-mono text-emerald-700">
                  +{successData.created_count}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/80 border border-emerald-200 text-center">
                <span className="text-[11px] text-emerald-700 block">Diperbarui</span>
                <span className="text-lg font-bold font-mono text-blue-700">
                  {successData.updated_count}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/80 border border-emerald-200 text-center">
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

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button variant="outline" size="sm" onClick={handleResetModal}>
              Generate Periode Lain
            </Button>
            <Button variant="primary" size="sm" onClick={handleClose}>
              Selesai & Tutup
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleExecuteGenerate} className="space-y-3.5 py-0.5">
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Banner Penjelasan Alur Ringkas */}
          <div className="px-3.5 py-2.5 rounded-xl bg-blue-50/80 border border-blue-200/80 text-blue-900 text-xs flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <p className="text-blue-800 leading-snug">
              Sistem akan menduplikasi seluruh data karyawan aktif ke periode target, menyinkronkan rekap absensi sesuai rentang cut-off, dan <strong>langsung menerbitkan slip gaji ke portal karyawan</strong>.
            </p>
          </div>

          {/* 2-Column Balanced Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* Kolom Kiri: Target Periode, Perusahaan, Tindakan Duplikat */}
            <div className="space-y-3">
              {/* Target Periode Tujuan */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-text-primary">
                  1. Target Periode Penggajian <span className="text-rose-500">*</span>
                </label>
                <select
                  value={targetPeriod}
                  onChange={(e) => setTargetPeriod(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface text-xs font-semibold text-text-primary outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  required
                >
                  <optgroup label="📅 Bulan Penggajian (Periode Kalender Rutin)">
                    {CALENDAR_MONTH_OPTIONS.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.label} ({m.code})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="📋 Surat Pesanan (SP) / Wilayah Khusus">
                    {periodOptions
                      .filter((sp) => {
                        const m = sp.code.match(/^SP\s*(\d+)$/i);
                        // Sembunyikan dummy SP 4 s/d SP 12 warisan lama
                        if (m && parseInt(m[1], 10) > 3) return false;
                        return true;
                      })
                      .map((sp) => (
                        <option key={sp.code} value={sp.code}>
                          {sp.fullLabel}
                        </option>
                      ))}
                  </optgroup>
                </select>
                <span className="text-[10.5px] text-text-muted block">
                  Bulan kalender untuk gajian bulanan, atau SP untuk batch penugasan baru.
                </span>
              </div>

              {/* Filter Perusahaan */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-text-primary">
                  2. Entitas Perusahaan
                </label>
                <select
                  value={targetCompany}
                  onChange={(e) => setTargetCompany(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface text-xs font-medium text-text-primary outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="all">Semua Perusahaan (RBS & Riama Mandiri)</option>
                  <option value="rbs">PT. Rimbun Buana Sejahtera (RBS)</option>
                  <option value="rimamandiri">PT. Riama Mandiri Pratama (Riama)</option>
                </select>
                <span className="text-[10.5px] text-text-muted block">
                  Perusahaan karyawan yang akan diproses ke periode baru.
                </span>
              </div>

              {/* Tindakan jika data sudah ada di target */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-text-primary">
                  3. Jika Karyawan Sudah Ada di Periode Ini
                </label>
                <select
                  value={duplicateAction}
                  onChange={(e) => setDuplicateAction(e.target.value as 'update' | 'skip')}
                  className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface text-xs font-medium text-text-primary outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="update">Perbarui Data Penggajian (Update / Sinkron ulang)</option>
                  <option value="skip">Lewati / Pertahankan Data Lama (Skip)</option>
                </select>
                <span className="text-[10.5px] text-text-muted block">
                  Tindakan jika nama karyawan sudah terdaftar di periode target.
                </span>
              </div>
            </div>

            {/* Kolom Kanan: Cut-off Absensi & Visibilitas Portal */}
            <div className="space-y-3">
              {/* Pengaturan Cut-off Absensi */}
              <div className="p-3 rounded-xl border border-border-subtle bg-surface-container/30 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>Rentang Cut-off Absensi</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => applyCutoffPreset('21-20')}
                      className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 cursor-pointer"
                    >
                      ⏱️ 21 - 20
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCutoffPreset('26-25')}
                      className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 cursor-pointer"
                    >
                      ⏱️ 26 - 25
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCutoffPreset('this_month')}
                      className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 cursor-pointer"
                    >
                      Bulan Penuh
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10.5px] font-semibold text-text-secondary mb-0.5">
                      Cut-off Awal
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-lg border border-border-subtle bg-surface text-xs outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-semibold text-text-secondary mb-0.5">
                      Cut-off Akhir
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-lg border border-border-subtle bg-surface text-xs outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Checkbox Tarik Absensi Otomatis */}
                <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={syncAttendance}
                    onChange={(e) => setSyncAttendance(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-primary border-border-subtle focus:ring-primary cursor-pointer accent-primary"
                  />
                  <span className="text-[11.5px] font-medium text-text-primary">
                    Tarik Masuk & Libur Otomatis dari Modul Absensi
                  </span>
                </label>
              </div>

              {/* Visibilitas User Portal */}
              <div className="p-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Eye className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-emerald-950 block truncate">
                      Visibilitas Portal Karyawan
                    </span>
                    <span className="text-[10.5px] text-emerald-700 block truncate">
                      Langsung terbit di portal karyawan
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsVisibleToUser(true)}
                    className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
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
                    className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                      !isVisibleToUser
                        ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    🔒 Sembunyi
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-border-subtle">
            <Button variant="outline" type="button" onClick={handleClose} disabled={isLoading} size="sm">
              Batal
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isLoading}
              size="sm"
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
