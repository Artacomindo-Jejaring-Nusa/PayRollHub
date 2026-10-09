import React, { useEffect, useState } from 'react';
import { employeeService } from '../services/employeeService';
import { WorkReport } from '../../../types/auth';
import { Card } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { getStorageUrl } from '../../../lib/utils';
import {
  ClipboardList,
  Plus,
  Calendar,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  Upload,
  ExternalLink,
  Camera,
  X,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { DevFeatureLock } from '../../../components/shared/DevFeatureLock';

interface ActivitySlot {
  key: 'absen' | 'kegiatan1' | 'kegiatan2' | 'kegiatan_lain';
  title: string;
  subtitle: string;
  photoUrl: string | null;
  description: string;
  isRequired: boolean;
}

function getReportActivities(report: WorkReport): ActivitySlot[] {
  // If backend provides activities or individual columns
  if (report.photo_absen || report.desc_absen || report.photo_kegiatan1 || report.desc_kegiatan1) {
    return [
      {
        key: 'absen',
        title: '1. Absen Masuk',
        subtitle: 'Foto Masuk Bertugas',
        photoUrl: report.photo_absen ? getStorageUrl(report.photo_absen) : null,
        description: report.desc_absen || '-',
        isRequired: true,
      },
      {
        key: 'kegiatan1',
        title: '2. Kegiatan 1',
        subtitle: 'Aktivitas Utama',
        photoUrl: report.photo_kegiatan1 ? getStorageUrl(report.photo_kegiatan1) : null,
        description: report.desc_kegiatan1 || '-',
        isRequired: true,
      },
      {
        key: 'kegiatan2',
        title: '3. Kegiatan 2',
        subtitle: 'Aktivitas Kedua',
        photoUrl: report.photo_kegiatan2 ? getStorageUrl(report.photo_kegiatan2) : null,
        description: report.desc_kegiatan2 || '-',
        isRequired: true,
      },
      {
        key: 'kegiatan_lain',
        title: '4. Kegiatan Lain',
        subtitle: 'Tugas Lainnya (Opsional)',
        photoUrl: report.photo_kegiatan_lain ? getStorageUrl(report.photo_kegiatan_lain) : null,
        description: report.desc_kegiatan_lain || '-',
        isRequired: false,
      },
    ];
  }

  // Fallback for legacy report records
  return [
    {
      key: 'absen',
      title: '1. Absen Masuk',
      subtitle: 'Foto Masuk Bertugas',
      photoUrl: null,
      description: 'Laporan versi lama',
      isRequired: true,
    },
    {
      key: 'kegiatan1',
      title: '2. Kegiatan 1',
      subtitle: 'Aktivitas Utama',
      photoUrl: report.attachment_path ? getStorageUrl(report.attachment_path) : null,
      description: report.description || '-',
      isRequired: true,
    },
    {
      key: 'kegiatan2',
      title: '3. Kegiatan 2',
      subtitle: 'Aktivitas Kedua',
      photoUrl: null,
      description: '-',
      isRequired: true,
    },
    {
      key: 'kegiatan_lain',
      title: '4. Kegiatan Lain',
      subtitle: 'Opsional',
      photoUrl: null,
      description: '-',
      isRequired: false,
    },
  ];
}

export const EmployeeReportsPage: React.FC = () => {
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preview Attachment State
  const [previewAttachment, setPreviewAttachment] = useState<{
    url: string;
    title: string;
    subtitle?: string;
    isPdf: boolean;
  } | null>(null);

  // Form State: 4 baku kegiatan
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  // 1. Absen Masuk
  const [photoAbsen, setPhotoAbsen] = useState<File | null>(null);
  const [previewAbsen, setPreviewAbsen] = useState<string | null>(null);
  const [descAbsen, setDescAbsen] = useState('');

  // 2. Kegiatan 1
  const [photoKegiatan1, setPhotoKegiatan1] = useState<File | null>(null);
  const [previewKegiatan1, setPreviewKegiatan1] = useState<string | null>(null);
  const [descKegiatan1, setDescKegiatan1] = useState('');

  // 3. Kegiatan 2
  const [photoKegiatan2, setPhotoKegiatan2] = useState<File | null>(null);
  const [previewKegiatan2, setPreviewKegiatan2] = useState<string | null>(null);
  const [descKegiatan2, setDescKegiatan2] = useState('');

  // 4. Kegiatan Lain (Opsional)
  const [photoKegiatanLain, setPhotoKegiatanLain] = useState<File | null>(null);
  const [previewKegiatanLain, setPreviewKegiatanLain] = useState<string | null>(null);
  const [descKegiatanLain, setDescKegiatanLain] = useState('');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await employeeService.getWorkReports();
      setReports(res.data);
    } catch (err) {
      console.error('Failed to fetch reports', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (
    file: File | null,
    setFile: (f: File | null) => void,
    setPreview: (url: string | null) => void
  ) => {
    if (file) {
      setFile(file);
      const objUrl = URL.createObjectURL(file);
      setPreview(objUrl);
    } else {
      setFile(null);
      setPreview(null);
    }
  };

  const resetForm = () => {
    setPhotoAbsen(null);
    setPreviewAbsen(null);
    setDescAbsen('');

    setPhotoKegiatan1(null);
    setPreviewKegiatan1(null);
    setDescKegiatan1('');

    setPhotoKegiatan2(null);
    setPreviewKegiatan2(null);
    setDescKegiatan2('');

    setPhotoKegiatanLain(null);
    setPreviewKegiatanLain(null);
    setDescKegiatanLain('');

    setIsFormOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi Slot Wajib
    if (!photoAbsen) {
      alert('Foto Absen Masuk wajib dilampirkan!');
      return;
    }
    if (!descAbsen.trim()) {
      alert('Rincian Laporan Absen Masuk wajib diisi!');
      return;
    }

    if (!photoKegiatan1) {
      alert('Foto bukti Kegiatan 1 wajib dilampirkan!');
      return;
    }
    if (!descKegiatan1.trim()) {
      alert('Rincian Laporan Kegiatan 1 wajib diisi!');
      return;
    }

    if (!photoKegiatan2) {
      alert('Foto bukti Kegiatan 2 wajib dilampirkan!');
      return;
    }
    if (!descKegiatan2.trim()) {
      alert('Rincian Laporan Kegiatan 2 wajib diisi!');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('report_date', reportDate);

      // 1. Absen Masuk
      formData.append('photo_absen', photoAbsen);
      formData.append('desc_absen', descAbsen.trim());

      // 2. Kegiatan 1
      formData.append('photo_kegiatan1', photoKegiatan1);
      formData.append('desc_kegiatan1', descKegiatan1.trim());

      // 3. Kegiatan 2
      formData.append('photo_kegiatan2', photoKegiatan2);
      formData.append('desc_kegiatan2', descKegiatan2.trim());

      // 4. Kegiatan Lain (Opsional)
      if (photoKegiatanLain) {
        formData.append('photo_kegiatan_lain', photoKegiatanLain);
      }
      if (descKegiatanLain.trim()) {
        formData.append('desc_kegiatan_lain', descKegiatanLain.trim());
      }

      await employeeService.submitWorkReport(formData);
      alert('Laporan kerja harian (4 kegiatan) berhasil dikirim!');
      resetForm();
      fetchReports();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengirim laporan kerja.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DevFeatureLock featureName="Laporan Kerja (Karyawan)">
      <div className="space-y-6">
      {/* Header & Toggle Form Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border-subtle">
        <div>
          <h1 className="font-headline-page text-[22px] sm:text-[24px] font-bold text-text-primary tracking-tight">
            Laporan Kerja Harian
          </h1>
          <p className="font-body-default text-[13px] text-text-muted mt-1">
            Rekap 4 tugas harian & foto kegiatan: Absen Masuk, Kegiatan 1, Kegiatan 2, dan Kegiatan Lain
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-[12.5px] font-semibold flex items-center gap-2 transition-all shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isFormOpen ? 'Tutup Formulir' : 'Buat Laporan Baru (4 Kegiatan)'}</span>
        </button>
      </div>

      {/* Form Submit Box: 4 Kolom 4 Gambar */}
      {isFormOpen && (
        <Card className="p-5 sm:p-6 border-border-subtle bg-surface-panel shadow-sm space-y-5 animate-in fade-in duration-150">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="pb-3 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-[16px] text-text-primary flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  Formulir Laporan 4 Kegiatan Harian
                </h3>
                <p className="text-[12px] text-text-muted mt-0.5">
                  Judul kegiatan sudah baku. Unggah 4 foto dan isi rincian laporan wajib pada slot 1 - 3.
                </p>
              </div>

              {/* Tanggal Pelaporan */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <label className="text-[12px] font-medium text-text-muted shrink-0">Tanggal:</label>
                <input
                  type="date"
                  required
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-border-subtle bg-surface text-[12.5px] font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Grid 4 Kolom */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* KOLOM 1: ABSEN MASUK */}
              <div className="bg-surface rounded-xl border border-border-subtle p-4 flex flex-col justify-between space-y-3 shadow-2xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[13.5px] text-text-primary">1. Absen Masuk</span>
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Wajib
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Foto absen masuk bertugas (Foto saat mulai kerja / masuk shift)
                  </p>

                  {/* Foto Box */}
                  <div className="pt-1">
                    {previewAbsen ? (
                      <div className="relative rounded-lg overflow-hidden border border-border-subtle bg-slate-950/5 group h-36">
                        <img
                          src={previewAbsen}
                          alt="Absen Masuk"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleFileChange(null, setPhotoAbsen, setPreviewAbsen)}
                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white transition-colors"
                          title="Hapus foto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-36 rounded-lg border-2 border-dashed border-border-subtle hover:border-primary/50 bg-surface-container/40 hover:bg-surface-container cursor-pointer transition-colors p-3 text-center">
                        <Camera className="w-6 h-6 text-primary mb-1.5" />
                        <span className="text-[12px] font-semibold text-text-primary">
                          Foto Absen Masuk
                        </span>
                        <span className="text-[10.5px] text-text-muted mt-0.5">
                          Klik untuk ambil / pilih foto
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileChange(e.target.files[0], setPhotoAbsen, setPreviewAbsen);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Deskripsi */}
                <div>
                  <label className="block text-[11.5px] font-medium text-text-primary mb-1">
                    Rincian Laporan (Wajib) *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Contoh: Jam 07.30 tiba di pos, serah terima seragam & inventaris lengkap..."
                    value={descAbsen}
                    onChange={(e) => setDescAbsen(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-border-subtle bg-surface-panel text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>
              </div>

              {/* KOLOM 2: KEGIATAN 1 */}
              <div className="bg-surface rounded-xl border border-border-subtle p-4 flex flex-col justify-between space-y-3 shadow-2xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[13.5px] text-text-primary">2. Kegiatan 1</span>
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-primary/10 text-primary border border-primary/20">
                      Wajib
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Tugas & aktivitas kerja pertama yang dilaksanakan
                  </p>

                  {/* Foto Box */}
                  <div className="pt-1">
                    {previewKegiatan1 ? (
                      <div className="relative rounded-lg overflow-hidden border border-border-subtle bg-slate-950/5 group h-36">
                        <img
                          src={previewKegiatan1}
                          alt="Kegiatan 1"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleFileChange(null, setPhotoKegiatan1, setPreviewKegiatan1)}
                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white transition-colors"
                          title="Hapus foto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-36 rounded-lg border-2 border-dashed border-border-subtle hover:border-primary/50 bg-surface-container/40 hover:bg-surface-container cursor-pointer transition-colors p-3 text-center">
                        <Camera className="w-6 h-6 text-primary mb-1.5" />
                        <span className="text-[12px] font-semibold text-text-primary">
                          Foto Kegiatan 1
                        </span>
                        <span className="text-[10.5px] text-text-muted mt-0.5">
                          Klik untuk ambil / pilih foto
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileChange(e.target.files[0], setPhotoKegiatan1, setPreviewKegiatan1);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Deskripsi */}
                <div>
                  <label className="block text-[11.5px] font-medium text-text-primary mb-1">
                    Rincian Laporan (Wajib) *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Contoh: Pembersihan area koridor dan pengecekan instalasi listrik lantai 1..."
                    value={descKegiatan1}
                    onChange={(e) => setDescKegiatan1(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-border-subtle bg-surface-panel text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>
              </div>

              {/* KOLOM 3: KEGIATAN 2 */}
              <div className="bg-surface rounded-xl border border-border-subtle p-4 flex flex-col justify-between space-y-3 shadow-2xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[13.5px] text-text-primary">3. Kegiatan 2</span>
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-primary/10 text-primary border border-primary/20">
                      Wajib
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Tugas & aktivitas kerja kedua yang dilaksanakan
                  </p>

                  {/* Foto Box */}
                  <div className="pt-1">
                    {previewKegiatan2 ? (
                      <div className="relative rounded-lg overflow-hidden border border-border-subtle bg-slate-950/5 group h-36">
                        <img
                          src={previewKegiatan2}
                          alt="Kegiatan 2"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleFileChange(null, setPhotoKegiatan2, setPreviewKegiatan2)}
                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white transition-colors"
                          title="Hapus foto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-36 rounded-lg border-2 border-dashed border-border-subtle hover:border-primary/50 bg-surface-container/40 hover:bg-surface-container cursor-pointer transition-colors p-3 text-center">
                        <Camera className="w-6 h-6 text-primary mb-1.5" />
                        <span className="text-[12px] font-semibold text-text-primary">
                          Foto Kegiatan 2
                        </span>
                        <span className="text-[10.5px] text-text-muted mt-0.5">
                          Klik untuk ambil / pilih foto
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileChange(e.target.files[0], setPhotoKegiatan2, setPreviewKegiatan2);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Deskripsi */}
                <div>
                  <label className="block text-[11.5px] font-medium text-text-primary mb-1">
                    Rincian Laporan (Wajib) *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Contoh: Patroli keliling area asrama, pengecekan pintu gerbang dan kunci..."
                    value={descKegiatan2}
                    onChange={(e) => setDescKegiatan2(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-border-subtle bg-surface-panel text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>
              </div>

              {/* KOLOM 4: KEGIATAN LAIN (OPSIONAL) */}
              <div className="bg-surface rounded-xl border border-border-subtle p-4 flex flex-col justify-between space-y-3 shadow-2xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[13.5px] text-text-primary">4. Kegiatan Lain</span>
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      Opsional
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Tugas atau aktivitas tambahan di luar rutinitas harian
                  </p>

                  {/* Foto Box */}
                  <div className="pt-1">
                    {previewKegiatanLain ? (
                      <div className="relative rounded-lg overflow-hidden border border-border-subtle bg-slate-950/5 group h-36">
                        <img
                          src={previewKegiatanLain}
                          alt="Kegiatan Lain"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleFileChange(null, setPhotoKegiatanLain, setPreviewKegiatanLain)}
                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white transition-colors"
                          title="Hapus foto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-36 rounded-lg border-2 border-dashed border-border-subtle hover:border-slate-400 bg-surface-container/30 hover:bg-surface-container cursor-pointer transition-colors p-3 text-center">
                        <Upload className="w-6 h-6 text-text-muted mb-1.5" />
                        <span className="text-[12px] font-semibold text-text-primary">
                          Foto Lainnya
                        </span>
                        <span className="text-[10.5px] text-text-muted mt-0.5">
                          Opsional (jika ada)
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileChange(e.target.files[0], setPhotoKegiatanLain, setPreviewKegiatanLain);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Deskripsi */}
                <div>
                  <label className="block text-[11.5px] font-medium text-text-primary mb-1">
                    Rincian Laporan (Opsional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Contoh: Membantu penerimaan paket kiriman barang atau koordinasi lainnya..."
                    value={descKegiatanLain}
                    onChange={(e) => setDescKegiatanLain(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-border-subtle bg-surface-panel text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-xl text-[12.5px] font-medium text-text-muted hover:bg-surface-container transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[12.5px] font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Mengirim Laporan...' : 'Kirim Laporan Harian'}</span>
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Reports History List */}
      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-44 bg-surface-container rounded-2xl" />
          <div className="h-44 bg-surface-container rounded-2xl" />
        </div>
      ) : reports.length === 0 ? (
        <Card className="p-10 text-center space-y-3 border-border-subtle bg-surface-panel rounded-2xl">
          <ClipboardList className="w-12 h-12 text-text-muted mx-auto" />
          <h3 className="text-[16px] font-semibold text-text-primary">Belum Ada Laporan Kerja Harian</h3>
          <p className="text-[12.5px] text-text-muted max-w-sm mx-auto">
            Klik tombol "Buat Laporan Baru (4 Kegiatan)" di atas untuk mengirimkan rekap absensi masuk dan aktivitas kerja hari ini.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const isApproved = report.status === 'approved';
            const isRejected = report.status === 'rejected';
            const activities = getReportActivities(report);

            return (
              <Card
                key={report.id}
                className="p-5 border-border-subtle bg-surface-panel shadow-xs rounded-2xl space-y-4"
              >
                {/* Header Bar Laporan */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border-row">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border flex items-center gap-1 ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isRejected
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {isApproved ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Disetujui
                        </>
                      ) : isRejected ? (
                        <>
                          <XCircle className="w-3 h-3" /> Perlu Revisi
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" /> Menunggu Review
                        </>
                      )}
                    </span>
                    <h3 className="font-bold text-[15px] text-text-primary">
                      Laporan Kerja Harian
                    </h3>
                  </div>

                  <span className="text-[12px] text-text-muted flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-text-muted" />
                    <span>
                      {new Date(report.report_date).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </span>
                </div>

                {/* 4 Kolom Kegiatan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {activities.map((act) => (
                    <div
                      key={act.key}
                      className="rounded-xl border border-border-subtle bg-surface p-3 flex flex-col justify-between space-y-2.5 hover:border-primary/30 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-[12.5px] text-text-primary">
                            {act.title}
                          </span>
                          <span
                            className={`text-[9.5px] font-semibold px-1.5 py-0.2 rounded ${
                              act.isRequired
                                ? 'bg-primary/10 text-primary'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {act.isRequired ? 'Wajib' : 'Opsional'}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-text-muted line-clamp-1">{act.subtitle}</p>
                      </div>

                      {/* Foto Thumbnail */}
                      <div className="pt-0.5">
                        {act.photoUrl ? (
                          <div
                            onClick={() =>
                              setPreviewAttachment({
                                url: act.photoUrl!,
                                title: act.title,
                                subtitle: `${new Date(report.report_date).toLocaleDateString('id-ID')} - ${act.subtitle}`,
                                isPdf: false,
                              })
                            }
                            className="relative rounded-lg overflow-hidden border border-border-subtle bg-slate-950/5 group h-32 cursor-pointer shadow-2xs"
                          >
                            <img
                              src={act.photoUrl}
                              alt={act.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  const errNotice = document.createElement('div');
                                  errNotice.className =
                                    'h-full flex items-center justify-center text-[10.5px] text-rose-500 font-medium p-2 text-center';
                                  errNotice.innerText = 'Gagal memuat foto';
                                  parent.appendChild(errNotice);
                                }
                              }}
                            />
                            <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-[11px] font-medium backdrop-blur-2xs">
                              <Eye className="w-3.5 h-3.5" />
                              <span>Lihat Foto</span>
                            </div>
                          </div>
                        ) : (
                          <div className="h-32 rounded-lg border border-dashed border-border-subtle bg-surface-container/20 flex flex-col items-center justify-center text-text-muted text-[11px] p-2 text-center">
                            <ImageIcon className="w-5 h-5 mb-1 opacity-40" />
                            <span>Tanpa Lampiran Foto</span>
                          </div>
                        )}
                      </div>

                      {/* Rincian Laporan */}
                      <div className="bg-surface-panel p-2.5 rounded-lg border border-border-subtle min-h-[55px] flex flex-col justify-start">
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-0.5">
                          Rincian:
                        </span>
                        <p className="text-[11.5px] text-text-primary leading-relaxed whitespace-pre-line line-clamp-3 hover:line-clamp-none transition-all">
                          {act.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Feedback Review dari HR jika ada */}
                {report.feedback && (
                  <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-[12px] space-y-1">
                    <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Catatan Evaluasi dari HR ({report.reviewer?.name || 'Admin'}):
                    </div>
                    <div className="text-amber-800 leading-relaxed pl-5">{report.feedback}</div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Preview Attachment Modal */}
      {previewAttachment && (
        <Modal
          isOpen={!!previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          title={`Pratinjau Foto: ${previewAttachment.title}`}
          description={previewAttachment.subtitle}
          maxWidth="3xl"
        >
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-border-subtle bg-slate-950/5 flex items-center justify-center p-2 min-h-[300px] max-h-[68vh]">
              <img
                src={previewAttachment.url}
                alt={previewAttachment.title}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-sm"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const errNotice = document.createElement('div');
                    errNotice.className = 'text-center p-6 text-[13px] text-rose-500 font-medium';
                    errNotice.innerText = 'Foto tidak dapat dimuat atau belum tersinkronisasi di server.';
                    parent.appendChild(errNotice);
                  }
                }}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border-row">
              <span className="text-[12px] text-text-muted truncate max-w-sm">
                {previewAttachment.title}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreviewAttachment(null)}>
                  Tutup
                </Button>
                <a
                  href={previewAttachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-white text-[12px] font-semibold hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Ukuran Penuh / Unduh</span>
                </a>
              </div>
            </div>
          </div>
        </Modal>
      )}
      </div>
    </DevFeatureLock>
  );
};
