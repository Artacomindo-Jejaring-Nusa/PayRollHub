import React, { useState } from 'react';
import { complaintService } from '../services/complaintService';
import { ComplaintCategory } from '../types/complaint';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import {
  MessageSquareWarning,
  Camera,
  X,
  Upload,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react';

interface CreateComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateComplaintModal: React.FC<CreateComplaintModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('gaji');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('File harus berupa foto/gambar (JPG, PNG, atau WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Ukuran foto maksimal adalah 10MB.');
      return;
    }

    setErrorMsg(null);
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrorMsg('Mohon isi judul dan rincian tulisan keluhan.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('category', category);
      formData.append('description', description.trim());
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      await complaintService.submitComplaint(formData);

      // Reset form
      setTitle('');
      setCategory('gaji');
      setDescription('');
      setPhotoFile(null);
      setPhotoPreview(null);

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Gagal mengirimkan keluhan. Silakan coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tulis Keluhan & Kendala Karyawan"
      description="Sampaikan kendala, pertanyaan slip gaji, absensi, atau operasional ke tim HRD secara transparan"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-[12px] font-semibold text-text-primary mb-1">
            Judul / Topik Keluhan *
          </label>
          <input
            type="text"
            required
            placeholder="Contoh: Selisih Tunjangan Transport SP 8 / Kendala Titik Radius Sekolah"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-10 px-3.5 rounded-xl border border-border-subtle bg-surface text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-text-primary mb-1">
            Kategori Kendala *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
            className="w-full h-10 px-3.5 rounded-xl border border-border-subtle bg-surface text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="gaji">💰 Gaji & Slip (Selisih potongan / jam kerja / rekening)</option>
            <option value="absensi">📍 Absensi & Lokasi (Kendala GPS / radius sekolah / shift)</option>
            <option value="fasilitas">🏢 Fasilitas & Operasional (Seragam, sarana, peralatan)</option>
            <option value="teknis">📱 Kendala Aplikasi / Akun (Login, data profil)</option>
            <option value="lainnya">💬 Lainnya / Masukan Umum</option>
          </select>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-text-primary mb-1">
            Rincian Tulisan Keluhan *
          </label>
          <textarea
            required
            rows={4}
            placeholder="Jelaskan secara lengkap kronologi atau detail kendala yang Anda alami..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3.5 rounded-xl border border-border-subtle bg-surface text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none leading-relaxed"
          />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-text-primary mb-1">
            Lampirkan Foto Bukti / Dokumen Fisik (Opsional)
          </label>
          <p className="text-[11px] text-text-muted mb-2">
            Anda dapat melampirkan foto slip gaji fisik, tangkapan layar (screenshot) kendala, atau foto lokasi pendukung.
          </p>

          {photoPreview ? (
            <div className="relative inline-block border border-border-subtle rounded-xl overflow-hidden bg-surface group">
              <img
                src={photoPreview}
                alt="Pratinjau Keluhan"
                className="w-48 h-32 object-cover rounded-xl"
              />
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-black text-white rounded-full transition-all cursor-pointer"
                title="Hapus Foto"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="p-1.5 bg-surface text-[11px] font-medium text-text-secondary truncate max-w-[192px]">
                {photoFile?.name}
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-border-subtle hover:border-primary/50 bg-surface rounded-xl cursor-pointer transition-colors group">
              <Camera className="w-6 h-6 text-text-muted group-hover:text-primary transition-colors mb-1.5" />
              <span className="text-xs font-semibold text-text-primary group-hover:text-primary">
                Ambil / Pilih Foto Bukti
              </span>
              <span className="text-[11px] text-text-muted mt-0.5">
                Format: JPG, PNG, WEBP (Maksimal 10MB)
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>
          )}
        </div>

        <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2.5">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Mengirimkan...' : 'Kirim Keluhan Sekarang'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
