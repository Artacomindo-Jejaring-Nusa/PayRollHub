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
  const brandName = isRiama ? 'Riama Mandiri Pratama' : 'RBS Global';
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
                    HRD Mandiri
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
                Rincian Komponen Gaji Sesuai Formula Database
              </h3>

              <div className="border border-border-subtle rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-primary text-white text-[12px] font-semibold uppercase">
                      <th className="py-3 px-4">Komponen Gaji / Potongan</th>
                      <th className="py-3 px-4 text-center">Dasar Rumus</th>
                      <th className="py-3 px-4 text-right">Nominal (IDR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-row text-[13.5px]">
                    {/* Col N: Net Base Price */}
                    {payroll.net_base_price !== null && payroll.net_base_price !== undefined && (
                      <tr className="bg-slate-50/50">
                        <td className="py-2.5 px-4 font-medium text-text-primary">
                          Harga Dasar di potong PPh & Fee manajemen
                        </td>
                        <td className="py-2.5 px-4 text-center text-[12px] text-text-muted font-mono">
                          Kolom N
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-800">
                          {payroll.formatted_net_base_price}
                        </td>
                      </tr>
                    )}

                    {/* Col Q: BPJS Kes 5% */}
                    {payroll.bpjs_kes !== null && payroll.bpjs_kes !== undefined && (
                      <tr>
                        <td className="py-2.5 px-4 font-medium text-text-secondary pl-6">
                          ↳ BPJS Kesehatan (5%)
                        </td>
                        <td className="py-2.5 px-4 text-center text-[12px] text-text-muted font-mono">
                          Kolom Q (5%)
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                          -{payroll.formatted_bpjs_kes}
                        </td>
                      </tr>
                    )}

                    {/* Col T: BPJS TK 9.24% */}
                    {payroll.bpjs_tk !== null && payroll.bpjs_tk !== undefined && (
                      <tr>
                        <td className="py-2.5 px-4 font-medium text-text-secondary pl-6">
                          ↳ BPJS Ketenagakerjaan (9,24%)
                        </td>
                        <td className="py-2.5 px-4 text-center text-[12px] text-text-muted font-mono">
                          Kolom T (9.24%)
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                          -{payroll.formatted_bpjs_tk}
                        </td>
                      </tr>
                    )}

                    {/* Col U: Gaji Pokok */}
                    <tr className="bg-blue-50/50 font-semibold">
                      <td className="py-3 px-4 text-text-primary">
                        Gaji Pokok Bersih (Hak Jasa Kependidikan)
                      </td>
                      <td className="py-3 px-4 text-center text-[12px] text-primary font-mono">
                        Col N - Q - T
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-primary text-[14.5px]">
                        {payroll.formatted_basic_salary}
                      </td>
                    </tr>

                    {/* Allowance */}
                    {payroll.allowance > 0 && (
                      <tr>
                        <td className="py-2.5 px-4 font-medium text-text-primary">
                          Tunjangan Tambahan & Lembur
                        </td>
                        <td className="py-2.5 px-4 text-center text-[12px] text-text-muted font-mono">
                          Penambahan
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-emerald-600 font-medium">
                          +{payroll.formatted_allowance}
                        </td>
                      </tr>
                    )}

                    {/* Col V: Potongan Absensi */}
                    {payroll.absence_deduction && Number(payroll.absence_deduction) > 0 ? (
                      <tr className="bg-rose-50/40">
                        <td className="py-2.5 px-4 font-medium text-rose-700">
                          <div>Potongan Absensi ({payroll.absence_count || 0}x)</div>
                          {payroll.absence_note && (
                            <div className="text-[11px] text-rose-600 font-normal">
                              Ket: {payroll.absence_note}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center text-[12px] text-rose-600 font-mono">
                          Kolom V ({payroll.absence_count}x @ {formatCurrency(payroll.absence_rate || 50000)})
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-rose-600 font-semibold">
                          -{payroll.formatted_absence_deduction}
                        </td>
                      </tr>
                    ) : null}

                    {/* Col S: PPh21 */}
                    {payroll.pph21 && Number(payroll.pph21) > 0 ? (
                      <tr className="bg-amber-50/40">
                        <td className="py-2.5 px-4 font-medium text-amber-800">
                          Pajak Penghasilan (PPh 21)
                        </td>
                        <td className="py-2.5 px-4 text-center text-[12px] text-amber-700 font-mono">
                          Kolom S
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-amber-800 font-semibold">
                          -{payroll.formatted_pph21 || formatCurrency(payroll.pph21)}
                        </td>
                      </tr>
                    ) : null}

                    {/* General Deduction */}
                    {payroll.deduction > 0 && (
                      <tr>
                        <td className="py-2.5 px-4 font-medium text-status-danger-text">
                          Potongan Lainnya
                        </td>
                        <td className="py-2.5 px-4 text-center text-[12px] text-text-muted font-mono">
                          Pengurangan
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-status-danger-text font-medium">
                          -{payroll.formatted_deduction}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Net Take Home Pay Total Box */}
            <div className="p-5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-primary/40 flex items-center justify-between">
              <div>
                <div className="font-title-card text-[14px] font-bold text-primary uppercase tracking-wider">
                  TOTAL GAJI DITERIMA (TAKE HOME PAY)
                </div>
                <span className="text-[12px] text-text-muted">
                  Ditransfer langsung ke rekening {payroll.bank_name || 'karyawan'}
                </span>
              </div>

              <div className="font-display-kpi text-[24px] sm:text-[28px] font-bold text-primary font-mono">
                {payroll.formatted_take_home_pay}
              </div>
            </div>
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
            <p>Dicetak otomatis melalui sistem HRD Mandiri — {brandName}.</p>
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
