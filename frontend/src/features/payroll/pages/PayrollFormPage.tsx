import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { payrollService } from '../services/payrollService';
import { INDONESIAN_PROVINCES } from '../../../lib/constants';
import { formatCurrency } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Card } from '../../../components/ui/Card';
import {
  ArrowLeft,
  Save,
  Calculator,
  User,
  CreditCard,
  Building2,
  Briefcase,
  Calendar,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export const PayrollFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  // Form states matching contoh(1).xlsx
  const [rowNo, setRowNo] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [nik, setNik] = useState('');
  const [province, setProvince] = useState('DKI JAKARTA');
  const [schoolUnit, setSchoolUnit] = useState('');
  const [position, setPosition] = useState('Wali Asuh');
  const [joinDate, setJoinDate] = useState('');
  const [period, setPeriod] = useState('2026-08');
  const [basicSalary, setBasicSalary] = useState<number | string>(0);
  const [allowance, setAllowance] = useState<number | string>(0);
  const [deduction, setDeduction] = useState<number | string>(0);
  const [bankAccount, setBankAccount] = useState('');
  const [bankName, setBankName] = useState('BNI');

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Live Take Home Pay calculation
  const numBasic = parseFloat(String(basicSalary)) || 0;
  const numAllowance = parseFloat(String(allowance)) || 0;
  const numDeduction = parseFloat(String(deduction)) || 0;
  const takeHomePay = numBasic + numAllowance - numDeduction;

  useEffect(() => {
    if (isEdit && id) {
      setIsLoading(true);
      payrollService
        .getPayroll(parseInt(id, 10))
        .then((data) => {
          setRowNo(data.row_no ? String(data.row_no) : '');
          setEmployeeName(data.employee_name);
          setNik(data.nik || '');
          setProvince(data.province);
          setSchoolUnit(data.school_unit || '');
          setPosition(data.position || 'Wali Asuh');
          setJoinDate(data.join_date || '');
          setPeriod(data.period);
          setBasicSalary(data.basic_salary);
          setAllowance(data.allowance);
          setDeduction(data.deduction);
          setBankAccount(data.bank_account || '');
          setBankName(data.bank_name || 'BNI');
        })
        .catch((err) => {
          setGeneralError('Gagal memuat data penggajian: ' + err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isEdit, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);
    setIsSubmitting(true);

    const payload = {
      row_no: rowNo.trim() || undefined,
      employee_name: employeeName.trim(),
      nik: nik.trim() || undefined,
      province,
      school_unit: schoolUnit.trim() || undefined,
      position: position.trim() || undefined,
      join_date: joinDate.trim() || undefined,
      period: period.trim(),
      basic_salary: numBasic,
      allowance: numAllowance,
      deduction: numDeduction,
      bank_account: bankAccount.trim() || undefined,
      bank_name: bankName.trim() || undefined,
    };

    try {
      if (isEdit && id) {
        await payrollService.updatePayroll(parseInt(id, 10), payload);
      } else {
        await payrollService.createPayroll(payload);
      }
      navigate('/payrolls');
    } catch (err: any) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        const fieldErrors: Record<string, string> = {};
        Object.entries(err.response.data.errors).forEach(([field, msgs]: [string, any]) => {
          fieldErrors[field] = Array.isArray(msgs) ? msgs[0] : String(msgs);
        });
        setErrors(fieldErrors);
      } else {
        setGeneralError(
          err.response?.data?.message || 'Terjadi kesalahan saat menyimpan data.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-body-default text-text-muted">Memuat data formulir...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Link
          to="/payrolls"
          className="p-2 rounded-lg border border-border-subtle bg-surface-panel hover:bg-surface-container text-text-muted hover:text-text-primary transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-headline-page text-headline-page text-text-primary tracking-tight">
            {isEdit ? 'Ubah Data Penggajian' : 'Tambah Data Penggajian Baru'}
          </h1>
          <p className="font-body-default text-body-default text-text-muted">
            {isEdit
              ? 'Perbarui data kompensasi dan rincian tenaga kependidikan.'
              : 'Masukkan data tenaga kependidikan baru sesuai format Sekolah Rakyat.'}
          </p>
        </div>
      </div>

      {generalError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-danger-text text-body-default flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{generalError}</div>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Data Identitas Karyawan */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border-row">
            <User className="w-5 h-5 text-primary" />
            <h2 className="font-title-card text-[15px] font-bold text-text-primary">
              1. Identitas & Penempatan Karyawan
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nama Lengkap Karyawan *"
              placeholder="Contoh: FEBRI HIDAYAT"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              error={errors.employee_name}
              required
            />

            <Input
              label="Nomor Induk Kependudukan (NIK)"
              placeholder="16 digit NIK (Boleh dikosongkan jika belum ada)"
              value={nik}
              onChange={(e) => setNik(e.target.value)}
              error={errors.nik}
            />

            <Select
              label="Wilayah (Provinsi) *"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              error={errors.province}
              options={INDONESIAN_PROVINCES.map((p) => ({ label: p, value: p }))}
              required
            />

            <Input
              label="Sekolah Rakyat Permanen (Unit Kerja)"
              placeholder="Contoh: Sekolah Rakyat Menengah Atas 10 Jakarta Selatan"
              value={schoolUnit}
              onChange={(e) => setSchoolUnit(e.target.value)}
              error={errors.school_unit}
            />

            <Select
              label="Fungsi Tenaga Kependidikan (Jabatan)"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              error={errors.position}
              options={[
                { label: 'Wali Asuh', value: 'Wali Asuh' },
                { label: 'Cleaning Service', value: 'Cleaning Service' },
                { label: 'Juru Masak', value: 'Juru Masak' },
                { label: 'Wali Asrama', value: 'Wali Asrama' },
                { label: 'Tata Usaha', value: 'Tata Usaha' },
                { label: 'Operator Data Sekolah', value: 'Operator Data Sekolah' },
              ]}
            />

            <Input
              label="Tanggal Masuk Bekerja"
              placeholder="Contoh: 18 Agustus 2026 atau 1-Sep"
              value={joinDate}
              onChange={(e) => setJoinDate(e.target.value)}
              error={errors.join_date}
            />
          </div>
        </Card>

        {/* Section 2: Data Perbankan & Periode */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border-row">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="font-title-card text-[15px] font-bold text-text-primary">
              2. Data Rekening Bank & Periode
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Nama Bank"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              options={[
                { label: 'BNI', value: 'BNI' },
                { label: 'BRI', value: 'BRI' },
                { label: 'MANDIRI', value: 'MANDIRI' },
                { label: 'BCA', value: 'BCA' },
                { label: 'Lainnya', value: 'Lainnya' },
              ]}
            />

            <Input
              label="Nomor Rekening"
              placeholder="Nomor rekening bank"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              error={errors.bank_account}
            />

            <Input
              label="Periode Penggajian (YYYY-MM) *"
              placeholder="Contoh: 2026-08"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              error={errors.period}
              required
            />
          </div>
        </Card>

        {/* Section 3: Komponen Keuangan */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border-row">
            <Calculator className="w-5 h-5 text-primary" />
            <h2 className="font-title-card text-[15px] font-bold text-text-primary">
              3. Komponen Gaji & Take Home Pay
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Gaji Pokok / Nilai Gaji (Rp) *"
              type="number"
              min="0"
              step="1000"
              value={basicSalary}
              onChange={(e) => setBasicSalary(e.target.value)}
              error={errors.basic_salary}
              required
            />

            <Input
              label="Tunjangan Tambahan (Rp)"
              type="number"
              min="0"
              step="1000"
              value={allowance}
              onChange={(e) => setAllowance(e.target.value)}
              error={errors.allowance}
            />

            <Input
              label="Total Potongan (Rp)"
              type="number"
              min="0"
              step="1000"
              value={deduction}
              onChange={(e) => setDeduction(e.target.value)}
              error={errors.deduction}
            />
          </div>

          {/* Live Preview Box */}
          <div className="mt-4 p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <span className="text-[12px] font-bold uppercase tracking-wider text-primary block">
                Total Take Home Pay Diterima (Bersih)
              </span>
              <span className="text-[11px] text-text-muted">
                Rumus: Gaji Pokok + Tunjangan - Potongan
              </span>
            </div>

            <div className="font-display-kpi text-[24px] font-bold text-primary font-mono">
              {formatCurrency(takeHomePay)}
            </div>
          </div>
        </Card>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => navigate('/payrolls')}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            variant="primary"
            type="submit"
            isLoading={isSubmitting}
            leftIcon={<Save className="w-4 h-4" />}
          >
            {isEdit ? 'Simpan Perubahan' : 'Simpan Data Gaji'}
          </Button>
        </div>
      </form>
    </div>
  );
};
