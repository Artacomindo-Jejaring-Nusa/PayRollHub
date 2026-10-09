import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Calendar,
  Compass,
  Building,
  Info,
} from 'lucide-react';
import {
  attendanceService,
  calculateDistanceMeters,
} from '../services/attendanceService';
import { TodayAttendanceData, AttendanceRecord } from '../types/attendance';

export const EmployeeAttendancePage: React.FC = () => {
  // Server & Attendance State
  const [todayData, setTodayData] = useState<TodayAttendanceData | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Live GPS State
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isDetectingGps, setIsDetectingGps] = useState(true);
  const [liveDistance, setLiveDistance] = useState<number | null>(null);

  // Live Clock State
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' WIB'
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Attendance Data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await attendanceService.getTodayAttendance();
      setTodayData(data);

      const historyData = await attendanceService.getEmployeeHistory(selectedMonth);
      setHistory(historyData.data || []);
    } catch (err: any) {
      console.error(err);
      setMessage({
        text: err.response?.data?.message || 'Gagal memuat data absensi.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Request & Update GPS Location
  const requestLocation = useCallback(() => {
    setIsDetectingGps(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Browser Anda tidak mendukung deteksi lokasi GPS.');
      setIsDetectingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });
        setGpsError(null);
        setIsDetectingGps(false);

        // Hitung jarak ke kantor jika setting kantor sudah ada
        if (todayData?.office_setting) {
          const dist = calculateDistanceMeters(
            lat,
            lng,
            todayData.office_setting.latitude,
            todayData.office_setting.longitude
          );
          setLiveDistance(dist);
        }
      },
      (error) => {
        setIsDetectingGps(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Izin akses lokasi (GPS) ditolak. Silakan izinkan browser mengakses lokasi.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('Informasi lokasi GPS tidak tersedia pada perangkat saat ini.');
            break;
          case error.TIMEOUT:
            setGpsError('Waktu deteksi lokasi GPS habis. Silakan coba lagi.');
            break;
          default:
            setGpsError('Gagal mendeteksi lokasi GPS.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  }, [todayData]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Recalculate distance when todayData or coords update
  useEffect(() => {
    if (coords && todayData?.office_setting) {
      const dist = calculateDistanceMeters(
        coords.lat,
        coords.lng,
        todayData.office_setting.latitude,
        todayData.office_setting.longitude
      );
      setLiveDistance(dist);
    }
  }, [coords, todayData]);

  const maxRadius = todayData?.office_setting?.radius_meters || 100;
  const isWithinRadius = liveDistance !== null && liveDistance <= maxRadius;
  const hasCheckedIn = !!todayData?.attendance?.check_in_time;
  const hasCheckedOut = !!todayData?.attendance?.check_out_time;

  // Handle Absen Masuk
  const handleCheckIn = async () => {
    if (!coords) {
      setMessage({ text: 'Lokasi GPS belum terdeteksi. Silakan aktifkan GPS.', type: 'error' });
      return;
    }

    try {
      setActionLoading(true);
      setMessage(null);
      const res = await attendanceService.checkIn({
        latitude: coords.lat,
        longitude: coords.lng,
      });
      setMessage({ text: res.message || 'Absen masuk berhasil!', type: 'success' });
      fetchData();
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || 'Gagal melakukan absen masuk.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Absen Pulang
  const handleCheckOut = async () => {
    if (!coords) {
      setMessage({ text: 'Lokasi GPS belum terdeteksi. Silakan aktifkan GPS.', type: 'error' });
      return;
    }

    try {
      setActionLoading(true);
      setMessage(null);
      const res = await attendanceService.checkOut({
        latitude: coords.lat,
        longitude: coords.lng,
      });
      setMessage({ text: res.message || 'Absen pulang berhasil!', type: 'success' });
      fetchData();
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || 'Gagal melakukan absen pulang.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-primary" />
            <span>Absensi Kehadiran</span>
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Absensi mandiri berbasis verifikasi radius lokasi kantor (Cepat, otomatis, tanpa foto muka).
          </p>
        </div>

        {/* Live Digital Clock Badge */}
        <div className="bg-surface-panel border border-border-subtle rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-2xs shrink-0">
          <Clock className="w-5 h-5 text-primary animate-pulse" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Waktu Server (WIB)
            </div>
            <div className="text-lg font-mono font-bold text-text-primary leading-tight">
              {currentTime || '--:--:-- WIB'}
            </div>
          </div>
        </div>
      </div>

      {/* Alert Notification */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 shadow-2xs animate-in fade-in ${
            message.type === 'success'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
              : 'bg-rose-50/80 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          )}
          <div className="text-[13.5px] font-medium leading-relaxed">{message.text}</div>
        </div>
      )}

      {/* Main Grid: Live Radar Card & Action Buttons */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): GPS Radar & Action Box */}
        <div className="lg:col-span-7 space-y-5">
          {/* Geofence Radar Status Card */}
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-5 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2 text-text-primary font-semibold text-[14.5px]">
                <Compass className="w-4 h-4 text-primary" />
                <span>Radar Lokasi & Radius Kantor</span>
              </div>
              <button
                type="button"
                onClick={requestLocation}
                disabled={isDetectingGps}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-medium text-text-secondary hover:text-primary hover:bg-surface-container rounded-lg border border-border-subtle transition-all cursor-pointer disabled:opacity-50"
                title="Segarkan koordinat GPS"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDetectingGps ? 'animate-spin' : ''}`} />
                <span>{isDetectingGps ? 'Mendeteksi...' : 'Cek Ulang GPS'}</span>
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Office Target Info */}
              <div className="flex items-start gap-3 bg-surface-container/60 border border-border-subtle/70 rounded-xl p-3">
                <Building className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] text-text-muted font-medium">Titik Lokasi Kantor:</div>
                  <div className="text-[13px] font-semibold text-text-primary truncate">
                    {todayData?.office_setting?.office_name || 'Kantor Pusat'}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5 font-mono">
                    Maks. Radius: <strong>{maxRadius} Meter</strong> | Jam Masuk: <strong>{todayData?.office_setting?.work_start_time || '08:00'}</strong>
                  </div>
                </div>
              </div>

              {/* Status Radius Visual */}
              {isDetectingGps ? (
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4 flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-amber-600 animate-spin shrink-0" />
                  <div className="text-[12.5px] text-amber-800">
                    <strong className="block font-semibold">Sedang mencari sinyal satelit GPS...</strong>
                    Pastikan GPS aktif dan Anda mengizinkan izin lokasi pada peramban.
                  </div>
                </div>
              ) : gpsError ? (
                <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-[12.5px] text-rose-800">
                    <strong className="block font-semibold">Akses GPS Terkendala</strong>
                    {gpsError}
                  </div>
                </div>
              ) : isWithinRadius ? (
                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-[12.5px] text-emerald-800">
                    <strong className="block font-semibold text-emerald-900">
                      ✓ Anda Berada di Dalam Radius Kantor ({liveDistance} meter)
                    </strong>
                    Jarak Anda berada di dalam batas toleransi ({maxRadius} meter). Tombol absensi aktif.
                  </div>
                </div>
              ) : (
                <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-[12.5px] text-rose-800">
                    <strong className="block font-semibold text-rose-900">
                      ⚠ Di Luar Radius Kantor (Jarak: {liveDistance !== null ? `${liveDistance} meter` : '-'})
                    </strong>
                    Batas maksimum kantor adalah <strong>{maxRadius} meter</strong>. Silakan mendekat ke lokasi kantor untuk melakukan absensi.
                  </div>
                </div>
              )}
            </div>

            {/* Attendance Buttons */}
            <div className="pt-2 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Button Absen Masuk */}
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={actionLoading || isDetectingGps || !isWithinRadius || hasCheckedIn}
                className={`h-12 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                  hasCheckedIn
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-not-allowed opacity-90'
                    : isWithinRadius
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-98'
                    : 'bg-surface-container text-text-muted border border-border-subtle cursor-not-allowed opacity-60'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{hasCheckedIn ? '✓ Sudah Absen Masuk' : 'Absen Masuk'}</span>
              </button>

              {/* Button Absen Pulang */}
              <button
                type="button"
                onClick={handleCheckOut}
                disabled={
                  actionLoading ||
                  isDetectingGps ||
                  !isWithinRadius ||
                  !hasCheckedIn ||
                  hasCheckedOut
                }
                className={`h-12 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                  hasCheckedOut
                    ? 'bg-blue-100 text-blue-800 border border-blue-200 cursor-not-allowed opacity-90'
                    : hasCheckedIn && isWithinRadius
                    ? 'bg-rose-600 hover:bg-rose-700 text-white active:scale-98'
                    : 'bg-surface-container text-text-muted border border-border-subtle cursor-not-allowed opacity-60'
                }`}
              >
                <LogOut className="w-4 h-4" />
                <span>{hasCheckedOut ? '✓ Sudah Absen Pulang' : 'Absen Pulang'}</span>
              </button>
            </div>
          </div>

          {/* Light & Fast Server Note */}
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/60 text-blue-800 text-[12px] flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Sistem Cepat & Hemat Server:</strong> Absensi menggunakan verifikasi presisi GPS tanpa foto selfie, menghemat ruang penyimpanan server hingga 100% dan proses selesai dalam 1 detik.
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Today Summary Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-5 shadow-xs">
            <h2 className="font-semibold text-text-primary text-[14.5px] pb-3 border-b border-border-subtle flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span>Ringkasan Kehadiran Hari Ini</span>
            </h2>

            <div className="mt-4 space-y-3.5">
              {/* Check-In Detail */}
              <div className="p-3.5 rounded-xl bg-surface-container/50 border border-border-subtle">
                <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Jam Absen Masuk
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="text-xl font-bold font-mono text-text-primary">
                    {todayData?.attendance?.check_in_time
                      ? todayData.attendance.check_in_time.substring(0, 5) + ' WIB'
                      : '--:--'}
                  </div>
                  {todayData?.attendance?.check_in_time && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                        todayData.attendance.check_in_status === 'late'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {todayData.attendance.check_in_status === 'late' ? 'Terlambat' : 'Tepat Waktu'}
                    </span>
                  )}
                </div>
                {todayData?.attendance?.check_in_distance_meters !== null && todayData?.attendance?.check_in_distance_meters !== undefined && (
                  <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-text-muted" />
                    <span>Jarak saat absen: {todayData.attendance.check_in_distance_meters} m dari kantor</span>
                  </div>
                )}
              </div>

              {/* Check-Out Detail */}
              <div className="p-3.5 rounded-xl bg-surface-container/50 border border-border-subtle">
                <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Jam Absen Pulang
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="text-xl font-bold font-mono text-text-primary">
                    {todayData?.attendance?.check_out_time
                      ? todayData.attendance.check_out_time.substring(0, 5) + ' WIB'
                      : '--:--'}
                  </div>
                  {todayData?.attendance?.check_out_time && (
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-blue-100 text-blue-800">
                      Selesai
                    </span>
                  )}
                </div>
                {todayData?.attendance?.check_out_distance_meters !== null && todayData?.attendance?.check_out_distance_meters !== undefined && (
                  <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-text-muted" />
                    <span>Jarak saat pulang: {todayData.attendance.check_out_distance_meters} m dari kantor</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History Table Card */}
      <div className="bg-surface-panel border border-border-subtle rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border-subtle">
          <div>
            <h3 className="font-semibold text-text-primary text-[15px]">Riwayat Kehadiran Bulan Ini</h3>
            <p className="text-xs text-text-muted mt-0.5">Daftar rekapitulasi kehadiran Anda.</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted font-medium">Bulan:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-xs bg-surface-container border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted font-semibold bg-surface-container/30">
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Jam Masuk</th>
                <th className="py-2.5 px-3">Jarak Masuk</th>
                <th className="py-2.5 px-3">Jam Pulang</th>
                <th className="py-2.5 px-3">Jarak Pulang</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted">
                    Memuat riwayat kehadiran...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted">
                    Belum ada riwayat kehadiran pada bulan {selectedMonth}.
                  </td>
                </tr>
              ) : (
                history.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-container/20 transition-colors">
                    <td className="py-3 px-3 font-medium text-text-primary">{row.date}</td>
                    <td className="py-3 px-3 font-mono font-medium">
                      {row.check_in_time ? row.check_in_time.substring(0, 5) : '-'}
                    </td>
                    <td className="py-3 px-3 text-text-muted">
                      {row.check_in_distance_meters !== null ? `${row.check_in_distance_meters} m` : '-'}
                    </td>
                    <td className="py-3 px-3 font-mono font-medium">
                      {row.check_out_time ? row.check_out_time.substring(0, 5) : '-'}
                    </td>
                    <td className="py-3 px-3 text-text-muted">
                      {row.check_out_distance_meters !== null ? `${row.check_out_distance_meters} m` : '-'}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
