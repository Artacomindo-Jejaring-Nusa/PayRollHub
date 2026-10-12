import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { payrollPeriodService } from '../services/payrollPeriodService';
import { PayrollPeriodItem } from '../../../types/payroll';
import {
  Layers,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Building2,
  Shield,
  HelpCircle,
} from 'lucide-react';

interface PayrollPeriodsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPeriodChanged?: (periods: PayrollPeriodItem[]) => void;
  onPeriodUpdated?: () => void;
  company?: string;
}

export const PayrollPeriodsModal: React.FC<PayrollPeriodsModalProps> = ({
  isOpen,
  onClose,
  onPeriodChanged,
  onPeriodUpdated,
  company,
}) => {
  const [periods, setPeriods] = useState<PayrollPeriodItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Form Tambah
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [targetCompany, setTargetCompany] = useState<string>(company || 'all');
  const [isSp, setIsSp] = useState<boolean>(false);
  const [isVisibleToUser, setIsVisibleToUser] = useState<boolean>(false);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fetchPeriods = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await payrollPeriodService.getPeriods({ company: targetCompany });
      setPeriods(data);
      if (onPeriodChanged) {
        onPeriodChanged(data);
      }
    } catch (err) {
      console.error('Failed to fetch periods', err);
    } finally {
      setIsLoading(false);
    }
  }, [targetCompany, onPeriodChanged]);

  useEffect(() => {
    if (isOpen) {
      fetchPeriods();
      setFormError(null);
      setFormSuccess(null);
    }
  }, [isOpen, fetchPeriods]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!code.trim() || !name.trim()) {
      setFormError('Kode dan Nama Periode wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await payrollPeriodService.createPeriod({
        code: code.trim(),
        name: name.trim(),
        company: targetCompany,
        is_sp: isSp,
        is_visible_to_user: isVisibleToUser,
        description: description.trim() || undefined,
      });

      setFormSuccess(`Target Periode "${code.trim()}" berhasil ditambahkan!`);
      setCode('');
      setName('');
      setDescription('');
      setIsSp(false);
      setIsVisibleToUser(false);
      await fetchPeriods();
      if (onPeriodUpdated) onPeriodUpdated();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Gagal menambahkan periode baru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleVisibility = async (item: PayrollPeriodItem) => {
    if (!item.id) return;
    setActionLoadingId(item.id);
    try {
      const updatedVisibility = !item.is_visible_to_user;
      await payrollPeriodService.updatePeriod(item.id, {
        is_visible_to_user: updatedVisibility,
        sync_payrolls: true,
      });
      await fetchPeriods();
      if (onPeriodUpdated) onPeriodUpdated();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal memperbarui visibilitas periode.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (item: PayrollPeriodItem) => {
    if (!item.id) return;
    const isStandard = /^SP\s*\d+$/i.test(item.code);
    if (isStandard) {
      alert('Periode standar SP 1 s/d SP 12 tidak dapat dihapus.');
      return;
    }

    if (!window.confirm(`Apakah Anda yakin ingin menghapus periode "${item.code}"?`)) {
      return;
    }

    setActionLoadingId(item.id);
    try {
      await payrollPeriodService.deletePeriod(item.id, true);
      await fetchPeriods();
      if (onPeriodUpdated) onPeriodUpdated();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menghapus periode.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Kelola Target Surat Pesanan (SP) & Periode"
      description="Poin 17: Admin dapat menambah Target SP / Periode kustom (contoh: Ambon, Cikarang) dan mengatur apakah tampil di User View atau khusus Admin."
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* Form Tambah Target SP / Periode */}
        <form
          onSubmit={handleCreate}
          className="p-4 rounded-xl border border-border-subtle bg-surface-container-low space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-text flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              <span>Tambah Target SP / Periode Kustom</span>
            </h4>
            <span className="text-[11px] text-text-muted">
              Cocok untuk karyawan luar SP (Ambon, Cikarang, dll)
            </span>
          </div>

          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Kode Periode *
              </label>
              <Input
                placeholder="Contoh: Ambon, Cikarang, SP 13"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  // Auto-detect jika kode berformat SP
                  const looksLikeSp = /^SP\s*\d+$/i.test(e.target.value);
                  setIsSp(looksLikeSp);
                  if (!looksLikeSp) {
                    setIsVisibleToUser(false);
                  }
                }}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Nama Label / Keterangan *
              </label>
              <Input
                placeholder="Contoh: Wilayah Ambon, Karyawan Cikarang"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Perusahaan
              </label>
              <Select
                value={targetCompany}
                onChange={(e) => setTargetCompany(e.target.value)}
                options={[
                  { label: 'Semua Perusahaan (Global)', value: 'all' },
                  { label: 'PT. Rimbun Buana Sejahtera (RBS)', value: 'rbs' },
                  { label: 'PT. Riama Mandiri Pratama', value: 'rimamandiri' },
                ]}
              />
            </div>
          </div>

          {/* Opsi Tipe & Visibilitas User View */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border-row">
            {/* Tipe: SP vs Luar SP */}
            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">
                Kategori Periode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsSp(true)}
                  className={`py-1.5 px-3 rounded-lg border text-xs font-medium transition-all ${
                    isSp
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold'
                      : 'bg-white border-border-subtle text-text-muted hover:bg-slate-50'
                  }`}
                >
                  📜 Surat Pesanan (SP)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSp(false);
                    setIsVisibleToUser(false);
                  }}
                  className={`py-1.5 px-3 rounded-lg border text-xs font-medium transition-all ${
                    !isSp
                      ? 'bg-purple-50 border-purple-500 text-purple-700 font-semibold'
                      : 'bg-white border-border-subtle text-text-muted hover:bg-slate-50'
                  }`}
                >
                  📍 Di Luar SP (Kustom)
                </button>
              </div>
            </div>

            {/* Visibilitas User View (Karyawan) */}
            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">
                Visibilitas Portal Karyawan (User View)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsVisibleToUser(true)}
                  className={`py-1.5 px-2.5 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    isVisibleToUser
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-semibold shadow-2xs'
                      : 'bg-white border-border-subtle text-text-muted hover:bg-slate-50'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Tampil di User</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsVisibleToUser(false)}
                  className={`py-1.5 px-2.5 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    !isVisibleToUser
                      ? 'bg-amber-50 border-amber-500 text-amber-800 font-semibold shadow-2xs'
                      : 'bg-white border-border-subtle text-text-muted hover:bg-slate-50'
                  }`}
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Khusus Admin (Hidden)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-text-muted">
              {isVisibleToUser ? (
                <span className="text-emerald-700 font-medium">
                  ✓ Karyawan pada periode ini DAPAT melihat slip gaji di portal karyawan.
                </span>
              ) : (
                <span className="text-amber-800 font-medium">
                  🔒 Data periode ini TIDAK AKAN TAMPIL di User View (hanya Admin yang dapat melihat).
                </span>
              )}
            </p>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Simpan Target Periode
            </Button>
          </div>
        </form>

        {/* Tabel Daftar Semua Periode */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-text flex items-center gap-2">
              <Layers className="w-4 h-4 text-text-muted" />
              <span>Daftar Seluruh Target SP & Periode ({periods.length})</span>
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={fetchPeriods}
              disabled={isLoading}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Muat Ulang
            </Button>
          </div>

          <div className="border border-border-subtle rounded-xl overflow-hidden bg-white max-h-[380px] overflow-y-auto">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-text-muted text-xs gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span>Memuat data periode...</span>
              </div>
            ) : periods.length === 0 ? (
              <div className="py-8 text-center text-xs text-text-muted">
                Belum ada target periode yang tersimpan.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-border-subtle text-text-muted font-semibold">
                    <th className="py-2.5 px-3">Kode & Label</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">Total Karyawan</th>
                    <th className="py-2.5 px-3">Visibilitas Karyawan</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-row">
                  {periods.map((item) => {
                    const isStandard = /^SP\s*(1[0-2]|[1-9])$/i.test(item.code);
                    const isActing = actionLoadingId === item.id;

                    return (
                      <tr key={item.id || item.code} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-text">{item.code}</div>
                          <div className="text-[11px] text-text-muted">{item.name}</div>
                        </td>

                        <td className="py-2.5 px-3">
                          {item.is_sp ? (
                            <span className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Surat Pesanan (SP)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              Luar SP (Kustom)
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-semibold text-text">
                          {item.employee_count !== undefined ? (
                            <span>{item.employee_count} orang</span>
                          ) : (
                            <span className="text-text-muted">-</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(item)}
                            disabled={isActing}
                            title="Klik untuk mengubah visibilitas di portal karyawan"
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                              item.is_visible_to_user
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                            }`}
                          >
                            {isActing ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : item.is_visible_to_user ? (
                              <>
                                <Eye className="w-3 h-3 text-emerald-600" />
                                <span>Tampil di User View</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3 text-amber-700" />
                                <span>Khusus Admin (Hidden)</span>
                              </>
                            )}
                          </button>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          {isStandard ? (
                            <span className="text-[10px] text-slate-400 font-medium italic">
                              Master Resmi
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              disabled={isActing}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Hapus periode kustom ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-border-row">
          <Button variant="outline" type="button" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  );
};
