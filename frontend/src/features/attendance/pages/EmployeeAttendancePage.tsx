import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  SunMedium,
  Briefcase,
  Navigation,
  Camera,
  Car,
  RotateCcw,
  Eye,
  X,
  FileText,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import {
  attendanceService,
  calculateDistanceMeters,
} from '../services/attendanceService';
import {
  TodayAttendanceData,
  AttendanceRecord,
  AttendanceLocation,
} from '../types/attendance';
import { LiveCameraModal } from '../components/LiveCameraModal';
import { getStorageUrl } from '../../../lib/utils';

export const EmployeeAttendancePage: React.FC = () => {
  const { user } = useAuthStore();
  const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin';

  // Server & Attendance State
  const [todayData, setTodayData] = useState<TodayAttendanceData | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Mode: 'masuk' (radius 100+ lokasi + foto selfie) | 'dinas_luar' (bebas radius + catatan & foto) | 'libur' (bebas radius)
  const [attendanceMode, setAttendanceMode] = useState<'masuk' | 'dinas_luar' | 'libur'>('masuk');
  const [holidayNotes, setHolidayNotes] = useState<string>('Hari Libur Terjadwal / Off Rutin');
  const [dinasNotes, setDinasNotes] = useState<string>('');
  const [checkInNotes, setCheckInNotes] = useState<string>('');

  // Camera & Photo State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dinasFileInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Live Camera Modal State
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState<boolean>(false);
  const [liveCameraConfig, setLiveCameraConfig] = useState<{
    title: string;
    description: string;
    facingMode: 'user' | 'environment';
    showFaceGuide: boolean;
  }>({
    title: 'Ambil Foto Selfie Kehadiran',
    description: 'Posisikan wajah Anda tepat di dalam lingkaran pemandu untuk absensi langsung.',
    facingMode: 'user',
    showFaceGuide: true,
  });

  const handleOpenLiveCamera = (mode: 'selfie' | 'dinas') => {
    if (mode === 'selfie') {
      setLiveCameraConfig({
        title: 'Ambil Foto Selfie Kehadiran (Live Sensor)',
        description: 'Posisikan wajah Anda tepat di dalam lingkaran pemandu untuk absensi masuk live.',
        facingMode: 'user',
        showFaceGuide: true,
      });
    } else {
      setLiveCameraConfig({
        title: 'Ambil Foto Dokumentasi Dinas Lapangan',
        description: 'Arahkan kamera ke lokasi kegiatan dinas atau bukti surat tugas lapangan.',
        facingMode: 'environment',
        showFaceGuide: false,
      });
    }
    setIsLiveCameraOpen(true);
  };

  const handleCameraCaptured = (file: File, previewUrl: string) => {
    setPhotoFile(file);
    setPhotoPreview(previewUrl);
  };

  // Modal Lightbox Foto Preview
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  // Modal Konfirmasi Absen Pulang < 8 Jam Kerja
  const [earlyCheckOutModalOpen, setEarlyCheckOutModalOpen] = useState<boolean>(false);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Live GPS State
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isDetectingGps, setIsDetectingGps] = useState(true);

  // Selected Target Location (from 100+ locations)
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

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

      // Jika user sudah absen libur atau dinas hari ini, sesuaikan tab
      if (data.attendance?.attendance_type === 'libur' || data.attendance?.status === 'holiday') {
        setAttendanceMode('libur');
      } else if (data.attendance?.attendance_type === 'dinas_luar') {
        setAttendanceMode('dinas_luar');
      }

      // Default selected location ke assigned_location jika belum dipilih
      if (data.assigned_location && !selectedLocationId) {
        setSelectedLocationId(data.assigned_location.id);
      }

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
  }, [selectedMonth, selectedLocationId]);

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
      },
      (error) => {
        setIsDetectingGps(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Izin akses lokasi (GPS) ditolak. Silakan izinkan browser mengakses lokasi perangkat.');
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
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Handle Ambil Foto Kamera / Upload
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setMessage({ text: 'Ukuran foto terlalu besar (maksimal 10MB).', type: 'error' });
        return;
      }
      setPhotoFile(file);
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    }
  };

  const handleResetPhoto = () => {
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (dinasFileInputRef.current) dinasFileInputRef.current.value = '';
  };

  // Kalkulasi Jarak Terhadap Seluruh 100+ Lokasi Aktif
  const locationsWithDistance = useMemo(() => {
    const list = todayData?.locations || [];
    if (!coords) {
      return list.map((loc) => ({ ...loc, distance_meters: undefined }));
    }
    return list.map((loc) => {
      const dist = calculateDistanceMeters(coords.lat, coords.lng, loc.latitude, loc.longitude);
      return {
        ...loc,
        distance_meters: dist,
      };
    }).sort((a, b) => (a.distance_meters || 0) - (b.distance_meters || 0));
  }, [todayData?.locations, coords]);

  // Lokasi terdekat otomatis
  const nearestLocation: (AttendanceLocation & { distance_meters?: number }) | null = useMemo(() => {
    if (locationsWithDistance.length === 0) return null;
    return locationsWithDistance[0];
  }, [locationsWithDistance]);

  // Lokasi yang sedang aktif (prioritas utama: Kantor Pusat jika Admin, atau assigned_location sekolah penugasan karyawan)
  const activeTargetLocation = useMemo(() => {
    // POINT 10: Khusus akun Admin, lokasi terkunci secara ketat ke Kantor Pusat yang dibuat Super Admin
    if (todayData?.is_admin_headquarters_enforced || user?.role === 'admin') {
      const hq = todayData?.headquarters_location || todayData?.assigned_location;
      if (hq) {
        if (coords) {
          const dist = calculateDistanceMeters(coords.lat, coords.lng, hq.latitude, hq.longitude);
          return { ...hq, distance_meters: dist };
        }
        return hq;
      }
    }
    // Sesuai arahan Bang Maun: Karyawan otomatis terkunci ke lokasi penugasannya (tidak memilih bebas)
    const target = todayData?.assigned_location || todayData?.locations?.[0] || null;
    if (target) {
      if (coords) {
        const dist = calculateDistanceMeters(coords.lat, coords.lng, target.latitude, target.longitude);
        return { ...target, distance_meters: dist };
      }
      return target;
    }
    return null;
  }, [
    todayData?.is_admin_headquarters_enforced,
    todayData?.headquarters_location,
    todayData?.assigned_location,
    todayData?.locations,
    user?.role,
    coords,
  ]);

  // Evaluasi Radius untuk Absen Masuk
  const liveDistance = activeTargetLocation?.distance_meters ?? null;
  const maxRadius = activeTargetLocation?.radius_meters || todayData?.office_setting?.radius_meters || 100;
  const isWithinRadius = liveDistance !== null && liveDistance <= maxRadius;

  const hasCheckedIn = !!todayData?.attendance?.check_in_time;
  const hasCheckedOut = !!todayData?.attendance?.check_out_time;
  const isHolidayCheckedIn = todayData?.attendance?.attendance_type === 'libur' || todayData?.attendance?.status === 'holiday';
  const isDinasCheckedIn = todayData?.attendance?.attendance_type === 'dinas_luar';

  // Handle Absen Masuk (Validasi Radius 100+ Lokasi + Wajib Foto Selfie)
  const handleCheckInMasuk = async () => {
    if (!coords) {
      setMessage({ text: 'Lokasi GPS belum terdeteksi. Silakan aktifkan GPS terlebih dahulu.', type: 'error' });
      return;
    }

    if (!photoFile) {
      setMessage({ text: 'Foto bukti selfie kehadiran wajib diambil sebelum melakukan absen masuk.', type: 'error' });
      return;
    }

    try {
      setActionLoading(true);
      setMessage(null);
      const res = await attendanceService.checkIn({
        attendance_type: 'masuk',
        latitude: coords.lat,
        longitude: coords.lng,
        location_id: activeTargetLocation?.id,
        notes: checkInNotes.trim() || undefined,
        photo: photoFile,
      });
      setMessage({ text: res.message || 'Absen masuk berhasil tercatat!', type: 'success' });
      handleResetPhoto();
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

  // Handle Absen Perjalanan Dinas (Point 5: Bebas Radius GPS)
  const handleCheckInDinas = async () => {
    if (!dinasNotes.trim()) {
      setMessage({ text: 'Catatan/agenda keperluan perjalanan dinas wajib diisi.', type: 'error' });
      return;
    }

    try {
      setActionLoading(true);
      setMessage(null);
      const res = await attendanceService.checkIn({
        attendance_type: 'dinas_luar',
        latitude: coords?.lat,
        longitude: coords?.lng,
        notes: dinasNotes.trim(),
        photo: photoFile,
      });
      setMessage({ text: res.message || 'Absen Perjalanan Dinas berhasil dicatat! Selamat bertugas.', type: 'success' });
      handleResetPhoto();
      fetchData();
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || 'Gagal mencatat absen perjalanan dinas.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Absen Libur (Point 3: Bebas Radius GPS)
  const handleCheckInLibur = async () => {
    try {
      setActionLoading(true);
      setMessage(null);
      const res = await attendanceService.checkIn({
        attendance_type: 'libur',
        latitude: coords?.lat,
        longitude: coords?.lng,
        notes: holidayNotes.trim() || 'Hari Libur / Off Terjadwal',
      });
      setMessage({
        text: res.message || 'Absen Libur berhasil dicatat. Selamat berlibur!',
        type: 'success',
      });
      fetchData();
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || 'Gagal mencatat absen libur.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // POINT 8: Kalkulasi Durasi Kerja Berjalan & Jam Kerja 8 Jam
  const elapsedWorkMinutes = useMemo(() => {
    if (!todayData?.attendance?.check_in_time) return null;
    try {
      const parts = todayData.attendance.check_in_time.split(':');
      if (parts.length < 2) return null;
      const inHours = parseInt(parts[0], 10);
      const inMinutes = parseInt(parts[1], 10);

      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();

      let diff = (currentHours * 60 + currentMinutes) - (inHours * 60 + inMinutes);
      if (diff < 0) diff += 24 * 60; // Antisipasi pergantian hari
      return diff;
    } catch {
      return null;
    }
  }, [todayData?.attendance?.check_in_time, currentTime]);

  const isEightHoursMet = elapsedWorkMinutes !== null && elapsedWorkMinutes >= 480;

  const elapsedFormatted = useMemo(() => {
    if (elapsedWorkMinutes === null) return '';
    const h = Math.floor(elapsedWorkMinutes / 60);
    const m = elapsedWorkMinutes % 60;
    return `${h} jam ${m} menit`;
  }, [elapsedWorkMinutes]);

  const remainingToEightHours = useMemo(() => {
    if (elapsedWorkMinutes === null || elapsedWorkMinutes >= 480) return 0;
    return 480 - elapsedWorkMinutes;
  }, [elapsedWorkMinutes]);

  const remainingFormatted = useMemo(() => {
    if (remainingToEightHours <= 0) return '';
    const h = Math.floor(remainingToEightHours / 60);
    const m = remainingToEightHours % 60;
    return h > 0 ? `${h} jam ${m} menit` : `${m} menit`;
  }, [remainingToEightHours]);

  // POINT 8: Absensi Pulang Di-Los (Bebas Radius, Terpenting 8 Jam Kerja)
  const handleCheckOutClick = () => {
    if (hasCheckedOut) return;
    // Jika durasi kerja < 8 jam (480 menit), tampilkan konfirmasi
    if (elapsedWorkMinutes !== null && elapsedWorkMinutes < 480) {
      setEarlyCheckOutModalOpen(true);
    } else {
      executeCheckOut();
    }
  };

  const executeCheckOut = async () => {
    setEarlyCheckOutModalOpen(false);
    try {
      setActionLoading(true);
      setMessage(null);
      // Pulang di-los: kirim koordinat jika ada, fallback 0 jika belum terdeteksi
      const res = await attendanceService.checkOut({
        latitude: coords?.lat ?? 0,
        longitude: coords?.lng ?? 0,
      });
      setMessage({ text: res.message || 'Absen pulang berhasil tercatat!', type: 'success' });
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
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-primary" />
            <span>Presensi & Absensi Karyawan</span>
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Mendukung 100+ titik lokasi kerja (Radius Geofencing) & Opsi Absen Libur tanpa batasan radius.
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

      {/* Navigation Switch Mode: Absen Masuk vs Perjalanan Dinas vs Absen Libur */}
      {!hasCheckedIn && (
        <div className="bg-surface-panel border border-border-subtle p-1.5 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-2 shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setAttendanceMode('masuk');
              handleResetPhoto();
            }}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              attendanceMode === 'masuk'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-container'
            }`}
          >
            <Briefcase className="w-4 h-4 shrink-0" />
            <span className="truncate">Absen Masuk (Radius + Foto)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAttendanceMode('dinas_luar');
              handleResetPhoto();
            }}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              attendanceMode === 'dinas_luar'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-container'
            }`}
          >
            <Car className="w-4 h-4 shrink-0" />
            <span className="truncate">Perjalanan Dinas (Bebas Radius)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAttendanceMode('libur');
              handleResetPhoto();
            }}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              attendanceMode === 'libur'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-container'
            }`}
          >
            <SunMedium className="w-4 h-4 shrink-0" />
            <span className="truncate">Absen Libur / Off (Bebas Radius)</span>
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* TAB 1: ABSEN MASUK DENGAN RADIUS 100+ LOKASI & FOTO SELFIE */}
          {attendanceMode === 'masuk' && !isHolidayCheckedIn && !isDinasCheckedIn && (
            <div className="bg-surface-panel border border-border-subtle rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                <div className="flex items-center gap-2 text-text-primary font-semibold text-[14.5px]">
                  <Compass className="w-4 h-4 text-primary" />
                  <span>Radius Absensi (100+ Titik Sekolah & Kantor)</span>
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
                {/* POINT 9: Info Jadwal Shift Aktif Karyawan Hari Ini */}
                {todayData?.assigned_shift && (
                  <div className="bg-gradient-to-r from-sky-50 to-indigo-50/70 border border-sky-200/90 rounded-2xl p-4 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-600/10 border border-sky-300 flex items-center justify-center shrink-0 mt-0.5">
                          <Clock className="w-5 h-5 text-sky-700" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">
                              Shift Kerja Anda Hari Ini
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-600 text-white shadow-2xs font-mono">
                              {todayData.assigned_shift.code}
                            </span>
                            {todayData.assigned_shift.cross_day && (
                              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                                +1 Hari (Malam)
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-bold text-text-primary mt-1">
                            {todayData.assigned_shift.name}{' '}
                            <span className="font-mono text-sky-700 font-semibold">
                              ({todayData.assigned_shift.formatted_time || `${todayData.assigned_shift.start_time.substring(0, 5)} - ${todayData.assigned_shift.end_time.substring(0, 5)}`})
                            </span>
                          </div>
                          <div className="text-xs text-text-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>
                              Batas Toleransi: <strong className="text-sky-700 font-semibold">{todayData.assigned_shift.late_tolerance_minutes} Menit</strong>
                            </span>
                            <span>
                              Target Kerja: <strong className="text-sky-700 font-semibold">{todayData.assigned_shift.work_hours} Jam</strong>
                            </span>
                            {todayData.assigned_shift.description && (
                              <span className="italic text-text-secondary">
                                • {todayData.assigned_shift.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* POINT 10: Info Khusus Akun Admin (Wajib di Kantor Pusat yang Dibuat Super Admin) */}
                {(todayData?.is_admin_headquarters_enforced || user?.role === 'admin') ? (
                  <div className="bg-blue-50/90 border border-blue-200/90 rounded-2xl p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                          <Building className="w-5 h-5 text-blue-700" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
                              Mode Presensi Admin — Wajib Kantor Pusat
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-2xs">
                              Ditetapkan Super Admin
                            </span>
                          </div>
                          <div className="text-sm font-bold text-text-primary mt-1">
                            {activeTargetLocation?.name || todayData?.office_setting?.office_name || 'Kantor Pusat Operasional'}
                          </div>
                          <div className="text-xs text-text-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>Batas Radius Kantor: <strong className="text-blue-700 font-semibold">{maxRadius} Meter</strong></span>
                            {activeTargetLocation?.address && (
                              <span>Alamat: {activeTargetLocation.address}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-[11.5px] text-blue-800/90 bg-white/80 rounded-xl px-3 py-2 border border-blue-200/70 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        Sesuai ketetapan sistem (Point 10), seluruh akun <strong>Admin wajib melakukan presensi di Kantor Pusat</strong> yang telah ditentukan oleh Super Admin.
                      </span>
                    </div>
                  </div>
                ) : (activeTargetLocation || todayData?.assigned_location) ? (
                  /* Info Penugasan Terkunci Otomatis untuk Karyawan (Sesuai arahan Bang Maun) */
                  <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-4 shadow-2xs space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                          <Building className="w-5 h-5 text-emerald-700" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                              Lokasi Penugasan Anda
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                              Terkunci Otomatis
                            </span>
                          </div>
                          <div className="text-sm font-bold text-text-primary mt-1">
                            {(activeTargetLocation || todayData?.assigned_location)?.name} {(activeTargetLocation || todayData?.assigned_location)?.code ? `[${(activeTargetLocation || todayData?.assigned_location)?.code}]` : ''}
                          </div>
                          <div className="text-xs text-text-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>Batas Radius: <strong className="text-emerald-700 font-semibold">{maxRadius} Meter</strong></span>
                            {(activeTargetLocation || todayData?.assigned_location)?.address && (
                              <span>Alamat: {(activeTargetLocation || todayData?.assigned_location)?.address}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-[11.5px] text-emerald-800/80 bg-white/70 rounded-xl px-3 py-2 border border-emerald-200/60 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Lokasi absensi Anda telah terdaftar dan <strong>terkunci otomatis sesuai data penugasan</strong> Anda. Anda tidak perlu memilih lokasi secara manual.
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Peringatan jika belum memiliki penugasan lokasi */
                  <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 shadow-2xs flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                        Lokasi Penugasan Belum Ditetapkan
                      </div>
                      <div className="text-xs text-amber-800 mt-1">
                        Akun Anda belum memiliki lokasi penugasan absensi. Silakan hubungi Admin / HRD untuk menetapkan unit penugasan kerja Anda.
                      </div>
                    </div>
                  </div>
                )}

                {/* Status Visual Jarak & Radius */}
                {isDetectingGps ? (
                  <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4 flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-amber-600 animate-spin shrink-0" />
                    <div className="text-[12.5px] text-amber-800">
                      <strong className="block font-semibold">Mendeteksi Posisi Satelit GPS...</strong>
                      Pastikan izin akses lokasi peramban diizinkan.
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
                        ✓ Berada di Dalam Radius Lokasi ({liveDistance} meter)
                      </strong>
                      Lokasi: <strong>{activeTargetLocation?.name}</strong>. Jarak Anda berada di dalam batas toleransi ({maxRadius} meter). Ambil foto selfie untuk absen masuk.
                    </div>
                  </div>
                ) : (
                  <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-[12.5px] text-rose-800">
                      <strong className="block font-semibold text-rose-900">
                        ⚠ Di Luar Radius Lokasi (Jarak: {liveDistance !== null ? `${liveDistance} meter` : '-'})
                      </strong>
                      Batas radius untuk <strong>{activeTargetLocation?.name}</strong> adalah <strong>{maxRadius} meter</strong>. Silakan mendekat ke lokasi untuk melakukan absensi masuk.
                    </div>
                  </div>
                )}

                {/* Point 4: Foto Selfie Bukti Kehadiran (Wajib untuk Absen Masuk) */}
                {!hasCheckedIn && (
                  <div className="space-y-2 pt-2 border-t border-border-subtle">
                    <label className="text-[12px] font-semibold text-text-secondary flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-primary" />
                        <span>Foto Selfie Kehadiran <span className="text-rose-500 font-bold">*Wajib</span>:</span>
                      </span>
                      {photoPreview && (
                        <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Foto Berhasil Diambil
                        </span>
                      )}
                    </label>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />

                    {!photoPreview ? (
                      <button
                        type="button"
                        onClick={() => handleOpenLiveCamera('selfie')}
                        className="w-full py-4 px-4 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 transition-all flex flex-col sm:flex-row items-center justify-center gap-3 text-primary font-medium text-xs cursor-pointer group shadow-2xs"
                      >
                        <div className="w-11 h-11 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center shrink-0">
                          <Camera className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="text-center sm:text-left">
                          <div className="font-bold text-text-primary text-[13px] flex items-center justify-center sm:justify-start gap-1.5">
                            <span>Buka Kamera & Ambil Foto Selfie Langsung</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          </div>
                          <div className="text-[11px] text-text-muted mt-0.5">
                            Nyalakan kamera live (webcam/kamera depan) untuk jepret foto bukti kehadiran
                          </div>
                        </div>
                      </button>
                    ) : (
                      <div className="flex items-center gap-3.5 p-3 bg-surface-container rounded-xl border border-border-subtle">
                        <div className="relative group shrink-0">
                          <img
                            src={photoPreview}
                            alt="Selfie Kehadiran"
                            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border border-border-subtle shadow-xs cursor-pointer"
                            onClick={() => setPreviewModalUrl(photoPreview)}
                          />
                          <div
                            onClick={() => setPreviewModalUrl(photoPreview)}
                            className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                            title="Perbesar foto"
                          >
                            <Eye className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-text-primary truncate">
                            {photoFile?.name || 'Foto Selfie Kehadiran'}
                          </div>
                          <div className="text-[11px] text-text-muted mt-0.5">
                            {photoFile ? `${(photoFile.size / 1024).toFixed(0)} KB • ` : ''}Siap dikirim bersama absen masuk
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenLiveCamera('selfie')}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Ambil Ulang Foto Selfie</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Input Catatan Opsional saat Masuk */}
                {!hasCheckedIn && (
                  <div>
                    <label className="text-[11.5px] font-medium text-text-muted block mb-1">
                      Catatan Masuk (Opsional):
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Mengikuti rapat pagi / piket unit..."
                      value={checkInNotes}
                      onChange={(e) => setCheckInNotes(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-surface-container border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              {/* POINT 8: Live Duration & 8-Hour Tracker */}
              {hasCheckedIn && !hasCheckedOut && (
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                    isEightHoursMet
                      ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50/90 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Clock
                      className={`w-4 h-4 shrink-0 ${
                        isEightHoursMet ? 'text-emerald-600' : 'text-amber-600 animate-spin'
                      }`}
                    />
                    <div>
                      <div className="font-semibold text-[13px]">
                        Durasi Kerja Berjalan: {elapsedFormatted}
                      </div>
                      <div className="text-[11px] opacity-90 mt-0.5">
                        {isEightHoursMet
                          ? '✓ Standar 8 jam kerja sudah terpenuhi. Anda dapat melakukan absen pulang.'
                          : `Kurang ${remainingFormatted} lagi untuk mencapai standar 8 jam kerja.`}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`px-2.5 py-1 rounded-full font-bold text-[10px] tracking-wide uppercase shrink-0 ${
                      isEightHoursMet
                        ? 'bg-emerald-200/80 text-emerald-900'
                        : 'bg-amber-200/80 text-amber-900'
                    }`}
                  >
                    {isEightHoursMet ? '8 Jam Terpenuhi' : '< 8 Jam'}
                  </div>
                </div>
              )}

              {/* Status Durasi Selesai Kerja */}
              {hasCheckedOut && todayData?.attendance?.work_duration_formatted && (
                <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>
                      Total Jam Kerja Hari Ini:{' '}
                      <strong>{todayData.attendance.work_duration_formatted}</strong>
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full font-semibold text-[10.5px] ${
                      todayData.attendance.is_eight_hours_met
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {todayData.attendance.is_eight_hours_met
                      ? '✓ Memenuhi 8 Jam'
                      : 'Kurang dari 8 Jam'}
                  </span>
                </div>
              )}

              {/* Action Buttons: Absen Masuk & Absen Pulang */}
              <div className="pt-2 border-t border-border-subtle">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={handleCheckInMasuk}
                    disabled={actionLoading || isDetectingGps || !isWithinRadius || !photoFile || hasCheckedIn}
                    className={`h-12 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                      hasCheckedIn
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-not-allowed opacity-90'
                        : isWithinRadius && photoFile
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-98'
                        : 'bg-surface-container text-text-muted border border-border-subtle cursor-not-allowed opacity-60'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{hasCheckedIn ? '✓ Sudah Absen Masuk' : 'Absen Masuk (Foto + Radius)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCheckOutClick}
                    disabled={actionLoading || !hasCheckedIn || hasCheckedOut}
                    className={`h-12 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                      hasCheckedOut
                        ? 'bg-blue-100 text-blue-800 border border-blue-200 cursor-not-allowed opacity-90'
                        : hasCheckedIn
                        ? 'bg-rose-600 hover:bg-rose-700 text-white active:scale-98'
                        : 'bg-surface-container text-text-muted border border-border-subtle cursor-not-allowed opacity-60'
                    }`}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{hasCheckedOut ? '✓ Sudah Absen Pulang' : 'Absen Pulang (Bebas Radius)'}</span>
                  </button>
                </div>

                {!hasCheckedIn && isWithinRadius && !photoFile && (
                  <p className="text-[11.5px] text-amber-600 font-medium mt-2 text-center">
                    ⚠️ Ambil foto selfie kehadiran di atas terlebih dahulu untuk mengaktifkan tombol Absen Masuk.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PERJALANAN DINAS (POINT 5: BEBAS RADIUS GPS) */}
          {(attendanceMode === 'dinas_luar' || isDinasCheckedIn) && !isHolidayCheckedIn && (
            <div className="bg-surface-panel border border-indigo-200/80 rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                <div className="flex items-center gap-2.5 text-indigo-900 font-semibold text-[15px]">
                  <Car className="w-5 h-5 text-indigo-600" />
                  <span>Absen Perjalanan Dinas / Tugas Luar (Bebas Radius)</span>
                </div>
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={isDetectingGps}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-medium text-text-secondary hover:text-indigo-600 hover:bg-surface-container rounded-lg border border-border-subtle transition-all cursor-pointer disabled:opacity-50"
                  title="Segarkan koordinat GPS"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDetectingGps ? 'animate-spin' : ''}`} />
                  <span>{isDetectingGps ? 'Mendeteksi...' : 'Cek Ulang GPS'}</span>
                </button>
              </div>

              <div className="py-4 space-y-4">
                {/* Ketentuan Perjalanan Dinas */}
                <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-xl p-4 text-xs text-indigo-950 leading-relaxed space-y-2">
                  <div className="font-semibold text-sm flex items-center gap-1.5 text-indigo-900">
                    <Info className="w-4 h-4 text-indigo-600" />
                    <span>Ketentuan Absen Perjalanan Dinas:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-indigo-900">
                    <li>
                      <strong>Bebas Batasan Radius:</strong> Anda dapat melakukan absensi dari lokasi penugasan dinas mana pun tanpa terkendala batas radius kantor/sekolah.
                    </li>
                    <li>
                      <strong>Titik GPS Tetap Dicatat:</strong> Posisi koordinat GPS Anda saat ini ({coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'mendeteksi lokasi...'}) tetap tersimpan rapi sebagai bukti autentik keberadaan.
                    </li>
                    <li>
                      <strong>Keperluan Dinas:</strong> Wajib mencantumkan agenda dinas luar dan disarankan melampirkan foto bukti kegiatan lapangan.
                    </li>
                  </ul>
                </div>

                {!hasCheckedIn ? (
                  <div className="space-y-4">
                    {/* Input Catatan Keperluan Dinas (Wajib) */}
                    <div>
                      <label className="text-xs font-semibold text-text-secondary block mb-1">
                        Keperluan / Agenda Perjalanan Dinas <span className="text-rose-500 font-bold">*Wajib</span>:
                      </label>
                      <textarea
                        rows={2}
                        value={dinasNotes}
                        onChange={(e) => setDinasNotes(e.target.value)}
                        placeholder="Contoh: Kunjungan koordinasi ke Dinas Pendidikan / Supervisi unit sekolah cabang..."
                        className="w-full px-3.5 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Lampiran Foto Kegiatan Dinas (Opsional/Direkomendasikan) */}
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-semibold text-text-secondary flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Foto Kegiatan / Lokasi Dinas (Opsional):</span>
                        </span>
                        {photoPreview && (
                          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Foto Terlampir
                          </span>
                        )}
                      </label>

                      <input
                        ref={dinasFileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />

                      {!photoPreview ? (
                        <button
                          type="button"
                          onClick={() => handleOpenLiveCamera('dinas')}
                          className="w-full py-3.5 px-4 rounded-xl border border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2.5 text-indigo-700 font-semibold text-xs cursor-pointer shadow-2xs group"
                        >
                          <Camera className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                          <span>Buka Kamera & Ambil Foto Bukti Lapangan</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-3.5 p-3 bg-surface-container rounded-xl border border-border-subtle">
                          <img
                            src={photoPreview}
                            alt="Foto Bukti Dinas"
                            className="w-16 h-16 object-cover rounded-xl border border-border-subtle shadow-xs cursor-pointer"
                            onClick={() => setPreviewModalUrl(photoPreview)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-text-primary truncate">
                              {photoFile?.name || 'Foto Bukti Dinas'}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenLiveCamera('dinas')}
                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:underline cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Ganti / Ambil Ulang</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons: Kirim Absen Dinas */}
                    <button
                      type="button"
                      onClick={handleCheckInDinas}
                      disabled={actionLoading || !dinasNotes.trim()}
                      className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Car className="w-4 h-4" />
                      <span>{actionLoading ? 'Mencatat Absen...' : 'Kirim Absen Perjalanan Dinas'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-sm font-semibold">
                          ✓ Absen Perjalanan Dinas Tercatat Hari Ini
                        </strong>
                        <span className="text-xs text-indigo-800 mt-0.5 block">
                          Tercatat pada pukul {todayData?.attendance?.check_in_time?.substring(0, 5)} WIB. Catatan: &quot;{todayData?.attendance?.notes}&quot;
                        </span>
                      </div>
                    </div>

                    {/* Tombol Absen Pulang Dinas */}
                    {!hasCheckedOut && (
                      <button
                        type="button"
                        onClick={handleCheckOutClick}
                        disabled={actionLoading}
                        className="w-full h-12 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{actionLoading ? 'Menyimpan...' : 'Absen Pulang (Selesai Dinas)'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ABSEN LIBUR / OFF (POINT 3: BEBAS RADIUS GPS) */}
          {(attendanceMode === 'libur' || isHolidayCheckedIn) && (
            <div className="bg-surface-panel border border-amber-200/80 rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center gap-2.5 pb-3 border-b border-border-subtle text-amber-900 font-semibold text-[15px]">
                <SunMedium className="w-5 h-5 text-amber-600" />
                <span>Absen Libur / Hari Off Terjadwal (Bebas Radius)</span>
              </div>

              <div className="py-4 space-y-4">
                <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 leading-relaxed space-y-2">
                  <div className="font-semibold text-sm flex items-center gap-1.5 text-amber-950">
                    <Info className="w-4 h-4 text-amber-600" />
                    <span>Ketentuan Absen Libur:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-amber-800">
                    <li>
                      <strong>Tidak memerlukan radius GPS</strong>: Anda dapat melakukan absensi libur dari rumah atau lokasi mana pun.
                    </li>
                    <li>
                      <strong>Tercatat otomatis di rekapitulasi</strong>: Status hari libur akan terekam sehingga tidak terhitung sebagai alpa/mangkir pada slip gaji.
                    </li>
                    <li>
                      <strong>Tidak perlu absen pulang</strong>: Setelah konfirmasi absen libur, kewajiban absensi Anda untuk hari ini telah selesai.
                    </li>
                  </ul>
                </div>

                {!hasCheckedIn ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-text-secondary block mb-1">
                        Keterangan Libur:
                      </label>
                      <input
                        type="text"
                        value={holidayNotes}
                        onChange={(e) => setHolidayNotes(e.target.value)}
                        placeholder="Contoh: Hari Libur Terjadwal / Shift Off / Libur Nasional"
                        className="w-full px-3.5 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleCheckInLibur}
                      disabled={actionLoading}
                      className="w-full h-12 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                    >
                      <SunMedium className="w-4 h-4" />
                      <span>{actionLoading ? 'Mencatat Absen...' : 'Konfirmasi Absen Libur Hari Ini'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-sm font-semibold">
                        ✓ Anda Telah Melakukan Absen Libur Hari Ini
                      </strong>
                      <span className="text-xs text-emerald-800 mt-0.5 block">
                        Tercatat pada pukul {todayData?.attendance?.check_in_time?.substring(0, 5)} WIB. Anda tidak perlu melakukan absen pulang. Selamat beristirahat!
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Notice Card */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/70 text-blue-900 text-[12px] flex items-start gap-2.5">
            <Navigation className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Sistem Multi-Lokasi Presisi & Fleksibel:</strong> Tersedia 100+ titik Sekolah Rakyat & Kantor (Radius + Foto Selfie Kehadiran), Mode Perjalanan Dinas tanpa batasan radius, serta Absen Libur Terjadwal.
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Today Summary Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-5 shadow-xs">
            <h2 className="font-semibold text-text-primary text-[14.5px] pb-3 border-b border-border-subtle flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span>Status Kehadiran Hari Ini</span>
            </h2>

            <div className="mt-4 space-y-3.5">
              {/* Jenis Presensi Badge */}
              <div className="p-3.5 rounded-xl bg-surface-container/60 border border-border-subtle">
                <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Jenis Presensi
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                    {todayData?.attendance?.attendance_type === 'libur' ? (
                      <>
                        <SunMedium className="w-4 h-4 text-amber-600" />
                        <span>Absen Libur / Off</span>
                      </>
                    ) : todayData?.attendance?.attendance_type === 'dinas_luar' ? (
                      <>
                        <Car className="w-4 h-4 text-indigo-600" />
                        <span>Perjalanan Dinas</span>
                      </>
                    ) : (
                      <>
                        <Briefcase className="w-4 h-4 text-primary" />
                        <span>Absen Masuk Kerja</span>
                      </>
                    )}
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      todayData?.attendance?.attendance_type === 'libur'
                        ? 'bg-amber-100 text-amber-800'
                        : todayData?.attendance?.attendance_type === 'dinas_luar'
                        ? 'bg-indigo-100 text-indigo-800'
                        : hasCheckedIn
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-surface-container text-text-muted border border-border-subtle'
                    }`}
                  >
                    {todayData?.attendance?.attendance_type === 'libur'
                      ? 'Libur Terjadwal'
                      : todayData?.attendance?.attendance_type === 'dinas_luar'
                      ? 'Dinas Luar'
                      : hasCheckedIn
                      ? 'Hadir'
                      : 'Belum Absen'}
                  </span>
                </div>
              </div>

              {/* Check-In Detail */}
              <div className="p-3.5 rounded-xl bg-surface-container/60 border border-border-subtle">
                <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Jam Check-in
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
                        todayData.attendance.attendance_type === 'libur'
                          ? 'bg-amber-100 text-amber-800'
                          : todayData.attendance.attendance_type === 'dinas_luar'
                          ? 'bg-indigo-100 text-indigo-800'
                          : todayData.attendance.check_in_status === 'late'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {todayData.attendance.attendance_type === 'libur'
                        ? 'Libur'
                        : todayData.attendance.attendance_type === 'dinas_luar'
                        ? 'Dinas Luar'
                        : todayData.attendance.check_in_status === 'late'
                        ? 'Terlambat'
                        : 'Tepat Waktu'}
                    </span>
                  )}
                </div>
                {todayData?.attendance?.location_name && (
                  <div className="text-[11px] text-text-muted mt-1.5 flex items-center gap-1 font-medium">
                    <MapPin className="w-3 h-3 text-primary shrink-0" />
                    <span>{todayData.attendance.location_name}</span>
                  </div>
                )}
                {todayData?.attendance?.check_in_distance_meters !== null && todayData?.attendance?.check_in_distance_meters !== undefined && (
                  <div className="text-[10.5px] text-text-muted mt-0.5">
                    Jarak saat absen: {todayData.attendance.check_in_distance_meters} m dari titik lokasi
                  </div>
                )}
              </div>

              {/* Foto Bukti Kehadiran Hari Ini */}
              {(todayData?.attendance?.photo_full_url || todayData?.attendance?.photo_url) && (
                <div className="p-3.5 rounded-xl bg-surface-container/60 border border-border-subtle">
                  <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                    Foto Bukti Kehadiran
                  </div>
                  <div className="flex items-center gap-3">
                    <img
                      src={getStorageUrl(todayData.attendance.photo_full_url || todayData.attendance.photo_url)}
                      alt="Foto Bukti Kehadiran"
                      className="w-14 h-14 rounded-xl object-cover border border-border-subtle shadow-2xs cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setPreviewModalUrl(getStorageUrl(todayData.attendance?.photo_full_url || todayData.attendance?.photo_url))}
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        const raw = todayData.attendance?.photo_full_url || todayData.attendance?.photo_url;
                        if (!target.dataset.triedFallback && raw) {
                          target.dataset.triedFallback = 'true';
                          const clean = raw.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?(api\/storage|storage)\/?/, '');
                          target.src = `/api/storage/${clean}`;
                        }
                      }}
                    />
                    <div>
                      <div className="text-xs font-semibold text-text-primary">Foto Terverifikasi</div>
                      <button
                        type="button"
                        onClick={() => setPreviewModalUrl(getStorageUrl(todayData.attendance?.photo_full_url || todayData.attendance?.photo_url))}
                        className="text-[11px] text-primary hover:underline mt-0.5 flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Lihat Ukuran Penuh</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Check-Out Detail */}
              {todayData?.attendance?.attendance_type !== 'libur' && (
                <div className="p-3.5 rounded-xl bg-surface-container/60 border border-border-subtle">
                  <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                    Jam Check-out (Pulang)
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
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History Table Card */}
      <div className="bg-surface-panel border border-border-subtle rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border-subtle">
          <div>
            <h3 className="font-semibold text-text-primary text-[15px]">Riwayat Kehadiran Bulan Ini</h3>
            <p className="text-xs text-text-muted mt-0.5">Daftar rekapitulasi kehadiran, dinas luar, dan absen libur Anda.</p>
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
                <th className="py-2.5 px-3">Jenis Absen</th>
                <th className="py-2.5 px-3">Lokasi / Unit</th>
                <th className="py-2.5 px-3">Jam Masuk</th>
                <th className="py-2.5 px-3">Jarak</th>
                <th className="py-2.5 px-3">Jam Pulang</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Foto Bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-text-muted">
                    Memuat riwayat kehadiran...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-text-muted">
                    Belum ada riwayat kehadiran pada bulan {selectedMonth}.
                  </td>
                </tr>
              ) : (
                history.map((row) => {
                  const isLibur = row.attendance_type === 'libur' || row.status === 'holiday';
                  const isDinas = row.attendance_type === 'dinas_luar';
                  const rawPhoto = row.photo_full_url || row.photo_url;
                  const photoSrc = rawPhoto ? getStorageUrl(rawPhoto) : null;
                  return (
                    <tr key={row.id} className="hover:bg-surface-container/20 transition-colors">
                      <td className="py-3 px-3 font-medium text-text-primary">{row.date}</td>
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
                          {isLibur ? 'Libur / Off' : isDinas ? 'Dinas Luar' : 'Masuk'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-text-secondary">
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
                      <td className="py-3 px-3">
                        {photoSrc ? (
                          <div
                            onClick={() => setPreviewModalUrl(photoSrc)}
                            className="flex items-center gap-1 text-primary hover:underline cursor-pointer group"
                            title="Klik untuk melihat foto"
                          >
                            <img
                              src={photoSrc}
                              alt="Bukti"
                              className="w-7 h-7 rounded-lg object-cover border border-border-subtle group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                const target = e.currentTarget as HTMLImageElement;
                                if (!target.dataset.triedFallback && rawPhoto) {
                                  target.dataset.triedFallback = 'true';
                                  const clean = rawPhoto.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?(api\/storage|storage)\/?/, '');
                                  target.src = `/api/storage/${clean}`;
                                }
                              }}
                            />
                            <Eye className="w-3 h-3 text-text-muted group-hover:text-primary" />
                          </div>
                        ) : (
                          <span className="text-text-muted">-</span>
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

      {/* Modal Lightbox Foto Preview */}
      {previewModalUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewModalUrl(null)}
        >
          <div
            className="relative max-w-lg w-full bg-surface-panel rounded-2xl overflow-hidden shadow-2xl border border-border-subtle"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 border-b border-border-subtle bg-surface-container">
              <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-primary" />
                <span>Pratinjau Foto Bukti Kehadiran</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalUrl(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-panel transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 bg-black/90 flex items-center justify-center max-h-[75vh] overflow-hidden">
              <img
                src={getStorageUrl(previewModalUrl)}
                alt="Foto Kehadiran"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-md"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  if (!target.dataset.triedFallback && previewModalUrl) {
                    target.dataset.triedFallback = 'true';
                    const clean = previewModalUrl.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?(api\/storage|storage)\/?/, '');
                    target.src = `/api/storage/${clean}`;
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* POINT 8: Modal Konfirmasi Absen Pulang Sebelum 8 Jam Kerja */}
      {earlyCheckOutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">Konfirmasi Absen Pulang</h3>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Durasi jam kerja Anda hari ini baru berjalan{' '}
                  <strong className="text-amber-700 font-semibold">{elapsedFormatted}</strong> (belum mencapai standar kerja 8 jam).
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50/90 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
              Masih tersisa sekitar <strong>{remainingFormatted}</strong> untuk mencapai standar 8 jam kerja (480 menit). Absen pulang di-los (bebas lokasi), namun durasi kerja tetap tercatat di laporan. Tetap ingin absen pulang sekarang?
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEarlyCheckOutModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-border-subtle text-text-secondary hover:bg-surface-container transition-all cursor-pointer"
              >
                Batal (Lanjut Kerja)
              </button>
              <button
                type="button"
                onClick={executeCheckOut}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all cursor-pointer"
              >
                {actionLoading ? 'Menyimpan...' : 'Ya, Tetap Absen Pulang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POINT 4 & 5: Live Camera Viewfinder Modal */}
      <LiveCameraModal
        isOpen={isLiveCameraOpen}
        onClose={() => setIsLiveCameraOpen(false)}
        onCapture={handleCameraCaptured}
        title={liveCameraConfig.title}
        description={liveCameraConfig.description}
        defaultFacingMode={liveCameraConfig.facingMode}
        showFaceGuide={liveCameraConfig.showFaceGuide}
      />
    </div>
  );
};
