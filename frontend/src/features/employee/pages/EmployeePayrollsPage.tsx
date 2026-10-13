import React, { useEffect, useState, useMemo } from 'react';
import { employeeService } from '../services/employeeService';
import { PayrollItem } from '../../../types/payroll';
import { formatCurrency } from '../../../lib/utils';
import { formatPeriodDisplay, MONTH_PERIOD_OPTIONS, normalizePeriodToSP } from '../../../lib/period';
import { Card } from '../../../components/ui/Card';
import {
  FileText,
  Download,
  Calendar,
  Building2,
  ChevronDown,
  ChevronUp,
  Filter,
  RotateCcw,
} from 'lucide-react';

export const EmployeePayrollsPage: React.FC = () => {
  const [payrolls, setPayrolls] = useState<PayrollItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Filter Modes: 'all' (Semua), 'single' (Per Bulan/SP), 'range' (Rentang Periode/Tutup Absen)
  const [filterMode, setFilterMode] = useState<'all' | 'single' | 'range'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [startPeriod, setStartPeriod] = useState<string>('SP 1');
  const [endPeriod, setEndPeriod] = useState<string>('SP 10');

  useEffect(() => {
    fetchPayrolls();
  }, []);

  const fetchPayrolls = async () => {
    setIsLoading(true);
    try {
      const data = await employeeService.getPayrolls();
      setPayrolls(data);
    } catch (err) {
      console.error('Failed to fetch payrolls', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (item: PayrollItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingId(item.id);
    try {
      await employeeService.downloadSlipPdf(item.id, item.employee_name, item.period);
    } catch (err) {
      alert('Gagal mengunduh slip gaji. Silakan coba kembali.');
    } finally {
      setDownloadingId(null);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Helper untuk mendapatkan index nomor periode (1 - 12)
  const getPeriodNum = (periodStr?: string | null): number => {
    if (!periodStr) return 1;
    const norm = normalizePeriodToSP(periodStr);
    const m = norm.match(/^SP\s*(\d+)$/i);
    return m ? parseInt(m[1], 10) : 1;
  };

  const filteredPayrolls = useMemo(() => {
    if (filterMode === 'all') {
      return payrolls;
    }

    if (filterMode === 'single') {
      if (!selectedMonth) return payrolls;
      return payrolls.filter((p) => {
        const norm = normalizePeriodToSP(p.period);
        return (
          norm.toLowerCase() === selectedMonth.toLowerCase() ||
          p.period.toLowerCase() === selectedMonth.toLowerCase()
        );
      });
    }

    if (filterMode === 'range') {
      const minIdx = Math.min(getPeriodNum(startPeriod), getPeriodNum(endPeriod));
      const maxIdx = Math.max(getPeriodNum(startPeriod), getPeriodNum(endPeriod));

      return payrolls.filter((p) => {
        const idx = getPeriodNum(p.period);
        return idx >= minIdx && idx <= maxIdx;
      });
    }

    return payrolls;
  }, [payrolls, filterMode, selectedMonth, startPeriod, endPeriod]);

  const totalFilteredTHP = useMemo(() => {
    return filteredPayrolls.reduce((sum, p) => sum + (Number(p.take_home_pay) || 0), 0);
  }, [filteredPayrolls]);

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-20 bg-surface-container rounded-xl w-full" />
        <div className="h-20 bg-surface-container rounded-xl w-full" />
        <div className="h-20 bg-surface-container rounded-xl w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pb-2 border-b border-border-subtle">
        <h1 className="font-headline-page text-[22px] sm:text-[24px] font-bold text-text-primary tracking-tight">
          Riwayat Slip Gaji
        </h1>
        <p className="font-body-default text-[13px] text-text-muted mt-1">
          Daftar seluruh rekapitulasi gaji Anda beserta rincian dan unduh dokumen slip resmi.
        </p>
      </div>

      {/* Filter Toolbar: Per Bulan / Per Rentang Gajian */}
      {payrolls.length > 0 && (
        <div className="bg-surface-panel rounded-xl border border-border-subtle p-3.5 sm:p-4 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold text-text-primary flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-primary" />
                <span>Pilih Tampilan:</span>
              </span>
              <div className="inline-flex rounded-lg bg-surface border border-border-subtle p-0.5 text-[12px]">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Semua Slip
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('single');
                    if (!selectedMonth && payrolls.length > 0) {
                      setSelectedMonth(normalizePeriodToSP(payrolls[0].period));
                    }
                  }}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    filterMode === 'single'
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Pilih SP Tertentu
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('range')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    filterMode === 'range'
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Rentang SP
                </button>
              </div>
            </div>

            <div className="text-[12px] text-text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Menampilkan: <strong className="text-text-primary">{filteredPayrolls.length} Slip</strong>
              </span>
              <span>•</span>
              <span>
                Total THP: <strong className="text-primary font-mono">{formatCurrency(totalFilteredTHP)}</strong>
              </span>
            </div>
          </div>

          {/* Dynamic Filter Controls */}
          {filterMode === 'single' && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-1">
              <label className="text-[12px] text-text-muted font-medium shrink-0">
                Pilih Periode Surat Pesanan (SP):
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 px-3 bg-surface rounded-lg text-[12.5px] border border-border-subtle outline-none focus:ring-2 focus:ring-primary font-medium cursor-pointer max-w-xs"
              >
                <option value="">Semua Periode</option>
                {MONTH_PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterMode === 'range' && (
            <div className="flex flex-wrap items-center gap-2.5 pt-1 text-[12px]">
              <span className="text-text-muted font-medium">Dari Periode:</span>
              <select
                value={startPeriod}
                onChange={(e) => setStartPeriod(e.target.value)}
                className="h-9 px-3 bg-surface rounded-lg text-[12.5px] border border-border-subtle outline-none focus:ring-2 focus:ring-primary font-medium cursor-pointer"
              >
                {MONTH_PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <span className="text-text-muted font-medium">s/d</span>

              <select
                value={endPeriod}
                onChange={(e) => setEndPeriod(e.target.value)}
                className="h-9 px-3 bg-surface rounded-lg text-[12.5px] border border-border-subtle outline-none focus:ring-2 focus:ring-primary font-medium cursor-pointer"
              >
                {MONTH_PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {payrolls.length === 0 ? (
        <Card className="p-8 text-center space-y-2 border-border-subtle bg-surface-panel">
          <FileText className="w-10 h-10 text-text-muted mx-auto" />
          <h3 className="text-[15px] font-semibold text-text-primary">Belum Ada Data Slip Gaji</h3>
          <p className="text-[12px] text-text-muted max-w-sm mx-auto">
            Data penggajian Anda belum diinput atau dipublikasikan oleh bagian HR / Administrasi.
          </p>
        </Card>
      ) : filteredPayrolls.length === 0 ? (
        <Card className="p-8 text-center space-y-3 border-border-subtle bg-surface-panel">
          <Calendar className="w-10 h-10 text-text-muted mx-auto" />
          <h3 className="text-[15px] font-semibold text-text-primary">Tidak Ada Slip untuk Periode Ini</h3>
          <p className="text-[12px] text-text-muted max-w-sm mx-auto">
            Tidak ditemukan catatan slip gaji untuk filter bulan atau rentang yang Anda pilih.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilterMode('all');
              setSelectedMonth('');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[12px] font-semibold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Tampilkan Semua Slip</span>
          </button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPayrolls.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <Card
                key={item.id}
                onClick={() => toggleExpand(item.id)}
                className="overflow-hidden border-border-subtle bg-surface-panel shadow-xs hover:border-slate-300 transition-all cursor-pointer"
              >
                {/* Main Summary Header Row */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-[14px] shrink-0 mt-0.5 sm:mt-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[15px] text-text-primary">
                          Periode: {formatPeriodDisplay(item.period)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            item.status === 'off'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {item.status === 'off' ? 'Off' : 'Aktif'}
                        </span>
                      </div>
                      <div className="text-[12px] text-text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="font-medium text-text-primary">{item.position}</span>
                        <span>•</span>
                        <span>{item.school_unit || item.province}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-subtle">
                    <div className="text-left sm:text-right">
                      <div className="text-[10.5px] text-text-muted uppercase font-semibold">
                        Take Home Pay
                      </div>
                      <div className="text-[16px] sm:text-[18px] font-bold text-text-primary">
                        {formatCurrency(item.take_home_pay)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleDownload(item, e)}
                        disabled={downloadingId === item.id}
                        className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{downloadingId === item.id ? 'Mengunduh...' : 'Unduh PDF'}</span>
                      </button>

                      <div className="p-1 text-text-muted">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details Breakdown */}
                {isExpanded && (
                  <div className="bg-surface px-4 sm:px-6 py-4 border-t border-border-subtle space-y-3 text-[12px]">
                    <div className="font-semibold text-text-primary text-[12.5px]">
                      Rincian Komponen Gaji:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-surface-panel rounded-xl border border-border-subtle">
                        <div className="text-text-muted text-[11px]">Gaji Pokok</div>
                        <div className="font-bold text-[14px] text-text-primary mt-0.5">
                          {formatCurrency(item.basic_salary)}
                        </div>
                      </div>

                      <div className="p-3 bg-surface-panel rounded-xl border border-border-subtle">
                        <div className="text-text-muted text-[11px]">Tunjangan / Insentif</div>
                        <div className="font-bold text-[14px] text-text-primary mt-0.5">
                          +{formatCurrency(item.allowance)}
                        </div>
                      </div>

                      <div className="p-3 bg-surface-panel rounded-xl border border-border-subtle">
                        <div className="text-text-muted text-[11px]">Total Potongan</div>
                        <div className="font-bold text-[14px] text-status-danger-text mt-0.5">
                          -{formatCurrency(item.deduction)}
                        </div>
                      </div>
                    </div>

                    {/* Potongan Detail */}
                    {(Number(item.bpjs_tk || 0) > 0 ||
                      Number(item.absence_deduction || 0) > 0 ||
                      (item.custom_deductions && item.custom_deductions.length > 0) ||
                      Number(item.deduction || 0) > 0) && (
                      <div className="p-3 bg-surface-panel rounded-xl border border-border-subtle space-y-1.5">
                        <div className="font-medium text-text-primary text-[11.5px]">
                          Detail Potongan Terdaftar:
                        </div>
                        <div className="flex flex-wrap gap-4 text-text-muted text-[11.5px]">
                          {Number(item.bpjs_tk || 0) > 0 && (
                            <div>BPJS TK: {formatCurrency(item.bpjs_tk)}</div>
                          )}
                          {Number(item.absence_deduction || 0) > 0 && (
                            <div>
                              Ketidakhadiran: {formatCurrency(item.absence_deduction)} ({item.absence_count} hari)
                            </div>
                          )}
                          {item.custom_deductions && item.custom_deductions.length > 0 ? (
                            item.custom_deductions.map((cd, idx) => (
                              <div key={idx}>
                                {cd.name}: {formatCurrency(cd.amount)}
                              </div>
                            ))
                          ) : Number(item.deduction || 0) > 0 ? (
                            <div>Potongan Lainnya: {formatCurrency(item.deduction)}</div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
