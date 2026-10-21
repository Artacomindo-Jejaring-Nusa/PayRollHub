import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  Search,
  Sparkles,
  ArrowRight,
  Database,
  RefreshCw,
  Info,
  ShieldCheck,
  Building2,
  MapPin,
  School,
  Users,
  UserPlus,
  AlertOctagon,
  Copy,
  ChevronRight,
  Send,
  Layers,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { useTenantTheme, isValidationSubdomain } from '../../../lib/theme';
import { SP_PERIOD_LIST } from '../../../lib/period';
import {
  validationService,
  ValidatedRow,
  ValidationSummary,
  QuickCheckResult,
} from '../services/validationService';

export const DataValidationPage: React.FC = () => {
  const { tenant } = useTenantTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mode: 'bulk' (upload spreadsheet) or 'single' (instant lookup)
  const [activeTab, setActiveTab] = useState<'bulk' | 'single'>('bulk');

  // Bulk Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetPeriod, setTargetPeriod] = useState<string>('SP 9');
  const [targetCompany, setTargetCompany] = useState<string>(tenant.id);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [validationData, setValidationData] = useState<{
    summary: ValidationSummary;
    rows: ValidatedRow[];
  } | null>(null);

  // Bulk Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 12;

  // Commit to Payroll State
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [commitSuccessMessage, setCommitSuccessMessage] = useState<string | null>(null);
  const [showCommitModal, setShowCommitModal] = useState<boolean>(false);

  // Single Quick-Check State
  const [quickName, setQuickName] = useState<string>('');
  const [quickProvince, setQuickProvince] = useState<string>('');
  const [quickSchool, setQuickSchool] = useState<string>('');
  const [quickNik, setQuickNik] = useState<string>('');
  const [isCheckingSingle, setIsCheckingSingle] = useState<boolean>(false);
  const [singleResult, setSingleResult] = useState<QuickCheckResult | null>(null);
  const [singleError, setSingleError] = useState<string | null>(null);

  // Detail Modal State
  const [selectedRowDetail, setSelectedRowDetail] = useState<ValidatedRow | null>(null);

  // Drag & drop
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.match(/\.(xlsx|xls|csv)$/i)) {
        setSelectedFile(file);
        setAnalysisError(null);
      } else {
        setAnalysisError('Format file harus berupa Excel (.xlsx, .xls) atau CSV (.csv).');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setAnalysisError(null);
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) {
      setAnalysisError('Silakan pilih atau unggah file spreadsheet terlebih dahulu.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setCommitSuccessMessage(null);

    try {
      const result = await validationService.uploadAndValidate(
        selectedFile,
        targetPeriod,
        targetCompany
      );
      setValidationData(result);
      setCurrentPage(1);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Gagal menganalisis file.';
      setAnalysisError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportReport = async () => {
    if (!validationData) return;
    try {
      await validationService.exportReport(validationData.rows, validationData.summary);
    } catch (err: any) {
      alert('Gagal mengekspor laporan: ' + (err.message || 'Error'));
    }
  };

  const handleCommitToPayroll = async () => {
    if (!validationData) return;
    setIsCommitting(true);
    setCommitSuccessMessage(null);

    try {
      // Filter rows that are safe to commit (exclude duplicate within same target period and missing from SK)
      const safeRows = validationData.rows.filter(
        (r) =>
          r.status !== 'DUPLIKAT_PERIODE' &&
          r.status !== 'DUPLIKAT_FILE' &&
          r.status !== 'TIDAK_ADA_DI_SK' &&
          !r.is_missing_from_sk
      );

      const result = await validationService.commitToPayroll({
        rows: safeRows,
        target_period: targetPeriod,
        company: targetCompany,
      });

      setCommitSuccessMessage(
        `Sukses! ${result.inserted_count} data karyawan berhasil dimasukkan ke periode ${result.period}. Data lama tetap aman dan tidak terganggu.`
      );
      setShowCommitModal(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Gagal memproses data ke payroll.';
      alert('Gagal memasukkan data: ' + msg);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleQuickCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) {
      setSingleError('Nama karyawan wajib diisi.');
      return;
    }

    setIsCheckingSingle(true);
    setSingleError(null);
    setSingleResult(null);

    try {
      const res = await validationService.quickCheck({
        name: quickName.trim(),
        province: quickProvince.trim() || undefined,
        school_unit: quickSchool.trim() || undefined,
        nik: quickNik.trim() || undefined,
        company: targetCompany,
      });
      setSingleResult(res);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Gagal memeriksa data.';
      setSingleError(msg);
    } finally {
      setIsCheckingSingle(false);
    }
  };

  // Filtered rows for table
  const filteredRows = (validationData?.rows || []).filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) {
      return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchSchool = (r.school_unit || '').toLowerCase().includes(q);
      const matchProvince = (r.province || '').toLowerCase().includes(q);
      const matchNik = (r.effective_nik || '').toLowerCase().includes(q);
      return matchName || matchSchool || matchProvince || matchNik;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  return (
    <div className="space-y-6 pb-12">
      {/* ======================================================== */}
      {/* 1. HERO HEADER                                           */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-indigo-900/50">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-48 -bottom-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                AI Smart Validation Hub
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-slate-200">
                <Building2 className="w-3 h-3 text-blue-300" />
                {tenant.shortName}
              </span>
              {isValidationSubdomain() && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <ShieldCheck className="w-3 h-3" />
                  Subdomain Aktif: valid.{tenant.domainHint}
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Validasi Data Baru vs Database Lama
            </h1>
            <p className="text-slate-300 text-sm md:text-base max-w-2xl leading-relaxed">
              Pemeriksaan silang cerdas calon data SP baru terhadap riwayat database sebelum masuk sistem penggajian.
              Mendeteksi data baru, perpanjangan SP, potensi mutasi, serta memulihkan NIK yang kosong secara otomatis tanpa mengubah data lama.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => setActiveTab('bulk')}
              className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
                activeTab === 'bulk'
                  ? 'bg-indigo-600 text-white shadow-indigo-500/25 ring-2 ring-indigo-400'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Upload Spreadsheet (Bulk)
            </button>
            <button
              onClick={() => setActiveTab('single')}
              className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
                activeTab === 'single'
                  ? 'bg-indigo-600 text-white shadow-indigo-500/25 ring-2 ring-indigo-400'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15'
              }`}
            >
              <Search className="w-4 h-4" />
              Cek 1 Karyawan (Instant)
            </button>
          </div>
        </div>
      </div>

      {commitSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm font-medium">{commitSuccessMessage}</div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. TAB CONTENT: BULK SPREADSHEET VALIDATION              */}
      {/* ======================================================== */}
      {activeTab === 'bulk' && (
        <div className="space-y-6">
          {/* UPLOAD CONTROLS CARD */}
          <Card className="p-6 border border-slate-200 shadow-sm rounded-2xl bg-white">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-600" />
              Upload Dokumen SP Calon Data Baru
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Target Periode / SP
                </label>
                <select
                  value={targetPeriod}
                  onChange={(e) => setTargetPeriod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {SP_PERIOD_LIST.map((sp) => (
                    <option key={sp.code} value={sp.code}>
                      {sp.fullLabel}
                    </option>
                  ))}
                  <option value="SP 13">SP 13 (Khusus)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Untuk mendeteksi apakah data sudah ada di SP ini.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Perusahaan
                </label>
                <select
                  value={targetCompany}
                  onChange={(e) => setTargetCompany(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="rbs">PT. Rimbun Buana Sejahtera (RBS Global)</option>
                  <option value="rimamandiri">PT. Riama Mandiri Pratama</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mencocokkan dengan database arsip perusahaan terpilih.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  File Dokumen (.xlsx, .xls, .csv)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3 py-2 border border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 rounded-lg text-sm text-indigo-700 font-medium flex items-center justify-center gap-2 truncate transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="truncate">
                    {selectedFile ? selectedFile.name : 'Pilih File Excel Baru...'}
                  </span>
                </button>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mendukung format standar kolom RBS & Riama.
                </p>
              </div>
            </div>

            {/* DROPZONE AREA */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-xl cursor-pointer text-center transition-all ${
                isDragging
                  ? 'border-indigo-600 bg-indigo-50/70 scale-[0.99]'
                  : selectedFile
                  ? 'border-emerald-300 bg-emerald-50/30 hover:bg-emerald-50/50'
                  : 'border-slate-300 bg-slate-50/50 hover:bg-indigo-50/30'
              }`}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3 text-slate-800">
                  <div className="p-2.5 rounded-full bg-emerald-100 text-emerald-700">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-slate-900">{selectedFile.name}</div>
                    <div className="text-xs text-slate-500">
                      Ukuran: {(selectedFile.size / 1024).toFixed(1)} KB — Klik untuk mengganti file
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Upload className="w-8 h-8 text-indigo-500 mx-auto" />
                  <div className="text-sm font-semibold text-slate-800">
                    Tarik dan lepaskan file Excel/CSV di sini, atau klik untuk memilih
                  </div>
                  <div className="text-xs text-slate-500">
                    Maksimal 20MB. Kolom Nama, Wilayah, Sekolah Rakyat akan otomatis dipetakan.
                  </div>
                </div>
              )}
            </div>

            {analysisError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 shrink-0" />
                {analysisError}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-3">
              <Button
                variant="primary"
                onClick={handleStartAnalysis}
                disabled={!selectedFile || isAnalyzing}
                className="gap-2 px-6 py-2.5 rounded-xl shadow-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sedang Menganalisis Database...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Mulai Validasi Cerdas (AI Cross-Check)
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* ======================================================== */}
          {/* RESULTS DISPLAY                                          */}
          {/* ======================================================== */}
          {validationData && (
            <div className="space-y-6 animate-fade-in">
              {/* SUMMARY KPI CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Total Baris SK
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {validationData.summary.total_rows}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Baris spreadsheet</div>
                </div>

                <div
                  onClick={() => {
                    setStatusFilter('BARU');
                    setCurrentPage(1);
                  }}
                  className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 shadow-sm cursor-pointer hover:bg-emerald-100/60 transition-all hover:scale-[1.01]"
                >
                  <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider mb-1">
                    Data Baru (New)
                  </div>
                  <div className="text-2xl font-black text-emerald-700">
                    {validationData.summary.new_count}
                  </div>
                  <div className="text-[11px] text-emerald-600 mt-1">Belum pernah terdaftar</div>
                </div>

                <div
                  onClick={() => {
                    setStatusFilter('PERPANJANGAN_SP');
                    setCurrentPage(1);
                  }}
                  className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 shadow-sm cursor-pointer hover:bg-blue-100/60 transition-all hover:scale-[1.01]"
                >
                  <div className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider mb-1">
                    Perpanjangan SP
                  </div>
                  <div className="text-2xl font-black text-blue-700">
                    {validationData.summary.renewal_count}
                  </div>
                  <div className="text-[11px] text-blue-600 mt-1">Karyawan lama di sekolah sama</div>
                </div>

                <div
                  onClick={() => {
                    setStatusFilter('MUTASI_SEKOLAH');
                    setCurrentPage(1);
                  }}
                  className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 shadow-sm cursor-pointer hover:bg-purple-100/60 transition-all hover:scale-[1.01]"
                >
                  <div className="text-[11px] font-semibold text-purple-800 uppercase tracking-wider mb-1">
                    Potensi Mutasi
                  </div>
                  <div className="text-2xl font-black text-purple-700">
                    {validationData.summary.transfer_count}
                  </div>
                  <div className="text-[11px] text-purple-600 mt-1">Pindah unit sekolah</div>
                </div>

                <div
                  onClick={() => {
                    setStatusFilter('TIDAK_ADA_DI_SK');
                    setCurrentPage(1);
                  }}
                  className="p-4 rounded-xl bg-rose-50/80 border border-rose-200 shadow-sm cursor-pointer hover:bg-rose-100/70 transition-all hover:scale-[1.01]"
                >
                  <div className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Tidak Ada di SK</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-200 text-rose-800 font-bold">Out / Hilang</span>
                  </div>
                  <div className="text-2xl font-black text-rose-700">
                    {validationData.summary.missing_from_file_count || 0}
                  </div>
                  <div className="text-[11px] text-rose-600 mt-1">Ada di DB, tak masuk SK</div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 shadow-sm">
                  <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider mb-1">
                    NIK Dipulihkan
                  </div>
                  <div className="text-2xl font-black text-amber-700">
                    {validationData.summary.recovered_nik_count}
                  </div>
                  <div className="text-[11px] text-amber-600 mt-1">Ditemukan dari arsip SP</div>
                </div>

                <div
                  onClick={() => {
                    setStatusFilter('DUPLIKAT_PERIODE');
                    setCurrentPage(1);
                  }}
                  className="p-4 rounded-xl bg-red-50/70 border border-red-200 shadow-sm cursor-pointer hover:bg-red-100/60 transition-all hover:scale-[1.01]"
                >
                  <div className="text-[11px] font-semibold text-red-800 uppercase tracking-wider mb-1">
                    Duplikat / Review
                  </div>
                  <div className="text-2xl font-black text-red-700">
                    {validationData.summary.duplicate_count + validationData.summary.review_count}
                  </div>
                  <div className="text-[11px] text-red-600 mt-1">Perlu perhatian admin</div>
                </div>
              </div>

              {/* HEALTH SCORE BANNER */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-full bg-indigo-600 text-white font-black text-sm">
                    {validationData.summary.health_score}%
                  </div>
                  <div>
                    <div className="text-sm font-bold text-indigo-950">
                      Tingkat Kelayakan Data (Health Score)
                    </div>
                    <div className="text-xs text-indigo-800/80">
                      {validationData.summary.health_score >= 80
                        ? 'Kualitas data sangat baik. Sebagian besar data siap diproses tanpa konflik.'
                        : 'Ditemukan beberapa data ganda atau nama mirip yang memerlukan verifikasi manual.'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Button
                    variant="outline"
                    onClick={handleExportReport}
                    className="gap-2 text-xs py-2 px-3 border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Hasil (.xlsx)
                  </Button>

                  <Button
                    variant="primary"
                    onClick={() => setShowCommitModal(true)}
                    className="gap-2 text-xs py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Proses Masuk ke {targetPeriod}
                  </Button>
                </div>
              </div>

              {/* KAMUS PANDUAN ISTILAH VALIDASI UNTUK USER & MANAJEMEN */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs shadow-2xs">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-2.5">
                  <Info className="w-4 h-4 text-indigo-600" />
                  <span>Kamus Istilah & Arti Kategori Validasi Data:</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-slate-600">
                  <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1"></span>
                    <div>
                      <strong className="text-slate-900 block">Data Baru (New):</strong>
                      Ada di file SK baru, namun belum pernah terdaftar di database sistem (karyawan baru masuk).
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-1"></span>
                    <div>
                      <strong className="text-slate-900 block">Perpanjangan SP:</strong>
                      Karyawan lama di database yang tetap bertugas di unit sekolah yang sama pada SK baru (kontrak berlanjut).
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0 mt-1"></span>
                    <div>
                      <strong className="text-slate-900 block">Potensi Mutasi:</strong>
                      Karyawan lama di database yang dipindah tugaskan ke unit sekolah berbeda pada SK baru.
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-rose-50/40 p-2.5 rounded-xl border border-rose-200/70 shadow-2xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 mt-1"></span>
                    <div>
                      <strong className="text-rose-900 block">Tidak Ada di SK (Out / Ketinggalan):</strong>
                      Ada di database periode sebelumnya, namun tidak ada di file SK baru. (Indikasi: Resign/Habis Kontrak, atau terlewat saat pengetikan SK).
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 mt-1"></span>
                    <div>
                      <strong className="text-slate-900 block">NIK Dipulihkan:</strong>
                      Karyawan lama yang NIK-nya kosong di spreadsheet, berhasil dipulihkan otomatis oleh AI dari database.
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-1"></span>
                    <div>
                      <strong className="text-slate-900 block">Duplikat / Review:</strong>
                      Data ganda di file atau kemiripan nama yang membutuhkan pengecekan manual admin.
                    </div>
                  </div>
                </div>
              </div>

              {/* TABLE CARD */}
              <Card className="p-5 border border-slate-200 shadow-sm rounded-2xl bg-white">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                  {/* FILTER TABS */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold">
                    {[
                      { key: 'ALL', label: 'Semua Data', count: validationData.summary.total_rows + (validationData.summary.missing_from_file_count || 0) },
                      { key: 'BARU', label: 'Data Baru', count: validationData.summary.new_count },
                      { key: 'PERPANJANGAN_SP', label: 'Perpanjangan SP', count: validationData.summary.renewal_count },
                      { key: 'MUTASI_SEKOLAH', label: 'Mutasi Sekolah', count: validationData.summary.transfer_count },
                      { key: 'TIDAK_ADA_DI_SK', label: 'Tidak Ada di SK', count: validationData.summary.missing_from_file_count || 0 },
                      { key: 'DUPLIKAT_PERIODE', label: 'Duplikat SP', count: validationData.summary.duplicate_count },
                      { key: 'REVIEW_MIRIP', label: 'Perlu Review', count: validationData.summary.review_count },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => {
                          setStatusFilter(tab.key);
                          setCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                          statusFilter === tab.key
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {tab.label}
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                            statusFilter === tab.key
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* SEARCH BOX */}
                  <div className="relative w-full md:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Cari nama, sekolah, NIK..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* TABLE */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/75 text-slate-700 border-b border-slate-200 font-semibold">
                        <th className="py-2.5 px-3 w-12 text-center">No</th>
                        <th className="py-2.5 px-3 w-40">Status Validasi</th>
                        <th className="py-2.5 px-3">Nama Karyawan</th>
                        <th className="py-2.5 px-3">Wilayah & Sekolah</th>
                        <th className="py-2.5 px-3">NIK</th>
                        <th className="py-2.5 px-3">Riwayat SP Database</th>
                        <th className="py-2.5 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {paginatedRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                            Tidak ada data yang sesuai dengan filter.
                          </td>
                        </tr>
                      ) : (
                        paginatedRows.map((r, idx) => {
                          const globalIdx = (currentPage - 1) * rowsPerPage + idx + 1;

                          let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                          let badgeText: string = r.status;
                          if (r.status === 'BARU') {
                            badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                            badgeText = 'DATA BARU';
                          } else if (r.status === 'PERPANJANGAN_SP') {
                            badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                            badgeText = 'PERPANJANGAN SP';
                          } else if (r.status === 'MUTASI_SEKOLAH') {
                            badgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
                            badgeText = 'MUTASI';
                          } else if (r.status === 'TIDAK_ADA_DI_SK') {
                            badgeClass = 'bg-rose-100 text-rose-800 border-rose-300 font-black';
                            badgeText = 'TIDAK ADA DI SK';
                          } else if (r.status === 'DUPLIKAT_PERIODE' || r.status === 'DUPLIKAT_FILE') {
                            badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                            badgeText = 'DUPLIKAT';
                          } else if (r.status === 'REVIEW_MIRIP') {
                            badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                            badgeText = 'PERLU REVIEW';
                          }

                          return (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 text-center text-slate-500 font-mono">
                                {globalIdx}
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="space-y-1">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}
                                  >
                                    {badgeText}
                                  </span>
                                  <div className="text-[11px] text-slate-600 line-clamp-1" title={r.recommendation}>
                                    {r.recommendation}
                                  </div>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                <div>{r.name}</div>
                                {r.position && (
                                  <div className="text-[10px] text-slate-500 font-normal">
                                    {r.position}
                                  </div>
                                )}
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="font-medium text-slate-800">{r.school_unit || '-'}</div>
                                <div className="text-[10px] text-slate-500">{r.province || '-'}</div>
                              </td>

                              <td className="py-2.5 px-3">
                                {r.effective_nik ? (
                                  <div className="space-y-0.5">
                                    <div className="font-mono text-slate-800">{r.effective_nik}</div>
                                    {r.recovered_nik && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-100 text-amber-800">
                                        💡 NIK Pulih
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">NIK Kosong</span>
                                )}
                              </td>

                              <td className="py-2.5 px-3">
                                {r.history_periods && r.history_periods.length > 0 ? (
                                  <div className="space-y-0.5">
                                    <div className="flex flex-wrap gap-1">
                                      {r.history_periods.map((p, pIdx) => (
                                        <span
                                          key={pIdx}
                                          className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-mono"
                                        >
                                          {p}
                                        </span>
                                      ))}
                                    </div>
                                    {r.history_schools && r.history_schools.length > 0 && (
                                      <div className="text-[10px] text-slate-500 truncate max-w-xs" title={r.history_schools.join(', ')}>
                                        {r.history_schools.join(', ')}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">-</span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() => setSelectedRowDetail(r)}
                                  className="px-2 py-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:bg-indigo-50 rounded"
                                >
                                  Detail
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 text-xs text-slate-600">
                    <div>
                      Menampilkan baris {(currentPage - 1) * rowsPerPage + 1} -{' '}
                      {Math.min(currentPage * rowsPerPage, filteredRows.length)} dari{' '}
                      {filteredRows.length} data
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="h-8 text-xs px-2.5"
                      >
                        Sebelumnya
                      </Button>
                      <span className="px-2 py-1 font-semibold text-slate-800">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="h-8 text-xs px-2.5"
                      >
                        Berikutnya
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. TAB CONTENT: QUICK SINGLE CHECK                       */}
      {/* ======================================================== */}
      {activeTab === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* SEARCH FORM */}
          <div className="lg:col-span-5">
            <Card className="p-6 border border-slate-200 shadow-sm rounded-2xl bg-white space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base pb-2 border-b border-slate-100">
                <Search className="w-4 h-4 text-indigo-600" />
                Pemeriksaan Cepat 1 Karyawan
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Cari apakah seorang kandidat/guru pernah terdaftar di database, riwayat SP sebelumnya,
                sekolah penempatan terdahulu, serta NIK yang tersimpan.
              </p>

              <form onSubmit={handleQuickCheck} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Karyawan / Guru <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ahmad Fauzi"
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Provinsi / Wilayah (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: SULAWESI SELATAN"
                    value={quickProvince}
                    onChange={(e) => setQuickProvince(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sekolah Rakyat / Unit (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: SDN 1 MAKASSAR"
                    value={quickSchool}
                    onChange={(e) => setQuickSchool(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    NIK (Opsional jika ada)
                  </label>
                  <input
                    type="text"
                    placeholder="Kosongkan jika NIK belum ada"
                    value={quickNik}
                    onChange={(e) => setQuickNik(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {singleError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {singleError}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isCheckingSingle}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm"
                >
                  {isCheckingSingle ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Mengecek Database...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Periksa Sekarang
                    </>
                  )}
                </Button>
              </form>
            </Card>
          </div>

          {/* SINGLE RESULT VIEW */}
          <div className="lg:col-span-7">
            {singleResult ? (
              <div className="space-y-4 animate-fade-in">
                {/* CLASSIFICATION HERO */}
                <div
                  className={`p-6 rounded-2xl border shadow-sm ${
                    singleResult.classification === 'BARU'
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      : singleResult.classification === 'PERPANJANGAN_SP'
                      ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                      : singleResult.classification === 'MUTASI_SEKOLAH'
                      ? 'bg-purple-50/80 border-purple-200 text-purple-950'
                      : 'bg-amber-50/80 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase border ${
                        singleResult.classification === 'BARU'
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : singleResult.classification === 'PERPANJANGAN_SP'
                          ? 'bg-blue-600 text-white border-blue-700'
                          : singleResult.classification === 'MUTASI_SEKOLAH'
                          ? 'bg-purple-600 text-white border-purple-700'
                          : 'bg-amber-600 text-white border-amber-700'
                      }`}
                    >
                      {singleResult.classification === 'BARU'
                        ? 'DATA BARU'
                        : singleResult.classification === 'PERPANJANGAN_SP'
                        ? 'KARYAWAN EKSISTING (PERPANJANGAN SP)'
                        : singleResult.classification === 'MUTASI_SEKOLAH'
                        ? 'POTENSI MUTASI SEKOLAH'
                        : 'PERLU REVIEW / MIRIP'}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold mb-1">{singleResult.input.name}</h3>
                  <p className="text-sm leading-relaxed mb-4">{singleResult.recommendation}</p>

                  {singleResult.recovered_nik && (
                    <div className="p-3 rounded-xl bg-white/80 border border-slate-200 text-slate-800 text-xs flex items-center justify-between">
                      <span className="font-semibold text-slate-600">NIK Ditemukan dari Database:</span>
                      <span className="font-mono font-bold text-slate-900 bg-amber-100 px-2 py-0.5 rounded">
                        {singleResult.recovered_nik}
                      </span>
                    </div>
                  )}
                </div>

                {/* EXACT MATCHES DETAILS */}
                {singleResult.exact_payrolls.length > 0 && (
                  <Card className="p-5 border border-slate-200 shadow-sm rounded-2xl bg-white">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                      <Database className="w-4 h-4 text-indigo-600" />
                      Riwayat Slip Gaji / SP di Database ({singleResult.exact_payrolls.length} Catatan)
                    </h4>

                    <div className="space-y-2">
                      {singleResult.exact_payrolls.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">
                              {p.employee_name} ({p.period})
                            </div>
                            <div className="text-slate-500 text-[11px]">
                              {p.school_unit || '-'} • {p.province || '-'} • Posisi: {p.position || '-'}
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.status === 'off'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {p.status === 'off' ? 'STATUS OFF' : 'AKTIF'}
                            </span>
                            <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                              NIK: {p.nik || '-'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* SIMILAR NAMES */}
                {singleResult.similar_payrolls.length > 0 && (
                  <Card className="p-5 border border-slate-200 shadow-sm rounded-2xl bg-white">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-600" />
                      Nama Serupa Terdeteksi ({singleResult.similar_payrolls.length} Nama)
                    </h4>

                    <div className="space-y-2">
                      {singleResult.similar_payrolls.map((sim, sIdx) => (
                        <div
                          key={sIdx}
                          className="p-3 rounded-xl bg-amber-50/50 border border-amber-200 text-xs flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">
                              {sim.payroll.employee_name}
                            </div>
                            <div className="text-slate-500 text-[11px]">
                              {sim.payroll.school_unit} ({sim.payroll.period})
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold text-[10px]">
                            {sim.similarity}% Mirip
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* USER ACCOUNTS */}
                {singleResult.user_accounts.length > 0 && (
                  <Card className="p-5 border border-slate-200 shadow-sm rounded-2xl bg-white">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Akun Login / Presensi Terdaftar
                    </h4>

                    <div className="space-y-2">
                      {singleResult.user_accounts.map((u) => (
                        <div
                          key={u.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{u.name}</div>
                            <div className="text-slate-500 text-[11px]">
                              Role: {u.role} • Unit: {u.school_unit || '-'}
                            </div>
                          </div>
                          <div className="font-mono text-slate-700 text-right">
                            NIK: {u.nik || '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="p-12 border border-slate-200 shadow-sm rounded-2xl bg-white text-center flex flex-col items-center justify-center min-h-[380px]">
                <div className="p-4 rounded-full bg-indigo-50 text-indigo-600 mb-3">
                  <Search className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-slate-800 mb-1">
                  Belum Ada Pencarian Dilakukan
                </h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  Masukkan nama personil atau guru pada formulir di sebelah kiri untuk melihat riwayat database secara instan.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. COMMIT TO PAYROLL CONFIRMATION MODAL                  */}
      {/* ======================================================== */}
      {showCommitModal && validationData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="p-2.5 rounded-full bg-emerald-100 text-emerald-700">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Konfirmasi Input ke Payroll
                </h3>
                <p className="text-xs text-slate-500">
                  Data yang aman akan dimasukkan ke periode {targetPeriod}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2 text-slate-700">
              <div className="flex justify-between">
                <span>Target Periode:</span>
                <span className="font-bold text-slate-900">{targetPeriod}</span>
              </div>
              <div className="flex justify-between">
                <span>Target Perusahaan:</span>
                <span className="font-bold text-slate-900">
                  {targetCompany === 'rimamandiri' ? 'Riama Mandiri' : 'RBS Global'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Data Siap Input:</span>
                <span className="font-bold text-emerald-700">
                  {validationData.summary.new_count +
                    validationData.summary.renewal_count +
                    validationData.summary.transfer_count}{' '}
                  Orang
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Data Dilewati (Duplikat):</span>
                <span>{validationData.summary.duplicate_count} Orang</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[11px] leading-relaxed">
              <ShieldCheck className="w-4 h-4 inline mr-1 text-blue-600" />
              <strong>Garansi Keamanan Data:</strong> Proses ini hanya akan menambahkan data sebagai draft baru di periode {targetPeriod}. Data SP sebelumnya (SP 1 - SP 8) tidak akan diubah atau dihapus.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCommitModal(false)}
                disabled={isCommitting}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCommitToPayroll}
                disabled={isCommitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isCommitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Sedang Memproses...
                  </>
                ) : (
                  'Ya, Proses Sekarang'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. ROW DETAIL MODAL                                      */}
      {/* ======================================================== */}
      {selectedRowDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border mb-1 ${
                    selectedRowDetail.status === 'BARU'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : selectedRowDetail.status === 'PERPANJANGAN_SP'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : selectedRowDetail.status === 'MUTASI_SEKOLAH'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : selectedRowDetail.status === 'TIDAK_ADA_DI_SK'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {selectedRowDetail.status}
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedRowDetail.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRowDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2 text-slate-700">
              <div className="font-semibold text-slate-900 mb-1">Rekomendasi AI:</div>
              <div className="text-slate-600 leading-relaxed">
                {selectedRowDetail.recommendation}
              </div>

              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400">Sekolah Baru:</span>
                  <div className="font-semibold text-slate-800">
                    {selectedRowDetail.school_unit || '-'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Wilayah / Provinsi:</span>
                  <div className="font-semibold text-slate-800">
                    {selectedRowDetail.province || '-'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">NIK File:</span>
                  <div className="font-mono text-slate-800">
                    {selectedRowDetail.nik || '-'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">NIK Dipulihkan (Arsip):</span>
                  <div className="font-mono font-bold text-amber-700">
                    {selectedRowDetail.recovered_nik || '-'}
                  </div>
                </div>
              </div>
            </div>

            {selectedRowDetail.history_periods && selectedRowDetail.history_periods.length > 0 && (
              <div className="text-xs space-y-1">
                <span className="font-semibold text-slate-700">
                  Riwayat Surat Pesanan Sebelumnya:
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedRowDetail.history_periods.map((hp, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[11px]"
                    >
                      {hp}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRowDetail(null)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
