import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { userService } from '../services/userService';
import { User, UserRole } from '../../../types/auth';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { Pagination } from '../../../components/shared/Pagination';
import { PayrollPaginationMeta } from '../../../types/payroll';
import { useTenantTheme } from '../../../lib/theme';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Filter,
} from 'lucide-react';

export const UserListPage: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const { tenant } = useTenantTheme();

  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [meta, setMeta] = useState<PayrollPaginationMeta>({
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
    from: 0,
    to: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('viewer');
  const [formCompany, setFormCompany] = useState<'rbs' | 'rimamandiri'>('rbs');
  const [formNik, setFormNik] = useState('');
  const [formSchoolUnit, setFormSchoolUnit] = useState('');
  const [formMaritalStatus, setFormMaritalStatus] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [modalGeneralError, setModalGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await userService.getUsers({
        search: search.trim() || undefined,
        role: roleFilter || undefined,
        page,
        per_page: perPage,
      });
      setUsers(response.data);
      if (response.meta) {
        setMeta({
          current_page: response.meta.current_page,
          last_page: response.meta.last_page,
          per_page: response.meta.per_page,
          total: response.meta.total,
          from: response.meta.from ?? (response.meta.current_page - 1) * response.meta.per_page + 1,
          to: response.meta.to ?? Math.min(response.meta.current_page * response.meta.per_page, response.meta.total),
        });
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, roleFilter, page, perPage]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('admin');
    setFormCompany(tenant.id);
    setFormNik('');
    setFormSchoolUnit('');
    setFormMaritalStatus('');
    setFormErrors({});
    setModalGeneralError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword('');
    setFormRole(user.role);
    setFormCompany((user.company as any) || 'rbs');
    setFormNik(user.nik || '');
    setFormSchoolUnit(user.school_unit || '');
    setFormMaritalStatus(user.marital_status || '');
    setFormErrors({});
    setModalGeneralError(null);
    setModalOpen(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setModalGeneralError(null);
    setIsSubmitting(true);

    const payload = {
      name: formName.trim(),
      email: formEmail.trim(),
      role: formRole,
      company: formRole === 'super_admin' ? null : (formRole === 'lord_admin' ? (formCompany || 'rbs') : formCompany),
      nik: formNik.trim() || null,
      school_unit: formSchoolUnit.trim() || null,
      marital_status: formMaritalStatus || null,
      ...(formPassword.trim() ? { password: formPassword.trim() } : {}),
    };

    try {
      if (editingUser) {
        await userService.updateUser(editingUser.id, payload);
      } else {
        await userService.createUser({
          ...payload,
          password: formPassword.trim(),
        });
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        const fieldErrors: Record<string, string> = {};
        Object.entries(err.response.data.errors).forEach(([field, msgs]: [string, any]) => {
          fieldErrors[field] = Array.isArray(msgs) ? msgs[0] : String(msgs);
        });
        setFormErrors(fieldErrors);
        if (err.response?.data?.message) {
          setModalGeneralError(err.response.data.message);
        }
      } else {
        const rawMsg = err.response?.data?.message || err.message || '';
        let friendlyMsg = 'Gagal menyimpan data pengguna. Silakan periksa kembali isian formulir.';
        if (rawMsg.includes('1062') || rawMsg.includes('Duplicate entry') || rawMsg.includes('SQLSTATE')) {
          if (rawMsg.includes('users.nik') || rawMsg.includes('users_nik_unique')) {
            friendlyMsg = 'NIK ini sudah terdaftar pada pengguna/karyawan lain di sistem. Harap gunakan NIK yang unik.';
            setFormErrors((prev) => ({ ...prev, nik: friendlyMsg }));
          } else if (rawMsg.includes('users.email') || rawMsg.includes('users_email_unique')) {
            friendlyMsg = 'Email ini sudah terdaftar pada pengguna lain di sistem. Harap gunakan email lain.';
            setFormErrors((prev) => ({ ...prev, email: friendlyMsg }));
          } else {
            friendlyMsg = 'Data NIK atau Email yang Anda masukkan sudah terdaftar pada pengguna lain di sistem.';
          }
        } else if (rawMsg) {
          friendlyMsg = rawMsg;
        }
        setModalGeneralError(friendlyMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await userService.deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      const rawMsg = err.response?.data?.message || err.message || '';
      const cleanMsg = rawMsg.includes('SQLSTATE')
        ? 'Gagal menghapus pengguna karena akun ini masih terhubung dengan data riwayat presensi atau penggajian.'
        : (rawMsg || 'Gagal menghapus pengguna.');
      alert(cleanMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-headline-page text-headline-page text-text-primary tracking-tight">
              Manajemen Pengguna & Hak Akses
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Total {meta.total} Pengguna
            </span>
          </div>
          <p className="font-body-default text-body-default text-text-muted mt-1">
            Kelola akun internal, pembagian role (Admin, Karyawan, User), dan kredensial login.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenCreate}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Tambah Pengguna Baru
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-surface-panel rounded-xl border border-border-subtle p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama, NIK, atau email pengguna..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 pl-9 pr-4 bg-surface-panel rounded-lg text-body-default text-text-primary placeholder:text-text-muted border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px]"
            />
          </div>

          <div className="sm:col-span-4 relative">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 bg-surface-panel rounded-lg text-body-default text-text-primary border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px] cursor-pointer"
            >
              <option value="">Semua Peran (Role)</option>
              <option value="lord_admin">👑 Lord Admin (Owner)</option>
              <option value="super_admin">⭐ Super Admin</option>
              <option value="admin">🛡️ Admin Perusahaan</option>
              <option value="user">👤 User (View & Search)</option>
              <option value="karyawan">📱 Karyawan (Portal)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface-panel rounded-xl border border-border-subtle shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-border-subtle text-[12px] font-semibold text-text-muted uppercase tracking-wider">
                <th className="py-3.5 px-4 text-center w-12">No</th>
                <th className="py-3.5 px-4 min-w-[200px]">Nama Pengguna</th>
                <th className="py-3.5 px-4 min-w-[200px]">Email</th>
                <th className="py-3.5 px-4 text-center min-w-[120px]">Peran (Role)</th>
                <th className="py-3.5 px-4 text-center min-w-[150px]">Terdaftar Sejak</th>
                <th className="py-3.5 px-4 text-center min-w-[100px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-row text-body-default text-[13px]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span>Memuat daftar pengguna...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-slate-300" />
                      <span className="font-medium text-text-primary">
                        Tidak ada pengguna yang cocok dengan pencarian.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((item, index) => {
                  const rowNumber = (meta.current_page - 1) * meta.per_page + index + 1;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 text-center text-text-muted font-mono text-[12px]">
                        {rowNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-text-primary">{item.name}</div>
                        {item.school_unit && (
                          <div className="text-[11px] text-emerald-800 font-medium flex items-center gap-1 mt-0.5">
                            <span>🏫 {item.school_unit}</span>
                          </div>
                        )}
                        {currentUser?.id === item.id && (
                          <span className="text-[10px] text-primary font-medium">
                            (Akun Anda Saat Ini)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="font-mono text-[12px]">{item.email}</div>
                        {item.nik && (
                          <div className="text-[11px] text-text-muted mt-0.5">
                            NIK: <span className="font-mono font-medium text-slate-700">{item.nik}</span>
                          </div>
                        )}
                        {item.marital_status && (
                          <div className="text-[10.5px] text-indigo-700 font-medium mt-0.5 inline-flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                            <span>💍 {item.marital_status}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge
                          variant={
                            item.role === 'lord_admin'
                              ? 'lord_admin'
                              : item.role === 'super_admin'
                              ? 'super_admin'
                              : item.role === 'admin'
                              ? 'admin'
                              : item.role === 'karyawan'
                              ? 'karyawan'
                              : 'viewer'
                          }
                        >
                          {item.role === 'lord_admin'
                            ? '👑 Lord Admin'
                            : item.role === 'super_admin'
                            ? '⭐ Super Admin'
                            : item.role === 'admin'
                            ? `Admin (${item.company?.toUpperCase() || 'RBS'})`
                            : item.role === 'karyawan'
                            ? 'Karyawan (Portal)'
                            : 'User (View & Search)'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-center text-text-muted text-[12px]">
                        {item.created_at
                          ? new Date(item.created_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Akun Lord Admin hanya boleh diedit oleh sesama Lord Admin */}
                          {currentUser?.role === 'lord_admin' || item.role !== 'lord_admin' ? (
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 rounded text-text-muted hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Ubah Pengguna"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="p-1.5 text-text-muted/40" title="Akun Lord Admin Terkunci (Hanya Owner)">
                              🔒
                            </span>
                          )}

                          {currentUser?.id !== item.id && (currentUser?.role === 'lord_admin' || item.role !== 'lord_admin') && (
                            <button
                              onClick={() => setDeleteTarget(item)}
                              className="p-1.5 rounded text-text-muted hover:text-status-danger-text hover:bg-red-50 transition-colors cursor-pointer"
                              title="Hapus Pengguna"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <Pagination
          meta={meta}
          onPageChange={(p) => setPage(p)}
          perPage={perPage}
          onPerPageChange={(newPerPage) => {
            setPerPage(newPerPage);
            setPage(1);
          }}
          isLoading={isLoading}
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? 'Ubah Data Pengguna' : 'Tambah Pengguna Baru'}
        description={`Kelola akses staf dan akun pengguna untuk ${tenant.companyLegalName}.`}
      >
        <form onSubmit={handleModalSubmit} className="space-y-4">
          {modalGeneralError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2.5 animate-fadeIn">
              <span className="text-base leading-none mt-0.5">⚠️</span>
              <div className="flex-1">
                <p className="font-semibold text-red-800">Perhatian</p>
                <p className="mt-0.5 leading-relaxed">{modalGeneralError}</p>
              </div>
            </div>
          )}

          <Input
            label="Nama Lengkap"
            placeholder="Contoh: Siti Aisyah"
            required
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            error={formErrors.name}
          />

          <Input
            label="Email Pengguna"
            type="email"
            placeholder="nama@perusahaan.co.id"
            required
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            error={formErrors.email}
          />

          <Input
            label={editingUser ? 'Kata Sandi Baru (Kosongkan jika tidak diubah)' : 'Kata Sandi'}
            type="password"
            placeholder="Minimal 6 karakter"
            required={!editingUser}
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
            error={formErrors.password}
          />

          <Select
            label="Hak Akses / Peran (Role)"
            required
            value={formRole}
            onChange={(e) => setFormRole(e.target.value as UserRole)}
            options={[
              ...(currentUser?.role === 'lord_admin' ? [{ label: '👑 Lord Admin (Owner / Dewa Admin - Hak Akses Tertinggi)', value: 'lord_admin' }] : []),
              { label: '⭐ Super Admin (Akses Kedua Dashboard & Melihat Audit Log)', value: 'super_admin' },
              { label: '🛡️ Admin Perusahaan (Akses Penuh Kelola Data Gaji & Absensi)', value: 'admin' },
              { label: '👤 User (Hanya View & Search Data Penggajian)', value: 'user' },
              { label: '📱 Karyawan (Portal Mandiri: Slip Gaji, Laporan, Profil)', value: 'karyawan' },
            ]}
            error={formErrors.role}
          />

          {formRole !== 'super_admin' && formRole !== 'lord_admin' && (
            <Select
              label="Entitas Perusahaan"
              required
              value={formCompany}
              onChange={(e) => setFormCompany(e.target.value as 'rbs' | 'rimamandiri')}
              options={[
                { label: 'PT Rimbun Buana Sejahtera (RBS)', value: 'rbs' },
                { label: 'PT Riama Mandiri Pratama (RIMA)', value: 'rimamandiri' },
              ]}
              error={formErrors.company}
            />
          )}

          {formRole === 'karyawan' && (
            <div className="space-y-3 bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="NIK Karyawan"
                  placeholder="Contoh: 320123456789"
                  value={formNik}
                  onChange={(e) => setFormNik(e.target.value)}
                  error={formErrors.nik}
                  helperText="Digunakan sebagai ID login cepat & sandi default"
                />
                <Input
                  label="Unit Sekolah / Lokasi"
                  placeholder="Contoh: SD IT Rabbani"
                  value={formSchoolUnit}
                  onChange={(e) => setFormSchoolUnit(e.target.value)}
                  error={formErrors.school_unit}
                  helperText="Terisi otomatis saat import/input gaji"
                />
              </div>

              <div>
                <Select
                  label="Status Perkawinan"
                  value={formMaritalStatus}
                  onChange={(e) => setFormMaritalStatus(e.target.value)}
                  options={[
                    { label: '-- Pilih Status Perkawinan --', value: '' },
                    { label: 'Kawin', value: 'Kawin' },
                    { label: 'Belum Kawin', value: 'Belum Kawin' },
                    { label: 'Nikah Anak 1', value: 'Nikah Anak 1' },
                    { label: 'Nikah Anak 2', value: 'Nikah Anak 2' },
                    { label: 'Nikah Anak 3', value: 'Nikah Anak 3' },
                    { label: 'Duda Anak 1', value: 'Duda Anak 1' },
                    { label: 'Duda Anak 2', value: 'Duda Anak 2' },
                    { label: 'Duda Anak 3', value: 'Duda Anak 3' },
                    { label: 'Tidak Kawin', value: 'Tidak Kawin' },
                  ]}
                  error={formErrors.marital_status}
                />
                <p className="text-[11px] text-text-muted mt-1">
                  Data internal admin / HRD (tidak ditampilkan ke akun karyawan & slip gaji)
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-row">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              {editingUser ? 'Simpan Perubahan' : 'Buat Pengguna'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete User Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Konfirmasi Hapus Pengguna"
        message={`Apakah Anda yakin ingin menghapus akun pengguna "${deleteTarget?.name}" (${deleteTarget?.email})? Pengguna ini tidak akan dapat login lagi ke sistem.`}
        confirmLabel="Ya, Hapus Pengguna"
        isLoading={isDeleting}
      />
    </div>
  );
};
