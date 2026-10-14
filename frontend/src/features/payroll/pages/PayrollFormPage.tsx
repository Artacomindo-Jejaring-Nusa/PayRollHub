import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTenantTheme } from '../../../lib/theme';
import { payrollService } from '../services/payrollService';
import { attendanceService } from '../../attendance/services/attendanceService';
import { INDONESIAN_PROVINCES } from '../../../lib/constants';
import { formatCurrency } from '../../../lib/utils';
import { SP_PERIOD_LIST, normalizePeriodToSP } from '../../../lib/period';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Card } from '../../../components/ui/Card';
import { ProvincePayrollSetting, OffEmployeeItem, PayrollPeriodItem } from '../../../types/payroll';
import { PayrollPeriodsModal } from '../components/PayrollPeriodsModal';
import { payrollPeriodService } from '../services/payrollPeriodService';
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
  CalendarX,
  UserCheck,
  UserX,
  Wallet,
  CheckCircle2,
  Plus,
  Trash2,
  RefreshCw,
  SlidersHorizontal,
  History,
  AlertTriangle,
  Eye,
  EyeOff,
  Layers,
} from 'lucide-react';

export const PayrollFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { tenant } = useTenantTheme();

  // Basic Information (Kotak 1)
  const [rowNo, setRowNo] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [nik, setNik] = useState('');
  const [province, setProvince] = useState('DKI JAKARTA');
  const [schoolUnit, setSchoolUnit] = useState('');
  const [position, setPosition] = useState('Wali Asuh');
  const [joinDate, setJoinDate] = useState('');
  const [company, setCompany] = useState<'rbs' | 'rimamandiri'>(
    tenant.id === 'rimamandiri' ? 'rimamandiri' : 'rbs'
  );

  // Status & Rekening (Kotak 2)
  const [status, setStatus] = useState<'active' | 'off'>('active');
  const [resignDate, setResignDate] = useState('');
  const [period, setPeriod] = useState('SP 1');
  const [isVisibleToUser, setIsVisibleToUser] = useState<boolean>(true);
  const [availablePeriods, setAvailablePeriods] = useState<PayrollPeriodItem[]>([]);
  const [isPeriodsModalOpen, setIsPeriodsModalOpen] = useState(false);
  const [bankAccount, setBankAccount] = useState('');
  const [bankName, setBankName] = useState('BNI');

  // Pergantian Karyawan (Pengganti Karyawan Off)
  const [isReplacing, setIsReplacing] = useState(false);
  const [replacedPayrollId, setReplacedPayrollId] = useState<number | string>('');
  const [replacedEmployeeName, setReplacedEmployeeName] = useState('');
  const [replacementDate, setReplacementDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [replacementNote, setReplacementNote] = useState('');
  const [offEmployees, setOffEmployees] = useState<OffEmployeeItem[]>([]);
  const [provinceSettings, setProvinceSettings] = useState<ProvincePayrollSetting[]>([]);

  // Formula Gaji Pokok & BPJS (Sesuai Format Resmi 2026)
  const [basicSalary, setBasicSalary] = useState<number | string>('');
  const [bpjsKes, setBpjsKes] = useState<number | string>('');
  const [bpjsTkJht, setBpjsTkJht] = useState<number | string>(0);
  const [bpjsTkJp, setBpjsTkJp] = useState<number | string>(0);
  const [bpjsTk, setBpjsTk] = useState<number | string>(0);
  const [netBasePrice, setNetBasePrice] = useState<number | string>('');

  // Point 15: Jumlah Absen Masuk & Jumlah Libur (Kotak 4)
  const [attendedDays, setAttendedDays] = useState<number | string>(0);
  const [holidayDays, setHolidayDays] = useState<number | string>(0);
  const [syncingAttendance, setSyncingAttendance] = useState(false);
  const [attendanceSyncNotice, setAttendanceSyncNotice] = useState<string | null>(null);

  // Potongan Absensi & Take Home Pay (Kotak 4)
  const [absenceCount, setAbsenceCount] = useState<number>(0);
  const [absenceRate, setAbsenceRate] = useState<number>(50000);
  const [absenceDeduction, setAbsenceDeduction] = useState<number | string>(0);
  const [absenceNote, setAbsenceNote] = useState('');
  const [allowance, setAllowance] = useState<number | string>(0);

  // Custom Deductions (Bisa nambah-nambah potongan kustom)
  const [customDeductions, setCustomDeductions] = useState<
    Array<{ id: string; name: string; amount: number | string }>
  >([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Load auxiliary data: Province settings & Off employees
  useEffect(() => {
    payrollService.getProvinceSettings(tenant.id).then(setProvinceSettings).catch(console.error);
    payrollService.getOffEmployees(undefined, tenant.id).then(setOffEmployees).catch(console.error);
  }, [tenant.id]);

  // Handler auto-apply dari pengaturan provinsi
  const handleApplyProvinceRules = (provName: string) => {
    const found = provinceSettings.find(
      (p) => p.province.trim().toUpperCase() === provName.trim().toUpperCase()
    );
    if (found) {
      setBpjsKes(found.bpjs_kes);
      setBpjsTkJht(found.bpjs_tk_jht);
      setBpjsTkJp(found.bpjs_tk_jp);
      setBpjsTk(found.bpjs_tk);
    }
  };

  // Auto-hitung BPJS Kesehatan saat Gaji Pokok berubah jika belum terisi
  const handleBasicSalaryChange = (valStr: string) => {
    setBasicSalary(valStr);
    const val = parseFloat(valStr) || 0;
    if (val > 0 && (!bpjsKes || Number(bpjsKes) === 0)) {
      handleApplyProvinceRules(province);
    }
  };

  // Point 15: Helper tarik data absensi karyawan otomatis dari modul kehadiran
  const handleSyncAttendance = async () => {
    if (!employeeName.trim()) {
      alert('Silakan isi Nama Lengkap Karyawan terlebih dahulu untuk menarik data absensi.');
      return;
    }
    try {
      setSyncingAttendance(true);
      setAttendanceSyncNotice(null);
      const res = await attendanceService.getRecapByEmployee({
        sp_period: period,
        search: employeeName.trim(),
      });
      const cleanTargetName = employeeName.trim().toLowerCase();
      const cleanTargetNik = nik ? nik.trim() : '';
      const found = res.items?.find(
        (item: any) =>
          (cleanTargetNik && item.nik && item.nik.trim() === cleanTargetNik) ||
          (item.name && item.name.toLowerCase().includes(cleanTargetName)) ||
          cleanTargetName.includes((item.name || '').toLowerCase())
      );

      if (found) {
        setAttendedDays(found.total_present ?? 0);
        setHolidayDays(found.total_holiday ?? 0);
        setAttendanceSyncNotice(
          `✓ Data absensi berhasil ditarik untuk ${period}: ${found.total_present} hari masuk, ${found.total_holiday} hari libur.`
        );
      } else {
        setAttendanceSyncNotice(
          `Catatan: Tidak ditemukan log presensi otomatis atas nama "${employeeName}" pada ${period}. Silakan masukkan jumlah absen masuk & libur secara manual.`
        );
      }
    } catch (err) {
      console.error('Error syncing attendance:', err);
      setAttendanceSyncNotice('Gagal menghubungkan ke data absensi. Silakan isi secara manual.');
    } finally {
      setSyncingAttendance(false);
    }
  };

  const handleAddCustomDeduction = () => {
    setCustomDeductions((prev) => [
      ...prev,
      {
        id: `cd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: '',
        amount: '',
      },
    ]);
  };

  const handleRemoveCustomDeduction = (id: string) => {
    setCustomDeductions((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCustomDeductionChange = (
    id: string,
    field: 'name' | 'amount',
    val: string | number
  ) => {
    setCustomDeductions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  // Potongan Absensi
  const handleAbsenceMultiplierChange = (count: number) => {
    setAbsenceCount(count);
    const total = count * (absenceRate || 0);
    setAbsenceDeduction(total);
  };

  const handleAbsenceRateChange = (rateVal: number) => {
    setAbsenceRate(rateVal);
    const total = (absenceCount || 0) * rateVal;
    setAbsenceDeduction(total);
  };

  // Format 2026: BPJS TK BUKAN pengurang! THP = (Pokok + BPJS KES + Tunjangan) - (Absensi + Potongan Kustom)
  const numBasic = parseFloat(String(basicSalary)) || 0;
  const numBpjsKes = parseFloat(String(bpjsKes)) || 0;
  const numAllowance = parseFloat(String(allowance)) || 0;
  const numAbsence = parseFloat(String(absenceDeduction)) || 0;
  const numCustomDeductions = customDeductions.reduce((sum, item) => {
    const val = parseFloat(String(item.amount)) || 0;
    return sum + (val > 0 ? val : 0);
  }, 0);

  const totalEarnings = numBasic + numBpjsKes + numAllowance;
  const totalDeductions = numAbsence + numCustomDeductions;
  const takeHomePay = Math.max(0, totalEarnings - totalDeductions);

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
          setPeriod(normalizePeriodToSP(data.period));
          setIsVisibleToUser(data.is_visible_to_user ?? true);
          setCompany(data.company === 'rimamandiri' ? 'rimamandiri' : 'rbs');
          setStatus(data.status || 'active');
          setResignDate(data.resign_date || '');

          setNetBasePrice(data.net_base_price ?? '');
          setBpjsKes(data.bpjs_kes ?? '');
          setBpjsTkJht(data.bpjs_tk_jht ?? 0);
          setBpjsTkJp(data.bpjs_tk_jp ?? 0);
          setBpjsTk(data.bpjs_tk ?? 0);
          setBasicSalary(data.basic_salary);

          if (data.replaced_employee_name || data.replaced_payroll_id) {
            setIsReplacing(true);
            setReplacedPayrollId(data.replaced_payroll_id ?? '');
            setReplacedEmployeeName(data.replaced_employee_name ?? '');
            setReplacementDate(data.replacement_date ? data.replacement_date.slice(0, 10) : new Date().toISOString().split('T')[0]);
            setReplacementNote(data.replacement_note ?? '');
          }

          setAttendedDays(data.attended_days ?? 0);
          setHolidayDays(data.holiday_days ?? 0);

          setAbsenceCount(data.absence_count ?? 0);
          setAbsenceRate(data.absence_rate ?? 50000);
          setAbsenceDeduction(data.absence_deduction ?? 0);
          setAbsenceNote(data.absence_note || '');

          setAllowance(data.allowance);

          if (data.custom_deductions && Array.isArray(data.custom_deductions) && data.custom_deductions.length > 0) {
            setCustomDeductions(
              data.custom_deductions.map((item, idx) => ({
                id: `cd-${idx}-${Date.now()}`,
                name: item.name || '',
                amount: item.amount || 0,
              }))
            );
          } else if (data.deduction && Number(data.deduction) > 0) {
            setCustomDeductions([
              {
                id: `cd-legacy`,
                name: 'Potongan Lainnya',
                amount: data.deduction,
              },
            ]);
          } else {
            setCustomDeductions([]);
          }

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
  }, [isEdit, id, tenant.id]);

  useEffect(() => {
    payrollPeriodService
      .getPeriods({ company })
      .then((items) => {
        setAvailablePeriods(items);
      })
      .catch((err) => {
        console.error('Failed to load periods', err);
      });
  }, [company]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);
    setIsSubmitting(true);

    const calculatedTk = (parseFloat(String(bpjsTkJht)) || 0) + (parseFloat(String(bpjsTkJp)) || 0);

    const payload = {
      row_no: rowNo.trim() || undefined,
      employee_name: employeeName.trim(),
      nik: nik.trim() || undefined,
      province,
      school_unit: schoolUnit.trim() || undefined,
      position: position.trim() || undefined,
      join_date: joinDate.trim() || undefined,
      period: period.trim(),
      is_visible_to_user: isVisibleToUser,
      company,
      status,
      resign_date: status === 'off' ? resignDate.trim() || undefined : undefined,

      net_base_price: netBasePrice !== '' ? parseFloat(String(netBasePrice)) : undefined,
      bpjs_kes: bpjsKes !== '' ? parseFloat(String(bpjsKes)) : undefined,
      bpjs_tk_jht: bpjsTkJht !== '' ? parseFloat(String(bpjsTkJht)) : 0,
      bpjs_tk_jp: bpjsTkJp !== '' ? parseFloat(String(bpjsTkJp)) : 0,
      bpjs_tk: calculatedTk > 0 ? calculatedTk : (bpjsTk !== '' ? parseFloat(String(bpjsTk)) : 0),
      basic_salary: numBasic,

      replaced_payroll_id: isReplacing && replacedPayrollId ? Number(replacedPayrollId) : undefined,
      replaced_employee_name: isReplacing ? replacedEmployeeName.trim() || undefined : undefined,
      replacement_date: isReplacing ? replacementDate.trim() || undefined : undefined,
      replacement_note: isReplacing ? replacementNote.trim() || undefined : undefined,

      attended_days: parseInt(String(attendedDays), 10) || 0,
      holiday_days: parseInt(String(holidayDays), 10) || 0,
      absence_count: absenceCount || 0,
      absence_rate: absenceRate || 0,
      absence_deduction: numAbsence,
      absence_note: absenceNote.trim() || undefined,

      allowance: numAllowance,
      deduction: numCustomDeductions,
      custom_deductions: customDeductions
        .filter((cd) => cd.name.trim() !== '' || (parseFloat(String(cd.amount)) || 0) > 0)
        .map((cd) => ({
          name: cd.name.trim() || 'Potongan Kustom',
          amount: parseFloat(String(cd.amount)) || 0,
        })),
      take_home_pay: takeHomePay,
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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header with Title and Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                ? 'Perbarui data rincian gaji, potongan absensi, dan status keaktifan tenaga kependidikan.'
                : 'Masukkan data tenaga kependidikan baru lengkap dengan formula gaji pokok dan absensi.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            type="button"
            size="sm"
            onClick={() => navigate('/payrolls')}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            variant="primary"
            type="button"
            size="sm"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            leftIcon={<Save className="w-4 h-4" />}
          >
            {isEdit ? 'Simpan Perubahan' : 'Simpan Data Gaji'}
          </Button>
        </div>
      </div>

      {generalError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-danger-text text-body-default flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{generalError}</div>
        </div>
      )}

      {/* Main 2x2 Grid Form Layout (4 Kotak / Quadrant Grid) */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ======================================================== */}
          {/* KOTAK 1 (Kiri Atas): Identitas & Penempatan Karyawan       */}
          {/* ======================================================== */}
          <Card className="p-6 flex flex-col justify-between space-y-4 border border-border-subtle shadow-sm hover:border-slate-300 transition-colors">
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border-row">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-primary flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-title-card text-[15px] font-bold text-text-primary">
                    1. Identitas & Penempatan Karyawan
                  </h2>
                  <p className="text-[11px] text-text-muted">
                    Data pribadi, NIK, dan penempatan unit Sekolah Rakyat
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                <Input
                  label="Nama Lengkap Karyawan *"
                  placeholder="Contoh: FEBRI HIDAYAT"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  error={errors.employee_name}
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    label="Nomor Induk Kependudukan (NIK)"
                    placeholder="16 digit NIK"
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
                </div>

                <Input
                  label="Sekolah Rakyat Permanen (Unit Kerja)"
                  placeholder="Contoh: Sekolah Rakyat Menengah Atas 10 Jakarta Selatan"
                  value={schoolUnit}
                  onChange={(e) => setSchoolUnit(e.target.value)}
                  error={errors.school_unit}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {(() => {
                    const basePositionOptions = [
                      { label: 'Security', value: 'Security' },
                      { label: 'Satpam', value: 'Satpam' },
                      { label: 'Wali Asuh', value: 'Wali Asuh' },
                      { label: 'Cleaning Service', value: 'Cleaning Service' },
                      { label: 'Juru Masak', value: 'Juru Masak' },
                      { label: 'Wali Asrama', value: 'Wali Asrama' },
                      { label: 'Tata Usaha', value: 'Tata Usaha' },
                      { label: 'Operator Data Sekolah', value: 'Operator Data Sekolah' },
                    ];
                    // Jika posisi yang sedang diedit belum ada di daftar, tambahkan dinamis agar tidak hilang
                    const options = [...basePositionOptions];
                    if (position && !options.some((opt) => opt.value.toLowerCase() === position.toLowerCase())) {
                      options.unshift({ label: position, value: position });
                    }
                    return (
                      <Select
                        label="Fungsi Tenaga Kependidikan (Jabatan)"
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        error={errors.position}
                        options={options}
                      />
                    );
                  })()}

                  <Input
                    label="Tanggal Masuk Bekerja"
                    placeholder="Contoh: 1 September 2026"
                    value={joinDate}
                    onChange={(e) => setJoinDate(e.target.value)}
                    error={errors.join_date}
                  />
                </div>

                <Select
                  label="Entitas Perusahaan (Tenant)"
                  value={company}
                  onChange={(e) => setCompany(e.target.value as 'rbs' | 'rimamandiri')}
                  options={[
                    { label: 'PT. Rimbun Buana Sejahtera (rimbunbuanasejahtera.com)', value: 'rbs' },
                    { label: 'PT. Riama Mandiri Pratama (riamamandiripratama.com)', value: 'rimamandiri' },
                  ]}
                />
              </div>
            </div>
          </Card>

          {/* ======================================================== */}
          {/* KOTAK 2 (Kanan Atas): Status Keaktifan & Rekening Bank    */}
          {/* ======================================================== */}
          <Card className="p-6 flex flex-col justify-between space-y-4 border border-border-subtle shadow-sm hover:border-slate-300 transition-colors">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border-row">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-title-card text-[15px] font-bold text-text-primary">
                      2. Status Keaktifan & Rekening Bank
                    </h2>
                    <p className="text-[11px] text-text-muted">
                      Status keaktifan kerja, tanggal keluar, dan rekening bank
                    </p>
                  </div>
                </div>

                {/* Status Indicator */}
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    status === 'off'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {status === 'off' ? 'Off / Keluar' : 'Aktif'}
                </span>
              </div>

              {/* Status Switcher Buttons */}
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-text-secondary">
                  Status Keaktifan Karyawan *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('active');
                      setResignDate('');
                    }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-[13px] font-semibold transition-all cursor-pointer ${
                      status === 'active'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-2xs'
                        : 'bg-surface border-border-subtle text-text-muted hover:bg-surface-container'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Karyawan Aktif</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStatus('off');
                      if (!resignDate) {
                        setResignDate(new Date().toISOString().split('T')[0]);
                      }
                    }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-[13px] font-semibold transition-all cursor-pointer ${
                      status === 'off'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-2xs'
                        : 'bg-surface border-border-subtle text-text-muted hover:bg-surface-container'
                    }`}
                  >
                    <UserX className="w-4 h-4" />
                    <span>Off / Keluar</span>
                  </button>
                </div>
              </div>

              {/* Tanggal Keluar (Jika Status Off) */}
              {status === 'off' && (
                <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 space-y-2">
                  <label className="block text-[12px] font-semibold text-rose-800">
                    Tanggal Keluar (Resign Date) *
                  </label>
                  <input
                    type="date"
                    value={resignDate}
                    onChange={(e) => setResignDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-rose-300 bg-white text-rose-900 text-[13px] outline-none focus:ring-2 focus:ring-rose-500"
                    required={status === 'off'}
                  />
                  <p className="text-[11px] text-rose-700 leading-tight">
                    Karyawan ini akan tercatat dalam laporan <strong>Karyawan Off</strong> di dashboard admin.
                  </p>
                </div>
              )}

              {/* Periode Gaji & Visibilitas */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-text">
                    Periode Gaji (Bulan) Target *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsPeriodsModalOpen(true)}
                    className="text-[11.5px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>+ Kelola / Tambah Periode Target</span>
                  </button>
                </div>

                {(() => {
                  const optionsMap = new Map<string, string>();
                  SP_PERIOD_LIST.forEach((sp) => optionsMap.set(sp.code, sp.fullLabel));
                  availablePeriods.forEach((ap) => {
                    const suffix = ap.is_visible_to_user === false ? ' (Luar SP — Hidden)' : (!ap.is_sp ? ' (Luar SP)' : '');
                    optionsMap.set(ap.code, `${ap.code} — ${ap.name}${suffix}`);
                  });
                  if (period && !optionsMap.has(period)) {
                    optionsMap.set(period, `${period} (Target Periode)`);
                  }

                  const spOptions = Array.from(optionsMap.entries()).map(([value, label]) => ({
                    value,
                    label,
                  }));

                  return (
                    <Select
                      value={period}
                      onChange={(e) => {
                        const selectedVal = e.target.value;
                        setPeriod(selectedVal);
                        const matched = availablePeriods.find(
                          (p) => p.code.toLowerCase() === selectedVal.toLowerCase()
                        );
                        if (matched) {
                          setIsVisibleToUser(matched.is_visible_to_user ?? true);
                        } else {
                          setIsVisibleToUser(/^SP\s*\d+$/i.test(selectedVal));
                        }
                      }}
                      options={spOptions}
                      error={errors.period}
                      required
                    />
                  );
                })()}

                {/* Visibilitas di Portal Karyawan (User View) (Poin 17) */}
                <div className="p-3 rounded-xl border border-border-subtle bg-slate-50/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text flex items-center gap-1.5">
                      {isVisibleToUser ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          Tampil di Portal Karyawan
                        </span>
                      ) : (
                        <span className="text-amber-800 flex items-center gap-1">
                          <EyeOff className="w-3.5 h-3.5" />
                          Khusus Admin (Disembunyikan dari User View)
                        </span>
                      )}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsVisibleToUser(true)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                          isVisibleToUser
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        👁️ Tampilkan
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsVisibleToUser(false)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                          !isVisibleToUser
                            ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        🔒 Sembunyikan
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-text-muted leading-tight">
                    {isVisibleToUser ? (
                      <span>Karyawan ini dapat melihat dan mengunduh slip gaji di portal karyawan mandiri.</span>
                    ) : (
                      <span className="text-amber-800 font-medium">
                        Karyawan di luar SP (misal Ambon, Cikarang) tidak akan melihat data penggajian ini di User View. Hanya Admin yang dapat melihat dan mengelola data ini.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Bank & Nomor Rekening */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Select
                  label="Nama Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  options={[
                    { label: 'BNI', value: 'BNI' },
                    { label: 'BRI', value: 'BRI' },
                    { label: 'MANDIRI', value: 'MANDIRI' },
                    { label: 'BCA', value: 'BCA' },
                    { label: 'BSI', value: 'BSI' },
                    { label: 'Lainnya', value: 'Lainnya' },
                  ]}
                />

                <Input
                  label="Nomor Rekening Bank"
                  placeholder="Nomor rekening"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  error={errors.bank_account}
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11.5px] text-text-muted flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Rekening digunakan untuk slip transfer gaji resmi periode <strong>{period}</strong>.
                </span>
              </div>

              {/* Pergantian Karyawan (Pengganti Karyawan Off) */}
              <div className="pt-3 border-t border-border-row space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-semibold text-text-secondary flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isReplacing}
                      onChange={(e) => setIsReplacing(e.target.checked)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 cursor-pointer"
                    />
                    <span>Karyawan ini menggantikan karyawan keluar / off</span>
                  </label>
                  {isReplacing && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      Pergantian Posisi
                    </span>
                  )}
                </div>

                {isReplacing && (
                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-3">
                    <div>
                      <label className="block text-[11.5px] font-semibold text-amber-900 mb-1">
                        Pilih Karyawan Yang Digantikan (Off/Keluar)
                      </label>
                      <select
                        value={replacedPayrollId}
                        onChange={(e) => {
                          setReplacedPayrollId(e.target.value);
                          const sel = offEmployees.find((o) => o.id === Number(e.target.value));
                          if (sel) {
                            setReplacedEmployeeName(sel.employee_name);
                          }
                        }}
                        className="w-full h-9 px-3 rounded-lg border border-amber-300 bg-white text-[12.5px] outline-none focus:ring-2 focus:ring-primary text-text-primary"
                      >
                        <option value="">-- Pilih dari Karyawan Off ({offEmployees.length}) --</option>
                        {offEmployees.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.employee_name} ({o.position || '-'}) - {o.school_unit || '-'} {o.resign_date ? `[Out: ${o.resign_date}]` : ''}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        placeholder="Atau ketik nama karyawan yang digantikan..."
                        value={replacedEmployeeName}
                        onChange={(e) => setReplacedEmployeeName(e.target.value)}
                        className="w-full h-8 px-3 mt-1.5 rounded-lg border border-amber-200 bg-white text-[12px] outline-none focus:ring-2 focus:ring-primary text-text-primary"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                          Tanggal Efektif Penggantian
                        </label>
                        <input
                          type="date"
                          value={replacementDate}
                          onChange={(e) => setReplacementDate(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg border border-amber-300 bg-white text-[12px] outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                          Catatan / Keterangan
                        </label>
                        <input
                          type="text"
                          placeholder="Contoh: Menggantikan Wali Asuh Asrama 1"
                          value={replacementNote}
                          onChange={(e) => setReplacementNote(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg border border-amber-300 bg-white text-[12px] outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* ======================================================== */}
          {/* KOTAK 3 (Kiri Bawah): Gaji Pokok & Komponen BPJS         */}
          {/* ======================================================== */}
          <Card className="p-6 flex flex-col justify-between space-y-4 border border-border-subtle shadow-sm hover:border-slate-300 transition-colors">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border-row">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-title-card text-[15px] font-bold text-text-primary">
                      3. Gaji Pokok & Komponen BPJS
                    </h2>
                    <p className="text-[11px] text-text-muted">
                      Gaji Pokok, BPJS Kesehatan (+), & BPJS Ketenagakerjaan (Non-potongan)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleApplyProvinceRules(province)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors flex items-center gap-1 cursor-pointer"
                  title={`Gunakan nilai standar UMP provinsi ${province}`}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Isi Sesuai {province}</span>
                </button>
              </div>

              <div className="space-y-3.5">
                {/* Gaji Pokok Langsung */}
                <div>
                  <Input
                    label="Gaji Pokok (Rp) *"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Contoh: 3291906"
                    value={basicSalary}
                    onChange={(e) => handleBasicSalaryChange(e.target.value)}
                    error={errors.basic_salary}
                    required
                  />
                  <span className="text-[10px] text-text-muted">
                    Penghasilan dasar pegawai (komponen utama)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* BPJS KES */}
                  <div>
                    <Input
                      label="Tunjangan BPJS Kesehatan (Rp)"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Contoh: 192094"
                      value={bpjsKes}
                      onChange={(e) => setBpjsKes(e.target.value)}
                      error={errors.bpjs_kes}
                    />
                    <span className="text-[10px] text-emerald-600 font-medium">
                      + Tunjangan Kesehatan (Penambah ke Total Gaji)
                    </span>
                  </div>

                  {/* BPJS TK JHT & JP */}
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-semibold text-text-secondary">
                      BPJS TK (JHT & JP) - Non-Potongan
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="JHT: 150000"
                        value={bpjsTkJht}
                        onChange={(e) => {
                          setBpjsTkJht(e.target.value);
                          const total = (parseFloat(e.target.value) || 0) + (parseFloat(String(bpjsTkJp)) || 0);
                          setBpjsTk(total);
                        }}
                        className="w-full h-10 px-2.5 rounded-lg border border-border-subtle bg-surface text-[12px] font-mono outline-none focus:ring-2 focus:ring-primary"
                        title="BPJS TK JHT"
                      />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="JP: 200000"
                        value={bpjsTkJp}
                        onChange={(e) => {
                          setBpjsTkJp(e.target.value);
                          const total = (parseFloat(String(bpjsTkJht)) || 0) + (parseFloat(e.target.value) || 0);
                          setBpjsTk(total);
                        }}
                        className="w-full h-10 px-2.5 rounded-lg border border-border-subtle bg-surface text-[12px] font-mono outline-none focus:ring-2 focus:ring-primary"
                        title="BPJS TK JP"
                      />
                    </div>
                    <span className="text-[10.5px] text-text-muted block">
                      Total BPJS TK: <strong className="font-mono text-primary">{formatCurrency((parseFloat(String(bpjsTkJht)) || 0) + (parseFloat(String(bpjsTkJp)) || 0))}</strong> (Muncul di bawah slip sebagai saldo dicairkan, tidak memotong gaji diterima).
                    </span>
                  </div>
                </div>

                {/* Banner Total Gaji Sebelum Potongan */}
                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                        TOTAL GAJI SEBELUM POTONGAN
                      </span>
                      <span className="text-[11px] text-text-muted font-mono">
                        Pokok ({formatCurrency(numBasic)}) + BPJS KES ({formatCurrency(numBpjsKes)}) + Tunjangan ({formatCurrency(numAllowance)})
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[20px] font-bold font-mono text-primary">
                        {formatCurrency(totalEarnings)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* ======================================================== */}
          {/* KOTAK 4 (Kanan Bawah): Potongan Absensi & Take Home Pay    */}
          {/* ======================================================== */}
          <Card className="p-6 flex flex-col justify-between space-y-4 border border-border-subtle shadow-sm hover:border-slate-300 transition-colors">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border-row flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                    <CalendarX className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-title-card text-[15px] font-bold text-text-primary">
                      4. Potongan Absensi & Take Home Pay
                    </h2>
                    <p className="text-[11px] text-text-muted">
                      Hari masuk, libur, tarif potongan absensi, potongan lain, & gaji bersih
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSyncAttendance}
                  disabled={syncingAttendance}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title={`Tarik data hari masuk & libur otomatis dari data absensi ${period}`}
                >
                  <RefreshCw className={`w-3 h-3 ${syncingAttendance ? 'animate-spin' : ''}`} />
                  <span>{syncingAttendance ? 'Menghubungkan...' : 'Tarik dari Rekap Absensi'}</span>
                </button>
              </div>

              {attendanceSyncNotice && (
                <div className="p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-[11.5px] text-emerald-800 flex items-center justify-between gap-2">
                  <span>{attendanceSyncNotice}</span>
                  <button
                    type="button"
                    onClick={() => setAttendanceSyncNotice(null)}
                    className="text-emerald-700 hover:text-emerald-900 font-bold px-1"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="space-y-3.5">
                {/* Point 15: Field Jumlah Absen Masuk & Jumlah Libur */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Jumlah Absen Masuk (Hari)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={attendedDays}
                      onChange={(e) => setAttendedDays(e.target.value)}
                      className="w-full h-10 px-3 bg-white rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px] font-mono font-medium"
                    />
                    <span className="text-[10px] text-text-muted mt-0.5 block">
                      Total presensi hadir kerja masuk selama periode {period}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Jumlah Libur (Hari)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={holidayDays}
                      onChange={(e) => setHolidayDays(e.target.value)}
                      className="w-full h-10 px-3 bg-white rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px] font-mono font-medium"
                    />
                    <span className="text-[10px] text-text-muted mt-0.5 block">
                      Total hari libur / off selama periode {period}
                    </span>
                  </div>
                </div>

                {/* Point 16: Potongan Absensi Tarif per Hari & Kelipatan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Kelipatan Absensi (Hari Tidak Masuk) *
                    </label>
                    <select
                      value={absenceCount}
                      onChange={(e) => handleAbsenceMultiplierChange(parseInt(e.target.value, 10))}
                      className="w-full h-10 px-3 bg-surface-panel rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px] font-medium cursor-pointer"
                    >
                      <option value={0}>0x (Tidak Ada Potongan)</option>
                      <option value={1}>1x (1 Hari Absen / Alpa)</option>
                      <option value={2}>2x (2 Hari Absen / Alpa)</option>
                      <option value={3}>3x (3 Hari Absen / Alpa)</option>
                      <option value={4}>4x (4 Hari Absen / Alpa)</option>
                      <option value={5}>5x (5 Hari Absen / Alpa)</option>
                      <option value={6}>6x (6 Hari Absen / Alpa)</option>
                      <option value={7}>7x (7 Hari Absen / Alpa)</option>
                      <option value={8}>8x (8 Hari Absen / Alpa)</option>
                      <option value={9}>9x (9 Hari Absen / Alpa)</option>
                      <option value={10}>10x (10 Hari Absen / Alpa)</option>
                    </select>
                  </div>

                  <Input
                    label="Potongan Tarif per Hari (Rp) *"
                    type="number"
                    min="0"
                    step="any"
                    value={absenceRate}
                    onChange={(e) => handleAbsenceRateChange(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <Input
                      label="Total Pot. Absensi (Rp)"
                      type="number"
                      min="0"
                      step="any"
                      value={absenceDeduction}
                      onChange={(e) => setAbsenceDeduction(e.target.value)}
                      error={errors.absence_deduction}
                    />
                    <span className="text-[10px] text-text-muted">
                      = {absenceCount}x @ {formatCurrency(absenceRate)}
                    </span>
                  </div>

                  <Input
                    label="Tunjangan / Lembur (Rp)"
                    type="number"
                    min="0"
                    step="any"
                    value={allowance}
                    onChange={(e) => setAllowance(e.target.value)}
                    error={errors.allowance}
                  />
                </div>

                <Input
                  label="Keterangan Absensi (Opsional)"
                  placeholder="Contoh: Izin 2 hari tanpa surat keterangan sakit"
                  value={absenceNote}
                  onChange={(e) => setAbsenceNote(e.target.value)}
                  error={errors.absence_note}
                />

                {/* Bagian Potongan Kustom (Bisa nambah-nambah potongan kustom) */}
                <div className="pt-2 border-t border-border-subtle space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-[12px] font-semibold text-text-primary">
                        Potongan Kustom / Lainnya (Di luar Absensi)
                      </label>
                      <p className="text-[11px] text-text-muted">
                        Tambahkan potongan fleksibel sesuai kebutuhan karyawan (misal: Kasbon, Koperasi, Seragam, Denda, dll).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCustomDeduction}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[12px] font-semibold border border-rose-200 transition-colors shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Potongan</span>
                    </button>
                  </div>

                  {customDeductions.length === 0 ? (
                    <div className="p-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 text-center">
                      <span className="text-[12px] text-text-muted">
                        Belum ada potongan kustom. Klik <strong>+ Tambah Potongan</strong> jika ada potongan lain di luar absensi.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {customDeductions.map((item, index) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-panel border border-border-subtle"
                        >
                          <div className="flex-1">
                            <input
                              type="text"
                              placeholder={`Nama Potongan #${index + 1} (misal: Kasbon, Koperasi)`}
                              value={item.name}
                              onChange={(e) =>
                                handleCustomDeductionChange(item.id, 'name', e.target.value)
                              }
                              className="w-full h-9 px-3 bg-surface rounded-md text-[12.5px] border border-border-subtle outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                            />
                          </div>

                          <div className="w-40 sm:w-48">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-text-muted font-mono font-semibold">
                                Rp
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0"
                                value={item.amount}
                                onChange={(e) =>
                                  handleCustomDeductionChange(item.id, 'amount', e.target.value)
                                }
                                className="w-full h-9 pl-9 pr-3 bg-surface rounded-md text-[12.5px] border border-border-subtle outline-none focus:ring-2 focus:ring-rose-500 font-mono font-medium text-right"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveCustomDeduction(item.id)}
                            title="Hapus Potongan"
                            className="p-2 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-rose-50/70 border border-rose-200/80 text-[12px]">
                        <span className="font-semibold text-rose-800">
                          Total Potongan Kustom ({customDeductions.length} item):
                        </span>
                        <span className="font-mono font-bold text-rose-800 text-[13px]">
                          -{formatCurrency(numCustomDeductions)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Take Home Pay Highlight Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50/80 to-teal-50/80 border-2 border-emerald-400/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                        TOTAL TAKE HOME PAY (BERSIH)
                      </span>
                      <span className="text-[10.5px] text-emerald-700 font-mono">
                        Pokok ({formatCurrency(numBasic)}) + BPJS KES ({formatCurrency(numBpjsKes)}) + Tunjangan ({formatCurrency(numAllowance)}) - Absensi ({formatCurrency(numAbsence)}) - Potongan ({formatCurrency(numCustomDeductions)})
                      </span>
                      <span className="text-[10px] text-emerald-600 block mt-0.5">
                        * Sesuai format slip 2026: BPJS Ketenagakerjaan dicairkan terpisah dan tidak memotong gaji diterima.
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[22px] font-bold font-mono text-emerald-800">
                        {formatCurrency(takeHomePay)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Bottom Action Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-row">
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

      {/* Modal Kelola Target SP & Periode Custom (Poin 17) */}
      <PayrollPeriodsModal
        isOpen={isPeriodsModalOpen}
        onClose={() => setIsPeriodsModalOpen(false)}
        onPeriodChanged={(newList) => {
          setAvailablePeriods(newList);
        }}
        company={company}
      />
    </div>
  );
};
