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
  ChevronRight,
  Upload,
  ArrowRight,
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
  const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'lord_admin';

  // Server & Attendance State
  const [todayData, setTodayData] = useState<TodayAttendanceData | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Mode: 'masuk' (radius 100+ lokasi + foto selfie) | 'dinas_luar' (bebas radius + catatan & foto) | 'libur' (bebas radius) | 'sakit_izin' (upload surat)
  const [attendanceMode, setAttendanceMode] = useState<'masuk' | 'dinas_luar' | 'libur' | 'sakit_izin'>('masuk');
  const [holidayNotes, setHolidayNotes] = useState<string>('Hari Libur Terjadwal / Off Rutin');
  const [dinasNotes, setDinasNotes] = useState<string>('');
  const [checkInNotes, setCheckInNotes] = useState<string>('');
  const [leaveSubtype, setLeaveSubtype] = useState<'sakit' | 'izin'>('sakit');
  const [leaveNotes, setLeaveNotes] = useState<string>('');

  // Deteksi jika browser dibuka dari In-App Webview (misal WhatsApp / Telegram / Instagram)
  const isInAppBrowser = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    return /FBAN|FBAV|Instagram|WhatsApp|Line|Messenger/i.test(ua);
  }, []);

  // Camera & Photo State (Live Camera Sensor Only)
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

  const handleOpenLiveCamera = (mode: 'selfie' | 'dinas' | 'surat') => {
    if (mode === 'selfie') {
      setLiveCameraConfig({
        title: 'Ambil Foto Selfie Kehadiran (Live Sensor)',
        description: 'Posisikan wajah Anda tepat di dalam lingkaran pemandu untuk absensi masuk live.',
        facingMode: 'user',
        showFaceGuide: true,
      });
    } else if (mode === 'dinas') {
      setLiveCameraConfig({
        title: 'Ambil Foto Dokumentasi Dinas Lapangan',
        description: 'Arahkan kamera ke lokasi kegiatan dinas atau bukti surat tugas lapangan.',
        facingMode: 'environment',
        showFaceGuide: false,
      });
    } else {
      setLiveCameraConfig({
        title: 'Foto Surat Keterangan Sakit / Izin',
        description: 'Posisikan surat dokter atau surat izin Anda agar terbaca jelas oleh Admin.',
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
  // Modal Pilih Shift Kerja Karyawan
  const [isShiftModalOpen, setIsShiftModalOpen] = useState<boolean>(false);
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [shiftSaving, setShiftSaving] = useState<boolean>(false);

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
    const tzName = todayData?.timezone_name || 'Asia/Jakarta';
    const tzCode = todayData?.timezone || 'WIB';

    const updateClock = () => {
      try {
        const now = new Date();
        const formatted = now.toLocaleTimeString('id-ID', {
          timeZone: tzName,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
        setCurrentTime(`${formatted} ${tzCode}`);
      } catch {
        const now = new Date();
        setCurrentTime(
          now.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }) + ` ${tzCode}`
        );
      }
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [todayData?.timezone_name, todayData?.timezone]);

  // Fetch Attendance Data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await attendanceService.getTodayAttendance();
      setTodayData(data);

      // Jika user sudah absen libur, sakit/izin, atau dinas hari ini, sesuaikan tab
      if (data.attendance?.attendance_type === 'sakit' || data.attendance?.attendance_type === 'izin') {
        setAttendanceMode('sakit_izin');
      } else if (data.attendance?.attendance_type === 'libur' || data.attendance?.status === 'holiday') {
        setAttendanceMode('libur');
      } else if (data.attendance?.attendance_type === 'dinas_luar') {
        setAttendanceMode('dinas_luar');
      } else {
        setAttendanceMode('masuk');
      }

      // Default selected location ke assigned_location jika belum dipilih
      if (data.assigned_location && !selectedLocationId) {
        setSelectedLocationId(data.assigned_location.id);
      }

      // Default selected shift ke assigned_shift
      if (data.assigned_shift) {
        setSelectedShiftId(data.assigned_shift.id);
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

  // Handle Simpan & Terapkan Shift Baru
  const handleSaveShift = async (shiftId: number) => {
    try {
      setShiftSaving(true);
      const res = await attendanceService.selectShift(shiftId);
      setMessage({ text: res.message || 'Shift kerja berhasil diperbarui!', type: 'success' });
      setIsShiftModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || 'Gagal mengubah shift kerja.',
        type: 'error',
      });
    } finally {
      setShiftSaving(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Request & Update GPS Location with Automatic Fallback (High Accuracy -> Standard Accuracy)
  const requestLocation = useCallback(() => {
    setIsDetectingGps(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Browser Anda tidak mendukung deteksi lokasi GPS.');
      setIsDetectingGps(false);
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setCoords({ lat, lng });
      setGpsError(null);
      setIsDetectingGps(false);
    };

    const handleFinalError = (error: GeolocationPositionError) => {
      setIsDetectingGps(false);
      switch (error.code) {
        case error.PERMISSION_DENIED:
          setGpsError('Izin akses lokasi (GPS) ditolak. Silakan klik ikon gembok / setelan di bilah alamat browser Anda dan ubah izin Lokasi menjadi "Izinkan" (Allow).');
          break;
        case error.POSITION_UNAVAILABLE:
          setGpsError('Informasi lokasi GPS tidak tersedia pada perangkat saat ini. Pastikan setelan lokasi perangkat aktif.');
          break;
        case error.TIMEOUT:
          setGpsError('Waktu deteksi sinyal GPS habis. Silakan periksa koneksi internet atau klik "Cek Ulang GPS".');
          break;
        default:
          setGpsError('Gagal mendeteksi lokasi GPS. Silakan coba klik tombol "Cek Ulang GPS".');
      }
    };

    // Tahap 1: Coba ambil koordinat satelit presisi tinggi (High Accuracy)
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (error) => {
        // Jika gagal karena timeout atau sinyal satelit tidak tersedia (umum terjadi di dalam ruangan gedung):
        // Lakukan otomatis fallback ke Tahap 2: Akurasi jaringan / WiFi tanpa memblokir karyawan
        if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
          navigator.geolocation.getCurrentPosition(
            handleSuccess,
            handleFinalError,
            {
              enableHighAccuracy: false,
              timeout: 15000,
              maximumAge: 60000,
            }
          );
        } else {
          handleFinalError(error);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
      }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const handleResetPhoto = () => {
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview(null);
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
  const hasRealWorkCheckedIn = hasCheckedIn && !isHolidayCheckedIn;
  const isDinasCheckedIn = todayData?.attendance?.attendance_type === 'dinas_luar';
  const isSakitIzinCheckedIn = todayData?.attendance?.attendance_type === 'sakit' || todayData?.attendance?.attendance_type === 'izin';

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
        shift_id: todayData?.assigned_shift?.id,
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
        shift_id: todayData?.assigned_shift?.id,
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

  // Handle Batalkan Absen Libur agar bisa Absen Masuk
  const handleCancelHoliday = async () => {
    if (!window.confirm('Apakah Anda yakin ingin membatalkan status Absen Libur hari ini untuk melakukan Absen Masuk?')) return;
    try {
      setActionLoading(true);
      setMessage(null);
      const res = await attendanceService.cancelHoliday();
      setMessage({ text: res.message || 'Status libur berhasil dibatalkan. Silakan lakukan Absen Masuk.', type: 'success' });
      setAttendanceMode('masuk');
      await fetchData();
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || 'Gagal membatalkan status libur.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Absen Sakit / Izin (Point Maun: Upload Surat & Menunggu Verifikasi Admin)
  const handleCheckInSakitIzin = async () => {
    if (!leaveNotes.trim()) {
      setMessage({
        text: `Keterangan / alasan ${leaveSubtype === 'sakit' ? 'sakit' : 'izin'} wajib diisi.`,
        type: 'error',
      });
      return;
    }

    if (!photoFile) {
      setMessage({
        text: 'Foto bukti surat keterangan dokter / surat permohonan izin wajib dilampirkan.',
        type: 'error',
      });
      return;
    }

    try {
      setActionLoading(true);
      setMessage(null);
      const res = await attendanceService.checkIn({
        attendance_type: leaveSubtype,
        latitude: coords?.lat,
        longitude: coords?.lng,
        notes: leaveNotes.trim(),
        photo: photoFile,
      });
      setMessage({
        text: res.message || 'Pengajuan Sakit/Izin berhasil dikirim dan menunggu verifikasi Admin.',
        type: 'success',
      });
      handleResetPhoto();
      fetchData();
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || 'Gagal mengirim pengajuan sakit/izin.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // POINT 8: Kalkulasi Durasi Kerja Berjalan & Target Jam Kerja Shift
  const assignedShift = todayData?.assigned_shift;
  const targetWorkHours = (assignedShift && assignedShift.work_hours > 0) ? assignedShift.work_hours : 8;
  const targetWorkMinutes = Math.round(targetWorkHours * 60);

  const elapsedWorkMinutes = useMemo(() => {
    if (!todayData?.attendance?.check_in_time) return null;
    try {
      const inDate = todayData.attendance.date || todayData.today || new Date().toISOString().slice(0, 10);
      const inTime = todayData.attendance.check_in_time.substring(0, 8);
      const checkInDateTime = new Date(`${inDate}T${inTime}`);

      const now = new Date();
      if (!isNaN(checkInDateTime.getTime())) {
        const diffMs = now.getTime() - checkInDateTime.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        return Math.max(0, diffMins);
      }

      const parts = inTime.split(':');
      if (parts.length < 2) return null;
      const inHours = parseInt(parts[0], 10);
      const inMinutes = parseInt(parts[1], 10);
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();

      let diff = (currentHours * 60 + currentMinutes) - (inHours * 60 + inMinutes);
      if (diff < 0) diff += 24 * 60; // Antisipasi pergantian hari
      return diff;
    } catch {
      return null;
    }
  }, [todayData?.attendance?.check_in_time, todayData?.attendance?.date, todayData?.today, currentTime]);

  const isEightHoursMet = elapsedWorkMinutes !== null && elapsedWorkMinutes >= targetWorkMinutes;

  const elapsedFormatted = useMemo(() => {
    if (elapsedWorkMinutes === null) return '';
    const h = Math.floor(elapsedWorkMinutes / 60);
    const m = elapsedWorkMinutes % 60;
    return `${h} jam ${m} menit`;
  }, [elapsedWorkMinutes]);

  const remainingToEightHours = useMemo(() => {
    if (elapsedWorkMinutes === null || elapsedWorkMinutes >= targetWorkMinutes) return 0;
    return targetWorkMinutes - elapsedWorkMinutes;
  }, [elapsedWorkMinutes, targetWorkMinutes]);

  const remainingFormatted = useMemo(() => {
    if (remainingToEightHours <= 0) return '';
    const h = Math.floor(remainingToEightHours / 60);
    const m = remainingToEightHours % 60;
    return h > 0 ? `${h} jam ${m} menit` : `${m} menit`;
  }, [remainingToEightHours]);

  // POINT 8: Absensi Pulang Di-Los (Bebas Radius, Terpenting Memenuhi Target Jam Kerja Shift)
  const handleCheckOutClick = () => {
    if (hasCheckedOut) {
      setMessage({
        text: `Anda sudah melakukan absen pulang hari ini pada pukul ${todayData?.attendance?.check_out_time?.substring(0, 5) || ''} ${todayData?.timezone || 'WIB'}. Selamat beristirahat!`,
        type: 'success',
      });
      return;
    }
    if (!hasCheckedIn) {
      setMessage({
        text: 'Anda belum melakukan absen masuk hari ini. Silakan ambil foto selfie kehadiran dan klik tombol "Absen Masuk" terlebih dahulu.',
        type: 'error',
      });
      return;
    }
    // Jika durasi kerja < target jam kerja shift, tampilkan konfirmasi
    if (elapsedWorkMinutes !== null && elapsedWorkMinutes < targetWorkMinutes) {
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
      // Pulang di-los: kirim koordinat jika ada & valid (jangan kirim 0,0 fallback)
      const payload: { latitude?: number; longitude?: number } = {};
      if (coords && coords.lat !== 0 && coords.lng !== 0) {
        payload.latitude = coords.lat;
        payload.longitude = coords.lng;
      }
      const res = await attendanceService.checkOut(payload);
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
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <span>Presensi & Absensi Karyawan</span>
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5 sm:mt-1">
            Mendukung 100+ titik lokasi kerja (Radius Geofencing) & Opsi Absen Libur tanpa batasan radius.
          </p>
        </div>

        {/* Live Digital Clock Badge */}
        <div className="bg-surface-panel border border-border-subtle rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between sm:justify-start gap-3 shadow-2xs shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary animate-pulse shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted sm:hidden">
              Waktu Server:
            </span>
          </div>
          <div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              <span>Waktu Server</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                {todayData?.timezone || 'WIB'}
              </span>
            </div>
            <div className="text-base sm:text-lg font-mono font-bold text-text-primary leading-tight">
              {currentTime || `--:--:-- ${todayData?.timezone || 'WIB'}`}
            </div>
          </div>
        </div>
      </div>
 
      {/* Banner Rekomendasi Browser Eksternal jika Terbuka di WhatsApp Webview */}
      {isInAppBrowser && (
        <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 shadow-2xs animate-in fade-in">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Buka Lewat WhatsApp?</strong> Beberapa peramban internal WhatsApp membatasi sensor GPS & Kamera. Jika mengalami kendala, ketuk <strong>ikon titik tiga (⋮)</strong> di pojok kanan atas lalu pilih <strong>"Buka di Browser / Chrome"</strong>.
          </div>
        </div>
      )}

      {/* Alert Notification */}
      {message && (
        <div
          className={`p-3 sm:p-4 rounded-xl border flex items-start gap-2.5 sm:gap-3 shadow-2xs animate-in fade-in ${
            message.type === 'success'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
              : 'bg-rose-50/80 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-rose-600 mt-0.5" />
          )}
          <div className="text-xs sm:text-[13.5px] font-medium leading-relaxed">{message.text}</div>
        </div>
      )}

      {/* Banner Sesi Shift Malam Selesai */}
      {todayData?.recent_completed_shift && !hasCheckedIn && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-sky-50 to-amber-50 border border-indigo-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-200 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5 text-indigo-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-indigo-900">
                  Sesi Shift Malam Telah Selesai
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white font-mono">
                  {todayData.recent_completed_shift.shift?.name || 'Shift 3 Malam'}
                </span>
              </div>
              <p className="text-xs text-indigo-950/80 mt-0.5 leading-relaxed">
                Absen pulang Anda tercatat pukul{' '}
                <strong>{todayData.recent_completed_shift.check_out_time?.substring(0, 5)} {todayData.timezone || 'WIB'}</strong>.
                Jika hari ini Anda libur / off, silakan catat status libur agar terdata resmi di sistem.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setAttendanceMode('libur');
              handleResetPhoto();
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all cursor-pointer active:scale-95 shrink-0 flex items-center justify-center gap-1.5"
          >
            <SunMedium className="w-4 h-4" />
            <span>Catat Hari Ini Libur / Off</span>
          </button>
        </div>
      )}

      {/* Navigation Switch Mode: Absen Masuk vs Perjalanan Dinas vs Absen Libur vs Sakit/Izin */}
      {(!hasCheckedIn || isHolidayCheckedIn || hasCheckedOut) && (
        <div className="bg-surface-panel border border-border-subtle p-1 sm:p-1.5 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2 shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setAttendanceMode('masuk');
              handleResetPhoto();
            }}
            className={`py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer ${
              attendanceMode === 'masuk'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-container'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate hidden sm:inline">Absen Masuk (Radius)</span>
            <span className="truncate sm:hidden font-medium">Masuk</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAttendanceMode('dinas_luar');
              handleResetPhoto();
            }}
            className={`py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer ${
              attendanceMode === 'dinas_luar'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-container'
            }`}
          >
            <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate hidden sm:inline">Perjalanan Dinas</span>
            <span className="truncate sm:hidden font-medium">Dinas</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAttendanceMode('libur');
              handleResetPhoto();
            }}
            className={`py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer ${
              attendanceMode === 'libur'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-container'
            }`}
          >
            <SunMedium className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate hidden sm:inline">Absen Libur / Off</span>
            <span className="truncate sm:hidden font-medium">Libur/Off</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAttendanceMode('sakit_izin');
              handleResetPhoto();
            }}
            className={`py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer ${
              attendanceMode === 'sakit_izin'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-container'
            }`}
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate hidden sm:inline">Sakit / Izin (Surat)</span>
            <span className="truncate sm:hidden font-medium">Sakit/Izin</span>
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* TAB 1: ABSEN MASUK DENGAN RADIUS 100+ LOKASI & FOTO SELFIE */}
          {attendanceMode === 'masuk' && !isDinasCheckedIn && !isSakitIzinCheckedIn && (
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
                {/* Notice jika sebelumnya sudah absen libur tapi ingin masuk kerja */}
                {isHolidayCheckedIn && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5 shadow-2xs">
                    <SunMedium className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="leading-relaxed">
                      Status Anda saat ini <strong>Absen Libur</strong>. Mengambil foto selfie dan klik tombol absen masuk di bawah akan langsung memperbarui status Anda menjadi <strong>Masuk Kerja</strong>.
                    </span>
                  </div>
                )}
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

                      {/* Tombol Pilih / Ganti Shift */}
                      {!hasCheckedIn && todayData?.available_shifts && todayData.available_shifts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedShiftId(todayData.assigned_shift?.id || null);
                            setIsShiftModalOpen(true);
                          }}
                          className="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-sky-50 text-sky-700 border border-sky-300 shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5 text-sky-600" />
                          <span>Pilih / Ganti Shift</span>
                        </button>
                      )}
                    </div>

                    {/* Bar Pemilihan Shift Cepat Langsung di Card */}
                    {!hasCheckedIn && todayData?.available_shifts && todayData.available_shifts.length > 1 && (
                      <div className="mt-3 pt-3 border-t border-sky-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                          <span className="text-xs font-bold text-sky-900">
                            Pilih Shift Kerja Hari Ini:
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                          <select
                            value={todayData.assigned_shift?.id || ''}
                            onChange={(e) => {
                              const sId = Number(e.target.value);
                              if (sId) {
                                setSelectedShiftId(sId);
                                handleSaveShift(sId);
                              }
                            }}
                            disabled={shiftSaving}
                            className="w-full px-3 py-1.5 text-xs font-semibold bg-white border border-sky-300 rounded-xl text-sky-950 focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-2xs cursor-pointer disabled:opacity-60"
                          >
                            {todayData.available_shifts.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.formatted_time || `${s.start_time.substring(0, 5)} - ${s.end_time.substring(0, 5)}`}) {s.cross_day ? '🌙 (+1 Hari)' : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedShiftId(todayData.assigned_shift?.id || null);
                              setIsShiftModalOpen(true);
                            }}
                            className="shrink-0 px-2.5 py-1.5 text-xs font-semibold text-sky-700 bg-white hover:bg-sky-100/70 border border-sky-300 rounded-xl transition-all cursor-pointer shadow-2xs"
                            title="Buka dialog info shift lengkap"
                          >
                            Semua Shift
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Jika Sudah Absen Masuk, Beri Info Shift Terkunci */}
                    {hasCheckedIn && (
                      <div className="mt-3 pt-3 border-t border-sky-200/80 flex items-center justify-between gap-2 text-xs text-sky-800">
                        <span className="flex items-center gap-1.5 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Shift terkunci untuk presensi hari ini karena Anda sudah melakukan absen masuk.</span>
                        </span>
                      </div>
                    )}
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
                {!hasRealWorkCheckedIn && (
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

                    {!photoPreview ? (
                      <button
                        type="button"
                        onClick={() => handleOpenLiveCamera('selfie')}
                        className="w-full py-3 px-3 sm:py-4 sm:px-4 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 transition-all flex items-center justify-start gap-3 text-primary font-medium text-xs cursor-pointer group shadow-2xs text-left"
                      >
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center shrink-0">
                          <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-primary group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-text-primary text-[12.5px] sm:text-[13px] flex items-center gap-1.5 flex-wrap">
                            <span>Buka Kamera & Ambil Foto Selfie Langsung</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                          </div>
                          <div className="text-[10.5px] sm:text-[11px] text-text-muted mt-0.5 line-clamp-1 sm:line-clamp-none">
                            Nyalakan kamera live untuk jepret foto bukti kehadiran
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
                {!hasRealWorkCheckedIn && (
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

              {/* POINT 8: Live Duration & Shift Target Tracker */}
              {hasRealWorkCheckedIn && !hasCheckedOut && (
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
                          ? `✓ Target ${targetWorkHours} jam kerja shift sudah terpenuhi. Anda dapat melakukan absen pulang.`
                          : `Kurang ${remainingFormatted} lagi untuk mencapai target ${targetWorkHours} jam kerja shift.`}
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
                    {isEightHoursMet ? `${targetWorkHours} Jam Terpenuhi` : `< ${targetWorkHours} Jam`}
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
                      ? `✓ Memenuhi Target (${targetWorkHours} Jam)`
                      : `Kurang dari Target (${targetWorkHours} Jam)`}
                  </span>
                </div>
              )}

              {/* Action Buttons: Absen Masuk & Absen Pulang */}
              <div className="pt-2 border-t border-border-subtle">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={handleCheckInMasuk}
                    disabled={actionLoading || isDetectingGps || !isWithinRadius || !photoFile || hasRealWorkCheckedIn}
                    className={`h-12 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                      hasRealWorkCheckedIn
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-not-allowed opacity-90'
                        : isHolidayCheckedIn && isWithinRadius && photoFile
                        ? 'bg-amber-600 hover:bg-amber-700 text-white active:scale-98'
                        : isWithinRadius && photoFile
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-98'
                        : 'bg-surface-container text-text-muted border border-border-subtle cursor-not-allowed opacity-60'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{hasRealWorkCheckedIn ? '✓ Sudah Absen Masuk' : isHolidayCheckedIn ? 'Konfirmasi Ganti ke Absen Masuk' : 'Absen Masuk (Foto + Radius)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCheckOutClick}
                    disabled={actionLoading}
                    className={`h-12 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                      hasCheckedOut
                        ? 'bg-blue-100 text-blue-800 border border-blue-200 cursor-not-allowed opacity-90'
                        : hasRealWorkCheckedIn
                        ? 'bg-rose-600 hover:bg-rose-700 text-white active:scale-98'
                        : 'bg-surface-container text-text-muted border border-border-subtle hover:bg-surface-container-high'
                    }`}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{hasCheckedOut ? '✓ Sudah Absen Pulang' : 'Absen Pulang (Bebas Radius)'}</span>
                  </button>
                </div>

                {!hasRealWorkCheckedIn && isWithinRadius && !photoFile && (
                  <p className="text-[11.5px] text-amber-600 font-medium mt-2 text-center">
                    ⚠️ Ambil foto selfie kehadiran di atas terlebih dahulu untuk mengaktifkan tombol {isHolidayCheckedIn ? 'Ganti ke Absen Masuk' : 'Absen Masuk'}.
                  </p>
                )}

                {hasCheckedOut && !isHolidayCheckedIn && (
                  <div className="mt-3.5 p-3 bg-amber-50/90 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-900 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <SunMedium className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Ingin mencatat sisa hari ini sebagai <strong>Hari Libur / Off Terjadwal</strong>?</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAttendanceMode('libur');
                        handleResetPhoto();
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer transition-all shrink-0"
                    >
                      Catat Hari Libur / Off
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PERJALANAN DINAS (POINT 5: BEBAS RADIUS GPS) */}
          {(attendanceMode === 'dinas_luar' || isDinasCheckedIn) && !isHolidayCheckedIn && !isSakitIzinCheckedIn && (
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
                          Tercatat pada pukul {todayData?.attendance?.check_in_time?.substring(0, 5)} {todayData?.timezone || 'WIB'}. Catatan: &quot;{todayData?.attendance?.notes}&quot;
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
          {(attendanceMode === 'libur' || isHolidayCheckedIn) && !isSakitIzinCheckedIn && (
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

                {!isHolidayCheckedIn ? (
                  <div className="space-y-3">
                    {hasCheckedOut && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2 animate-in fade-in">
                        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Sesi Kerja Sebelumnya Selesai:</strong> Anda telah melakukan absensi pulang pada pukul {todayData?.attendance?.check_out_time?.substring(0, 5)} {todayData?.timezone || 'WIB'}. Mengkonfirmasi libur akan mencatat sisa hari ini sebagai Hari Libur / Off Terjadwal tanpa menghapus riwayat jam kerja shift Anda.
                        </div>
                      </div>
                    )}
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
                      <span>{actionLoading ? 'Mencatat Absen...' : hasCheckedOut ? 'Konfirmasi Catat Sisa Hari Ini Sebagai Libur / Off' : 'Konfirmasi Absen Libur Hari Ini'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-sm font-semibold">
                          ✓ Anda Telah Melakukan Absen Libur Hari Ini
                        </strong>
                        <span className="text-xs text-emerald-800 mt-0.5 block">
                          Tercatat pada pukul {todayData?.attendance?.check_in_time?.substring(0, 5)} {todayData?.timezone || 'WIB'}. Anda tidak perlu melakukan absen pulang. Selamat beristirahat!
                        </span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-emerald-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                      <div className="text-xs text-emerald-950 font-medium">
                        Ada tugas mendadak atau ingin masuk kerja hari ini?
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAttendanceMode('masuk');
                          handleResetPhoto();
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <span>Masuk Kerja Hari Ini (Absen Masuk)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ABSEN SAKIT / IZIN RESMI (POINT MAUN: UPLOAD SURAT & VERIFIKASI ADMIN) */}
          {(attendanceMode === 'sakit_izin' || isSakitIzinCheckedIn) && (
            <div className="bg-surface-panel border border-purple-200/90 rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center gap-2.5 pb-3 border-b border-border-subtle text-purple-900 font-semibold text-[15px]">
                <FileText className="w-5 h-5 text-purple-600" />
                <span>Pengajuan Absen Sakit / Izin Resmi (Upload Surat)</span>
              </div>

              <div className="py-4 space-y-4">
                <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-4 text-xs text-purple-900 leading-relaxed space-y-2">
                  <div className="font-semibold text-sm flex items-center gap-1.5 text-purple-950">
                    <Info className="w-4 h-4 text-purple-600" />
                    <span>Ketentuan Absen Sakit & Izin:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-purple-800">
                    <li>
                      <strong>Wajib melampirkan foto surat resmi</strong>: Surat Keterangan Dokter (SKD) untuk sakit, atau surat permohonan tertulis untuk izin penting.
                    </li>
                    <li>
                      <strong>Bebas radius lokasi GPS</strong>: Anda dapat mengajukan permohonan dari rumah, klinik, atau rumah sakit.
                    </li>
                    <li>
                      <strong>Proses Verifikasi Admin</strong>: Permohonan akan diverifikasi langsung oleh Admin HRD sebelum disahkan di rekapitulasi gaji.
                    </li>
                    <li>
                      <strong>Tidak perlu absen pulang</strong>: Setelah pengajuan dikirim, Anda tidak perlu melakukan check-out.
                    </li>
                  </ul>
                </div>

                {!hasCheckedIn ? (
                  <div className="space-y-4">
                    {/* Pemilihan Jenis: Sakit vs Izin */}
                    <div>
                      <label className="text-xs font-semibold text-text-secondary block mb-1.5">
                        Pilih Kategori Permohonan:
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setLeaveSubtype('sakit')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                            leaveSubtype === 'sakit'
                              ? 'bg-rose-50/80 border-rose-300 text-rose-900 font-semibold shadow-2xs'
                              : 'bg-surface-container border-border-subtle text-text-secondary hover:bg-surface-container-high'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${leaveSubtype === 'sakit' ? 'bg-rose-600 text-white' : 'bg-surface-panel text-text-muted'}`}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">Sakit (SKD Dokter)</div>
                            <div className="text-[10px] text-text-muted truncate">Surat Dokter</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setLeaveSubtype('izin')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                            leaveSubtype === 'izin'
                              ? 'bg-purple-50/80 border-purple-300 text-purple-900 font-semibold shadow-2xs'
                              : 'bg-surface-container border-border-subtle text-text-secondary hover:bg-surface-container-high'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${leaveSubtype === 'izin' ? 'bg-purple-600 text-white' : 'bg-surface-panel text-text-muted'}`}>
                            <Briefcase className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">Izin Resmi</div>
                            <div className="text-[10px] text-text-muted truncate">Keperluan Khusus</div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Alasan / Keterangan */}
                    <div>
                      <label className="text-xs font-semibold text-text-secondary block mb-1">
                        Alasan / Keterangan <span className="text-rose-500 font-bold">*Wajib</span>:
                      </label>
                      <textarea
                        rows={2}
                        value={leaveNotes}
                        onChange={(e) => setLeaveNotes(e.target.value)}
                        placeholder={
                          leaveSubtype === 'sakit'
                            ? 'Contoh: Sakit demam tinggi / rawat jalan, istirahat dokter 2 hari...'
                            : 'Contoh: Mengurus keperluan keluarga mendesak / acara penting resmi...'
                        }
                        className="w-full px-3.5 py-2 text-xs bg-surface-container border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>

                    {/* Lampiran Foto Surat Bukti (Wajib) */}
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-semibold text-text-secondary flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-purple-600" />
                          <span>Foto Surat Bukti Sakit / Izin <strong className="text-rose-500">*Wajib</strong>:</span>
                        </span>
                        {photoPreview && (
                          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Surat Terlampir
                          </span>
                        )}
                      </label>

                      {!photoPreview ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenLiveCamera('surat')}
                            className="py-3 px-3 rounded-xl border border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/50 hover:bg-purple-50 transition-all flex items-center justify-center gap-2 text-purple-700 font-semibold text-xs cursor-pointer shadow-2xs group"
                          >
                            <Camera className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
                            <span>Buka Kamera & Foto Surat</span>
                          </button>

                          <label className="py-3 px-3 rounded-xl border border-dashed border-border-subtle hover:border-purple-400 bg-surface-container hover:bg-surface-container-high transition-all flex items-center justify-center gap-2 text-text-secondary hover:text-purple-700 font-semibold text-xs cursor-pointer shadow-2xs">
                            <Upload className="w-4 h-4 text-purple-600" />
                            <span>Pilih dari Galeri / File</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  const url = URL.createObjectURL(f);
                                  handleCameraCaptured(f, url);
                                }
                              }}
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3.5 p-3 bg-surface-container rounded-xl border border-border-subtle">
                          <img
                            src={photoPreview}
                            alt="Foto Surat Bukti"
                            className="w-16 h-16 object-cover rounded-xl border border-border-subtle shadow-xs cursor-pointer"
                            onClick={() => setPreviewModalUrl(photoPreview)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-text-primary truncate">
                              {photoFile?.name || 'Foto Surat Keterangan'}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <button
                                type="button"
                                onClick={() => handleOpenLiveCamera('surat')}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 hover:underline cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Foto Ulang</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleResetPhoto}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:underline cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tombol Kirim */}
                    <button
                      type="button"
                      onClick={handleCheckInSakitIzin}
                      disabled={actionLoading || !leaveNotes.trim() || !photoFile}
                      className="w-full h-12 bg-purple-600 hover:bg-purple-700 active:scale-98 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileText className="w-4 h-4" />
                      <span>{actionLoading ? 'Mengirim Pengajuan...' : `Kirim Permohonan Absen ${leaveSubtype === 'sakit' ? 'Sakit' : 'Izin'}`}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Status Box */}
                    {todayData?.attendance?.approval_status === 'pending' ? (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-sm font-semibold text-amber-900">
                            ⏳ Pengajuan Sedang Menunggu Verifikasi Admin
                          </strong>
                          <span className="text-xs text-amber-800 mt-0.5 block leading-relaxed">
                            Permohonan {todayData?.attendance?.attendance_type === 'sakit' ? 'Sakit (Surat Dokter)' : 'Izin Resmi'} Anda tercatat pada pukul {todayData?.attendance?.check_in_time?.substring(0, 5)} {todayData?.timezone || 'WIB'}. Admin sedang meninjau kelengkapan foto surat Anda. Anda tidak perlu absen pulang.
                          </span>
                        </div>
                      </div>
                    ) : todayData?.attendance?.approval_status === 'approved' ? (
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-sm font-semibold text-emerald-900">
                            ✓ Pengajuan Telah Disetujui Admin
                          </strong>
                          <span className="text-xs text-emerald-800 mt-0.5 block leading-relaxed">
                            Dokumen surat Anda telah diverifikasi oleh Admin. Status presensi hari ini tercatat sah sebagai {todayData?.attendance?.attendance_type === 'sakit' ? 'Sakit Resmi' : 'Izin Resmi'}.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-sm font-semibold text-rose-900">
                            ✕ Pengajuan Ditolak oleh Admin
                          </strong>
                          <span className="text-xs text-rose-800 mt-0.5 block leading-relaxed">
                            Alasan: &quot;{todayData?.attendance?.rejection_reason || 'Dokumen surat tidak memenuhi syarat.'}&quot;. Status kehadiran tercatat sebagai Tidak Hadir (Alpa).
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Preview Rincian Pengajuan */}
                    <div className="bg-surface-container/60 rounded-xl p-3 border border-border-subtle flex items-start gap-3">
                      {todayData?.attendance?.photo_full_url && (
                        <img
                          src={todayData.attendance.photo_full_url}
                          alt="Foto Surat"
                          className="w-16 h-16 object-cover rounded-lg border border-border-subtle shrink-0 cursor-pointer shadow-xs"
                          onClick={() => setPreviewModalUrl(todayData.attendance?.photo_full_url || null)}
                        />
                      )}
                      <div className="min-w-0 text-xs space-y-1">
                        <div className="font-semibold text-text-primary">
                          Keterangan Alasan:
                        </div>
                        <div className="text-text-secondary italic">
                          &quot;{todayData?.attendance?.notes || '-'}&quot;
                        </div>
                      </div>
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
                      ? todayData.attendance.check_in_time.substring(0, 5) + ' ' + (todayData?.timezone || 'WIB')
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
                        ? todayData.attendance.check_out_time.substring(0, 5) + ' ' + (todayData?.timezone || 'WIB')
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
                        {row.check_out_time ? (
                          <span className="inline-flex items-center gap-1">
                            <span>{row.check_out_time.substring(0, 5)}</span>
                            {(row.shift?.cross_day || (row.check_in_time && row.check_out_time < row.check_in_time)) && (
                              <span className="text-[9px] font-sans font-bold px-1 py-0.5 rounded bg-purple-100 text-purple-700" title="Pulang di hari berikutnya (+1 hari)">
                                +1h
                              </span>
                            )}
                          </span>
                        ) : '-'}
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

      {/* POINT 8: Modal Konfirmasi Absen Pulang Sebelum Target Jam Kerja Shift */}
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
                  <strong className="text-amber-700 font-semibold">{elapsedFormatted}</strong> (belum mencapai target kerja shift {targetWorkHours} jam).
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50/90 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
              Masih tersisa sekitar <strong>{remainingFormatted}</strong> untuk mencapai target {targetWorkHours} jam kerja ({targetWorkMinutes} menit) sesuai shift ({assignedShift?.name || 'Reguler'}). Absen pulang di-los (bebas lokasi), namun durasi kerja tetap tercatat di laporan. Tetap ingin absen pulang sekarang?
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

      {/* Modal Pemilihan Shift Kerja Karyawan */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary">Pilih Jadwal Shift Kerja</h3>
                  <p className="text-xs text-text-muted">
                    Sesuaikan shift kerja Anda hari ini sebelum melakukan presensi masuk
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(false)}
                className="w-8 h-8 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 py-1">
              {todayData?.available_shifts?.map((shift) => {
                const isSelected = selectedShiftId === shift.id;
                const isCurrent = todayData?.assigned_shift?.id === shift.id;

                return (
                  <div
                    key={shift.id}
                    onClick={() => setSelectedShiftId(shift.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/70 shadow-xs ring-1 ring-sky-500/30'
                        : 'border-border-subtle bg-surface-panel hover:bg-surface-container hover:border-border-default'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                        isSelected ? 'border-sky-600 bg-sky-600 text-white' : 'border-border-subtle bg-white'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-text-primary">{shift.name}</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-100 text-sky-800 border border-sky-200">
                            {shift.code}
                          </span>
                          {shift.cross_day && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                              +1 Hari (Malam)
                            </span>
                          )}
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Shift Aktif Saat Ini
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-text-secondary font-mono font-semibold mt-1">
                          Jam Kerja: {shift.formatted_time || `${shift.start_time.substring(0, 5)} - ${shift.end_time.substring(0, 5)}`} {todayData?.timezone || 'WIB'}
                        </div>

                        <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-3 flex-wrap">
                          <span>Toleransi: <strong className="text-text-secondary">{shift.late_tolerance_minutes} menit</strong></span>
                          <span>•</span>
                          <span>Durasi Target: <strong className="text-text-secondary">{shift.work_hours} jam</strong></span>
                          {shift.description && (
                            <>
                              <span>•</span>
                              <span className="italic">{shift.description}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-border-subtle text-text-secondary hover:bg-surface-container transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={shiftSaving || !selectedShiftId || selectedShiftId === todayData?.assigned_shift?.id}
                onClick={() => selectedShiftId && handleSaveShift(selectedShiftId)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {shiftSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Terapkan Shift Ini</span>
                  </>
                )}
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
