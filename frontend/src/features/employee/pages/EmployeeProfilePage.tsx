import React, { useEffect, useState } from 'react';
import { employeeService, EmployeeProfileData } from '../services/employeeService';
import { useAuthStore } from '../../../store/authStore';
import { Card } from '../../../components/ui/Card';
import {
  User,
  ShieldCheck,
  Building2,
  Phone,
  CreditCard,
  MapPin,
  Lock,
  Save,
  CheckCircle2,
} from 'lucide-react';

export const EmployeeProfilePage: React.FC = () => {
  const { setUser } = useAuthStore();
  const [profileData, setProfileData] = useState<EmployeeProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [phone, setPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [address, setAddress] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const data = await employeeService.getProfile();
      setProfileData(data);
      setPhone(data.user.phone || '');
      setBankName(data.user.bank_name || '');
      setBankAccount(data.user.bank_account || '');
      setAddress(data.user.address || '');
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);

    try {
      const updatedUser = await employeeService.updateProfile({
        phone: phone.trim(),
        bank_name: bankName.trim(),
        bank_account: bankAccount.trim(),
        address: address.trim(),
        ...(newPassword.trim() ? { current_password: currentPassword, new_password: newPassword } : {}),
      });

      setUser(updatedUser);
      setSuccessMessage('Data profil Anda berhasil disimpan.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyimpan perubahan profil.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-44 bg-surface-container rounded-xl w-full" />
        <div className="h-60 bg-surface-container rounded-xl w-full" />
      </div>
    );
  }

  const u = profileData?.user;
  const job = profileData?.job_details;

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-border-subtle">
        <h1 className="font-headline-page text-[22px] sm:text-[24px] font-bold text-text-primary tracking-tight">
          Profil & Data Karyawan
        </h1>
        <p className="font-body-default text-[13px] text-text-muted mt-1">
          Perbarui informasi kontak, rekening penerimaan gaji, dan keamanan akun Anda
        </p>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Desktop 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Read-Only Employment Information Box (1/3) */}
        <Card className="p-5 sm:p-6 border-border-subtle bg-surface-panel shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-[14px] text-text-primary">
              Data Resmi HRD
            </h3>
            <span className="text-[10.5px] text-text-muted ml-auto">Terkunci</span>
          </div>

          <div className="space-y-3 text-[12.5px]">
            <div className="p-3 bg-surface rounded-lg border border-border-subtle">
              <span className="text-text-muted text-[11px] block">Nama Lengkap</span>
              <span className="font-semibold text-text-primary">{u?.name}</span>
            </div>

            <div className="p-3 bg-surface rounded-lg border border-border-subtle">
              <span className="text-text-muted text-[11px] block">Nomor Induk Karyawan (NIK)</span>
              <span className="font-mono font-semibold text-text-primary">{u?.nik || '-'}</span>
            </div>

            <div className="p-3 bg-surface rounded-lg border border-border-subtle">
              <span className="text-text-muted text-[11px] block">Jabatan / Posisi</span>
              <span className="font-semibold text-text-primary">{job?.position || 'Staf Lapangan'}</span>
            </div>

            <div className="p-3 bg-surface rounded-lg border border-border-subtle">
              <span className="text-text-muted text-[11px] block">Unit Penempatan / Wilayah</span>
              <span className="font-semibold text-text-primary">{job?.school_unit || job?.province || '-'}</span>
            </div>

            <div className="p-3 bg-surface rounded-lg border border-border-subtle">
              <span className="text-text-muted text-[11px] block">Status Kerja</span>
              <span
                className={`font-semibold ${
                  job?.status === 'off' ? 'text-status-danger-text' : 'text-emerald-700'
                }`}
              >
                {job?.status === 'off' ? 'Non-Aktif / Off' : 'Aktif'}
              </span>
            </div>
          </div>
        </Card>

        {/* Right Column: Editable Personal Form (2/3) */}
        <div className="lg:col-span-2">
          <Card className="p-5 sm:p-6 border-border-subtle bg-surface-panel shadow-xs">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
                <User className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-[14px] text-text-primary">
                  Data Pribadi & Informasi Rekening
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-text-primary mb-1">
                    Nomor WhatsApp / HP Aktif
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Contoh: 081234567890"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 rounded-lg border border-border-subtle bg-surface text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-text-primary mb-1">
                    Nama Bank Pencairan
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Contoh: BCA / BRI / Mandiri / BSI"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 rounded-lg border border-border-subtle bg-surface text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-text-primary mb-1">
                    Nomor Rekening Bank
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 1234567890"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-lg border border-border-subtle bg-surface text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-text-primary mb-1">
                    Alamat Domisili Tempat Tinggal
                  </label>
                  <input
                    type="text"
                    placeholder="Kota / Alamat tempat tinggal saat ini"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-lg border border-border-subtle bg-surface text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Change Password Section */}
              <div className="pt-3 border-t border-border-subtle space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-text-muted" />
                  <h4 className="font-semibold text-[13px] text-text-primary">
                    Ganti Kata Sandi (Kosongkan jika tidak ingin mengubah)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-text-primary mb-1">
                      Kata Sandi Saat Ini
                    </label>
                    <input
                      type="password"
                      placeholder="Masukkan kata sandi lama"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-lg border border-border-subtle bg-surface text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-text-primary mb-1">
                      Kata Sandi Baru
                    </label>
                    <input
                      type="password"
                      placeholder="Minimal 6 karakter"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-lg border border-border-subtle bg-surface text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[13px] font-semibold flex items-center gap-2 transition-all shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};
