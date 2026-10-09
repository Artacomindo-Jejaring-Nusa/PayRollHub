import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  MapPin,
  Calendar,
  Users,
  Search,
  Download,
  Settings,
  CheckCircle2,
  AlertCircle,
  Building,
  Save,
  Compass,
  Crosshair,
  ExternalLink,
} from 'lucide-react';
import { attendanceService } from '../services/attendanceService';
import {
  AttendanceRecord,
  AttendanceSummary,
  OfficeSetting,
} from '../types/attendance';

export const AdminAttendancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'recap' | 'settings'>('recap');

  // Recap & Filter State
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

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

  useEffect(() => {
    if (activeTab === 'recap') {
      fetchRecap();
    } else {
      fetchSettings();
    }
  }, [activeTab, fetchRecap, fetchSettings]);

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

  // Use Current Admin GPS Position
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-primary" />
            <span>Manajemen Absensi Karyawan</span>
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Rekapitulasi kehadiran harian dan konfigurasi titik lokasi kantor berbasis radius GPS.
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
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-surface-panel text-primary shadow-2xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Pengaturan Radius Kantor</span>
          </button>
        </div>
      </div>

      {/* TAB 1: REKAP KEHADIRAN KARYAWAN */}
      {activeTab === 'recap' && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
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
                Hadir Hari Ini
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                {summary?.total_present ?? '-'}
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

            <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 shadow-2xs col-span-2 lg:col-span-1">
              <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
                Belum Absen
              </div>
              <div className="text-2xl font-bold text-amber-700 mt-1">
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
              <span>Export CSV</span>
            </a>
          </div>

          {/* Table List */}
          <div className="bg-surface-panel border border-border-subtle rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-container/40 text-text-muted font-semibold">
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-3">Jabatan</th>
                    <th className="py-3 px-3">Tanggal</th>
                    <th className="py-3 px-3">Jam Masuk</th>
                    <th className="py-3 px-3">Jarak Masuk</th>
                    <th className="py-3 px-3">Status Masuk</th>
                    <th className="py-3 px-3">Jam Pulang</th>
                    <th className="py-3 px-3">Jarak Pulang</th>
                    <th className="py-3 px-4">Koordinat GPS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-text-muted">
                        Memuat data absensi karyawan...
                      </td>
                    </tr>
                  ) : attendances.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-text-muted">
                        Tidak ada data absensi untuk tanggal {selectedDate}.
                      </td>
                    </tr>
                  ) : (
                    attendances.map((row) => (
                      <tr key={row.id} className="hover:bg-surface-container/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-text-primary">{row.user?.name || '-'}</div>
                          <div className="text-[11px] text-text-muted font-mono">
                            NIK: {row.user?.nik || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-text-muted capitalize">
                          {row.user?.position || (row.user?.role === 'karyawan' ? 'Karyawan (Portal)' : row.user?.role || '-')}
                        </td>
                        <td className="py-3 px-3 font-medium text-text-primary">{row.date}</td>
                        <td className="py-3 px-3 font-mono font-medium">
                          {row.check_in_time ? row.check_in_time.substring(0, 5) : '-'}
                        </td>
                        <td className="py-3 px-3 text-text-muted">
                          {row.check_in_distance_meters !== null ? `${row.check_in_distance_meters} m` : '-'}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              row.check_in_status === 'late'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {row.check_in_status === 'late' ? 'Terlambat' : 'Tepat Waktu'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-medium">
                          {row.check_out_time ? row.check_out_time.substring(0, 5) : '-'}
                        </td>
                        <td className="py-3 px-3 text-text-muted">
                          {row.check_out_distance_meters !== null ? `${row.check_out_distance_meters} m` : '-'}
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PENGATURAN RADIUS & LOKASI KANTOR */}
      {activeTab === 'settings' && (
        <div className="bg-surface-panel border border-border-subtle rounded-2xl p-6 shadow-xs max-w-4xl mx-auto">
          <div className="pb-4 border-b border-border-subtle">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Compass className="w-5 h-5 text-primary" />
              <span>Konfigurasi Geofencing & Radius Kantor</span>
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Tentukan koordinat pusat kantor dan radius jangkauan absensi dalam meter. Karyawan hanya dapat melakukan absensi jika berada di dalam radius ini.
            </p>
          </div>

          {notification && (
            <div
              className={`mt-4 p-4 rounded-xl border flex items-start gap-3 shadow-2xs ${
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
              <div className="text-xs font-medium">{notification.text}</div>
            </div>
          )}

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
                    Nama Kantor / Lokasi Kerja
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={settings.office_name}
                      onChange={(e) => setSettings({ ...settings, office_name: e.target.value })}
                      placeholder="Contoh: Kantor Pusat Riama Mandiri"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Latitude */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1.5">
                    Latitude Kantor
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
                    Longitude Kantor
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
                    Batas Radius Absensi (Meter)
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

              {/* Live OpenStreetMap Preview */}
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <div className="text-xs font-semibold text-text-primary mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span>Preview Peta Lokasi Kantor:</span>
                </div>
                <div className="w-full h-56 rounded-xl overflow-hidden border border-border-subtle bg-surface-container">
                  <iframe
                    title="OpenStreetMap Office"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${settings.longitude - 0.005}%2C${settings.latitude - 0.005}%2C${settings.longitude + 0.005}%2C${settings.latitude + 0.005}&layer=mapnik&marker=${settings.latitude}%2C${settings.longitude}`}
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
    </div>
  );
};
