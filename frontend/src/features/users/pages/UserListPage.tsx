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
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
} from 'lucide-react';

export const UserListPage: React.FC = () => {
  const { user: currentUser } = useAuthStore();

  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('viewer');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await userService.getUsers({ search: search.trim() });
      setUsers(response.data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('user');
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword('');
    setFormRole(user.role);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setIsSubmitting(true);

    const payload = {
      name: formName.trim(),
      email: formEmail.trim(),
      role: formRole,
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
      } else {
        alert(err.response?.data?.message || 'Gagal menyimpan data pengguna.');
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
      alert(err.response?.data?.message || 'Gagal menghapus pengguna.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-page text-headline-page text-text-primary tracking-tight">
            Manajemen Pengguna & Hak Akses
          </h1>
          <p className="font-body-default text-body-default text-text-muted mt-1">
            Kelola akun internal, pembagian role (Admin vs Viewer), dan kredensial login.
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

      {/* Search Bar */}
      <div className="bg-surface-panel rounded-xl border border-border-subtle p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama atau email pengguna..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 bg-surface-panel rounded-lg text-body-default text-text-primary placeholder:text-text-muted border border-border-subtle outline-none focus:ring-2 focus:ring-primary text-[13px]"
          />
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
                users.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 text-center text-text-muted font-mono text-[12px]">
                      {index + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-text-primary">{item.name}</div>
                      {currentUser?.id === item.id && (
                        <span className="text-[10px] text-primary font-medium">
                          (Akun Anda Saat Ini)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{item.email}</td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge
                        variant={
                          item.role === 'admin'
                            ? 'admin'
                            : item.role === 'karyawan'
                            ? 'karyawan'
                            : 'viewer'
                        }
                      >
                        {item.role === 'admin'
                          ? 'Admin (Full Akses)'
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
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded text-text-muted hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Ubah Pengguna"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {currentUser?.id !== item.id && (
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="p-1.5 rounded text-text-muted hover:text-status-danger-text hover:bg-red-50 transition-colors"
                            title="Hapus Pengguna"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? 'Ubah Data Pengguna' : 'Tambah Pengguna Baru'}
        description="Kelola akses staf ke sistem HRD Mandiri."
      >
        <form onSubmit={handleModalSubmit} className="space-y-4">
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
              { label: 'Admin (Full Akses: Tambah, Ubah, Hapus, Import)', value: 'admin' },
              { label: 'User (Hanya View & Search Data Penggajian)', value: 'user' },
              { label: 'Karyawan (Portal Mandiri: Slip Gaji, Laporan, Profil)', value: 'karyawan' },
            ]}
            error={formErrors.role}
          />

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
