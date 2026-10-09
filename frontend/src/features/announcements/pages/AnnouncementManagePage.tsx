import React, { useEffect, useState } from 'react';
import { announcementService } from '../services/announcementService';
import { Announcement } from '../../../types/auth';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import {
  Bell,
  Plus,
  Pin,
  Trash2,
  Edit2,
  Calendar,
  Building2,
  User,
  CheckCircle2,
} from 'lucide-react';

export const AnnouncementManagePage: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Umum');
  const [company, setCompany] = useState<'all' | 'rbs' | 'rimamandiri'>('all');
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, [selectedCompany]);

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const res = await announcementService.getAnnouncements({
        company: selectedCompany !== 'all' ? selectedCompany : undefined,
        search: search.trim() || undefined,
      });
      setAnnouncements(res.data);
    } catch (err) {
      console.error('Failed to load announcements', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setTitle('');
    setContent('');
    setCategory('Umum');
    setCompany('all');
    setIsPinned(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: Announcement) => {
    setEditingItem(item);
    setTitle(item.title);
    setContent(item.content);
    setCategory(item.category);
    setCompany(item.company);
    setIsPinned(item.is_pinned);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pengumuman ini?')) return;
    try {
      await announcementService.deleteAnnouncement(id);
      fetchAnnouncements();
    } catch (err) {
      alert('Gagal menghapus pengumuman.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        category,
        company,
        is_pinned: isPinned,
      };

      if (editingItem) {
        await announcementService.updateAnnouncement(editingItem.id, payload);
      } else {
        await announcementService.createAnnouncement(payload);
      }

      setIsModalOpen(false);
      fetchAnnouncements();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyimpan pengumuman.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-page text-headline-page text-text-primary tracking-tight">
            Manajemen Papan Pengumuman
          </h1>
          <p className="font-body-default text-body-default text-text-muted mt-1">
            Publikasikan informasi, edaran operasional, dan memo HR untuk dibaca seluruh karyawan
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenCreate}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Buat Pengumuman Baru
        </Button>
      </div>

      {/* Filter Row */}
      <div className="bg-surface-panel rounded-xl border border-border-subtle p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-[12px] font-medium text-text-muted">Target Perusahaan:</label>
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border-subtle bg-surface text-[12.5px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Semua Perusahaan</option>
            <option value="rimamandiri">PT. Riama Mandiri Pratama</option>
            <option value="rbs">PT. Rimbun Buana Sejahtera</option>
          </select>
        </div>

        <div className="text-[12px] text-text-muted">
          Total {announcements.length} Pengumuman
        </div>
      </div>

      {/* Announcements List */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-28 bg-slate-200 rounded-xl" />
          <div className="h-28 bg-slate-200 rounded-xl" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-surface-panel rounded-2xl border border-border-subtle p-8 text-center text-text-muted text-[13px]">
          Belum ada pengumuman yang dibuat. Klik tombol di atas untuk membuat pengumuman pertama.
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((item) => (
            <div
              key={item.id}
              className={`bg-surface-panel rounded-xl border p-5 shadow-xs space-y-3 transition-colors ${
                item.is_pinned ? 'border-amber-300 bg-amber-50/20' : 'border-border-subtle'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 uppercase">
                    {item.category}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                    {item.company === 'all'
                      ? 'Semua Perusahaan'
                      : item.company === 'rimamandiri'
                      ? 'Riama Mandiri'
                      : 'RBS Global'}
                  </span>
                  {item.is_pinned && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                      <Pin className="w-3 h-3" /> PENTING
                    </span>
                  )}
                  <h3 className="font-bold text-[15px] text-text-primary">{item.title}</h3>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-[11.5px] text-text-muted">
                    {new Date(item.published_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <div className="h-4 w-px bg-border-subtle mx-1" />
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-container rounded-lg transition-colors"
                    title="Ubah Pengumuman"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Hapus Pengumuman"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="text-[13px] text-text-primary whitespace-pre-line leading-relaxed">
                {item.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Create / Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Ubah Pengumuman' : 'Buat Pengumuman Baru'}
        description="Pesan ini akan langsung tampil di beranda seluruh karyawan"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-text-primary mb-1">
              Judul Pengumuman *
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Jadwal Pembagian Seragam & Penggajian Bulan Ini"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-border-subtle bg-surface text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-text-primary mb-1">
                Kategori *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-border-subtle bg-surface text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="Umum">Umum</option>
                <option value="Penting">Penting</option>
                <option value="Operasional">Operasional</option>
                <option value="Gaji & Tunjangan">Gaji & Tunjangan</option>
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-text-primary mb-1">
                Target Perusahaan *
              </label>
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value as any)}
                className="w-full h-10 px-3.5 rounded-xl border border-border-subtle bg-surface text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="all">Semua Perusahaan (Global)</option>
                <option value="rimamandiri">PT. Riama Mandiri Pratama</option>
                <option value="rbs">PT. Rimbun Buana Sejahtera</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-text-primary mb-1">
              Isi Konten Pengumuman *
            </label>
            <textarea
              required
              rows={5}
              placeholder="Tuliskan isi pengumuman secara rinci..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-border-subtle bg-surface text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPinned"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 cursor-pointer"
            />
            <label htmlFor="isPinned" className="text-[13px] text-text-primary cursor-pointer">
              Sematkan di posisi teratas (Pinned Announcement)
            </label>
          </div>

          <div className="pt-3 border-t border-border-row flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Publikasikan'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
