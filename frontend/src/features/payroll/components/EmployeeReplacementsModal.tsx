import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { EmployeeReplacement, OffEmployeeItem, PayrollItem } from '../../../types/payroll';
import { payrollService } from '../services/payrollService';
import {
  Users,
  UserCheck,
  UserX,
  Search,
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowRight,
  FileText,
} from 'lucide-react';

interface EmployeeReplacementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplacementRecorded?: () => void;
  company?: string;
  payrolls?: PayrollItem[];
}

export const EmployeeReplacementsModal: React.FC<EmployeeReplacementsModalProps> = ({
  isOpen,
  onClose,
  onReplacementRecorded,
  company,
  payrolls = [],
}) => {
  const [replacements, setReplacements] = useState<EmployeeReplacement[]>([]);
  const [offEmployees, setOffEmployees] = useState<OffEmployeeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form state
  const [selectedNewPayrollId, setSelectedNewPayrollId] = useState<number | string>('');
  const [selectedOldPayrollId, setSelectedOldPayrollId] = useState<number | string>('');
  const [manualOldEmployeeName, setManualOldEmployeeName] = useState('');
  const [replacementDate, setReplacementDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [reason, setReason] = useState('Menggantikan karyawan yang keluar / off');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchReplacements = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await payrollService.getEmployeeReplacements({
        search: search.trim() || undefined,
        company,
      });
      setReplacements(res.data);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Gagal memuat riwayat pergantian.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOffList = async () => {
    try {
      const data = await payrollService.getOffEmployees(undefined, company);
      setOffEmployees(data);
    } catch (err) {
      console.error('Failed to load off employees:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReplacements();
      fetchOffList();
      setIsAddingNew(false);
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen, company]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReplacements();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNewPayrollId) {
      setErrorMessage('Pilih karyawan baru yang masuk menggantikan.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const selectedOff = offEmployees.find((o) => o.id === Number(selectedOldPayrollId));
      const oldName = selectedOff ? selectedOff.employee_name : manualOldEmployeeName.trim();

      await payrollService.createEmployeeReplacement({
        new_payroll_id: Number(selectedNewPayrollId),
        old_payroll_id: selectedOff ? selectedOff.id : null,
        old_employee_name: oldName || 'Karyawan Sebelumnya',
        replacement_date: replacementDate,
        reason: reason.trim(),
        notes: notes.trim(),
      });

      setSuccessMessage('Rekam jejak pergantian karyawan berhasil dicatat!');
      setIsAddingNew(false);
      setSelectedNewPayrollId('');
      setSelectedOldPayrollId('');
      setManualOldEmployeeName('');
      setNotes('');
      await fetchReplacements();
      if (onReplacementRecorded) {
        onReplacementRecorded();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Gagal mencatat pergantian karyawan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan riwayat pergantian ini?')) return;

    setDeletingId(id);
    setErrorMessage(null);
    try {
      await payrollService.deleteEmployeeReplacement(id);
      setSuccessMessage('Catatan pergantian berhasil dihapus.');
      await fetchReplacements();
      if (onReplacementRecorded) {
        onReplacementRecorded();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Gagal menghapus catatan.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rekam Jejak Pergantian Karyawan"
      maxWidth="2xl"
    >
      <div className="space-y-4 py-1">
        {/* Banner */}
        <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-900 text-[12.5px] leading-relaxed flex items-start gap-2.5">
          <Users className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong>Pencatatan Rotasi & Pergantian Karyawan:</strong> Mencatat riwayat ketika karyawan baru masuk untuk menggantikan posisi karyawan yang telah nonaktif (off/keluar). Data pergantian akan otomatis tertaut dan muncul di slip gaji serta daftar karyawan.
          </div>
        </div>

        {/* Alerts */}
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[12px] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {successMessage}
            </span>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[12px] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              {errorMessage}
            </span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-700 hover:text-rose-900 font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Action Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama karyawan baru/lama, NIK, unit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-surface rounded-lg text-text-primary text-[12.5px] border border-border-subtle outline-none focus:ring-2 focus:ring-primary"
            />
          </form>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReplacements}
              disabled={isLoading}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>

            <Button
              variant={isAddingNew ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => {
                setIsAddingNew(!isAddingNew);
                setSuccessMessage(null);
                setErrorMessage(null);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {isAddingNew ? 'Tutup Form' : 'Catat Pergantian Baru'}
            </Button>
          </div>
        </div>

        {/* Add Form */}
        {isAddingNew && (
          <form onSubmit={handleCreateSubmit} className="bg-surface-page p-5 rounded-xl border border-border-subtle space-y-4">
            <div className="pb-2 border-b border-border-row">
              <h4 className="font-bold text-text-primary text-[14.5px] flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Form Pencatatan Pergantian Karyawan
              </h4>
              <p className="text-[12px] text-text-muted mt-0.5">
                Pilih karyawan baru dan tentukan siapa karyawan sebelumnya yang digantikan.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Karyawan Baru */}
              <div>
                <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                  Karyawan Baru (Pengganti) <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedNewPayrollId}
                  onChange={(e) => setSelectedNewPayrollId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border-subtle bg-surface text-text-primary text-[12.5px] outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">-- Pilih Karyawan Baru --</option>
                  {payrolls
                    .filter((p) => p.status !== 'off')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.employee_name} ({p.position || '-'}) - {p.school_unit || p.province}
                      </option>
                    ))}
                </select>
                <span className="text-[11px] text-text-muted mt-1 block">
                  Karyawan aktif yang mulai bekerja menggantikan.
                </span>
              </div>

              {/* Karyawan Lama (Off) */}
              <div>
                <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                  Karyawan Yang Digantikan (Off/Keluar)
                </label>
                <select
                  value={selectedOldPayrollId}
                  onChange={(e) => {
                    setSelectedOldPayrollId(e.target.value);
                    if (e.target.value) {
                      setManualOldEmployeeName('');
                    }
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-border-subtle bg-surface text-text-primary text-[12.5px] outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Pilih dari Karyawan Off ({offEmployees.length}) --</option>
                  {offEmployees.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.employee_name} ({o.position || '-'}) - {o.school_unit || '-'} {o.resign_date ? `[Out: ${o.resign_date}]` : ''}
                    </option>
                  ))}
                </select>

                {!selectedOldPayrollId && (
                  <input
                    type="text"
                    placeholder="Atau ketik nama karyawan lama secara manual..."
                    value={manualOldEmployeeName}
                    onChange={(e) => setManualOldEmployeeName(e.target.value)}
                    className="w-full h-9 px-3 mt-1.5 rounded-lg border border-border-subtle bg-surface text-text-primary text-[12px] outline-none focus:ring-2 focus:ring-primary placeholder:text-text-muted"
                  />
                )}
              </div>

              {/* Tanggal Pergantian */}
              <div>
                <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                  Tanggal Efektif Pergantian <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={replacementDate}
                  onChange={(e) => setReplacementDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border-subtle bg-surface text-text-primary text-[13px] outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {/* Alasan */}
              <div>
                <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                  Alasan Pergantian
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Mengundurkan diri / Habis kontrak..."
                  className="w-full h-10 px-3 rounded-lg border border-border-subtle bg-surface text-text-primary text-[12.5px] outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Catatan */}
            <div>
              <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                Catatan Tambahan (Opsional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tuliskan catatan serah terima, unit sekolah, atau instruksi khusus..."
                className="w-full h-16 p-2.5 rounded-lg border border-border-subtle bg-surface text-[12.5px] outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddingNew(false)}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Simpan Catatan Pergantian
              </Button>
            </div>
          </form>
        )}

        {/* History List Table */}
        <div className="border border-border-subtle rounded-xl overflow-hidden max-h-[380px] overflow-y-auto shadow-2xs">
          <table className="w-full text-left border-collapse text-[12.5px]">
            <thead className="bg-surface-container-low sticky top-0 border-b border-border-subtle font-semibold text-text-muted uppercase text-[11px] tracking-wider z-10">
              <tr>
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Karyawan Baru</th>
                <th className="py-2.5 px-3">Menggantikan</th>
                <th className="py-2.5 px-3">Unit / Jabatan</th>
                <th className="py-2.5 px-3">Alasan / Catatan</th>
                <th className="py-2.5 px-3 text-center w-14">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-row">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    <span>Memuat riwayat pergantian karyawan...</span>
                  </td>
                </tr>
              ) : replacements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <FileText className="w-7 h-7 text-slate-300" />
                      <span className="font-medium text-text-primary">
                        Belum ada rekam jejak pergantian karyawan.
                      </span>
                      <span className="text-[12px]">
                        Klik tombol "Catat Pergantian Baru" di atas untuk menambahkan catatan pergantian.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                replacements.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[11.5px] text-text-muted whitespace-nowrap">
                      {item.replacement_date ? item.replacement_date.slice(0, 10) : '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-emerald-800 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{item.new_employee_name}</span>
                      </div>
                      {item.new_nik && (
                        <span className="font-mono text-[10.5px] text-text-muted block">
                          NIK: {item.new_nik}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-rose-800 flex items-center gap-1">
                        <UserX className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>{item.old_employee_name}</span>
                      </div>
                      {item.old_nik && (
                        <span className="font-mono text-[10.5px] text-text-muted block">
                          NIK: {item.old_nik}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-text-primary font-medium text-[12px] truncate max-w-[170px]" title={item.school_unit || ''}>
                        {item.school_unit || '-'}
                      </div>
                      {item.position && (
                        <Badge variant="role" className="text-[10px] py-0 px-1.5 mt-0.5">
                          {item.position}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-text-primary text-[12px] block">
                        {item.reason || '-'}
                      </span>
                      {item.notes && (
                        <span className="text-[11px] text-text-muted italic block truncate max-w-[200px]" title={item.notes}>
                          Ket: {item.notes}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="p-1 rounded text-text-muted hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                        title="Hapus Catatan"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end pt-3 border-t border-border-row">
          <Button variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  );
};
