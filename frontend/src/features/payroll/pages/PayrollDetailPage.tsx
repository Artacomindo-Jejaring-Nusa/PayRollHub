import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { useTenantTheme } from '../../../lib/theme';
import { payrollService } from '../services/payrollService';
import { PayrollItem } from '../../../types/payroll';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { formatCurrency, formatPeriod } from '../../../lib/utils';
import {
  ArrowLeft,
  Download,
  Printer,
  Wallet,
  Loader2,
  Building2,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  CalendarX,
  CreditCard,
  UserCheck,
  UserX,
  RefreshCw,
} from 'lucide-react';

export const PayrollDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { tenant } = useTenantTheme();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [payroll, setPayroll] = useState<PayrollItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPayroll = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const data = await payrollService.getPayroll(Number(id));
        setPayroll(data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Data tidak ditemukan.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayroll();
  }, [id]);

  const handleDownloadPdf = async () => {
    if (!payroll) return;
    setIsDownloading(true);
    try {
      await payrollService.downloadSlipPdf(payroll.id, payroll.employee_name, payroll.period);
    } catch (err) {
      alert('Gagal mengunduh file slip gaji PDF: ' + err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-body-default text-text-muted">Memuat data karyawan...</span>
      </div>
    );
  }

  if (error || !payroll) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <div className="text-status-danger-text font-medium">{error || 'Data tidak ditemukan'}</div>
        <Link to="/payrolls">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Kembali ke Daftar
          </Button>
        </Link>
      </div>
    );
  }

  // Company display logic
  const isRiama = payroll.company === 'rimamandiri' || tenant.id === 'rimamandiri';
  const companyTitle = isRiama ? 'PT. Riama Mandiri Pratama' : 'PT. Rimbun Buana Sejahtera';
  const brandName = isRiama ? 'Riama Mandiri Pratama' : 'RBS HRD - Global';
  const domainName = isRiama ? 'riamamandiripratama.com' : 'rimbunbuanasejahtera.com';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar (Actions, Back button) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center space-x-3">
          <Link
            to="/payrolls"
            className="p-2 rounded-lg border border-border-subtle bg-surface-panel hover:bg-surface-container text-text-muted hover:text-text-primary transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-headline-page text-headline-page text-text-primary tracking-tight">
              {isAdmin ? 'Slip Gaji Karyawan' : 'Detail Data Karyawan'}
            </h1>
            <p className="font-body-default text-body-default text-text-muted">
              {isAdmin
                ? `Rincian kompensasi resmi periode ${formatPeriod(payroll.period)}`
                : `Informasi penempatan dan data kependidikan periode ${formatPeriod(payroll.period)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4 text-text-muted" />}
          >
            Cetak
          </Button>
          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/payrolls/${payroll.id}/edit`)}
              >
                Ubah Data
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDownloadPdf}
                isLoading={isDownloading}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Unduh Slip (PDF)
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Payslip / Profile Document Card */}
      <Card className="p-8 sm:p-10 border border-slate-300 shadow-md bg-white print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="border-b-2 border-primary pb-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold shadow-sm">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-headline-page text-[20px] font-bold text-primary tracking-tight">
                    {isRiama ? 'HRD Riama Mandiri' : 'RBS HRD - Global'}
                  </h2>
                  <span className="text-[12px] text-text-muted font-medium">
                    {brandName} • {companyTitle}
                  </span>
                </div>
              </div>
              <p className="text-[12px] text-text-muted pt-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-text-muted" />
                <span>Sekolah Rakyat Nusantara</span>
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <div className="flex items-center sm:justify-end gap-2">
                <Badge variant={payroll.status === 'off' ? 'off' : 'active'}>
                  {payroll.status === 'off' ? 'Status: Off / Keluar' : 'Status: Karyawan Aktif'}
                </Badge>
                {isAdmin && (
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                    Confidential
                  </span>
                )}
              </div>
              <div className="font-title-card text-[15px] font-semibold text-text-primary pt-1">
                {isAdmin ? 'SLIP GAJI TENAGA KEPENDIDIKAN' : 'DATA TENAGA KEPENDIDIKAN & PENEMPATAN'}
              </div>
              <div className="text-[13px] font-mono text-primary font-bold">
                Periode: {payroll.period}
              </div>
            </div>
          </div>
        </div>

        {/* Employee Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 px-5 rounded-xl bg-surface-page border border-border-row mb-6">
          <div className="space-y-2">
            <div className="flex items-center text-[13px]">
              <span className="w-40 text-text-muted">Nama Lengkap</span>
              <span className="font-semibold text-text-primary">: {payroll.employee_name}</span>
            </div>
            <div className="flex items-center text-[13px]">
              <span className="w-40 text-text-muted">Nomor Induk (NIK)</span>
              <span className="font-mono text-text-primary">: {payroll.nik || '-'}</span>
            </div>
            <div className="flex items-center text-[13px]">
              <span className="w-40 text-text-muted">Fungsi / Jabatan</span>
              <span className="text-text-primary font-medium flex items-center gap-1.5">
                : {payroll.position ? <Badge variant="role">{payroll.position}</Badge> : '-'}
              </span>
            </div>
            <div className="flex items-center text-[13px]">
              <span className="w-40 text-text-muted">Tanggal Lahir</span>
              <span className="text-text-primary font-medium">: {payroll.birth_date || '-'}</span>
            </div>
            <div className="flex items-center text-[13px]">
              <span className="w-40 text-text-muted">Jenis Kelamin</span>
              <span className="text-text-primary font-medium">: {payroll.gender || '-'}</span>
            </div>
            <div className="flex items-center text-[13px]">
              <span className="w-40 text-text-muted">Status Keaktifan</span>
              <span className="font-semibold flex items-center gap-1.5">
                :{' '}
                {payroll.status === 'off' ? (
                  <span className="text-rose-700 inline-flex items-center gap-1">
                    <UserX className="w-3.5 h-3.5" /> Off / Non-Aktif
                  </span>
                ) : (
                  <span className="text-emerald-700 inline-flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5" /> Aktif
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center text-[13px]">
              <span className="w-40 text-text-muted">Wilayah (Provinsi)</span>
              <span className="text-text-primary font-medium">: {payroll.province}</span>
            </div>
            <div className="flex items-center text-[13px]">
              <span className="w-40 text-text-muted">Sekolah Rakyat</span>
              <span className="text-text-primary font-medium">: {payroll.school_unit || '-'}</span>
            </div>
            <div className="flex items-center text-[13px]">
              <span className="w-40 text-text-muted">WhatsApp / No HP</span>
              <span className="font-mono text-text-primary">: {payroll.whatsapp || '-'}</span>
            </div>
            <div className="flex items-center text-[13px]">
              <span className="w-40 text-text-muted">Email</span>
              <span className="text-text-primary">: {payroll.email || '-'}</span>
            </div>
            <div className="flex items-center text-[13px]">
              <span className="w-40 text-text-muted">Tanggal Masuk</span>
              <span className="text-text-muted">: {payroll.join_date || '-'}</span>
            </div>
            {payroll.status === 'off' && payroll.resign_date && (
              <div className="flex items-center text-[13px]">
                <span className="w-40 text-rose-600 font-semibold">Tanggal Keluar</span>
                <span className="font-mono text-rose-600 font-semibold">: {payroll.resign_date}</span>
              </div>
            )}
            {isAdmin && (
              <div className="flex items-center text-[13px]">
                <span className="w-40 text-text-muted">Rekening & Bank</span>
                <span className="font-mono text-text-primary">
                  : {payroll.bank_name ? `${payroll.bank_name} (${payroll.bank_account || '-'})` : '-'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Breakdown Table (Admin Only) */}
        {isAdmin ? (
          <>
            <div className="space-y-4 mb-6">
              <h3 className="font-title-card text-[15px] font-bold text-text-primary uppercase tracking-wide">
                Rincian Komponen Gaji Sesuai Format Resmi Perusahaan
              </h3>

              <div className="border border-border-subtle rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-primary text-white text-[12px] font-semibold uppercase">
                      <th className="py-3 px-4">Rincian Komponen Gaji</th>
                      <th className="py-3 px-4 text-center">Tipe</th>
                      <th className="py-3 px-4 text-right">Jumlah (IDR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-row text-[13.5px]">
                    {/* 1. Gaji Pokok */}
                    <tr className="bg-white font-medium">
                      <td className="py-2.5 px-4 font-semibold text-text-primary">
                        Gaji Pokok
                      </td>
                      <td className="py-2.5 px-4 text-center text-[12px] text-text-muted font-mono">
                        Pokok
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-text-primary">
                        {payroll.formatted_basic_salary}
                      </td>
                    </tr>

                    {/* 2. Tunjangan BPJS Kesehatan */}
                    <tr>
                      <td className="py-2.5 px-4 text-text-secondary pl-6">
                        Tunjangan BPJS Kesehatan
                      </td>
                      <td className="py-2.5 px-4 text-center text-[12px] text-emerald-700 font-mono">
                        Penambah
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-600 font-medium">
                        {payroll.bpjs_kes && Number(payroll.bpjs_kes) > 0 ? `+${payroll.formatted_bpjs_kes}` : 'Rp -'}
                      </td>
                    </tr>

                    {/* 3. Tunjangan Jabatan / Lainnya */}
                    <tr>
                      <td className="py-2.5 px-4 text-text-secondary pl-6">
                        Tunjangan Jabatan & Lembur
                      </td>
                      <td className="py-2.5 px-4 text-center text-[12px] text-emerald-700 font-mono">
                        Penambah
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-600 font-medium">
                        {payroll.allowance && Number(payroll.allowance) > 0 ? `+${payroll.formatted_allowance}` : 'Rp -'}
                      </td>
                    </tr>

                    {/* 4. Tunjangan Hari Raya */}
                    <tr>
                      <td className="py-2.5 px-4 text-text-secondary pl-6">
                        Tunjangan Hari Raya (THR)
                      </td>
                      <td className="py-2.5 px-4 text-center text-[12px] text-text-muted font-mono">
                        Penambah
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-text-muted">
                        Rp -
                      </td>
                    </tr>

                    {/* Subtotal Gaji Sebelum Potongan */}
                    <tr className="bg-slate-100/70 font-semibold border-t border-b border-slate-300">
                      <td className="py-2.5 px-4 text-text-primary">
                        Total Gaji sebelum potongan
                      </td>
                      <td className="py-2.5 px-4 text-center text-[12px] text-primary font-mono">
                        Subtotal
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-primary text-[14px]">
                        {formatCurrency(Number(payroll.basic_salary || 0) + Number(payroll.bpjs_kes || 0) + Number(payroll.allowance || 0))}
                      </td>
                    </tr>

                    {/* Header Bagian Potongan */}
                    <tr className="bg-rose-50/30">
                      <td colSpan={3} className="py-2 px-4 font-bold text-rose-800 text-[12.5px] uppercase tracking-wide">
                        Potongan
                      </td>
                    </tr>

                    {/* PPh 21 */}
                    <tr>
                      <td className="py-2.5 px-4 text-rose-700 pl-6">
                        Pph 21
                      </td>
                      <td className="py-2.5 px-4 text-center text-[12px] text-rose-600 font-mono">
                        Pajak
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-rose-600 font-medium">
                        {payroll.pph21 && Number(payroll.pph21) > 0 ? `-${payroll.formatted_pph21 || formatCurrency(payroll.pph21)}` : 'Rp -'}
                      </td>
                    </tr>

                    {/* Absensi */}
                    <tr>
                      <td className="py-2.5 px-4 text-rose-700 pl-6">
                        Absensi {payroll.absence_count && Number(payroll.absence_count) > 0 ? `(${payroll.absence_count}x)` : ''}
                        {payroll.absence_note && (
                          <span className="text-[11px] text-rose-500 font-normal block">
                            Ket: {payroll.absence_note}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center text-[12px] text-rose-600 font-mono">
                        Pengurang
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-rose-600 font-medium">
                        {payroll.absence_deduction && Number(payroll.absence_deduction) > 0 ? `-${payroll.formatted_absence_deduction}` : 'Rp -'}
                      </td>
                    </tr>

                    {/* Potongan Kustom / Lainnya jika ada */}
                    {payroll.custom_deductions && payroll.custom_deductions.length > 0 ? (
                      payroll.custom_deductions.map((cd, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-4 text-rose-700 pl-6">
                            {cd.name || 'Potongan Kustom'}
                          </td>
                          <td className="py-2.5 px-4 text-center text-[12px] text-rose-600 font-mono">
                            Pengurang
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-rose-600 font-medium">
                            -{formatCurrency(cd.amount)}
                          </td>
                        </tr>
                      ))
                    ) : payroll.deduction && Number(payroll.deduction) > 0 ? (
                      <tr>
                        <td className="py-2.5 px-4 text-rose-700 pl-6">
                          Potongan Lainnya
                        </td>
                        <td className="py-2.5 px-4 text-center text-[12px] text-rose-600 font-mono">
                          Pengurang
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-rose-600 font-medium">
                          -{payroll.formatted_deduction}
                        </td>
                      </tr>
                    ) : null}

                    {/* Subtotal Total Potongan */}
                    <tr className="bg-rose-100/50 font-semibold border-t border-b border-rose-300">
                      <td className="py-2.5 px-4 text-rose-900">
                        Total Potongan
                      </td>
                      <td className="py-2.5 px-4 text-center text-[12px] text-rose-700 font-mono">
                        Subtotal
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-rose-700 text-[14px]">
                        {(() => {
                          const potTotal = Number(payroll.absence_deduction || 0) + Number(payroll.deduction || 0) + Number(payroll.pph21 || 0);
                          return potTotal > 0 ? `-${formatCurrency(potTotal)}` : 'Rp -';
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Net Take Home Pay Total Box */}
            <div className="p-5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-primary/40 flex items-center justify-between mb-5">
              <div>
                <div className="font-title-card text-[14px] font-bold text-primary uppercase tracking-wider">
                  TOTAL GAJI DITERIMA
                </div>
                <span className="text-[12px] text-text-muted">
                  Ditransfer ke rekening {payroll.bank_name ? `${payroll.bank_name} (${payroll.bank_account || '-'})` : 'karyawan'}
                </span>
              </div>

              <div className="font-display-kpi text-[24px] sm:text-[28px] font-bold text-primary font-mono">
                {payroll.formatted_take_home_pay}
              </div>
            </div>

            {/* BPJS Yang Bisa Dicairkan (Format Slip Baru 2026 - Non-Potongan) */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 mb-6">
              <div className="font-title-card text-[13.5px] font-bold text-text-primary uppercase tracking-wide mb-2.5 flex items-center justify-between">
                <span>BPJS yang bisa dicairkan (Non-potongan)</span>
                <span className="text-[11px] font-normal text-text-muted">Muncul di slip 2026</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-border-subtle">
                  <span className="text-text-secondary">BPJS TK JHT</span>
                  <span className="font-mono font-bold text-slate-800">
                    {payroll.bpjs_tk_jht && Number(payroll.bpjs_tk_jht) > 0
                      ? formatCurrency(payroll.bpjs_tk_jht)
                      : payroll.bpjs_tk && Number(payroll.bpjs_tk) > 0
                      ? formatCurrency(Math.round(Number(payroll.bpjs_tk) * 0.43))
                      : 'Rp -'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-border-subtle">
                  <span className="text-text-secondary">BPJS TK JP</span>
                  <span className="font-mono font-bold text-slate-800">
                    {payroll.bpjs_tk_jp && Number(payroll.bpjs_tk_jp) > 0
                      ? formatCurrency(payroll.bpjs_tk_jp)
                      : payroll.bpjs_tk && Number(payroll.bpjs_tk) > 0
                      ? formatCurrency(Math.round(Number(payroll.bpjs_tk) * 0.57))
                      : 'Rp -'}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-text-muted mt-2">
                * Catatan: Sesuai format slip gaji 2026, BPJS Ketenagakerjaan tidak memotong Gaji Diterima (THP) dan diakumulasi sebagai saldo klaim karyawan.
              </p>
            </div>

            {/* Replacement Note if exists */}
            {payroll.replaced_employee_name && (
              <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-[12.5px] mb-6 flex items-start gap-2.5">
                <RefreshCw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Rekam Jejak Pergantian Karyawan:</strong> Karyawan ini menggantikan posisi <strong>{payroll.replaced_employee_name}</strong>
                  {payroll.replacement_date ? ` per tanggal ${payroll.replacement_date}` : ''}.
                  {payroll.replacement_note && (
                    <span className="block text-amber-800 text-[11.5px] mt-0.5 italic">
                      Catatan: {payroll.replacement_note}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Operational Placement Summary for User */
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 mb-6">
            <div className="flex items-center gap-2 text-primary font-semibold text-[14px]">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>
                Status Operasional:{' '}
                {payroll.status === 'off' ? 'Off / Non-Aktif' : 'Penempatan Aktif'}
              </span>
            </div>
            <p className="text-[12.5px] text-text-muted leading-relaxed">
              Tenaga kependidikan terdaftar resmi pada unit <strong>{payroll.school_unit || 'Sekolah Rakyat'}</strong> wilayah <strong>{payroll.province}</strong> dengan fungsi penugasan <strong>{payroll.position || 'Tenaga Kependidikan'}</strong> untuk periode <strong>{payroll.period}</strong>.
            </p>
          </div>
        )}

        {/* Footer & Signature */}
        <div className="pt-10 flex justify-between items-end border-t border-border-row mt-8 text-[12px]">
          <div className="text-text-muted space-y-1">
            <p>Dicetak otomatis melalui sistem {brandName}.</p>
            <p>ID Transaksi: #{payroll.id} • Dibuat: {payroll.created_at?.slice(0, 10)}</p>
          </div>

          <div className="text-center w-56 space-y-12">
            <div className="text-text-muted">
              {isAdmin ? 'Disahkan oleh HR & Finance,' : 'Pencatatan Resmi HRD,'}
            </div>
            <div className="border-t border-slate-400 font-bold text-text-primary pt-1">
              {brandName} ({companyTitle})
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
