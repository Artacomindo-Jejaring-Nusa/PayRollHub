import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { payrollService } from '../services/payrollService';
import {
  PayrollImportPreviewData,
  PayrollImportResult,
} from '../../../types/payroll';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  Calendar,
  X,
  Info,
  ChevronDown,
  ChevronUp,
  UserCheck,
  UserX,
  Coins,
  RefreshCw,
  FileText,
  Check,
  ExternalLink,
  Eye,
  FileUp,
  Building2,
} from 'lucide-react';
import { SP_PERIOD_LIST } from '../../../lib/period';
import { useTenantTheme } from '../../../lib/theme';

export const PayrollImportPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { tenant } = useTenantTheme();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importPeriod, setImportPeriod] = useState('SP 1');
  const [importCompany, setImportCompany] = useState<string>(tenant.id);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState<'xlsx' | 'csv' | null>(null);

  const [previewData, setPreviewData] = useState<PayrollImportPreviewData | null>(null);
  const [importResult, setImportResult] = useState<PayrollImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'new' | 'update' | 'duplicate'>('all');
  const [showUpdatedDetails, setShowUpdatedDetails] = useState(false);
  const [showDuplicateDetails, setShowDuplicateDetails] = useState(true);
  const [previewPage, setPreviewPage] = useState(1);
  const rowsPerPage = 8;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = async (file: File) => {
    setErrorMessage(null);
    setImportResult(null);
    setPreviewData(null);
    setPreviewPage(1);
    setPreviewFilter('all');

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      setErrorMessage(
        'Format file tidak valid. Harap pilih file berekstensi Excel (.xlsx, .xls) atau CSV (.csv).'
      );
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Ukuran file melebihi batas maksimal 10MB.');
      return;
    }

    setSelectedFile(file);
    await fetchPreview(file, importPeriod, importCompany);
  };

  const fetchPreview = async (file: File, period: string, company: string = importCompany) => {
    setIsPreviewLoading(true);
    setErrorMessage(null);

    try {
      const data = await payrollService.previewImport(file, period, company);
      setPreviewData(data);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Gagal membaca file spreadsheet. Pastikan susunan kolom header sesuai dengan template.';
      setErrorMessage(msg);
      setPreviewData(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handlePeriodChange = async (newPeriod: string) => {
    setImportPeriod(newPeriod);
    setPreviewFilter('all');
    setPreviewPage(1);
    if (selectedFile) {
      await fetchPreview(selectedFile, newPeriod, importCompany);
    }
  };

  const handleCompanyChange = async (newCompany: string) => {
    setImportCompany(newCompany);
    setPreviewFilter('all');
    setPreviewPage(1);
    if (selectedFile) {
      await fetchPreview(selectedFile, importPeriod, newCompany);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadTemplate = async (format: 'xlsx' | 'csv') => {
    try {
      setIsDownloadingTemplate(format);
      await payrollService.downloadTemplate(format);
    } catch (err) {
      console.error('Failed to download template', err);
      alert('Gagal mengunduh template. Silakan coba lagi.');
    } finally {
      setIsDownloadingTemplate(null);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setErrorMessage(null);

    try {
      const result = await payrollService.importFile(selectedFile, importPeriod, importCompany);
      setImportResult(result);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Gagal menyimpan data import ke database. Silakan periksa kembali file Anda.';
      setErrorMessage(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const formatRupiah = (val: number) => {
    return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
  };

  // Duplicate and Update metrics
  const previewTotal = previewData?.total_rows || 0;
  const previewUpdates = previewData?.updated_count ?? previewData?.rows.filter((r) => r.is_update).length ?? 0;
  const previewNews = previewData ? previewData.rows.filter((r) => !r.is_update).length : 0;
  const previewDupAccounts = previewData?.duplicate_account_count ?? previewData?.rows.filter((r) => r.is_duplicate_bank_account).length ?? 0;
  const previewDupNiks = previewData?.duplicate_nik_count ?? previewData?.rows.filter((r) => r.is_duplicate_nik).length ?? 0;
  const previewDuplicates = previewData ? previewData.rows.filter((r) => r.is_duplicate_bank_account || r.is_duplicate_nik).length : 0;

  // Filtered rows for preview
  const filteredRows = React.useMemo(() => {
    if (!previewData) return [];
    if (previewFilter === 'new') {
      return previewData.rows.filter((r) => !r.is_update);
    }
    if (previewFilter === 'update') {
      return previewData.rows.filter((r) => r.is_update);
    }
    if (previewFilter === 'duplicate') {
      return previewData.rows.filter((r) => r.is_duplicate_bank_account || r.is_duplicate_nik);
    }
    return previewData.rows;
  }, [previewData, previewFilter]);

  const totalFilteredRows = filteredRows.length;
  const totalPages = Math.ceil(totalFilteredRows / rowsPerPage) || 1;
  const paginatedRows = filteredRows.slice((previewPage - 1) * rowsPerPage, previewPage * rowsPerPage);

  const handleFilterChange = (filter: 'all' | 'new' | 'update' | 'duplicate') => {
    setPreviewFilter(filter);
    setPreviewPage(1);
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border-subtle">
        <div className="flex items-center space-x-3">
          <Link
            to="/payrolls"
            className="p-2.5 rounded-xl border border-border-subtle bg-surface-panel hover:bg-surface-container text-text-muted hover:text-text-primary transition-colors shadow-xs"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-headline-page text-headline-page text-text-primary tracking-tight">
              Import Data Gaji Massal (Bulk)
            </h1>
            <p className="font-body-default text-body-default text-text-muted">
              Unggah file spreadsheet di sisi kiri, dan pantau hasil verifikasi data secara langsung di sisi kanan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGuide(!showGuide)}
            leftIcon={<Info className="w-4 h-4 text-primary" />}
            rightIcon={
              showGuide ? (
                <ChevronUp className="w-4 h-4 text-text-muted" />
              ) : (
                <ChevronDown className="w-4 h-4 text-text-muted" />
              )
            }
          >
            {showGuide ? 'Tutup Panduan Kolom' : 'Lihat Panduan 22 Kolom'}
          </Button>
        </div>
      </div>

      {/* Guide Accordion (Muncul saat tombol panduan diklik) */}
      {showGuide && (
        <Card className="p-6 border-blue-200 bg-surface-panel shadow-sm space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                i
              </div>
              <div>
                <h3 className="font-title-card text-[15px] font-bold text-text-primary">
                  Petunjuk & Aturan Pengisian Spreadsheet (22 Kolom)
                </h3>
                <p className="text-[12px] text-text-muted">
                  Sheet "PETUNJUK_PENGISIAN" pada file Excel hanya sebagai referensi dan <span className="text-emerald-700 font-semibold">TIDAK AKAN MASUK KE DATABASE</span>.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Key Rule Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-1">
              <div className="text-[12px] font-bold text-blue-900 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-blue-700" />
                1. Rumus Take Home Pay (THP)
              </div>
              <p className="text-[11.5px] text-blue-800 leading-relaxed">
                <span className="font-semibold">THP = Gaji Pokok + BPJS KES - BPJS TK - Potongan Absensi - Potongan Lain</span>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1">
              <div className="text-[12px] font-bold text-amber-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-700" />
                2. Potongan Absensi
              </div>
              <p className="text-[11.5px] text-amber-800 leading-relaxed">
                Nominal potongan absensi (hari x tarif harian). Rincian penjelasan ditulis di kolom <span className="font-semibold">Keterangan Absensi</span>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/80 space-y-1">
              <div className="text-[12px] font-bold text-rose-900 flex items-center gap-1.5">
                <UserX className="w-4 h-4 text-rose-700" />
                3. Status Off & Tgl Keluar
              </div>
              <p className="text-[11.5px] text-rose-800 leading-relaxed">
                Bila pegawai keluar, isi <span className="font-semibold">STATUS</span> = "Off" dan isi <span className="font-semibold">Tgl Keluar</span>. Otomatis masuk metrik report off.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
              <div className="text-[12px] font-bold text-emerald-900 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-700" />
                4. Awalan Petik (') NIK
              </div>
              <p className="text-[11.5px] text-emerald-800 leading-relaxed">
                Beri tanda petik satu (') di depan <span className="font-semibold">NIK & No Rekening</span> agar angka 16 digit tidak rusak di Excel.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* 2-COLUMN SPLIT LAYOUT (IMPORT FORM DI KIRI, PRIVIEW DI KANAN) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ============================================================ */}
        {/* KOTAK KIRI: IMPORT FORM                                     */}
        {/* ============================================================ */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="p-6 border-slate-200/90 shadow-sm space-y-5 bg-surface-panel">
            {/* Box Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <FileUp className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-title-card text-[16px] font-bold text-text-primary uppercase tracking-wide">
                    IMPORT FORM
                  </h2>
                  <p className="text-[12px] text-text-muted">
                    Masukkan file spreadsheet untuk proses bulk import
                  </p>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium text-[11px] border border-blue-200">
                Langkah 1
              </span>
            </div>

            {/* Template Download Shortcut */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[12.5px] text-slate-800 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                  Format Template Resmi
                </span>
                <span className="text-[11px] text-text-muted">2 Sheet (Data + Panduan)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={isDownloadingTemplate === 'xlsx'}
                  onClick={() => handleDownloadTemplate('xlsx')}
                  leftIcon={<Download className="w-3.5 h-3.5 text-primary" />}
                  className="bg-white hover:bg-slate-100 text-[11.5px] h-8 justify-center"
                >
                  Excel (.xlsx)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={isDownloadingTemplate === 'csv'}
                  onClick={() => handleDownloadTemplate('csv')}
                  leftIcon={<FileText className="w-3.5 h-3.5 text-slate-600" />}
                  className="bg-white hover:bg-slate-100 text-[11.5px] h-8 justify-center"
                >
                  CSV (.csv)
                </Button>
              </div>
            </div>

            {/* Company / Entity Selector */}
            <div className="space-y-1.5">
              <label className="font-semibold text-[13px] text-text-primary flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-primary" />
                  Target Entitas Perusahaan
                </span>
                <span className="text-[11px] font-normal text-text-muted">
                  Aktif: {tenant.name.split('(')[0].trim()}
                </span>
              </label>
              <select
                value={importCompany}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="w-full h-10 px-3.5 bg-surface-container-low rounded-xl border border-border-subtle text-[13.5px] font-medium text-text-primary outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-xs cursor-pointer"
              >
                <option value="rimamandiri">PT. Riama Mandiri Pratama (Riama)</option>
                <option value="rbs">PT. Rimbun Buana Sejahtera (RBS)</option>
              </select>
              <p className="text-[11.5px] text-text-muted">
                Data yang diimpor akan langsung tersimpan di bawah entitas ini.
              </p>
            </div>

            {/* Period Input */}
            <div className="space-y-1.5">
              <label className="font-semibold text-[13px] text-text-primary flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-primary" />
                  Target Surat Pesanan (SP) / Periode
                </span>
                <span className="text-[11px] font-normal text-text-muted">Kontrak Kemensos</span>
              </label>
              <select
                value={importPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="w-full h-10 px-3.5 bg-surface-container-low rounded-xl border border-border-subtle text-[13.5px] font-medium text-text-primary outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-xs cursor-pointer"
              >
                {SP_PERIOD_LIST.map((sp) => (
                  <option key={sp.code} value={sp.code}>
                    {sp.fullLabel}
                  </option>
                ))}
              </select>
              <p className="text-[11.5px] text-text-muted">
                Baris data tanpa kolom periode otomatis diset ke Surat Pesanan (SP) ini.
              </p>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-2.5 ${
                isDragOver
                  ? 'border-primary bg-primary-fixed/20 scale-[0.99]'
                  : 'border-slate-300 hover:border-primary hover:bg-slate-50/70'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-xl bg-blue-50 text-primary flex items-center justify-center shadow-inner">
                <Upload className="w-6 h-6" />
              </div>

              <div className="space-y-0.5">
                <p className="font-semibold text-[14px] text-text-primary">
                  Tarik & letakkan file ke sini
                </p>
                <p className="text-[12px] text-text-muted">
                  atau <span className="text-primary font-semibold underline underline-offset-2">pilih dari perangkat</span>
                </p>
              </div>

              <div className="text-[11px] text-text-muted">
                Mendukung .xlsx, .xls, .csv (Maks. 10 MB)
              </div>
            </div>

            {/* Selected File Card */}
            {selectedFile && (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-low border border-border-subtle shadow-xs">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <FileSpreadsheet className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-text-primary text-[13px] truncate">
                      {selectedFile.name}
                    </div>
                    <div className="text-[11.5px] text-text-muted">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Siap dianalisis
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchPreview(selectedFile, importPeriod)}
                    isLoading={isPreviewLoading}
                    leftIcon={<RefreshCw className="w-3.5 h-3.5 text-text-muted" />}
                    className="h-8 px-2.5 text-[11px]"
                  >
                    Refresh
                  </Button>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewData(null);
                    }}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-slate-200"
                    title="Hapus pilihan"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-status-danger-text text-[12.5px] flex items-start gap-2.5">
                <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
                <div className="font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Action Buttons in Left Form */}
            <div className="pt-2 flex items-center justify-between gap-3 border-t border-border-subtle">
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewData(null);
                  setErrorMessage(null);
                }}
                disabled={!selectedFile || isImporting}
              >
                Reset
              </Button>

              <Button
                variant="primary"
                size="md"
                disabled={!selectedFile || !previewData || isImporting || isPreviewLoading}
                isLoading={isImporting}
                onClick={handleConfirmImport}
                leftIcon={<Upload className="w-4 h-4" />}
                className="font-semibold flex-1 justify-center shadow-xs"
              >
                Mulai Import Data
              </Button>
            </div>
          </Card>
        </div>

        {/* ============================================================ */}
        {/* KOTAK KANAN: PRIVIEW                                         */}
        {/* ============================================================ */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="p-6 border-slate-200/90 shadow-sm space-y-5 bg-surface-panel min-h-[580px] flex flex-col justify-between">
            {/* Box Header */}
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-title-card text-[16px] font-bold text-text-primary uppercase tracking-wide">
                      PRIVIEW
                    </h2>
                    <p className="text-[12px] text-text-muted">
                      Pratinjau data dan validasi sebelum disimpan ke database
                    </p>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium text-[11px] border border-emerald-200">
                  Langkah 2
                </span>
              </div>

              {/* KONDISI 1: Belum ada file yang dipilih (Empty State) */}
              {!selectedFile && !previewData && !isPreviewLoading && (
                <div className="py-20 px-6 text-center space-y-3.5 my-auto">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                    <FileSpreadsheet className="w-8 h-8" />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="font-semibold text-text-primary text-[15px]">
                      Belum Ada File yang Dipilih
                    </h3>
                    <p className="text-[12.5px] text-text-muted leading-relaxed">
                      Silakan pilih atau tarik file Excel / CSV di formulir <span className="font-semibold text-text-primary">IMPORT FORM</span> (sebelah kiri) untuk melihat pratinjau data secara langsung.
                    </p>
                  </div>
                </div>
              )}

              {/* KONDISI 2: Sedang membaca & memvalidasi file (Loading State) */}
              {isPreviewLoading && (
                <div className="py-20 px-6 text-center space-y-3.5 my-auto">
                  <div className="inline-block animate-spin rounded-full h-9 w-9 border-3 border-primary border-t-transparent"></div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="font-semibold text-text-primary text-[15px]">
                      Membaca & Memvalidasi File...
                    </h3>
                    <p className="text-[12.5px] text-text-muted leading-relaxed">
                      Sistem sedang menghitung Gaji Pokok, BPJS, potongan absensi, dan memverifikasi baris data spreadsheet.
                    </p>
                  </div>
                </div>
              )}

              {/* KONDISI 3: Preview Data Siap (Preview Ready) */}
              {previewData && !isPreviewLoading && (
                <div className="space-y-4 pt-4">
                  {/* KPI Summary Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div
                      onClick={() => handleFilterChange('all')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        previewFilter === 'all'
                          ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-300'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                      }`}
                    >
                      <span className="text-[11px] font-semibold text-slate-600 block uppercase">
                        Total Baris
                      </span>
                      <span className="font-mono text-[18px] font-bold text-slate-800">
                        {previewTotal} Data
                      </span>
                      <span className="text-[10.5px] text-slate-500 block mt-0.5">Semua data spreadsheet</span>
                    </div>

                    <div
                      onClick={() => handleFilterChange('new')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        previewFilter === 'new'
                          ? 'bg-emerald-100/80 border-emerald-400 ring-2 ring-emerald-300'
                          : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100/50'
                      }`}
                    >
                      <span className="text-[11px] font-semibold text-emerald-700 block uppercase">
                        + Data Baru
                      </span>
                      <span className="font-mono text-[18px] font-bold text-emerald-700">
                        {previewNews} Data
                      </span>
                      <span className="text-[10.5px] text-emerald-600 block mt-0.5">Karyawan baru di SP ini</span>
                    </div>

                    <div
                      onClick={() => handleFilterChange('update')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        previewFilter === 'update'
                          ? 'bg-blue-100/80 border-blue-400 ring-2 ring-blue-300'
                          : 'bg-blue-50 border-blue-200 hover:bg-blue-100/50'
                      }`}
                    >
                      <span className="text-[11px] font-semibold text-blue-700 block uppercase flex items-center justify-between">
                        <span>🔄 Diperbarui</span>
                        {previewUpdates > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-200 text-blue-800">
                            {previewUpdates}
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[18px] font-bold text-blue-800">
                        {previewUpdates} Data
                      </span>
                      <span className="text-[10.5px] text-blue-600 block mt-0.5">Menimpa data cocok</span>
                    </div>

                    <div
                      onClick={() => handleFilterChange('duplicate')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        previewFilter === 'duplicate'
                          ? 'bg-amber-100/80 border-amber-400 ring-2 ring-amber-300'
                          : previewDuplicates > 0
                          ? 'bg-amber-50 border-amber-300 hover:bg-amber-100/50'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100/50'
                      }`}
                    >
                      <span className="text-[11px] font-semibold text-amber-800 block uppercase flex items-center justify-between">
                        <span>⚠️ Duplikat / Kembar</span>
                        {previewDuplicates > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-200 text-amber-900">
                            {previewDuplicates}
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[18px] font-bold text-amber-800">
                        {previewDuplicates} Baris
                      </span>
                      <span className="text-[10.5px] text-amber-700 block mt-0.5">
                        {previewDupAccounts} Rek / {previewDupNiks} NIK
                      </span>
                    </div>
                  </div>

                  {/* Quick Filter Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5 overflow-x-auto text-[11.5px]">
                      <button
                        onClick={() => handleFilterChange('all')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                          previewFilter === 'all'
                            ? 'bg-slate-800 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Semua ({previewTotal})
                      </button>

                      <button
                        onClick={() => handleFilterChange('new')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                          previewFilter === 'new'
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        }`}
                      >
                        + Data Baru ({previewNews})
                      </button>

                      <button
                        onClick={() => handleFilterChange('update')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                          previewFilter === 'update'
                            ? 'bg-blue-700 text-white shadow-xs'
                            : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                        }`}
                      >
                        🔄 Akan Di-Update ({previewUpdates})
                      </button>

                      <button
                        onClick={() => handleFilterChange('duplicate')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                          previewFilter === 'duplicate'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : previewDuplicates > 0
                            ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Duplikat ({previewDuplicates})
                      </button>
                    </div>

                    <div className="text-[11.5px] font-mono text-text-muted">
                      Est. THP: <span className="font-bold text-slate-800">{formatRupiah(previewData.total_estimated_thp)}</span>
                    </div>
                  </div>

                  {/* Warning banner if duplicate exists */}
                  {previewDuplicates > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-[11.5px] text-amber-900 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-bold text-amber-950">
                          Perhatian Potensi Duplikasi:
                        </span>
                        <p className="text-amber-800 leading-relaxed">
                          Terdeteksi{' '}
                          <strong className="text-amber-950 font-semibold">{previewDupAccounts} nomor rekening kembar</strong> (digunakan lebih dari 1 karyawan), dan{' '}
                          <strong className="text-amber-950 font-semibold">{previewDupNiks} NIK kembar / bentrok</strong>. Data berpotensi menimpa data sebelumnya atau tertukar saat pembayaran payroll. Klik tab{' '}
                          <button
                            onClick={() => handleFilterChange('duplicate')}
                            className="underline font-bold text-amber-900 hover:text-amber-950"
                          >
                            "Duplikat"
                          </button>{' '}
                          untuk memeriksa rincian baris terkait.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Warnings if any */}
                  {previewData.warnings && previewData.warnings.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-[11.5px] text-amber-800 space-y-1">
                      <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        Catatan Pemeriksaan ({previewData.warnings.length} catatan):
                      </div>
                      <div className="max-h-20 overflow-y-auto pl-5 list-disc space-y-0.5">
                        {previewData.warnings.slice(0, 4).map((w, i) => (
                          <div key={i}>• {w}</div>
                        ))}
                        {previewData.warnings.length > 4 && (
                          <div className="italic">...dan {previewData.warnings.length - 4} catatan lainnya.</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Table Container */}
                  <div className="border border-border-subtle rounded-xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto max-h-[360px]">
                      <table className="w-full text-left text-[11.5px]">
                        <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-border-subtle sticky top-0 whitespace-nowrap z-10">
                          <tr>
                            <th className="px-2.5 py-2 w-10 text-center">No</th>
                            <th className="px-2.5 py-2 w-20">Status</th>
                            <th className="px-2.5 py-2 w-24">Aksi / Hasil</th>
                            <th className="px-2.5 py-2 font-mono">NIK</th>
                            <th className="px-2.5 py-2">Nama Pegawai</th>
                            <th className="px-2.5 py-2">Wilayah</th>
                            <th className="px-2.5 py-2">Sekolah / Unit</th>
                            <th className="px-2.5 py-2">Jabatan</th>
                            <th className="px-2.5 py-2 text-right font-mono">Gaji Pokok</th>
                            <th className="px-2.5 py-2 text-right font-mono text-rose-600">Pot. Absen</th>
                            <th className="px-2.5 py-2 text-right font-mono font-bold text-emerald-700">Take Home Pay</th>
                            <th className="px-2.5 py-2">Rekening</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle text-text-primary whitespace-nowrap">
                          {paginatedRows.length === 0 ? (
                            <tr>
                              <td colSpan={12} className="px-4 py-8 text-center text-text-muted">
                                Tidak ada data pada filter "{previewFilter === 'new' ? 'Data Baru' : previewFilter === 'update' ? 'Akan Diperbarui' : previewFilter === 'duplicate' ? 'Duplikat' : 'Semua'}".
                              </td>
                            </tr>
                          ) : (
                            paginatedRows.map((row, idx) => (
                              <tr
                                key={idx}
                                className={
                                  row.is_duplicate_bank_account || row.is_duplicate_nik
                                    ? 'bg-amber-50/60 hover:bg-amber-100/60'
                                    : row.is_update
                                    ? 'bg-blue-50/40 hover:bg-blue-100/40'
                                    : row.status === 'off'
                                    ? 'bg-rose-50/50 hover:bg-rose-50/80'
                                    : idx % 2 === 0
                                    ? 'bg-white hover:bg-slate-50/80'
                                    : 'bg-slate-50/30 hover:bg-slate-50/80'
                                }
                              >
                                <td className="px-2.5 py-2 text-center text-text-muted font-mono">
                                  {row.row_no || (previewPage - 1) * rowsPerPage + idx + 1}
                                </td>

                                {/* Status */}
                                <td className="px-2.5 py-2">
                                  {row.status === 'off' ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-rose-100 text-rose-800">
                                      Off {row.resign_date ? `(${row.resign_date})` : ''}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-emerald-100 text-emerald-800">
                                      Aktif
                                    </span>
                                  )}
                                </td>

                                {/* Action / Update detection */}
                                <td className="px-2.5 py-2">
                                  {row.is_update ? (
                                    <div className="space-y-0.5">
                                      <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 cursor-help"
                                        title={row.match_reason || 'Data diperbarui'}
                                      >
                                        <RefreshCw className="w-2.5 h-2.5 text-blue-700" />
                                        Update
                                      </span>
                                      <div
                                        className="text-[9.5px] text-blue-700 max-w-[120px] truncate"
                                        title={row.match_reason || ''}
                                      >
                                        {row.match_reason?.includes('database') ? 'Di database' : 'Ganda di file'}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                                      + Baru
                                    </span>
                                  )}
                                </td>

                                {/* NIK */}
                                <td className="px-2.5 py-2 font-mono">
                                  {row.is_duplicate_nik ? (
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1">
                                        <span className="text-amber-950 font-bold">{row.nik}</span>
                                        <span
                                          className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-amber-200 text-amber-900 cursor-help"
                                          title={row.duplicate_nik_info || 'NIK ganda'}
                                        >
                                          Ganda
                                        </span>
                                      </div>
                                      <div
                                        className="text-[9px] text-amber-700 max-w-[140px] truncate"
                                        title={row.duplicate_nik_info || ''}
                                      >
                                        {row.duplicate_nik_info}
                                      </div>
                                    </div>
                                  ) : row.nik ? (
                                    <span className="text-text-muted">{row.nik}</span>
                                  ) : (
                                    <span className="text-amber-600 italic">Kosong</span>
                                  )}
                                </td>

                                <td className="px-2.5 py-2 font-semibold text-text-primary">
                                  {row.employee_name}
                                </td>

                                <td className="px-2.5 py-2">{row.province}</td>
                                <td className="px-2.5 py-2 text-text-muted">{row.school_unit || '-'}</td>
                                <td className="px-2.5 py-2 text-text-muted">{row.position || '-'}</td>

                                {/* Gaji Pokok */}
                                <td className="px-2.5 py-2 text-right font-mono font-medium text-primary">
                                  {formatRupiah(row.basic_salary)}
                                </td>

                                {/* Potongan Absensi */}
                                <td className="px-2.5 py-2 text-right font-mono">
                                  {row.absence_deduction > 0 ? (
                                    <span className="text-rose-600 font-semibold" title={row.absence_note || ''}>
                                      -{formatRupiah(row.absence_deduction)}
                                    </span>
                                  ) : (
                                    <span className="text-text-muted">0</span>
                                  )}
                                </td>

                                {/* THP */}
                                <td className="px-2.5 py-2 text-right font-mono font-bold text-emerald-700">
                                  {formatRupiah(row.take_home_pay)}
                                </td>

                                {/* Rekening Bank */}
                                <td className="px-2.5 py-2 font-mono">
                                  {row.is_duplicate_bank_account ? (
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1">
                                        <span className="text-amber-950 font-bold">
                                          {row.bank_name ? `${row.bank_name} ` : ''}
                                          {row.bank_account}
                                        </span>
                                        <span
                                          className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-amber-200 text-amber-900 cursor-help"
                                          title={row.duplicate_bank_account_info || 'Rekening kembar'}
                                        >
                                          Kembar
                                        </span>
                                      </div>
                                      <div
                                        className="text-[9px] text-amber-700 max-w-[160px] truncate"
                                        title={row.duplicate_bank_account_info || ''}
                                      >
                                        {row.duplicate_bank_account_info}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-text-muted">
                                      {row.bank_name ? `${row.bank_name} ` : ''}
                                      {row.bank_account || '-'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-border-subtle text-[11px] text-text-muted">
                        <div>
                          Menampilkan {filteredRows.length > 0 ? (previewPage - 1) * rowsPerPage + 1 : 0} -{' '}
                          {Math.min(previewPage * rowsPerPage, totalFilteredRows)} dari {totalFilteredRows} baris
                          {previewFilter !== 'all' && (
                            <span className="ml-1 text-primary font-medium">
                              (Filter: {previewFilter === 'new' ? 'Data Baru' : previewFilter === 'update' ? 'Akan Diperbarui' : 'Duplikat'})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            disabled={previewPage === 1}
                            onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                            className="px-2 py-0.5 rounded border border-border-subtle bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                          >
                            Prev
                          </button>
                          <span className="px-1.5 font-mono">
                            {previewPage} / {totalPages}
                          </span>
                          <button
                            disabled={previewPage === totalPages}
                            onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                            className="px-2 py-0.5 rounded border border-border-subtle bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Confirmation Bar */}
            {previewData && (
              <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-[12px] text-text-muted">
                  Data telah divalidasi. Klik konfirmasi untuk menyimpan secara permanen.
                </div>

                <Button
                  variant="primary"
                  size="md"
                  isLoading={isImporting}
                  onClick={handleConfirmImport}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  className="font-semibold shadow-xs"
                >
                  Konfirmasi & Simpan ke Database ({previewData.total_rows} Data)
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* IMPORT RESULT SUCCESS MODAL / CARD */}
      {importResult && (
        <Card className="p-6 sm:p-8 space-y-6 border-emerald-300 bg-white shadow-md animate-in fade-in duration-200">
          <div className="flex items-center gap-3.5 text-status-success-text">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-7 h-7 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-title-card text-[20px] font-bold text-text-primary">
                Import Data Gaji Berhasil
              </h3>
              <p className="text-[13px] text-text-muted">
                Total <span className="font-semibold text-emerald-700">{(importResult.imported_count || 0) + (importResult.updated_count || 0)} data karyawan</span> telah diproses dan berhasil tersimpan ke dalam database.
              </p>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 shadow-xs">
              <span className="text-[12px] font-bold text-emerald-900 uppercase block tracking-wider">
                Total Disimpan
              </span>
              <span className="font-display-kpi text-[26px] font-bold text-emerald-800 font-mono">
                {(importResult.imported_count || 0) + (importResult.updated_count || 0)} Data
              </span>
              <span className="text-[11px] text-emerald-700 block mt-0.5">
                100% masuk ke database
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[12px] font-medium text-slate-700 uppercase block">
                Data Baru Ditambahkan
              </span>
              <span className="font-display-kpi text-[26px] font-bold text-slate-800 font-mono">
                {importResult.imported_count} Data
              </span>
              <span className="text-[11px] text-text-muted block mt-0.5">
                Karyawan baru di SP ini
              </span>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-[12px] font-medium text-blue-800 uppercase block flex items-center justify-between">
                <span>Data Diperbarui (Update)</span>
                {importResult.updated_count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-200 text-blue-900">
                    {importResult.updated_count}
                  </span>
                )}
              </span>
              <span className="font-display-kpi text-[26px] font-bold text-blue-700 font-mono">
                {importResult.updated_count} Data
              </span>
              <span className="text-[11px] text-blue-600 block mt-0.5">
                Data lama disinkronkan
              </span>
            </div>

            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
              <span className="text-[12px] font-medium text-indigo-800 uppercase block">
                Estimasi Total THP
              </span>
              <span className="font-display-kpi text-[20px] font-bold text-indigo-700 font-mono">
                {formatRupiah(importResult.total_estimated_thp || 0)}
              </span>
              <span className="text-[11px] text-indigo-600 block mt-0.5">
                Total take home pay
              </span>
            </div>
          </div>

          {/* Section: Rekening Kembar Warning */}
          {importResult.duplicate_account_rows && importResult.duplicate_account_rows.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-300 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-[13.5px] text-amber-950">
                      Peringatan Rekening Kembar: {importResult.duplicate_account_rows.length} Karyawan Terdeteksi
                    </h4>
                    <p className="text-[11.5px] text-amber-800">
                      Nomor rekening berikut digunakan oleh lebih dari 1 karyawan. Mohon pastikan dan cross-check rekening sebelum payroll ditransfer.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDuplicateDetails(!showDuplicateDetails)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:text-amber-950 bg-amber-100 hover:bg-amber-200/80 rounded-lg flex items-center gap-1 transition-colors"
                >
                  {showDuplicateDetails ? 'Tutup Rincian' : 'Buka Rincian'}
                  {showDuplicateDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showDuplicateDetails && (
                <div className="border border-amber-200 rounded-lg overflow-hidden bg-white max-h-56 overflow-y-auto shadow-2xs">
                  <table className="w-full text-left text-[11.5px]">
                    <thead className="bg-amber-100/70 text-amber-900 font-semibold border-b border-amber-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-1.5 w-12 text-center">No</th>
                        <th className="px-3 py-1.5">Nama Karyawan</th>
                        <th className="px-3 py-1.5">Sekolah / Unit</th>
                        <th className="px-3 py-1.5 font-mono">No. Rekening</th>
                        <th className="px-3 py-1.5">Keterangan Kembar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {importResult.duplicate_account_rows.map((dup, i) => (
                        <tr key={i} className="hover:bg-amber-50/50">
                          <td className="px-3 py-1.5 text-center text-text-muted">{dup.row_no || i + 1}</td>
                          <td className="px-3 py-1.5 font-semibold text-slate-800">{dup.employee_name}</td>
                          <td className="px-3 py-1.5 text-text-muted">{dup.school_unit || '-'}</td>
                          <td className="px-3 py-1.5 font-mono font-semibold text-amber-900">
                            {dup.bank_name ? `${dup.bank_name} ` : ''}{dup.bank_account}
                          </td>
                          <td className="px-3 py-1.5 text-amber-800 text-[11px]">{dup.info}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Section: Rincian Data Diperbarui (Update) */}
          {importResult.updated_rows && importResult.updated_rows.length > 0 && (
            <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-5 h-5 text-blue-700 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-[13.5px] text-blue-950">
                      Transparansi Data yang Diperbarui ({importResult.updated_rows.length} Data)
                    </h4>
                    <p className="text-[11.5px] text-blue-800">
                      Data ini tidak dibuat baru karena cocok dengan data database periode terkait atau menimpa baris sebelumnya di file.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUpdatedDetails(!showUpdatedDetails)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-blue-800 hover:text-blue-950 bg-blue-100 hover:bg-blue-200/80 rounded-lg flex items-center gap-1 transition-colors"
                >
                  {showUpdatedDetails ? 'Tutup Rincian' : 'Buka Rincian'}
                  {showUpdatedDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showUpdatedDetails && (
                <div className="border border-blue-200 rounded-lg overflow-hidden bg-white max-h-56 overflow-y-auto shadow-2xs">
                  <table className="w-full text-left text-[11.5px]">
                    <thead className="bg-blue-100/70 text-blue-900 font-semibold border-b border-blue-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-1.5 w-12 text-center">No</th>
                        <th className="px-3 py-1.5">Nama Karyawan</th>
                        <th className="px-3 py-1.5 font-mono">NIK</th>
                        <th className="px-3 py-1.5">Sekolah / Unit</th>
                        <th className="px-3 py-1.5">Alasan Pembaruan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100">
                      {importResult.updated_rows.map((item, i) => (
                        <tr key={i} className="hover:bg-blue-50/50">
                          <td className="px-3 py-1.5 text-center text-text-muted">{item.row_no || i + 1}</td>
                          <td className="px-3 py-1.5 font-semibold text-slate-800">{item.employee_name}</td>
                          <td className="px-3 py-1.5 font-mono text-text-muted">{item.nik || '-'}</td>
                          <td className="px-3 py-1.5 text-text-muted">{item.school_unit || '-'}</td>
                          <td className="px-3 py-1.5 text-blue-900 font-medium text-[11px]">{item.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Any Errors / Skipped Rows */}
          {importResult.errors && importResult.errors.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
              <div className="font-semibold text-amber-900 text-[13px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Catatan ({importResult.errors.length} baris dilewati):
              </div>
              <ul className="list-disc list-inside text-[12px] text-amber-800 space-y-1">
                {importResult.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border-subtle">
            <Button
              variant="outline"
              onClick={() => {
                setImportResult(null);
                setSelectedFile(null);
                setPreviewData(null);
              }}
            >
              Import File Lain
            </Button>

            <Button
              variant="primary"
              onClick={() => navigate('/payrolls')}
              rightIcon={<ExternalLink className="w-4 h-4" />}
            >
              Lihat Daftar Data Gaji
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
