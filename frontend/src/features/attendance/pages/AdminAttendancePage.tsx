import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  MapPin,
  Calendar,
  Users,
  Search,
  Download,
  Upload,
  Settings,
  CheckCircle2,
  AlertCircle,
  Building,
  Save,
  Compass,
  Crosshair,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  FileSpreadsheet,
  SunMedium,
  Briefcase,
  X,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileText,
  Check,
  Camera,
  Car,
  Eye,
  Sparkles,
} from 'lucide-react';
import { attendanceService } from '../services/attendanceService';
import { Pagination } from '../../../components/shared/Pagination';
import {
  AttendanceRecord,
  AttendanceSummary,
  OfficeSetting,
  AttendanceLocation,
  SchoolUnitOption,
} from '../types/attendance';

export const AdminAttendancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'recap' | 'locations' | 'settings'>('recap');

  // Recap & Filter State
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [previewPhotoModal, setPreviewPhotoModal] = useState<string | null>(null);

  // Locations State (100+ Titik Radius)
  const [locations, setLocations] = useState<AttendanceLocation[]>([]);
  const [locationSearch, setLocationSearch] = useState<string>('');
  const [locationTypeFilter, setLocationTypeFilter] = useState<string>('all');
  const [locationsLoading, setLocationsLoading] = useState<boolean>(false);
  const [locationPage, setLocationPage] = useState<number>(1);
  const [locationPerPage, setLocationPerPage] = useState<number>(25);
  const [locationMeta, setLocationMeta] = useState<{
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  }>({
    current_page: 1,
    last_page: 1,
    per_page: 25,
    total: 0,
    from: 0,
    to: 0,
  });
  const [locationModalOpen, setLocationModalOpen] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<Partial<AttendanceLocation> | null>(null);
  const [modalSaving, setModalSaving] = useState<boolean>(false);

  // School Units & Auto Sync State
  const [schoolUnitOptions, setSchoolUnitOptions] = useState<SchoolUnitOption[]>([]);
  const [syncingSchools, setSyncingSchools] = useState<boolean>(false);

  // Manual Assign Modal State
  const [assignModalOpen, setAssignModalOpen] = useState<boolean>(false);
  const [selectedLocationForAssign, setSelectedLocationForAssign] = useState<AttendanceLocation | null>(null);
  const [assignEmployeesData, setAssignEmployeesData] = useState<{
    location: AttendanceLocation;
    assigned_employees: any[];
    all_employees: any[];
  } | null>(null);
  const [assignLoading, setAssignLoading] = useState<boolean>(false);
  const [assignSaving, setAssignSaving] = useState<boolean>(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [assignSearch, setAssignSearch] = useState<string>('');

  // Import / Export & Clear All State
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [clearLoading, setClearLoading] = useState<boolean>(false);
  const [templateDownloading, setTemplateDownloading] = useState<boolean>(false);
  const [exportLoading, setExportLoading] = useState<boolean>(false);

  // Settings State
  const [settings, setSettings] = useState<OfficeSetting | null>(null);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);
  const [settingsSaving, setSettingsSaving] = useState<boolean>(false);
  const [gpsDetecting, setGpsDetecting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Fetch Attendance Records & Summary
  const fetchRecap = useCallback(async () => {
    try {
      setLoading(true);
      const [listRes, sumRes] = await Promise.allSettled([
        attendanceService.getAdminAttendances({
          date: selectedDate,
          status: statusFilter,
          search: searchQuery || undefined,
        }),
        attendanceService.getAdminSummary(selectedDate),
      ]);
      if (listRes.status === 'fulfilled') {
        setAttendances(listRes.value?.data || []);
      }
      if (sumRes.status === 'fulfilled') {
        setSummary(sumRes.value);
      }
    } catch (err: any) {
      console.error('Error fetching recap:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, statusFilter, searchQuery]);

  // Fetch Locations (100+ Lokasi) with Pagination
  const fetchLocations = useCallback(async () => {
    try {
      setLocationsLoading(true);
      const res = await attendanceService.getAdminLocations({
        search: locationSearch || undefined,
        type: locationTypeFilter !== 'all' ? locationTypeFilter : undefined,
        page: locationPage,
        per_page: locationPerPage,
      });
      setLocations(res.data || []);
      if (res.meta) {
        setLocationMeta({
          current_page: res.meta.current_page || 1,
          last_page: res.meta.last_page || 1,
          per_page: res.meta.per_page || locationPerPage,
          total: res.meta.total ?? 0,
          from: res.meta.from ?? (res.data.length > 0 ? (res.meta.current_page - 1) * locationPerPage + 1 : 0),
          to: res.meta.to ?? (res.data.length > 0 ? (res.meta.current_page - 1) * locationPerPage + res.data.length : 0),
        });
      }
    } catch (err: any) {
      console.error('Error fetching locations:', err);
    } finally {
      setLocationsLoading(false);
    }
  }, [locationSearch, locationTypeFilter, locationPage, locationPerPage]);

  // Reset page to 1 when search query or type filter changes
  useEffect(() => {
    setLocationPage(1);
  }, [locationSearch, locationTypeFilter]);

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const data = await attendanceService.getSettings();
      setSettings(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // Fetch School Units (Daftar unit sekolah unik dari data gaji & users)
  const fetchSchoolUnits = useCallback(async () => {
    try {
      const data = await attendanceService.getSchoolUnits();
      setSchoolUnitOptions(data || []);
    } catch (err: any) {
      console.error('Error fetching school units:', err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'recap') {
      fetchRecap();
    } else if (activeTab === 'locations') {
      fetchLocations();
      fetchSchoolUnits();
    } else {
      fetchSettings();
    }
  }, [activeTab, fetchRecap, fetchLocations, fetchSchoolUnits, fetchSettings]);

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      setSettingsSaving(true);
      setNotification(null);
      const res = await attendanceService.updateSettings(settings);
      setSettings(res);
      setNotification({
        text: 'Pengaturan lokasi kantor & batas radius absensi berhasil disimpan.',
        type: 'success',
      });
    } catch (err: any) {
      setNotification({
        text: err.response?.data?.message || 'Gagal menyimpan pengaturan absensi.',
        type: 'error',
      });
    } finally {
      setSettingsSaving(false);
    }
  };

  // Use Current Admin GPS Position for Office Settings
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Browser tidak mendukung geolokasi GPS.');
      return;
    }
    setGpsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsDetecting(false);
        if (settings) {
          setSettings({
            ...settings,
            latitude: Number(pos.coords.latitude.toFixed(7)),
            longitude: Number(pos.coords.longitude.toFixed(7)),
          });
        }
      },
      (err) => {
        setGpsDetecting(false);
        alert('Gagal mengambil lokasi GPS: ' + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  // Handle Clear All Locations
  const handleClearAllLocations = async () => {
    if (
      !window.confirm(
        'PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA titik lokasi absensi untuk perusahaan ini? Tindakan ini akan mengosongkan tabel lokasi agar Anda dapat mengimpor data yang benar dari file Excel/CSV.'
      )
    ) {
      return;
    }

    try {
      setClearLoading(true);
      setNotification(null);
      const res = await attendanceService.clearAllLocations();
      setNotification({
        text: res.message || 'Semua data lokasi berhasil dibersihkan.',
        type: 'success',
      });
      fetchLocations();
    } catch (err: any) {
      setNotification({
        text: err.response?.data?.message || 'Gagal membersihkan data lokasi.',
        type: 'error',
      });
    } finally {
      setClearLoading(false);
    }
  };

  // Handle File Selection and Automatic Preview
  const handleFileChange = async (file: File | null) => {
    if (!file) {
      setImportFile(null);
      setPreviewData(null);
      setImportResult(null);
      return;
    }

    setImportFile(file);
    setImportResult(null);
    setPreviewData(null);
    try {
      setPreviewLoading(true);
      const res = await attendanceService.previewImportLocations(file);
      setPreviewData(res);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal membaca pratinjau file. Pastikan format spreadsheet sesuai template.');
      setImportFile(null);
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleResetImport = () => {
    setImportFile(null);
    setPreviewData(null);
    setImportResult(null);
  };

  // Handle Import Excel/CSV Submit
  const handleImportSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!importFile) {
      alert('Pilih file Excel (.xlsx) atau CSV (.csv) terlebih dahulu.');
      return;
    }

    try {
      setImportLoading(true);
      const res = await attendanceService.importLocations(importFile);
      setImportResult(res.data);
      setNotification({
        text: res.message || 'Import data lokasi selesai.',
        type: 'success',
      });
      fetchLocations();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengimpor file lokasi.');
    } finally {
      setImportLoading(false);
    }
  };

  // Handle Download Location Template (.xlsx) via Authenticated Blob
  const handleDownloadLocationTemplate = async () => {
    try {
      setTemplateDownloading(true);
      await attendanceService.downloadLocationTemplate();
    } catch (err: any) {
      console.error('Error downloading template:', err);
      // Fallback: buka link template publik jika ada kendala
      window.open(attendanceService.downloadLocationTemplateUrl(), '_blank');
    } finally {
      setTemplateDownloading(false);
    }
  };

  // Handle Export Locations (.csv) via Authenticated Blob
  const handleExportLocations = async () => {
    try {
      setExportLoading(true);
      await attendanceService.exportLocations();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengekspor data lokasi.');
    } finally {
      setExportLoading(false);
    }
  };

  // Open Modal Tambah/Edit Lokasi Manual
  const handleOpenAddLocation = () => {
    setEditingLocation({
      name: '',
      code: '',
      address: '',
      latitude: -6.2088000,
      longitude: 106.8456000,
      radius_meters: 100,
      type: 'school',
      is_active: true,
    });
    setLocationModalOpen(true);
  };

  const handleOpenEditLocation = (loc: AttendanceLocation) => {
    setEditingLocation({ ...loc });
    setLocationModalOpen(true);
  };

  // Save Modal Location (Create/Update Manual)
  const handleSaveModalLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation || !editingLocation.name) return;

    try {
      setModalSaving(true);
      if (editingLocation.id) {
        await attendanceService.updateLocation(editingLocation.id, editingLocation);
      } else {
        await attendanceService.createLocation(editingLocation);
      }
      setLocationModalOpen(false);
      setEditingLocation(null);
      fetchLocations();
      setNotification({
        text: `Lokasi '${editingLocation.name}' berhasil disimpan.`,
        type: 'success',
      });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyimpan data lokasi.');
    } finally {
      setModalSaving(false);
    }
  };

  // Delete Location Single
  const handleDeleteLocation = async (loc: AttendanceLocation) => {
    if (!window.confirm(`Hapus titik lokasi '${loc.name}'?`)) return;
    try {
      await attendanceService.deleteLocation(loc.id);
      fetchLocations();
      setNotification({
        text: `Lokasi '${loc.name}' berhasil dihapus.`,
        type: 'success',
      });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menghapus lokasi.');
    }
  };

  // Sinkronkan seluruh unit sekolah dari data impor penggajian menjadi titik lokasi
  const handleSyncFromSchoolUnits = async () => {
    if (
      !window.confirm(
        'Sinkronkan seluruh nama unit sekolah dari data impor gaji sebagai titik lokasi baru? Seluruh akun karyawan yang terdaftar di bawah unit sekolah tersebut akan otomatis terhubung ke lokasi sekolahnya masing-masing.'
      )
    )
      return;

    try {
      setSyncingSchools(true);
      const res = await attendanceService.syncFromSchoolUnits();
      fetchLocations();
      fetchSchoolUnits();
      setNotification({
        text: res.message || 'Sinkronisasi unit sekolah berhasil!',
        type: 'success',
      });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mensinkronkan data unit sekolah.');
    } finally {
      setSyncingSchools(false);
    }
  };

  // Buka Modal Atur Penugasan Karyawan Manual
  const handleOpenAssignEmployees = async (loc: AttendanceLocation) => {
    try {
      setSelectedLocationForAssign(loc);
      setAssignModalOpen(true);
      setAssignLoading(true);
      setAssignSearch('');
      const data = await attendanceService.getLocationEmployees(loc.id);
      setAssignEmployeesData(data);
      const currentlyAssignedIds = (data.assigned_employees || []).map((e: any) => e.id);
      setSelectedUserIds(currentlyAssignedIds);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal memuat data karyawan untuk lokasi ini.');
      setAssignModalOpen(false);
    } finally {
      setAssignLoading(false);
    }
  };

  // Simpan Penugasan Karyawan Manual
  const handleSaveAssignEmployees = async () => {
    if (!selectedLocationForAssign) return;
    try {
      setAssignSaving(true);
      await attendanceService.assignLocationEmployees(selectedLocationForAssign.id, selectedUserIds);
      setAssignModalOpen(false);
      fetchLocations();
      setNotification({
        text: `Penugasan karyawan untuk lokasi '${selectedLocationForAssign.name}' berhasil diperbarui (${selectedUserIds.length} karyawan terhubung).`,
        type: 'success',
      });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyimpan penugasan karyawan.');
    } finally {
      setAssignSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-primary" />
            <span>Manajemen Presensi & Radius Lokasi</span>
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Rekapitulasi absensi harian, master titik lokasi kerja/sekolah via Excel/CSV, dan konfigurasi radius.
          </p>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-container rounded-xl border border-border-subtle self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('recap')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'recap'
                ? 'bg-surface-panel text-primary shadow-2xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Rekap Kehadiran</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('locations')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'locations'
                ? 'bg-surface-panel text-primary shadow-2xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Master Lokasi ({locationMeta.total || locations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-surface-panel text-primary shadow-2xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Jam Kerja & Kebijakan</span>
          </button>
        </div>
      </div>

      {/* Global Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 shadow-2xs animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
              : 'bg-rose-50/80 border-rose-200 text-rose-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          )}
          <div className="text-xs font-medium leading-relaxed flex-1">{notification.text}</div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-text-muted hover:text-text-primary cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: REKAP KEHADIRAN KARYAWAN */}
      {activeTab === 'recap' && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
            <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 shadow-2xs">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                Total Karyawan
              </div>
              <div className="text-2xl font-bold text-text-primary mt-1">
                {summary?.total_employees ?? '-'}
              </div>
            </div>

            <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 shadow-2xs">
              <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
                Hadir Masuk
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                {summary?.total_present ?? '-'}
              </div>
            </div>

            <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 shadow-2xs">
              <div className="text-[11px] font-semibold text-indigo-800 uppercase tracking-wider">
                Dinas Luar
              </div>
              <div className="text-2xl font-bold text-indigo-700 mt-1">
                {summary?.total_business_trip ?? 0}
              </div>
            </div>

            <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 shadow-2xs">
              <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
                Libur / Off
              </div>
              <div className="text-2xl font-bold text-amber-700 mt-1">
                {summary?.total_holiday ?? 0}
              </div>
            </div>

            <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 shadow-2xs">
              <div className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">
                Tepat Waktu
              </div>
              <div className="text-2xl font-bold text-blue-700 mt-1">
                {summary?.total_on_time ?? '-'}
              </div>
            </div>

            <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 shadow-2xs">
              <div className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider">
                Terlambat
              </div>
              <div className="text-2xl font-bold text-rose-700 mt-1">
                {summary?.total_late ?? '-'}
              </div>
            </div>

            <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 shadow-2xs">
              <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                Belum Absen
              </div>
              <div className="text-2xl font-bold text-gray-700 mt-1">
                {summary?.total_not_checked_in ?? '-'}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              {/* Date Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted font-medium">Tanggal:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-surface-container border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-surface-container border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">Semua Status</option>
                  <option value="on_time">Tepat Waktu</option>
                  <option value="late">Terlambat</option>
                  <option value="dinas_luar">Perjalanan Dinas</option>
                  <option value="holiday">Libur / Off</option>
                </select>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari Nama / NIK / Email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-container border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Export CSV Button */}
            <a
              href={attendanceService.exportCsvUrl(selectedDate)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 border border-primary/20 rounded-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV Rekap</span>
            </a>
          </div>

          {/* Table List */}
          <div className="bg-surface-panel border border-border-subtle rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[950px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-container/40 text-text-muted font-semibold whitespace-nowrap">
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-3">Foto Bukti</th>
                    <th className="py-3 px-3">Jenis Absen</th>
                    <th className="py-3 px-3">Titik Lokasi / Unit</th>
                    <th className="py-3 px-3">Jam Masuk</th>
                    <th className="py-3 px-3">Jarak Masuk</th>
                    <th className="py-3 px-3">Jam Pulang</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Catatan</th>
                    <th className="py-3 px-4">Koordinat GPS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-text-muted">
                        Memuat data absensi karyawan...
                      </td>
                    </tr>
                  ) : attendances.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-text-muted">
                        Tidak ada data absensi untuk tanggal {selectedDate}.
                      </td>
                    </tr>
                  ) : (
                    attendances.map((row) => {
                      const isLibur = row.attendance_type === 'libur' || row.status === 'holiday';
                      const isDinas = row.attendance_type === 'dinas_luar';
                      const photoSrc = row.photo_full_url || row.photo_url;
                      return (
                        <tr key={row.id} className="hover:bg-surface-container/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-text-primary">{row.user?.name || '-'}</div>
                            <div className="text-[11px] text-text-muted font-mono">
                              NIK: {row.user?.nik || '-'} {row.user?.school_unit ? `• Unit: ${row.user.school_unit}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {photoSrc ? (
                              <div
                                onClick={() => setPreviewPhotoModal(photoSrc)}
                                className="flex items-center gap-1.5 cursor-pointer group"
                                title="Klik untuk memperbesar foto bukti"
                              >
                                <img
                                  src={photoSrc}
                                  alt="Bukti Kehadiran"
                                  className="w-8 h-8 rounded-lg object-cover border border-border-subtle group-hover:scale-105 shadow-2xs transition-transform"
                                />
                                <Eye className="w-3.5 h-3.5 text-text-muted group-hover:text-primary shrink-0" />
                              </div>
                            ) : (
                              <span className="text-text-muted text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                isLibur
                                  ? 'bg-amber-100 text-amber-800'
                                  : isDinas
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isLibur ? (
                                <>
                                  <SunMedium className="w-3 h-3 text-amber-600" />
                                  <span>Libur / Off</span>
                                </>
                              ) : isDinas ? (
                                <>
                                  <Car className="w-3 h-3 text-indigo-600" />
                                  <span>Dinas Luar</span>
                                </>
                              ) : (
                                <>
                                  <Briefcase className="w-3 h-3 text-emerald-600" />
                                  <span>Masuk Kerja</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-text-secondary font-medium">
                            {row.location_name || (row.location?.name ?? '-')}
                          </td>
                          <td className="py-3 px-3 font-mono font-medium">
                            {row.check_in_time ? row.check_in_time.substring(0, 5) : '-'}
                          </td>
                          <td className="py-3 px-3 text-text-muted">
                            {row.check_in_distance_meters !== null ? `${row.check_in_distance_meters} m` : '-'}
                          </td>
                          <td className="py-3 px-3 font-mono font-medium">
                            {row.check_out_time ? row.check_out_time.substring(0, 5) : '-'}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                isLibur
                                  ? 'bg-amber-100 text-amber-800'
                                  : isDinas
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : row.check_in_status === 'late'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isLibur
                                ? 'Libur'
                                : isDinas
                                ? 'Dinas Luar'
                                : row.check_in_status === 'late'
                                ? 'Terlambat'
                                : 'Tepat Waktu'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-text-muted max-w-[150px] truncate" title={row.notes || '-'}>
                            {row.notes || '-'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-text-muted">
                            {row.check_in_lat && row.check_in_lng ? (
                              <a
                                href={`https://www.google.com/maps?q=${row.check_in_lat},${row.check_in_lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                                title="Lihat titik di Google Maps"
                              >
                                <span>
                                  {row.check_in_lat.toFixed(4)}, {row.check_in_lng.toFixed(4)}
                                </span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MASTER LOKASI (IMPORT / EXPORT EXCEL & MANUAL) */}
      {activeTab === 'locations' && (
        <div className="space-y-6">
          {/* Top Actions & Filters */}
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari Nama Sekolah / Kode / Alamat..."
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-container border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted font-medium">Tipe:</span>
                <select
                  value={locationTypeFilter}
                  onChange={(e) => setLocationTypeFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-surface-container border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">Semua Tipe</option>
                  <option value="school">Sekolah Rakyat</option>
                  <option value="headquarters">Kantor Pusat</option>
                  <option value="branch">Cabang</option>
                  <option value="other">Lainnya</option>
                </select>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Download Template Excel */}
              <button
                type="button"
                onClick={handleDownloadLocationTemplate}
                disabled={templateDownloading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-300 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                title="Unduh format file Excel untuk input lokasi"
              >
                <Download className="w-3.5 h-3.5 text-sky-600" />
                <span>{templateDownloading ? 'Mengunduh...' : 'Unduh Template'}</span>
              </button>

              {/* Import Excel / CSV Button */}
              <button
                type="button"
                onClick={() => {
                  setImportModalOpen(true);
                  setImportResult(null);
                  setImportFile(null);
                  setPreviewData(null);
                  setShowGuide(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-all cursor-pointer"
                title="Unggah file Excel/CSV data lokasi"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Import Excel/CSV</span>
              </button>

              {/* Sinkronkan dari Data Sekolah Gaji Button */}
              <button
                type="button"
                onClick={handleSyncFromSchoolUnits}
                disabled={syncingSchools}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="Otomatis ambil seluruh unit sekolah dari data impor gaji sebagai titik lokasi & kaitkan akun karyawan"
              >
                <Sparkles className={`w-3.5 h-3.5 text-emerald-600 ${syncingSchools ? 'animate-spin' : ''}`} />
                <span>{syncingSchools ? 'Menyinkronkan...' : 'Sinkronkan Data Sekolah Gaji'}</span>
              </button>

              {/* Export Data Button */}
              <button
                type="button"
                onClick={handleExportLocations}
                disabled={exportLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 border border-primary/20 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                title="Ekspor daftar lokasi aktif ke file CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exportLoading ? 'Mengekspor...' : 'Export Data'}</span>
              </button>

              {/* Tambah Lokasi Manual Button */}
              <button
                type="button"
                onClick={handleOpenAddLocation}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Tambah Manual</span>
              </button>

              {/* Clear All Locations Button */}
              <button
                type="button"
                onClick={handleClearAllLocations}
                disabled={clearLoading || locations.length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                title="Hapus / Kosongkan semua lokasi untuk perusahaan ini"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>{clearLoading ? 'Menghapus...' : 'Bersihkan Semua'}</span>
              </button>
            </div>
          </div>

          {/* Table Master Lokasi */}
          <div className="bg-surface-panel border border-border-subtle rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[1050px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-container/40 text-text-muted font-semibold whitespace-nowrap">
                    <th className="py-3 px-4">Nama Titik Lokasi</th>
                    <th className="py-3 px-3">Kode Unit</th>
                    <th className="py-3 px-3">Tipe</th>
                    <th className="py-3 px-3">Karyawan Terdaftar</th>
                    <th className="py-3 px-3">Radius (Meter)</th>
                    <th className="py-3 px-3">Alamat</th>
                    <th className="py-3 px-3">Koordinat GPS</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {locationsLoading ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-text-muted">
                        Memuat data lokasi absensi...
                      </td>
                    </tr>
                  ) : locations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-14 text-center text-text-muted space-y-3">
                        <div className="text-sm font-semibold text-text-secondary">
                          Belum ada master lokasi yang terdaftar.
                        </div>
                        <p className="text-xs text-text-muted max-w-md mx-auto">
                          Anda dapat menyinkronkan langsung dari data gaji yang sudah diimpor, atau mengunduh template Excel.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                          <button
                            type="button"
                            onClick={handleSyncFromSchoolUnits}
                            disabled={syncingSchools}
                            className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>1. Sinkronkan dari Data Sekolah Gaji</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadLocationTemplate}
                            disabled={templateDownloading}
                            className="px-4 py-2 text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-300 rounded-xl hover:bg-sky-100 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5 text-sky-600" />
                            <span>2. {templateDownloading ? 'Mengunduh...' : 'Unduh Template Excel'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setImportModalOpen(true);
                              setImportResult(null);
                              setImportFile(null);
                            }}
                            className="px-4 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>3. Import Excel/CSV</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    locations.map((loc) => (
                      <tr key={loc.id} className="hover:bg-surface-container/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-text-primary flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{loc.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-text-secondary">
                          {loc.code || '-'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-container border border-border-subtle text-text-secondary">
                            {loc.type === 'school' ? 'Sekolah Rakyat' : loc.type === 'headquarters' ? 'Kantor Pusat' : loc.type}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => handleOpenAssignEmployees(loc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all cursor-pointer"
                            title="Klik untuk melihat / mengatur karyawan manual"
                          >
                            <Users className="w-3 h-3" />
                            <span>{loc.employee_count ?? 0} Karyawan</span>
                          </button>
                        </td>
                        <td className="py-3 px-3 font-semibold text-emerald-700">
                          {loc.radius_meters} Meter
                        </td>
                        <td className="py-3 px-3 text-text-muted max-w-[200px] truncate" title={loc.address || '-'}>
                          {loc.address || '-'}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px]">
                          <a
                            href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <span>{Number(loc.latitude).toFixed(4)}, {Number(loc.longitude).toFixed(4)}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              loc.is_active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {loc.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenAssignEmployees(loc)}
                            className="p-1.5 text-text-muted hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-all cursor-pointer mr-1"
                            title="Atur Karyawan Manual"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditLocation(loc)}
                            className="p-1.5 text-text-muted hover:text-primary hover:bg-surface-container rounded-md transition-all cursor-pointer mr-1"
                            title="Edit Lokasi"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLocation(loc)}
                            className="p-1.5 text-text-muted hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                            title="Hapus Lokasi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <Pagination
              meta={locationMeta as any}
              onPageChange={(page) => setLocationPage(page)}
              perPage={locationPerPage}
              onPerPageChange={(newPerPage) => {
                setLocationPerPage(newPerPage);
                setLocationPage(1);
              }}
              isLoading={locationsLoading}
            />
          </div>
        </div>
      )}

      {/* MODAL IMPORT EXCEL / CSV LOKASI DENGAN PANDUAN LENGKAP & PRATINJAU DATA */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col space-y-4 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-text-primary text-base">
                    Import Master Lokasi dari Excel / CSV
                  </h3>
                  <p className="text-xs text-text-muted">
                    Sinkronisasi ratusan titik lokasi radius absensi sekolah & unit kerja.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface-container transition-all cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Scrollable */}
            <div className="overflow-y-auto pr-1 space-y-4 flex-1 scrollbar-thin">
              {/* TATA CARA & PANDUAN PENGISIAN DATA */}
              <div className="rounded-xl border border-sky-200 bg-sky-50/60 overflow-hidden text-xs transition-all">
                <div className="p-3.5 flex items-center justify-between gap-3 bg-sky-100/60">
                  <div className="flex items-center gap-2 text-sky-950 font-bold">
                    <Info className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Tata Cara Pengisian Data & Penjelasan Tipe Lokasi:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadLocationTemplate}
                      disabled={templateDownloading}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold bg-white text-sky-800 border border-sky-300 rounded-lg shadow-2xs hover:bg-sky-50 transition-all cursor-pointer disabled:opacity-50"
                      title="Unduh file template resmi berformat .xlsx"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-600" />
                      <span>{templateDownloading ? 'Mengunduh...' : 'Unduh Template Excel'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowGuide(!showGuide)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-sky-800 hover:text-sky-950 cursor-pointer"
                    >
                      <span>{showGuide ? 'Sembunyikan' : 'Buka Detail Panduan'}</span>
                      {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Ringkasan Kolom Singkat */}
                <div className="px-3.5 py-2.5 border-t border-sky-200/60 text-sky-900 leading-relaxed">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="font-semibold text-sky-950">Susunan Kolom:</span>
                    <span className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-sky-200 font-bold">Nama Lokasi*</span>
                    <span>|</span>
                    <span className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-sky-200">Kode Unit</span>
                    <span>|</span>
                    <span className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-sky-200 font-bold">Latitude*</span>
                    <span>|</span>
                    <span className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-sky-200 font-bold">Longitude*</span>
                    <span>|</span>
                    <span className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-sky-200 font-bold">Radius Meter*</span>
                    <span>|</span>
                    <span className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-sky-200">Alamat</span>
                    <span>|</span>
                    <span className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-sky-200 font-bold">Tipe</span>
                  </div>
                </div>

                {/* Detail Panduan Expanded */}
                {showGuide && (
                  <div className="p-3.5 border-t border-sky-200/70 bg-white/90 space-y-3.5 text-text-secondary animate-in fade-in">
                    {/* Logika Bisnis Tipe Lokasi */}
                    <div>
                      <h4 className="font-bold text-text-primary text-[11px] uppercase tracking-wide flex items-center gap-1.5 mb-2">
                        <Briefcase className="w-3.5 h-3.5 text-primary" />
                        <span>Logika Bisnis & Penjelasan Pilihan Kolom "Tipe":</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                          <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                            <span className="font-mono bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded text-[10px]">school</span>
                            <span>Sekolah Rakyat (SRP)</span>
                          </div>
                          <p className="text-[11px] text-emerald-900 mt-1">
                            Unit Sekolah Rakyat tempat guru, pengajar, dan staf sekolah bertugas. Terhubung langsung dengan unit penugasan karyawan untuk absensi harian.
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/50">
                          <div className="font-bold text-purple-950 flex items-center gap-1.5">
                            <span className="font-mono bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded text-[10px]">headquarters</span>
                            <span>Kantor Pusat</span>
                          </div>
                          <p className="text-[11px] text-purple-900 mt-1">
                            Kantor pusat operasional yayasan/manajemen utama, tempat manajemen pusat & tim operasional inti bekerja.
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50">
                          <div className="font-bold text-amber-950 flex items-center gap-1.5">
                            <span className="font-mono bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded text-[10px]">branch</span>
                            <span>Kantor Cabang / Wilayah</span>
                          </div>
                          <p className="text-[11px] text-amber-900 mt-1">
                            Kantor perwakilan cabang regional atau pos koordinasi distrik di daerah penugasan.
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
                          <div className="font-bold text-slate-950 flex items-center gap-1.5">
                            <span className="font-mono bg-slate-200 text-slate-900 px-1.5 py-0.2 rounded text-[10px]">other</span>
                            <span>Pos / Lokasi Tugas Lainnya</span>
                          </div>
                          <p className="text-[11px] text-slate-800 mt-1">
                            Fasilitas pendukung, asrama, pos penugasan luar kota, atau lokasi proyek lapangan khusus.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Panduan Format Data & Koordinat */}
                    <div className="border-t border-border-subtle pt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <strong className="text-text-primary block mb-0.5">Format Koordinat GPS (Latitude & Longitude):</strong>
                        <p className="text-text-muted">
                          Buka Google Maps, klik kanan pada gerbang/gedung lokasi, lalu salin angka koordinat. Sistem mendukung angka dengan tanda desimal titik (<span className="font-mono font-bold">-6.482711</span>) maupun koma (<span className="font-mono font-bold">-6,482711</span>) secara otomatis!
                        </p>
                      </div>
                      <div>
                        <strong className="text-text-primary block mb-0.5">Pencegahan Duplikasi (Smart Sync):</strong>
                        <p className="text-text-muted">
                          Sistem mendeteksi jika Kode Unit atau Nama Lokasi sudah terdaftar. Data tersebut akan otomatis <strong>DIPERBARUI (UPDATE)</strong> dan tidak akan membuat baris ganda di database.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* AREA UNGGAH FILE / DROPZONE (JIKA BELUM ADA PREVIEW) */}
              {!previewData && !previewLoading && !importResult && (
                <div className="border-2 border-dashed border-border-subtle hover:border-primary/60 rounded-2xl p-7 text-center transition-all bg-surface-container/20 group">
                  <input
                    type="file"
                    id="excel_location_file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label
                    htmlFor="excel_location_file"
                    className="cursor-pointer flex flex-col items-center justify-center gap-3"
                  >
                    <div className="p-3.5 bg-primary/10 group-hover:bg-primary/20 rounded-2xl transition-all">
                      <Upload className="w-8 h-8 text-primary animate-bounce" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-text-primary">
                        Klik untuk Memilih File atau Drag & Drop File ke Sini
                      </div>
                      <p className="text-xs text-text-muted mt-1">
                        Format didukung: File Excel (<strong>.xlsx</strong>, <strong>.xls</strong>) atau <strong>.csv</strong> (Maks. 10 MB)
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-panel border border-border-subtle rounded-xl text-xs font-semibold text-text-secondary group-hover:border-primary transition-all shadow-2xs">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Pilih File dari Komputer</span>
                    </span>
                  </label>
                </div>
              )}

              {/* LOADING ANALISIS PREVIEW */}
              {previewLoading && (
                <div className="p-8 rounded-2xl border border-primary/20 bg-primary/5 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
                  <div className="text-sm font-bold text-text-primary">
                    Menganalisis Spreadsheet & Menyiapkan Pratinjau Data...
                  </div>
                  <p className="text-xs text-text-muted max-w-md mx-auto">
                    Sistem sedang memvalidasi koordinat latitude, longitude, toleransi radius, serta mengecek duplikasi lokasi.
                  </p>
                </div>
              )}

              {/* PRATINJAU DATA (PREVIEW TABLE & SUMMARY) */}
              {previewData && !importResult && (
                <div className="space-y-3.5 animate-in fade-in">
                  {/* File Info Bar */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container/50 border border-border-subtle text-xs">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-text-primary">{previewData.summary.filename}</span>
                      <span className="text-text-muted">({(previewData.summary.file_size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetImport}
                      className="px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:text-text-primary bg-surface-panel border border-border-subtle rounded-lg hover:bg-surface-container transition-all cursor-pointer"
                    >
                      Ganti File
                    </button>
                  </div>

                  {/* Summary Metric Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl border border-border-subtle bg-surface-container/40">
                      <div className="text-[11px] text-text-muted">Total Baris Terdeteksi</div>
                      <div className="text-base font-bold text-text-primary mt-0.5">
                        {previewData.summary.total_rows}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70">
                      <div className="text-[11px] text-emerald-800 font-semibold">Siap Tambah Baru</div>
                      <div className="text-base font-bold text-emerald-700 mt-0.5">
                        +{previewData.summary.create_count}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl border border-sky-200 bg-sky-50/70">
                      <div className="text-[11px] text-sky-800 font-semibold">Siap Update Eksisting</div>
                      <div className="text-base font-bold text-sky-700 mt-0.5">
                        ↻ {previewData.summary.update_count}
                      </div>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${previewData.summary.invalid_rows > 0 ? 'border-rose-200 bg-rose-50/80 text-rose-800' : 'border-emerald-200 bg-emerald-50/50 text-emerald-800'}`}>
                      <div className="text-[11px] font-semibold">
                        {previewData.summary.invalid_rows > 0 ? 'Data Bermasalah' : 'Status Validasi'}
                      </div>
                      <div className="text-base font-bold mt-0.5">
                        {previewData.summary.invalid_rows > 0 ? `${previewData.summary.invalid_rows} Baris Error` : 'Semua Valid ✓'}
                      </div>
                    </div>
                  </div>

                  {/* Peringatan Jika Ada Error */}
                  {previewData.summary.invalid_rows > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Perhatian:</strong> Terdapat {previewData.summary.invalid_rows} baris data yang memiliki catatan kesalahan koordinat/nama. Baris bertanda Error akan otomatis dilewati saat import.
                      </div>
                    </div>
                  )}

                  {/* Tabel Pratinjau Interaktif */}
                  <div className="border border-border-subtle rounded-xl overflow-hidden shadow-2xs bg-surface-panel">
                    <div className="px-3.5 py-2 bg-surface-container/30 border-b border-border-subtle flex items-center justify-between text-xs">
                      <span className="font-bold text-text-primary flex items-center gap-1.5">
                        <span>Pratinjau Baris Data Spreadsheet</span>
                        <span className="text-[11px] font-normal text-text-muted">({previewData.preview_rows.length} baris)</span>
                      </span>
                      <span className="text-[11px] text-text-muted">
                        Periksa kembali kesesuaian koordinat & tipe sebelum import
                      </span>
                    </div>

                    <div className="max-h-72 overflow-y-auto overflow-x-auto scrollbar-thin">
                      <table className="w-full min-w-[760px] text-left text-xs border-collapse">
                        <thead className="bg-surface-container/60 sticky top-0 z-10 text-text-muted font-semibold border-b border-border-subtle">
                          <tr>
                            <th className="py-2.5 px-3 w-12 text-center">No</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Nama Lokasi</th>
                            <th className="py-2.5 px-3">Kode Unit</th>
                            <th className="py-2.5 px-3">Tipe</th>
                            <th className="py-2.5 px-3">Koordinat GPS</th>
                            <th className="py-2.5 px-3">Radius</th>
                            <th className="py-2.5 px-3">Alamat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle font-normal">
                          {previewData.preview_rows.map((row: any, idx: number) => {
                            const isErr = !row.is_valid;
                            return (
                              <tr
                                key={idx}
                                className={`transition-colors ${isErr ? 'bg-rose-50/70 hover:bg-rose-50' : 'hover:bg-surface-container/20'}`}
                              >
                                <td className="py-2.5 px-3 text-center text-text-muted font-mono text-[11px]">
                                  {row.row_index}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  {isErr ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                      <AlertCircle className="w-3 h-3 text-rose-600" />
                                      <span>Error</span>
                                    </span>
                                  ) : row.action === 'update' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                                      <RefreshCw className="w-2.5 h-2.5 text-sky-600" />
                                      <span>Update</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                      <Plus className="w-3 h-3 text-emerald-600" />
                                      <span>Baru</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-text-primary">{row.name}</div>
                                  {isErr && row.errors?.length > 0 && (
                                    <div className="text-[10px] text-rose-700 font-medium mt-0.5">
                                      {row.errors.join(', ')}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-text-secondary">
                                  {row.code || '-'}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                      row.type === 'school'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : row.type === 'headquarters'
                                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                        : row.type === 'branch'
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : 'bg-slate-50 text-slate-700 border border-slate-200'
                                    }`}
                                  >
                                    {row.type_label}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                                  {row.latitude !== null && row.longitude !== null ? (
                                    <span className="text-text-secondary">
                                      {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
                                    </span>
                                  ) : (
                                    <span className="text-rose-600 font-bold">Tidak Valid</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap font-medium text-text-secondary">
                                  {row.radius_meters} m
                                </td>
                                <td className="py-2.5 px-3 text-text-muted max-w-[180px] truncate" title={row.address}>
                                  {row.address}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* HASIL RINGKASAN SETELAH IMPORT SELESAI */}
              {importResult && (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-3 animate-in zoom-in-95">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-100 rounded-full">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-emerald-950 text-sm">Proses Import Selesai Berhasil!</h4>
                      <p className="text-emerald-800 text-xs">Data master lokasi absensi telah berhasil disimpan dan disinkronisasi.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200 text-center">
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[11px] text-emerald-800 block">Lokasi Baru</span>
                      <strong className="text-emerald-900 text-sm">+{importResult.imported_count}</strong>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[11px] text-emerald-800 block">Lokasi Diperbarui</span>
                      <strong className="text-emerald-900 text-sm">↻ {importResult.updated_count}</strong>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[11px] text-emerald-800 block">Total Lokasi Aktif</span>
                      <strong className="text-emerald-900 text-sm">{importResult.total_current}</strong>
                    </div>
                  </div>

                  {importResult.errors?.length > 0 && (
                    <div className="pt-2 text-rose-800 text-[11px]">
                      <strong>Catatan Kesalahan yang Dilewati ({importResult.errors.length}):</strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        {importResult.errors.slice(0, 5).map((err: string, i: number) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-primary rounded-xl cursor-pointer"
              >
                {importResult ? 'Tutup Jendela' : 'Batal'}
              </button>

              <div className="flex items-center gap-2">
                {importResult ? (
                  <button
                    type="button"
                    onClick={() => setImportModalOpen(false)}
                    className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Selesai</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleImportSubmit()}
                    disabled={importLoading || !importFile || !previewData || previewData?.summary?.valid_rows === 0}
                    className="px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {importLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sedang Mengimpor Data...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {previewData
                            ? `Mulai Import ${previewData.summary.valid_rows} Lokasi Valid`
                            : 'Mulai Import Lokasi'}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT LOKASI MANUAL */}
      {locationModalOpen && editingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-6 shadow-xl max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h3 className="font-bold text-text-primary text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span>{editingLocation.id ? 'Edit Titik Lokasi' : 'Tambah Titik Lokasi Baru'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setLocationModalOpen(false)}
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModalLocation} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-text-primary block">
                    Nama Lokasi / Unit Sekolah*
                  </label>
                  {schoolUnitOptions.length > 0 && !editingLocation.id && (
                    <span className="text-[11px] text-primary font-medium">
                      Tersedia {schoolUnitOptions.length} unit data gaji
                    </span>
                  )}
                </div>

                {/* Dropdown Auto-Complete dari Data Unit Sekolah yang Diimpor */}
                {schoolUnitOptions.length > 0 && !editingLocation.id && (
                  <div className="mb-2">
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const opt = schoolUnitOptions.find((o) => o.name === val);
                        setEditingLocation((prev) => ({
                          ...prev,
                          name: val,
                          type: 'school',
                          address: prev?.address || `Unit ${val}`,
                          latitude: opt?.latitude ?? prev?.latitude ?? -6.2088,
                          longitude: opt?.longitude ?? prev?.longitude ?? 106.8456,
                          radius_meters: opt?.radius_meters ?? prev?.radius_meters ?? 100,
                        }));
                      }}
                      value={schoolUnitOptions.some((o) => o.name === editingLocation.name) ? editingLocation.name : ''}
                      className="w-full px-3 py-1.5 text-xs bg-primary/5 border border-primary/20 rounded-xl text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer mb-1.5"
                    >
                      <option value="">-- Pilih dari Unit Sekolah Terdaftar (Data Gaji) --</option>
                      {schoolUnitOptions.map((opt) => (
                        <option key={opt.name} value={opt.name}>
                          {opt.name} ({opt.employee_count} Karyawan) {opt.is_configured ? '✓ Lokasi sudah ada' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <input
                  type="text"
                  required
                  placeholder="Contoh: Sekolah Rakyat Jakarta 01"
                  value={editingLocation.name || ''}
                  onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />

                {/* Info Otomatis Hubungkan Karyawan */}
                {(() => {
                  const matchedOpt = schoolUnitOptions.find(
                    (o) => o.name.toLowerCase() === (editingLocation.name || '').trim().toLowerCase()
                  );
                  if (matchedOpt && matchedOpt.employee_count > 0) {
                    return (
                      <p className="text-[11px] text-emerald-700 font-medium mt-1.5 flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                        <span>
                          Ditemukan <strong>{matchedOpt.employee_count} karyawan</strong> di unit sekolah ini. Karyawan akan otomatis terhubung ke lokasi ini!
                        </span>
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-primary block mb-1">Kode Unit</label>
                  <input
                    type="text"
                    placeholder="Contoh: SRP-001"
                    value={editingLocation.code || ''}
                    onChange={(e) => setEditingLocation({ ...editingLocation, code: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-text-primary block mb-1">Tipe</label>
                  <select
                    value={editingLocation.type || 'school'}
                    onChange={(e) => setEditingLocation({ ...editingLocation, type: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="school">Sekolah Rakyat</option>
                    <option value="headquarters">Kantor Pusat</option>
                    <option value="branch">Cabang</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-primary block mb-1">Latitude*</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editingLocation.latitude ?? ''}
                    onChange={(e) => setEditingLocation({ ...editingLocation, latitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-text-primary block mb-1">Longitude*</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editingLocation.longitude ?? ''}
                    onChange={(e) => setEditingLocation({ ...editingLocation, longitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-primary block mb-1">Radius Geofencing (Meter)*</label>
                <input
                  type="number"
                  min={10}
                  max={10000}
                  required
                  value={editingLocation.radius_meters ?? 100}
                  onChange={(e) => setEditingLocation({ ...editingLocation, radius_meters: parseInt(e.target.value) || 100 })}
                  className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-primary block mb-1">Alamat Lengkap</label>
                <textarea
                  rows={2}
                  placeholder="Alamat lengkap lokasi..."
                  value={editingLocation.address || ''}
                  onChange={(e) => setEditingLocation({ ...editingLocation, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-primary rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="px-5 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {modalSaving ? 'Menyimpan...' : 'Simpan Lokasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ATUR PENUGASAN KARYAWAN MANUAL */}
      {assignModalOpen && selectedLocationForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-6 shadow-xl max-w-xl w-full space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle shrink-0">
              <div>
                <h3 className="font-bold text-text-primary text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span>Atur Penugasan Karyawan Manual</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Lokasi: <strong>{selectedLocationForAssign.name}</strong> ({selectedUserIds.length} Karyawan Terpilih)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-amber-50/80 border border-amber-200 rounded-xl px-3.5 py-2.5 text-amber-900 text-xs shrink-0 flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Karyawan yang terhubung ke lokasi ini <strong>tidak perlu lagi memilih lokasi</strong> saat melakukan absensi masuk.
              </span>
            </div>

            {/* Search Karyawan & Select All Bar */}
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama karyawan / NIK / unit..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const filtered = (assignEmployeesData?.all_employees || []).filter((emp: any) => {
                    const q = assignSearch.toLowerCase();
                    return (
                      emp.name?.toLowerCase().includes(q) ||
                      emp.nik?.toLowerCase().includes(q) ||
                      emp.school_unit?.toLowerCase().includes(q)
                    );
                  });
                  const allFilteredIds = filtered.map((e: any) => e.id);
                  const isAllSelected = allFilteredIds.every((id) => selectedUserIds.includes(id));
                  if (isAllSelected) {
                    setSelectedUserIds(selectedUserIds.filter((id) => !allFilteredIds.includes(id)));
                  } else {
                    setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...allFilteredIds])));
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-surface-container border border-border-subtle hover:bg-surface-container-high rounded-xl text-text-primary cursor-pointer shrink-0"
              >
                Pilih / Batal Semua
              </button>
            </div>

            {/* List Karyawan */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[200px] max-h-[350px] scrollbar-thin">
              {assignLoading ? (
                <div className="py-12 text-center text-xs text-text-muted">Memuat data karyawan...</div>
              ) : (assignEmployeesData?.all_employees || []).length === 0 ? (
                <div className="py-12 text-center text-xs text-text-muted">Tidak ada data karyawan ditemukan.</div>
              ) : (
                (assignEmployeesData?.all_employees || [])
                  .filter((emp: any) => {
                    const q = assignSearch.toLowerCase();
                    return (
                      emp.name?.toLowerCase().includes(q) ||
                      emp.nik?.toLowerCase().includes(q) ||
                      emp.school_unit?.toLowerCase().includes(q)
                    );
                  })
                  .map((emp: any) => {
                    const isChecked = selectedUserIds.includes(emp.id);
                    return (
                      <label
                        key={emp.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-primary/5 border-primary/40 text-text-primary'
                            : 'bg-surface-container/30 border-border-subtle hover:bg-surface-container text-text-secondary'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserIds([...selectedUserIds, emp.id]);
                              } else {
                                setSelectedUserIds(selectedUserIds.filter((id) => id !== emp.id));
                              }
                            }}
                            className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                          />
                          <div>
                            <div className="font-semibold text-text-primary flex items-center gap-2">
                              <span>{emp.name}</span>
                              {emp.nik && (
                                <span className="font-mono text-[10px] text-text-muted">({emp.nik})</span>
                              )}
                            </div>
                            <div className="text-[11px] text-text-muted mt-0.5">
                              Unit Sekolah: {emp.school_unit || '-'}
                            </div>
                          </div>
                        </div>
                        {isChecked && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                            Terhubung
                          </span>
                        )}
                      </label>
                    );
                  })
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-2.5 shrink-0">
              <span className="text-xs text-text-muted">
                <strong>{selectedUserIds.length}</strong> karyawan dipilih
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-primary rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignEmployees}
                  disabled={assignSaving}
                  className="px-5 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {assignSaving ? 'Menyimpan...' : 'Simpan Penugasan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PENGATURAN RADIUS KANTOR PUSAT & JAM KERJA */}
      {activeTab === 'settings' && (
        <div className="bg-surface-panel border border-border-subtle rounded-2xl p-6 shadow-xs max-w-4xl mx-auto">
          <div className="pb-4 border-b border-border-subtle">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Compass className="w-5 h-5 text-primary" />
              <span>Konfigurasi Standar Jam Kerja & Toleransi</span>
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Atur jam masuk, jam pulang, dan toleransi keterlambatan baku untuk presensi karyawan.
            </p>
          </div>

          {settingsLoading || !settings ? (
            <div className="py-12 text-center text-text-muted text-xs">
              Memuat konfigurasi kantor...
            </div>
          ) : (
            <form onSubmit={handleSaveSettings} className="mt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Nama Kantor */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-text-primary mb-1.5">
                    Nama Kantor Pusat / Default
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={settings.office_name}
                      onChange={(e) => setSettings({ ...settings, office_name: e.target.value })}
                      placeholder="Contoh: Kantor Pusat RBS / Riama Mandiri"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Latitude */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1.5">
                    Latitude Kantor Default
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={settings.latitude}
                    onChange={(e) => setSettings({ ...settings, latitude: parseFloat(e.target.value) || 0 })}
                    placeholder="-6.2088000"
                    className="w-full px-3 py-2 text-xs font-mono bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Longitude */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1.5">
                    Longitude Kantor Default
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={settings.longitude}
                    onChange={(e) => setSettings({ ...settings, longitude: parseFloat(e.target.value) || 0 })}
                    placeholder="106.8456000"
                    className="w-full px-3 py-2 text-xs font-mono bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Tombol Ambil Lokasi Admin Saat Ini */}
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={gpsDetecting}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all cursor-pointer"
                  >
                    <Crosshair className={`w-3.5 h-3.5 ${gpsDetecting ? 'animate-spin' : ''}`} />
                    <span>{gpsDetecting ? 'Mengambil GPS Admin...' : 'Gunakan Koordinat GPS Saya Saat Ini'}</span>
                  </button>
                </div>

                {/* Radius Meter */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1.5">
                    Batas Radius Default (Meter)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={10}
                      max={10000}
                      required
                      value={settings.radius_meters}
                      onChange={(e) => setSettings({ ...settings, radius_meters: parseInt(e.target.value) || 50 })}
                      className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-muted font-medium">
                      Meter
                    </span>
                  </div>
                  <span className="text-[11px] text-text-muted mt-1 block">
                    Disarankan 50–150 meter untuk area gedung kantor.
                  </span>
                </div>

                {/* Toleransi Menit Terlambat */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1.5">
                    Toleransi Keterlambatan (Menit)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={120}
                      required
                      value={settings.late_tolerance_minutes}
                      onChange={(e) => setSettings({ ...settings, late_tolerance_minutes: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-muted font-medium">
                      Menit
                    </span>
                  </div>
                </div>

                {/* Jam Masuk Kerja */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1.5">
                    Jam Masuk Baku
                  </label>
                  <input
                    type="time"
                    required
                    value={settings.work_start_time}
                    onChange={(e) => setSettings({ ...settings, work_start_time: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Jam Pulang Kerja */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1.5">
                    Jam Pulang Baku
                  </label>
                  <input
                    type="time"
                    required
                    value={settings.work_end_time}
                    onChange={(e) => setSettings({ ...settings, work_end_time: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{settingsSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Lightbox Modal Foto Bukti Kehadiran */}
      {previewPhotoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewPhotoModal(null)}
        >
          <div
            className="relative max-w-lg w-full bg-surface-panel rounded-2xl overflow-hidden shadow-2xl border border-border-subtle"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 border-b border-border-subtle bg-surface-container">
              <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-primary" />
                <span>Foto Bukti Kehadiran Karyawan</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhotoModal(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-panel transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 bg-black/90 flex items-center justify-center max-h-[75vh] overflow-hidden">
              <img
                src={previewPhotoModal}
                alt="Foto Bukti Kehadiran"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
