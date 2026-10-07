import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { payrollService } from '../services/payrollService';
import { PayrollImportResult } from '../../../types/payroll';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  Calendar,
  X,
} from 'lucide-react';

export const PayrollImportPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importPeriod, setImportPeriod] = useState('2026-08');
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<PayrollImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null);
    setImportResult(null);

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      setErrorMessage(
        'Format file tidak valid. Harap pilih file berekstensi .xlsx, .xls, atau .csv.'
      );
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Ukuran file melebihi batas maksimal 10MB.');
      return;
    }

    setSelectedFile(file);
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
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setErrorMessage(null);
    setImportResult(null);

    try {
      const result = await payrollService.importFile(selectedFile, importPeriod);
      setImportResult(result);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Gagal mengimpor file. Pastikan format kolom sesuai data Excel.';
      setErrorMessage(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const downloadSampleCsv = () => {
    const csvContent =
      'No,WILAYAH,SEKOLAH RAKYAT PERMANEN,NIK,NAMA LENGKAP,FUNGSI TENAGA KEPENDIDIKAN,TANGGAL MASUK,GAJI,NO REKENING,BANK\n' +
      '109,DKI JAKARTA,Salemba (Pusat),,FEBRI HIDAYAT,,1-Sep," Rp 5,721,000 ",2098199007,BNI\n' +
      '116,DKI JAKARTA,Sekolah Rakyat Menengah Atas 10 Jakarta Selatan,,MUHAMAD FERIANSAH,Cleaning Service,18 Agustus 2026," Rp 5,721,000 ",2098393515,BNI\n' +
      '660,SUMATERA UTARA,Sekolah Rakyat Menengah Atas 30 Padang Sidempuan,1213131111910001,RUDI SAPUTRA,Cleaning Service,25 Juli 2026," Rp 3,159,000 ",2097700845,BNI';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_standar_sekolah_rakyat.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Link
          to="/payrolls"
          className="p-2 rounded-lg border border-border-subtle bg-surface-panel hover:bg-surface-container text-text-muted hover:text-text-primary transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-headline-page text-headline-page text-text-primary tracking-tight">
            Import Data Gaji Massal (Spreadsheet)
          </h1>
          <p className="font-body-default text-body-default text-text-muted">
            Mendukung langsung format standar Excel Sekolah Rakyat (contoh: contoh(1).xlsx).
          </p>
        </div>
      </div>

      {/* Guide & Template Download Banner */}
      <Card className="p-5 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-blue-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-title-card text-[15px] font-bold text-text-primary flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Format Kolom Excel Standar (Persis contoh(1).xlsx)
            </h3>
            <p className="text-[12.5px] text-text-muted">
              Kolom: <span className="font-semibold text-text-primary">No, WILAYAH, SEKOLAH RAKYAT PERMANEN, NIK, NAMA LENGKAP, FUNGSI TENAGA KEPENDIDIKAN, TANGGAL MASUK, GAJI, NO REKENING, BANK</span>
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={downloadSampleCsv}
            leftIcon={<Download className="w-4 h-4 text-primary" />}
          >
            Unduh Format CSV
          </Button>
        </div>
      </Card>

      {/* Upload Zone & Period Settings */}
      <Card className="p-8 space-y-6">
        {/* Period Picker */}
        <div className="p-4 rounded-xl bg-surface-container-low border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="font-semibold text-[13px] text-text-primary flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary" />
              Periode Penggajian untuk Data Ini
            </span>
            <span className="text-[12px] text-text-muted">
              File Excel tanpa kolom periode otomatis diset ke periode yang Anda tentukan di sini.
            </span>
          </div>

          <input
            type="text"
            value={importPeriod}
            onChange={(e) => setImportPeriod(e.target.value)}
            placeholder="YYYY-MM (contoh: 2026-08)"
            className="w-40 h-9 px-3 bg-surface-panel rounded-lg border border-border-subtle font-mono text-[13px] text-text-primary outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-3 ${
            isDragOver
              ? 'border-primary bg-primary-fixed/20'
              : 'border-slate-300 hover:border-primary hover:bg-slate-50/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-14 h-14 rounded-full bg-blue-50 text-primary flex items-center justify-center shadow-inner">
            <Upload className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <p className="font-body-semibold text-[15px] text-text-primary">
              Tarik dan lepaskan file Excel / CSV ke sini
            </p>
            <p className="text-[13px] text-text-muted">
              atau <span className="text-primary font-medium underline">pilih file dari perangkat</span>
            </p>
          </div>

          <span className="text-[11px] text-text-muted">
            Mendukung .xlsx, .xls, .csv (Maksimal 10 MB)
          </span>
        </div>

        {/* Selected File Card */}
        {selectedFile && (
          <div className="flex items-center justify-between p-4 rounded-xl bg-surface-container-low border border-border-subtle">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-text-primary truncate">
                  {selectedFile.name}
                </div>
                <div className="text-[12px] text-text-muted">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedFile(null)}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-container"
              title="Hapus pilihan file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-danger-text text-[13px] flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => navigate('/payrolls')}
            disabled={isUploading}
          >
            Batal
          </Button>
          <Button
            variant="primary"
            disabled={!selectedFile || isUploading}
            isLoading={isUploading}
            onClick={handleUpload}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Mulai Import Data
          </Button>
        </div>
      </Card>

      {/* Import Result Summary Card */}
      {importResult && (
        <Card className="p-6 space-y-4 border-emerald-200 bg-white">
          <div className="flex items-center gap-3 text-status-success-text">
            <CheckCircle2 className="w-6 h-6" />
            <h3 className="font-title-card text-[17px] font-bold text-text-primary">
              Proses Import Selesai
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-[12px] font-medium text-emerald-800 uppercase block">
                Data Baru Ditambahkan
              </span>
              <span className="font-display-kpi text-[24px] font-bold text-emerald-700 font-mono">
                {importResult.imported_count} Data
              </span>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-[12px] font-medium text-blue-800 uppercase block">
                Data Yang Diperbarui
              </span>
              <span className="font-display-kpi text-[24px] font-bold text-blue-700 font-mono">
                {importResult.updated_count} Data
              </span>
            </div>
          </div>

          {/* Any Row Errors */}
          {importResult.errors && importResult.errors.length > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
              <div className="font-semibold text-amber-900 text-[13px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Catatan ({importResult.errors.length} baris dilewati):
              </div>
              <ul className="list-disc list-inside text-[12px] text-amber-800 space-y-1">
                {importResult.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <Button variant="primary" onClick={() => navigate('/payrolls')}>
              Lihat Daftar Data Gaji
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
