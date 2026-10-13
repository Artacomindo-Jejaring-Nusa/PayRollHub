import React, { useState } from 'react';
import { complaintService } from '../services/complaintService';
import { ComplaintCategory } from '../types/complaint';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import {
  MessageSquarePlus,
  Camera,
  X,
  Upload,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react';

interface CreateUserFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateUserFeedbackModal: React.FC<CreateUserFeedbackModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('saran');
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
    if (!title.trim()) {
      setErrorMsg('Silakan isi judul feedback.');
      return;
    }
    if (!description.trim() || description.length < 5) {
      setErrorMsg('Silakan jelaskan feedback Anda minimal 5 karakter.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('category', category);
      formData.append('description', description.trim());
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      await complaintService.submitUserFeedback(formData);
      // Reset form
      setTitle('');
      setCategory('saran');
      setDescription('');
      setPhotoFile(null);
      setPhotoPreview(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Gagal mengirimkan feedback. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Kirim Feedback & Masukan Sistem"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <p className="text-xs text-text-muted">
          Sampaikan saran pengembangan, masukan antarmuka, atau kendala operasional Anda langsung kepada Admin & Super Admin.
        </p>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Judul Feedback */}
        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">
            Judul / Subjek Masukan <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Saran penambahan tombol filter cepat / Kendala cetak slip"
            maxLength={200}
            required
            className="w-full px-3 py-2 text-xs bg-surface border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>

        {/* 2. Kategori */}
        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">
            Kategori <span className="text-rose-500">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
            className="w-full px-3 py-2 text-xs bg-surface border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          >
            <option value="saran">💡 Saran & Masukan Fitur</option>
            <option value="sistem">⚙️ Kendala Sistem / Tampilan</option>
            <option value="gaji">💵 Data Penggajian & Slip</option>
            <option value="absensi">📍 Presensi & Lokasi Absen</option>
            <option value="teknis">🔧 Kendala Teknis / Akun</option>
            <option value="lainnya">📝 Lainnya</option>
          </select>
        </div>

        {/* 3. Deskripsi Masukan */}
        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">
            Isi Feedback / Penjelasan Lengkap <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tuliskan masukan atau rincian kendala yang Anda alami secara detail..."
            rows={4}
            required
            className="w-full px-3 py-2 text-xs bg-surface border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
          />
        </div>

        {/* 4. Unggah Foto Bukti / Screenshot (Opsional) */}
        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">
            Lampiran Foto / Screenshot <span className="text-text-muted font-normal">(Opsional, Maks 10MB)</span>
          </label>

          {photoPreview ? (
            <div className="relative rounded-xl border border-border-subtle overflow-hidden bg-surface-container/40 p-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-14 h-14 object-cover rounded-lg border border-border-subtle"
                />
                <div className="text-xs">
                  <span className="font-semibold text-text-primary block truncate max-w-[200px]">
                    {photoFile?.name}
                  </span>
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium mt-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Foto siap dikirim
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="p-1.5 rounded-lg text-text-muted hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Hapus Foto"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="border-2 border-dashed border-border-subtle hover:border-primary/50 bg-surface-container/20 hover:bg-surface-container/40 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
                <Camera className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-text-primary">
                Pilih Foto atau Screenshot
              </span>
              <span className="text-[10px] text-text-muted mt-0.5">
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

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs"
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            className="text-xs flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Mengirimkan...' : 'Kirim Feedback'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
