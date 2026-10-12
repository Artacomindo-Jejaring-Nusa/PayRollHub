import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { formatCurrency } from '../../../lib/utils';
import { ProvincePayrollSetting } from '../../../types/payroll';
import { payrollService } from '../services/payrollService';
import {
  Building,
  Search,
  Pencil,
  CheckCircle2,
  RefreshCw,
  Loader2,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Save,
  ArrowRight,
} from 'lucide-react';

interface ProvinceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated?: () => void;
  company?: string;
}

export const ProvinceSettingsModal: React.FC<ProvinceSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
  company,
}) => {
  const [settings, setSettings] = useState<ProvincePayrollSetting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingSetting, setEditingSetting] = useState<ProvincePayrollSetting | null>(null);

  // Edit form state
  const [editUmp, setEditUmp] = useState<number | string>(0);
  const [editBpjsKes, setEditBpjsKes] = useState<number | string>(0);
  const [editBpjsTkJht, setEditBpjsTkJht] = useState<number | string>(0);
  const [editBpjsTkJp, setEditBpjsTkJp] = useState<number | string>(0);
  const [editNotes, setEditNotes] = useState('');
  const [applyToEmployees, setApplyToEmployees] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingProvince, setIsApplyingProvince] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await payrollService.getProvinceSettings(company);
      setSettings(data);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Gagal memuat aturan gaji provinsi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      setEditingSetting(null);
      setSuccessMessage(null);
    }
  }, [isOpen, company]);

  const handleStartEdit = (item: ProvincePayrollSetting) => {
    setEditingSetting(item);
    setEditUmp(item.ump);
    setEditBpjsKes(item.bpjs_kes);
    setEditBpjsTkJht(item.bpjs_tk_jht);
    setEditBpjsTkJp(item.bpjs_tk_jp);
    setEditNotes(item.notes || '');
    setApplyToEmployees(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleCancelEdit = () => {
    setEditingSetting(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSetting) return;

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const res = await payrollService.updateProvinceSetting(editingSetting.province, {
        ump: Number(editUmp) || 0,
        bpjs_kes: Number(editBpjsKes) || 0,
        bpjs_tk_jht: Number(editBpjsTkJht) || 0,
        bpjs_tk_jp: Number(editBpjsTkJp) || 0,
        notes: editNotes.trim(),
        apply_to_employees: applyToEmployees,
        company,
      });

      setSuccessMessage(res.message);
      setEditingSetting(null);
      await fetchSettings();
      if (onSettingsUpdated) {
        onSettingsUpdated();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Gagal menyimpan perubahan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyNow = async (province: string) => {
    setIsApplyingProvince(province);
    setErrorMessage(null);
    try {
      const res = await payrollService.applyProvinceSettingToEmployees(province, company);
      setSuccessMessage(res.message);
      if (onSettingsUpdated) {
        onSettingsUpdated();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Gagal menerapkan perhitungan ke karyawan.');
    } finally {
      setIsApplyingProvince(null);
    }
  };

  const filteredSettings = settings.filter((s) =>
    s.province.toLowerCase().includes(search.toLowerCase())
  );

  const calculatedTotalTk = (Number(editBpjsTkJht) || 0) + (Number(editBpjsTkJp) || 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pengaturan Gaji & BPJS per Wilayah / Provinsi"
      maxWidth="2xl"
    >
      <div className="space-y-4 py-1">
        {/* Banner info */}
        <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-900 text-[12.5px] leading-relaxed flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong>Perhitungan BPJS Berdasarkan UMP Provinsi:</strong> Nilai BPJS Ketenagakerjaan (JHT & JP) dan BPJS Kesehatan dihitung sesuai regulasi UMP masing-masing daerah. Anda dapat mengubah nilai per provinsi dan langsung menyinkronkannya ke seluruh data karyawan di wilayah tersebut.
          </div>
        </div>

        {/* Success / Error alerts */}
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

        {/* If currently editing a province */}
        {editingSetting ? (
          <form onSubmit={handleSaveEdit} className="bg-surface-page p-5 rounded-xl border border-border-subtle space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-row">
              <div>
                <h4 className="font-bold text-text-primary text-[15px] flex items-center gap-2">
                  <Building className="w-4 h-4 text-primary" />
                  Edit Pengaturan: {editingSetting.province}
                </h4>
                <p className="text-[11.5px] text-text-muted mt-0.5">
                  Sesuaikan nilai UMP dan nominal BPJS untuk wilayah ini.
                </p>
              </div>
              <Badge variant="province">{editingSetting.province}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                  Upah Minimum Provinsi (UMP)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-[12px] font-medium text-text-muted">Rp</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={editUmp}
                    onChange={(e) => setEditUmp(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-border-subtle bg-surface text-[13px] font-mono outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Contoh: 3484000"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                  Tunjangan BPJS Kesehatan
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-[12px] font-medium text-text-muted">Rp</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={editBpjsKes}
                    onChange={(e) => setEditBpjsKes(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-border-subtle bg-surface text-[13px] font-mono outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Contoh: 192094"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                  BPJS TK - JHT (Jaminan Hari Tua)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-[12px] font-medium text-text-muted">Rp</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={editBpjsTkJht}
                    onChange={(e) => setEditBpjsTkJht(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-border-subtle bg-surface text-[13px] font-mono outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Contoh: 150000"
                    required
                  />
                </div>
                <span className="text-[11px] text-text-muted mt-1 block">
                  Akan muncul di slip: BPJS yang bisa dicairkan
                </span>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                  BPJS TK - JP (Jaminan Pensiun)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-[12px] font-medium text-text-muted">Rp</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={editBpjsTkJp}
                    onChange={(e) => setEditBpjsTkJp(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-border-subtle bg-surface text-[13px] font-mono outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Contoh: 200000"
                    required
                  />
                </div>
                <span className="text-[11px] text-text-muted mt-1 block">
                  Total BPJS TK: <strong className="font-mono text-primary">{formatCurrency(calculatedTotalTk)}</strong>
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                Catatan / Keterangan Dasar Penetapan UMP (Opsional)
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Contoh: SK Gubernur 2026 No. 128 / UMP 2026..."
                className="w-full h-16 p-2.5 rounded-lg border border-border-subtle bg-surface text-[12.5px] outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Checkbox apply to employees */}
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg flex items-start gap-2.5">
              <input
                type="checkbox"
                id="applyToEmployeesCheck"
                checked={applyToEmployees}
                onChange={(e) => setApplyToEmployees(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 cursor-pointer"
              />
              <label htmlFor="applyToEmployeesCheck" className="text-[12px] text-amber-900 cursor-pointer">
                <strong>Terapkan otomatis ke seluruh karyawan aktif di {editingSetting.province}:</strong>
                <span className="block text-amber-800 text-[11.5px] mt-0.5">
                  Sistem akan memperbarui data BPJS Kesehatan, BPJS TK (JHT & JP), dan menghitung ulang Take Home Pay seluruh data karyawan pada wilayah ini.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSaving}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Simpan & Terapkan Perubahan
              </Button>
            </div>
          </form>
        ) : (
          /* List of provinces table */
          <div className="space-y-3">
            {/* Search Bar */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari provinsi/wilayah..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 bg-surface rounded-lg text-text-primary text-[12.5px] border border-border-subtle outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSettings}
                disabled={isLoading}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
              >
                Refresh
              </Button>
            </div>

            {/* Table */}
            <div className="border border-border-subtle rounded-xl overflow-hidden max-h-[380px] overflow-y-auto shadow-2xs">
              <table className="w-full text-left border-collapse text-[12.5px]">
                <thead className="bg-surface-container-low sticky top-0 border-b border-border-subtle font-semibold text-text-muted uppercase text-[11px] tracking-wider z-10">
                  <tr>
                    <th className="py-2.5 px-3">Provinsi</th>
                    <th className="py-2.5 px-3 text-right">UMP</th>
                    <th className="py-2.5 px-3 text-right">BPJS Kes</th>
                    <th className="py-2.5 px-3 text-right">BPJS TK (JHT+JP)</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-row">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-text-muted">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                        <span>Memuat data aturan wilayah...</span>
                      </td>
                    </tr>
                  ) : filteredSettings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-text-muted">
                        Tidak ada provinsi yang cocok dengan pencarian "{search}".
                      </td>
                    </tr>
                  ) : (
                    filteredSettings.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-text-primary">
                          <div className="flex items-center gap-1.5">
                            <span>{item.province}</span>
                          </div>
                          {item.notes && (
                            <span className="text-[10.5px] text-text-muted font-normal block truncate max-w-[200px]" title={item.notes}>
                              {item.notes}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-text-primary">
                          {formatCurrency(item.ump)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                          {formatCurrency(item.bpjs_kes)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-blue-700">
                          <div>{formatCurrency(item.bpjs_tk)}</div>
                          <div className="text-[10px] text-text-muted">
                            JHT: {formatCurrency(item.bpjs_tk_jht)} • JP: {formatCurrency(item.bpjs_tk_jp)}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleStartEdit(item)}
                              className="px-2 py-1 rounded-md text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer flex items-center gap-1"
                              title="Edit Nominal"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleApplyNow(item.province)}
                              disabled={isApplyingProvince === item.province}
                              className="px-2 py-1 rounded-md text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                              title="Terapkan ke seluruh karyawan provinsi ini"
                            >
                              {isApplyingProvince === item.province ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3 h-3" />
                              )}
                              <span>Sinkron</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end pt-3 border-t border-border-row">
          <Button variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  );
};
