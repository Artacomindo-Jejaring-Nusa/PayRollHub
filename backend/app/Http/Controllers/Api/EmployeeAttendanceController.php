<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\AttendanceSetting;
use App\Models\Shift;
use App\Services\TimezoneService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class EmployeeAttendanceController extends Controller
{
    /**
     * Ambil status absensi hari ini beserta setting kantor & 100+ lokasi aktif.
     */
    public function today(Request $request): JsonResponse
    {
        $user = $request->user();
        $clientTz = $request->header('X-Timezone') ?: $request->query('timezone');
        $clientLat = $request->query('latitude') ? (float) $request->query('latitude') : null;
        $clientLng = $request->query('longitude') ? (float) $request->query('longitude') : null;
        $tzData = TimezoneService::getNowForUser($user, $clientLat, $clientLng, $clientTz);

        $today = $tzData['today'];
        $serverTime = $tzData['time'];
        $targetCompany = $user->company ?: 'rbs';
        $setting = \App\Models\AttendanceSetting::getActiveSetting($targetCompany);
        $hqLocation = \App\Models\AttendanceSetting::syncHeadquartersLocation($setting);

        // Ambil daftar 100+ lokasi aktif untuk perusahaan ini
        $locations = \App\Models\AttendanceLocation::forTenant($targetCompany)
            ->where('is_active', true)
            ->orderBy('name', 'asc')
            ->get();

        // Pastikan lokasi Kantor Pusat ada di daftar lokasi
        if (!$locations->contains('id', $hqLocation->id)) {
            $locations->prepend($hqLocation);
        }

        $attendance = $this->resolveActiveAttendance($user, $today, $tzData['carbon']);

        // Cek apakah ada sesi shift malam / lintas hari kemarin yang baru saja selesai di-checkout hari ini
        $yesterday = Carbon::parse($today)->subDay()->toDateString();
        $recentCompletedShift = null;
        if (!$attendance || empty($attendance->check_in_time)) {
            $yesterdayAttendance = Attendance::with(['location', 'approver', 'shift'])
                ->where('user_id', $user->id)
                ->where('date', $yesterday)
                ->whereNotNull('check_in_time')
                ->whereNotNull('check_out_time')
                ->whereNotIn('attendance_type', ['libur', 'sakit', 'izin'])
                ->first();

            if ($yesterdayAttendance) {
                $yShift = $yesterdayAttendance->shift ?: $user->shift;
                $isYCrossDay = $yShift && ($yShift->cross_day || $yShift->start_time > $yShift->end_time);
                $isYNightCheckIn = $yesterdayAttendance->check_in_time >= '17:00:00';
                if ($isYCrossDay || $isYNightCheckIn) {
                    $recentCompletedShift = $yesterdayAttendance;
                }
            }
        }

        // POINT 10 & Note Bang Maun: Karyawan tidak perlu memilih lokasi karena sudah terdaftar dan terkunci
        // sesuai penugasannya (Admin wajib di Kantor Pusat, Karyawan di unit sekolah / kantor).
        $isAdmin = $user->role === 'admin';
        $assignedLocation = $this->resolveUserAssignedLocation($user, $targetCompany, $setting, $hqLocation);
        $isLocationLocked = true;

        // Default shift untuk karyawan:
        // Riama: SHIFT_1_3_SHIFT (Pagi 07:00-15:00)
        // RBS: Shift ID 1 / Reguler (08:00-17:00)
        $defaultShift = null;
        if ($targetCompany === 'rimamandiri') {
            $defaultShift = \App\Models\Shift::where('code', 'SHIFT_1_3_SHIFT')->first();
        }
        if (!$defaultShift) {
            $defaultShift = \App\Models\Shift::find(1) ?: \App\Models\Shift::where('code', 'REGULER')->first();
        }

        $assignedShift = ($attendance && $attendance->shift)
            ? $attendance->shift
            : ($user->shift ?: $defaultShift);

        return response()->json([
            'status' => 'success',
            'data' => [
                'today' => $today,
                'server_time' => $serverTime,
                'timezone' => $tzData['timezone'],
                'timezone_name' => $tzData['timezone_name'],
                'timezone_label' => $tzData['timezone_label'],
                'timezone_offset' => $tzData['timezone_offset'],
                'attendance' => $attendance,
                'recent_completed_shift' => $recentCompletedShift,
                'assigned_location' => $assignedLocation,
                'is_location_locked' => true,
                'assigned_shift' => $assignedShift,
                'available_shifts' => \App\Models\Shift::getAvailableForUser($user),
                'is_admin_user' => $isAdmin,
                'is_admin_headquarters_enforced' => $isAdmin,
                'headquarters_location' => $hqLocation,
                'total_locations' => 1,
                'locations' => collect([$assignedLocation]),
                'office_setting' => [
                    'office_name' => $setting->office_name,
                    'latitude' => $setting->latitude,
                    'longitude' => $setting->longitude,
                    'radius_meters' => $setting->radius_meters,
                    'work_start_time' => $setting->work_start_time,
                    'work_end_time' => $setting->work_end_time,
                    'late_tolerance_minutes' => $setting->late_tolerance_minutes,
                ],
            ],
        ]);
    }

    /**
     * Proses Absen Masuk (Check-in) dengan Validasi Radius Geofencing (100+ Lokasi)
     * atau Absen Libur (Bebas tanpa radius).
     */
    public function checkIn(Request $request): JsonResponse
    {
        $attendanceType = strtolower($request->input('attendance_type', 'masuk'));

        $user = $request->user();
        $clientTz = $request->header('X-Timezone') ?: $request->input('timezone');
        $lat = $request->input('latitude') ? (float) $request->input('latitude') : null;
        $lng = $request->input('longitude') ? (float) $request->input('longitude') : null;
        $tzData = TimezoneService::getNowForUser($user, $lat, $lng, $clientTz);

        $now = $tzData['carbon'];
        $today = $tzData['today'];
        $currentTime = $tzData['time'];
        $targetCompany = $user->company ?: 'rbs';

        $yesterday = Carbon::parse($today)->subDay()->toDateString();

        // 1. Tentukan tanggal shift yang sesuai (mendukung check-in dini hari untuk shift lintas hari)
        $attendanceDate = $today;
        $activeShift = null;
        if (!empty($request->input('shift_id'))) {
            $activeShift = Shift::find((int) $request->input('shift_id'));
        }
        if (!$activeShift) {
            $activeShift = $user->shift;
        }

        // Penentuan tanggal kemarin subuh hanya berlaku untuk absen kerja (masuk / dinas luar),
        // JANGAN PERNAH mundurkan tanggal ke kemarin jika karyawan sedang mengajukan ABSEN LIBUR hari ini!
        if (in_array($attendanceType, ['masuk', 'dinas_luar']) && $activeShift && ($activeShift->cross_day || $activeShift->start_time > $activeShift->end_time)) {
            $currentTimeStr = $now->format('H:i:s');
            // Jika check-in subuh / dini hari (00:00 - 08:00) dan kemarin belum ada catatan absensi:
            if ($currentTimeStr < $activeShift->end_time && $currentTimeStr < '08:00:00') {
                $yesterdayRec = Attendance::where('user_id', $user->id)->where('date', $yesterday)->first();
                if (!$yesterdayRec) {
                    $attendanceDate = $yesterday;
                }
            }
        }

        // 2. DI-LOSS-KAN: Auto-close shift masa lalu (Shift 3 Malam & Shift 24 Jam) yang lupa checkout
        // Jika ada shift sebelumnya yang belum ditutup (belum absen pulang), sistem otomatis menutupnya
        // agar karyawan tidak diblokir dan bisa langsung absen masuk atau absen libur untuk shift baru.
        $unclosedPast = Attendance::with('shift')->where('user_id', $user->id)
            ->where('date', '<', $attendanceDate)
            ->whereNotNull('check_in_time')
            ->whereNull('check_out_time')
            ->whereNotIn('attendance_type', ['libur', 'sakit', 'izin'])
            ->where('status', '!=', 'holiday')
            ->latest('date')
            ->first();

        if ($unclosedPast && in_array($attendanceType, ['masuk', 'dinas_luar', 'libur'])) {
            $pastShift = $unclosedPast->shift ?: $user->shift;
            $autoOutTime = $pastShift ? $pastShift->end_time : '07:00:00';
            $noteAction = ($attendanceType === 'libur') ? 'mencatat hari libur' : 'memulai shift baru';
            $unclosedPast->update([
                'check_out_time' => $autoOutTime,
                'notes' => trim(($unclosedPast->notes ?: '') . " [Auto-checkout sistem: Sesi shift ditutup otomatis saat karyawan {$noteAction}]"),
            ]);
        }

        // Cek apakah sudah check-in hari ini (pada tanggal shift yang ditentukan)
        $existing = Attendance::where('user_id', $user->id)
            ->where('date', $attendanceDate)
            ->first();

        if ($existing && $existing->check_in_time) {
            $isExistingHoliday = ($existing->attendance_type === 'libur' || $existing->status === 'holiday');
            $isRequestingWork = in_array($attendanceType, ['masuk', 'dinas_luar', 'perjalanan_dinas']);

            // Jika sebelumnya hanya tercatat absen libur, dan sekarang user ingin absen masuk kerja riil (atau dinas luar),
            // izinkan untuk memperbarui kehadiran (override holiday) daripada menolaknya dengan error!
            if ($isExistingHoliday && $isRequestingWork) {
                // Diizinkan override
            } elseif (!empty($existing->check_out_time)) {
                // DI-LOSS-KAN: KASUS ABSEN SETELAH CHECKOUT
                if ($attendanceType === 'libur') {
                    // Jika sesi sebelumnya sudah checkout (misal checkout shift subuh/pagi atau multi-shift),
                    // izinkan menetapkan status hari ini sebagai Libur/Off tanpa error!
                    $archiveNote = "[Sesi Kerja Selesai: Masuk {$existing->check_in_time}, Pulang {$existing->check_out_time}]";
                    $holidayNotes = $request->input('notes') ?: 'Hari Libur Terjadwal / Off Rutin';
                    $existing->update([
                        'attendance_type' => 'libur',
                        'status' => 'holiday',
                        'approval_status' => 'approved',
                        'location_name' => 'Hari Libur / Off',
                        'notes' => trim(($existing->notes ?: '') . " | {$archiveNote} | {$holidayNotes}"),
                    ]);

                    return response()->json([
                        'status' => 'success',
                        'message' => "Absen Libur berhasil tercatat pada {$currentTime} {$tzData['timezone']}. Anda tidak perlu absen pulang. Selamat beristirahat!",
                        'data' => $existing->fresh(['shift', 'location']),
                        'timezone' => $tzData['timezone'],
                        'timezone_label' => $tzData['timezone_label'],
                    ]);
                } else {
                    // KASUS ABSEN MASUK SESI 2 (Multi-shift / 2x Absen Sehari)
                    // Arsipkan sesi sebelumnya ke notes dan izinkan absen masuk sesi kedua
                    $existing->update([
                        'notes' => trim(($existing->notes ?: '') . " | [Sesi 1: Masuk {$existing->check_in_time}, Pulang {$existing->check_out_time}]"),
                        'check_out_time' => null,
                        'check_out_lat' => null,
                        'check_out_lng' => null,
                    ]);
                }
            } else {
                $jenis = match ($existing->attendance_type) {
                    'libur' => 'absen libur',
                    'sakit' => 'pengajuan sakit',
                    'izin' => 'pengajuan izin',
                    'dinas_luar' => 'absen perjalanan dinas',
                    default => 'absen masuk',
                };
                return response()->json([
                    'status' => 'error',
                    'message' => "Anda sudah melakukan {$jenis} hari ini pada pukul {$existing->check_in_time}. Silakan lakukan absen pulang terlebih dahulu sebelum absen masuk kembali.",
                ], 422);
            }
        }

        // =========================================================================
        // POINT 3: ABSEN LIBUR (TIDAK PERLU VALIDASI RADIUS GPS)
        // =========================================================
        if ($attendanceType === 'libur') {
            $notes = $request->input('notes') ?: 'Absen Libur / Hari Off Rutin';

            $attendance = Attendance::updateOrCreate(
                ['user_id' => $user->id, 'date' => $today],
                [
                    'attendance_type' => 'libur',
                    'check_in_time' => $currentTime,
                    'check_in_lat' => $request->input('latitude') ? (float) $request->input('latitude') : null,
                    'check_in_lng' => $request->input('longitude') ? (float) $request->input('longitude') : null,
                    'location_name' => 'Hari Libur / Off',
                    'check_in_distance_meters' => null,
                    'check_in_status' => 'on_time',
                    'status' => 'holiday',
                    'approval_status' => 'approved',
                    'notes' => $notes,
                ]
            );

            return response()->json([
                'status' => 'success',
                'message' => "Absen Libur berhasil tercatat pada {$currentTime} {$tzData['timezone']}. Anda tidak perlu absen pulang. Selamat beristirahat!",
                'data' => $attendance,
                'timezone' => $tzData['timezone'],
                'timezone_label' => $tzData['timezone_label'],
            ]);
        }

        // =========================================================================
        // POINT MAUN: ABSEN SAKIT / IZIN DENGAN UPLOAD FOTO SURAT & VERIFIKASI ADMIN
        // =========================================================================
        if ($attendanceType === 'sakit' || $attendanceType === 'izin') {
            $label = $attendanceType === 'sakit' ? 'Sakit' : 'Izin';
            $notes = $request->input('notes');
            if (empty(trim($notes ?? ''))) {
                return response()->json([
                    'status' => 'error',
                    'message' => "Alasan / keterangan permohonan {$label} wajib diisi.",
                ], 422);
            }

            // Foto bukti surat dokter / permohonan izin wajib diunggah
            if (!$request->hasFile('photo') && !$request->input('photo')) {
                return response()->json([
                    'status' => 'error',
                    'message' => "Foto bukti surat keterangan dokter atau surat permohonan izin wajib diunggah.",
                ], 422);
            }

            $photoPath = $this->storeAttendancePhoto($request, $user->id);
            $userShift = $user->shift ?: \App\Models\Shift::where('code', 'REGULER')->first();

            $attendance = Attendance::updateOrCreate(
                ['user_id' => $user->id, 'date' => $today],
                [
                    'attendance_type' => $attendanceType,
                    'check_in_time' => $currentTime,
                    'check_in_lat' => $request->input('latitude') ? (float) $request->input('latitude') : null,
                    'check_in_lng' => $request->input('longitude') ? (float) $request->input('longitude') : null,
                    'location_name' => $attendanceType === 'sakit' ? 'Sakit (Surat Dokter)' : 'Izin Resmi',
                    'shift_id' => $userShift?->id,
                    'check_in_distance_meters' => null,
                    'check_in_status' => 'on_time',
                    'status' => 'permit',
                    'approval_status' => 'pending', // Menunggu verifikasi admin
                    'notes' => $notes,
                    'photo_url' => $photoPath,
                ]
            );

            return response()->json([
                'status' => 'success',
                'message' => "Pengajuan Absen {$label} dengan lampiran surat berhasil dikirim pada {$currentTime} {$tzData['timezone']}. Saat ini menunggu verifikasi Admin. Anda tidak perlu absen pulang.",
                'data' => $attendance,
                'timezone' => $tzData['timezone'],
                'timezone_label' => $tzData['timezone_label'],
            ]);
        }

        // =========================================================================
        // POINT 5: ABSEN PERJALANAN DINAS (TIDAK PAKAI RADIUS GEOFENCING)
        // =========================================================================
        if ($attendanceType === 'dinas_luar' || $attendanceType === 'perjalanan_dinas') {
            $notes = $request->input('notes');
            if (empty(trim($notes ?? ''))) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Catatan keperluan perjalanan dinas wajib diisi (contoh: Kunjungan dinas / tugas lapangan).',
                ], 422);
            }

            // Simpan foto bukti dinas luar jika diunggah
            $userShift = $user->shift ?: \App\Models\Shift::where('code', 'REGULER')->first();
            $photoPath = $this->storeAttendancePhoto($request, $user->id);

            $attendance = Attendance::updateOrCreate(
                ['user_id' => $user->id, 'date' => $attendanceDate],
                [
                    'attendance_type' => 'dinas_luar',
                    'check_in_time' => $currentTime,
                    'check_in_lat' => $request->input('latitude') ? (float) $request->input('latitude') : null,
                    'check_in_lng' => $request->input('longitude') ? (float) $request->input('longitude') : null,
                    'location_name' => 'Perjalanan Dinas',
                    'location_id' => null,
                    'shift_id' => $userShift?->id,
                    'check_in_distance_meters' => null,
                    'check_in_status' => 'on_time',
                    'status' => 'present',
                    'notes' => !empty($existing?->notes) ? trim($existing->notes . ' | ' . $notes) : $notes,
                    'photo_url' => $photoPath,
                    'check_out_time' => null,
                    'check_out_lat' => null,
                    'check_out_lng' => null,
                ]
            );

            $wasHoliday = $existing && ($existing->attendance_type === 'libur' || $existing->status === 'holiday');
            $msg = $wasHoliday
                ? "Absen Perjalanan Dinas berhasil dicatat! Status libur Anda hari ini telah diperbarui menjadi Dinas Luar."
                : "Absen Perjalanan Dinas berhasil tercatat pada {$currentTime} {$tzData['timezone']}. Selamat bertugas!";

            return response()->json([
                'status' => 'success',
                'message' => $msg,
                'data' => $attendance,
                'timezone' => $tzData['timezone'],
                'timezone_label' => $tzData['timezone_label'],
            ]);
        }

        // =========================================================================
        // POINT 4: ABSEN MASUK (FOTO SELFIE + VALIDASI RADIUS 100+ LOKASI)
        // =========================================================================
        $validated = $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'location_id' => 'nullable|integer',
            'shift_id' => 'nullable|integer',
            'notes' => 'nullable|string|max:500',
        ]);

        // Simpan foto selfie absen masuk
        $photoPath = $this->storeAttendancePhoto($request, $user->id);
        if (!$photoPath) {
            return response()->json([
                'status' => 'error',
                'message' => 'Foto bukti kehadiran (selfie) wajib diambil sebelum melakukan absen masuk.',
            ], 422);
        }

        $lat = (float) $validated['latitude'];
        $lng = (float) $validated['longitude'];

        // =========================================================================
        // POINT 10: KHUSUS ADMIN — WAJIB ABSEN DI KANTOR PUSAT YANG DIBUAT SUPER ADMIN
        // =========================================================================
        $setting = \App\Models\AttendanceSetting::getActiveSetting($targetCompany);
        $hqLocation = \App\Models\AttendanceSetting::syncHeadquartersLocation($setting);

        // Note Bang Maun: Karyawan tidak perlu memilih lokasi karena sudah terdaftar dan terkunci
        // sesuai penugasan masing-masing (Admin wajib di Kantor Pusat, Karyawan di unit sekolah / kantor).
        $matchedLocation = $this->resolveUserAssignedLocation($user, $targetCompany, $setting, $hqLocation);

        $distance = \App\Models\AttendanceLocation::calculateDistanceInMeters(
            $lat, $lng,
            $matchedLocation->latitude, $matchedLocation->longitude
        );
        $isWithinRadius = $distance <= $matchedLocation->radius_meters;
        $locationName = $matchedLocation->name;
        $radiusLimit = $matchedLocation->radius_meters;
        $locationId = $matchedLocation->id;

        if (!$isWithinRadius) {
            $failMsg = ($user->role === 'admin' || $user->role === 'super_admin')
                ? "Gagal Absen: Sebagai Admin, Anda wajib melakukan absensi di Kantor Pusat ({$locationName}) yang telah ditetapkan oleh Super Admin! Jarak Anda saat ini: {$distance} meter dari Kantor Pusat (Batas radius kantor: {$radiusLimit} meter). Presensi di unit sekolah atau lokasi lain tidak diizinkan untuk akun Admin."
                : "Gagal Absen: Anda berada di luar radius lokasi penugasan Anda ({$locationName})! Jarak Anda saat ini: {$distance} meter (Batas radius lokasi: {$radiusLimit} meter). Presensi wajib dilakukan di area penugasan.";

            return response()->json([
                'status' => 'error',
                'message' => $failMsg,
                'distance_meters' => $distance,
                'max_radius_meters' => $radiusLimit,
                'nearest_location' => $locationName,
                'is_admin_violation' => ($user->role === 'admin' || $user->role === 'super_admin'),
            ], 422);
        }

        // Tentukan status keterlambatan berdasarkan Shift aktif karyawan (atau shift yang dipilih saat check-in)
        $setting = \App\Models\AttendanceSetting::getActiveSetting($targetCompany);

        $userShift = null;
        if (!empty($validated['shift_id'])) {
            $availableShifts = \App\Models\Shift::getAvailableForUser($user);
            $chosenShift = $availableShifts->firstWhere('id', (int) $validated['shift_id']);
            if ($chosenShift) {
                $user->update(['shift_id' => $chosenShift->id]);
                $userShift = $chosenShift;
            }
        }
        if (!$userShift) {
            $userShift = $user->shift;
            if (!$userShift) {
                $isRiama = in_array(strtolower($targetCompany), ['rimamandiri', 'riama']);
                if ($isRiama) {
                    $userShift = \App\Models\Shift::where('code', 'SHIFT_1_3_SHIFT')->first()
                        ?: \App\Models\Shift::whereIn('company', ['rimamandiri', 'riama'])->first();
                } else {
                    $userShift = \App\Models\Shift::where('code', 'REGULER')->first()
                        ?: (\App\Models\Shift::find(1) ?: \App\Models\Shift::whereIn('company', ['rbs', 'rimbun'])->first());
                }
            }
        }

        $shiftStartTime = $userShift ? $userShift->start_time : $setting->work_start_time;
        $shiftTolerance = $userShift ? (int) $userShift->late_tolerance_minutes : (int) $setting->late_tolerance_minutes;
        $shiftName = $userShift ? $userShift->name : 'Reguler';

        $workStart = Carbon::createFromTimeString($shiftStartTime);
        $lateThreshold = (clone $workStart)->addMinutes($shiftTolerance);

        $currentCheckInTime = Carbon::createFromTimeString($currentTime);
        $isCrossDay = $userShift && ($userShift->cross_day || $userShift->start_time > $userShift->end_time);
        if ($isCrossDay && (int) $workStart->format('H') >= 12 && $currentCheckInTime->lessThan($workStart) && (int) $currentCheckInTime->format('H') < 12) {
            $currentCheckInTime->addDay();
        }

        $isLate = $currentCheckInTime->greaterThan($lateThreshold);
        $checkInStatus = $isLate ? 'late' : 'on_time';
        $overallStatus = $isLate ? 'late' : 'present';

        $attendance = Attendance::updateOrCreate(
            ['user_id' => $user->id, 'date' => $attendanceDate],
            [
                'attendance_type' => 'masuk',
                'check_in_time' => $currentTime,
                'check_in_lat' => $lat,
                'check_in_lng' => $lng,
                'location_id' => $locationId,
                'shift_id' => $userShift?->id,
                'location_name' => $locationName,
                'check_in_distance_meters' => $distance,
                'check_in_status' => $checkInStatus,
                'status' => $overallStatus,
                'notes' => !empty($existing?->notes) ? trim($existing->notes . (!empty($validated['notes']) ? ' | ' . $validated['notes'] : '')) : ($validated['notes'] ?? null),
                'photo_url' => $photoPath,
                'check_out_time' => null,
                'check_out_lat' => null,
                'check_out_lng' => null,
            ]
        );

        $statusMsg = $isLate
            ? "Terlambat (melewati batas toleransi {$shiftTolerance} menit dari jadwal {$shiftName})"
            : "Tepat Waktu ({$shiftName})";

        $wasHoliday = $existing && ($existing->attendance_type === 'libur' || $existing->status === 'holiday');
        $msg = $wasHoliday
            ? "Absen Masuk berhasil dicatat! Status libur Anda sebelumnya telah diperbarui menjadi Masuk Kerja ({$statusMsg}) di lokasi '{$locationName}'."
            : "Absen masuk berhasil tercatat pada {$currentTime} {$tzData['timezone']} ({$statusMsg}) di lokasi '{$locationName}'. Jarak: {$distance} meter.";

        return response()->json([
            'status' => 'success',
            'message' => $msg,
            'data' => $attendance,
            'timezone' => $tzData['timezone'],
            'timezone_label' => $tzData['timezone_label'],
        ]);
    }

    /**
     * Proses Absen Pulang (Check-out).
     */
    public function checkOut(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'notes' => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $clientTz = $request->header('X-Timezone') ?: $request->input('timezone');
        $lat = $request->input('latitude') ? (float) $request->input('latitude') : null;
        $lng = $request->input('longitude') ? (float) $request->input('longitude') : null;
        $tzData = TimezoneService::getNowForUser($user, $lat, $lng, $clientTz);

        $now = $tzData['carbon'];
        $today = $tzData['today'];
        $currentTime = $tzData['time'];
        $targetCompany = $user->company ?: 'rbs';

        // Cek absensi aktif (mendukung shift malam lintas hari)
        $attendance = $this->resolveActiveAttendance($user, $today, $now);

        if (!$attendance || !$attendance->check_in_time) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda belum melakukan absen masuk hari ini.',
            ], 422);
        }

        if ($attendance->attendance_type === 'libur' || $attendance->status === 'holiday') {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda berstatus libur hari ini, tidak perlu melakukan absen pulang.',
            ], 422);
        }

        if ($attendance->check_out_time) {
            return response()->json([
                'status' => 'error',
                'message' => "Anda sudah melakukan absen pulang hari ini pada pukul {$attendance->check_out_time}.",
            ], 422);
        }

        // POINT 8: Absensi pulang di-los (Bebas radius geofence, yang terpenting durasi 8 jam kerja)
        $distance = null;
        $lat = isset($validated['latitude']) ? (float)$validated['latitude'] : null;
        $lng = isset($validated['longitude']) ? (float)$validated['longitude'] : null;

        // Sanitasi: jika koordinat 0,0 atau hampir 0 (Null Island / GPS belum terdeteksi), set null
        if ($lat !== null && $lng !== null) {
            if (abs($lat) < 0.0001 && abs($lng) < 0.0001) {
                $lat = null;
                $lng = null;
            }
        }

        if ($lat !== null && $lng !== null && $attendance->attendance_type !== 'dinas_luar') {
            if ($attendance->location_id) {
                $loc = \App\Models\AttendanceLocation::find($attendance->location_id);
                if ($loc && $loc->latitude && $loc->longitude) {
                    $distance = \App\Models\AttendanceLocation::calculateDistanceInMeters(
                        $lat,
                        $lng,
                        (float)$loc->latitude,
                        (float)$loc->longitude
                    );
                }
            }

            if ($distance === null) {
                $setting = \App\Models\AttendanceSetting::getActiveSetting($targetCompany);
                if ($setting && $setting->latitude && $setting->longitude) {
                    $distance = \App\Models\AttendanceSetting::calculateDistanceInMeters(
                        $lat,
                        $lng,
                        (float)$setting->latitude,
                        (float)$setting->longitude
                    );
                }
            }
        }

        // Failsafe sanitasi jarak: jangan simpan jarak anomali > 999.999 m (~1000 km)
        if ($distance !== null) {
            if ($distance > 999999) {
                $distance = null;
            } else {
                $distance = round($distance, 2);
            }
        }

        $notesUpdate = $attendance->notes;
        if (!empty($validated['notes'])) {
            $notesUpdate = $attendance->notes ? $attendance->notes . ' | ' . $validated['notes'] : $validated['notes'];
        }

        $attendance->update([
            'check_out_time' => $currentTime,
            'check_out_lat' => $lat,
            'check_out_lng' => $lng,
            'check_out_distance_meters' => $distance,
            'notes' => $notesUpdate,
        ]);

        $fresh = $attendance->fresh(['shift', 'location', 'user']);

        $shift = $fresh->shift ?: ($user->shift ?: null);
        $targetHours = ($shift && $shift->work_hours > 0) ? (float) $shift->work_hours : 8.0;
        $targetMinutes = (int) round($targetHours * 60);

        $durationMinutes = $fresh->work_duration_minutes ?? 0;
        $hours = intdiv($durationMinutes, 60);
        $mins = $durationMinutes % 60;
        $durationFormatted = "{$hours} jam {$mins} menit";
        $isTargetMet = $fresh->is_eight_hours_met ?? false;

        $durationText = $durationFormatted ? " Durasi kerja: {$durationFormatted}." : "";
        $targetText = $isTargetMet ? " (✓ Target {$targetHours} Jam Kerja Shift Terpenuhi)" : " (Kurang dari Target {$targetHours} Jam Kerja Shift)";

        return response()->json([
            'status' => 'success',
            'message' => "Absen pulang berhasil tercatat pada {$currentTime} {$tzData['timezone']}.{$durationText}{$targetText} Selamat beristirahat!",
            'data' => $fresh,
            'timezone' => $tzData['timezone'],
            'timezone_label' => $tzData['timezone_label'],
            'work_duration' => [
                'minutes' => $durationMinutes,
                'formatted' => $durationFormatted,
                'is_eight_hours_met' => $isTargetMet,
                'is_target_met' => $isTargetMet,
                'target_hours' => $targetHours,
                'target_minutes' => $targetMinutes,
            ],
        ]);
    }

    /**
     * Riwayat absensi karyawan pribadi.
     */
    public function history(Request $request): JsonResponse
    {
        $user = $request->user();
        $month = $request->query('month', Carbon::now()->format('Y-m'));

        $query = Attendance::with(['location', 'approver', 'shift'])
            ->where('user_id', $user->id)
            ->where('date', 'like', "{$month}%")
            ->orderBy('date', 'desc');

        $attendances = $query->paginate(31);

        return response()->json([
            'status' => 'success',
            'data' => $attendances,
        ]);
    }

    /**
     * Helper untuk memproses, mengompres, dan menyimpan file / base64 foto bukti kehadiran.
     * Menggunakan native GD untuk resize max 640px dan kualitas 70% (~40-70 KB per foto).
     */
    protected function storeAttendancePhoto(Request $request, int $userId): ?string
    {
        $filename = 'attendance_' . $userId . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.jpg';
        $targetRelativePath = 'attendance_photos/' . $filename;

        // 1. Dukungan file upload multipart (photo)
        if ($request->hasFile('photo')) {
            $file = $request->file('photo');
            if ($file->isValid()) {
                $saved = $this->compressAndSaveImage($file->getRealPath(), $targetRelativePath);
                if ($saved) {
                    return $targetRelativePath;
                }
                $ext = $file->getClientOriginalExtension() ?: 'jpg';
                return $file->storeAs('attendance_photos', $filename, 'public');
            }
        }

        // 2. Dukungan string base64 (dari kamera canvas / webcam)
        $photoData = $request->input('photo');
        if (is_string($photoData) && !empty($photoData)) {
            if (preg_match('/^data:image\/\w+;base64,/', $photoData)) {
                $photoData = substr($photoData, strpos($photoData, ',') + 1);
            }

            $decoded = base64_decode($photoData, true);
            if ($decoded !== false && strlen($decoded) > 50) {
                $saved = $this->compressAndSaveImage($decoded, $targetRelativePath);
                if ($saved) {
                    return $targetRelativePath;
                }
                Storage::disk('public')->put($targetRelativePath, $decoded);
                return $targetRelativePath;
            }
        }

        return null;
    }

    /**
     * Kompres dan resize gambar (Native GD) untuk menghemat storage VPS.
     * Mengurangi resolusi ke max 640px dan kompresi JPEG 70% (~40-70 KB per file).
     */
    protected function compressAndSaveImage(string $sourceDataOrPath, string $targetRelativePath): bool
    {
        if (!extension_loaded('gd')) {
            return false;
        }

        $image = null;
        if (file_exists($sourceDataOrPath)) {
            $imageInfo = @getimagesize($sourceDataOrPath);
            $mime = $imageInfo['mime'] ?? '';
            $image = match ($mime) {
                'image/jpeg', 'image/jpg' => @imagecreatefromjpeg($sourceDataOrPath),
                'image/png' => @imagecreatefrompng($sourceDataOrPath),
                'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($sourceDataOrPath) : null,
                default => @imagecreatefromstring((string) file_get_contents($sourceDataOrPath)),
            };
        } else {
            $image = @imagecreatefromstring($sourceDataOrPath);
        }

        if (!$image) {
            return false;
        }

        $origWidth = imagesx($image);
        $origHeight = imagesy($image);
        $maxDimension = 640;

        if ($origWidth > $maxDimension || $origHeight > $maxDimension) {
            if ($origWidth >= $origHeight) {
                $newWidth = $maxDimension;
                $newHeight = (int) round(($origHeight / $origWidth) * $maxDimension);
            } else {
                $newHeight = $maxDimension;
                $newWidth = (int) round(($origWidth / $origHeight) * $maxDimension);
            }
            $resized = imagescale($image, $newWidth, $newHeight, IMG_BILINEAR_FIXED);
            if ($resized !== false) {
                imagedestroy($image);
                $image = $resized;
            }
        }

        ob_start();
        imagejpeg($image, null, 70);
        $compressedData = ob_get_clean();
        imagedestroy($image);

        if (!empty($compressedData)) {
            Storage::disk('public')->put($targetRelativePath, $compressedData);
            return true;
        }

        return false;
    }

    /**
     * Resolves the locked attendance location for the user.
     * Sesuai arahan Bang Maun: Karyawan tidak perlu memilih lokasi karena sudah terdaftar dan
     * terkunci otomatis sesuai data penugasan (unit sekolah / kantor pusat).
     */
    protected function resolveUserAssignedLocation($user, string $targetCompany, $setting, $hqLocation): \App\Models\AttendanceLocation
    {
        // 1. Admin wajib terkunci di Kantor Pusat
        if ($user->role === 'admin' || $user->role === 'super_admin') {
            return $hqLocation;
        }

        // 2. Jika user sudah memiliki attendance_location_id yang valid & aktif
        if (!empty($user->attendance_location_id)) {
            $loc = \App\Models\AttendanceLocation::where('id', $user->attendance_location_id)
                ->where('is_active', true)
                ->first();
            if ($loc) {
                return $loc;
            }
        }

        // 3. Jika user memiliki school_unit, cocokkan ke master lokasi atau otomatis buat titik lokasinya
        if (!empty($user->school_unit)) {
            $cleanUserSchool = trim($user->school_unit);
            $cleanLower = strtolower($cleanUserSchool);

            $allLocations = \App\Models\AttendanceLocation::where('is_active', true)
                ->where(function ($q) use ($targetCompany) {
                    $q->where('tenant_id', $targetCompany)->orWhere('tenant_id', 'all');
                })
                ->get();

            // 1. Prioritaskan exact match (nama atau kode unit sama persis)
            $loc = $allLocations->first(function ($l) use ($cleanLower) {
                $name = strtolower(trim($l->name));
                $code = strtolower(trim($l->code ?? ''));
                return $name === $cleanLower || ($code !== '' && $code === $cleanLower);
            });

            // 2. Jika belum cocok, cari kecocokan sebagian dengan memprioritaskan nama lokasi terpanjang (terspesifik)
            if (!$loc) {
                $loc = $allLocations->sortByDesc(fn ($l) => strlen(trim($l->name)))
                    ->first(function ($l) use ($cleanLower) {
                        $name = strtolower(trim($l->name));
                        $code = strtolower(trim($l->code ?? ''));
                        return ($code !== '' && str_contains($cleanLower, $code))
                            || ($name !== '' && (str_contains($cleanLower, $name) || str_contains($name, $cleanLower)));
                    });
            }

            if (!$loc) {
                $loc = \App\Models\AttendanceLocation::create([
                    'tenant_id' => $targetCompany,
                    'name' => $cleanUserSchool,
                    'code' => null,
                    'address' => 'Unit Penugasan ' . $cleanUserSchool,
                    'latitude' => $setting->latitude ?: -6.2088,
                    'longitude' => $setting->longitude ?: 106.8456,
                    'radius_meters' => $setting->radius_meters ?: 100,
                    'type' => 'school',
                    'is_active' => true,
                ]);
            }

            // Tautkan user ke lokasi ini
            $user->update(['attendance_location_id' => $loc->id]);
            return $loc;
        }

        // 4. Staf umum/kantor yang belum memiliki unit sekolah otomatis ditautkan ke Kantor Pusat
        if ($hqLocation) {
            $user->update(['attendance_location_id' => $hqLocation->id]);
            return $hqLocation;
        }

        return $hqLocation;
    }

    /**
     * Resolusi absensi aktif untuk karyawan.
     * Mendukung shift malam lintas hari (cross-day shift / overnight, misal 23:00 - 07:00),
     * di mana karyawan check-in di malam hari (kemarin) dan check-out di pagi hari (hari ini).
     */
    protected function resolveActiveAttendance($user, string $today, Carbon $now): ?Attendance
    {
        // 1. Ambil absensi hari ini ($today) jika sudah ada
        $todayAttendance = Attendance::with(['location', 'approver', 'shift'])
            ->where('user_id', $user->id)
            ->where('date', $today)
            ->first();

        // 2. Ambil absensi kemarin ($yesterday)
        $yesterday = Carbon::parse($today)->subDay()->toDateString();
        $yesterdayAttendance = Attendance::with(['location', 'approver', 'shift'])
            ->where('user_id', $user->id)
            ->where('date', $yesterday)
            ->first();

        $hasYesterdayCheckIn = $yesterdayAttendance &&
            $yesterdayAttendance->check_in_time &&
            !in_array($yesterdayAttendance->attendance_type, ['libur', 'sakit', 'izin']) &&
            $yesterdayAttendance->status !== 'holiday';

        if ($hasYesterdayCheckIn) {
            $shift = $yesterdayAttendance->shift ?: $user->shift;
            $isCrossDayShift = $shift && ($shift->cross_day || $shift->start_time > $shift->end_time);
            $shiftWorkHours = ($shift && $shift->work_hours > 0) ? (float) $shift->work_hours : 8.0;
            $checkInTimeStr = $yesterdayAttendance->check_in_time;
            $isNightCheckIn = $checkInTimeStr >= '17:00:00';

            // KASUS A: Catatan kemarin BELUM checkout (masih terbuka / menunggu absen pulang)
            if (empty($yesterdayAttendance->check_out_time)) {
                $checkInDateTime = $yesterdayAttendance->created_at
                    ? $yesterdayAttendance->created_at->copy()
                    : Carbon::parse($yesterday . ' ' . $checkInTimeStr);

                // Jika shift lintas hari dan check_in_time terjadi setelah tengah malam (misal masuk jam 00:30)
                if ($isCrossDayShift && $checkInTimeStr < '12:00:00' && $checkInDateTime->toDateString() === $yesterday) {
                    $checkInDateTime->addDay();
                }

                $hoursSinceCheckIn = abs($now->diffInHours($checkInDateTime));

                // Sesi kemarin valid sebagai sesi aktif jika:
                // 1) Merupakan shift lintas hari atau check-in malam kemarin (>= 17:00), DAN
                // 2) Masih berada dalam batas jam aktif kerja shift.
                $maxHours = max(18.0, $shiftWorkHours + 6.0);

                if ($shiftWorkHours >= 20.0) {
                    // Shift 24 jam: berlaku sampai toleransi batas waktu shift (misal 30 jam sejak check-in)
                    $isWithinActiveWindow = ($hoursSinceCheckIn <= $maxHours);
                } else {
                    $isWithinActiveWindow = ($isCrossDayShift || $isNightCheckIn)
                        && $hoursSinceCheckIn <= $maxHours
                        && $now->format('H:i:s') < '16:00:00';
                }

                if ($isWithinActiveWindow) {
                    // Jika hari ini belum ada check-in baru, utamakan sesi shift kemarin yang belum selesai!
                    if (!$todayAttendance || empty($todayAttendance->check_in_time)) {
                        return $yesterdayAttendance;
                    }
                }
            }
        }

        return $todayAttendance;
    }

    /**
     * Karyawan memilih shift kerja aktif (misal dari 5 pilihan shift sekolah).
     */
    public function selectShift(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'shift_id' => 'required|integer|exists:shifts,id',
        ]);

        $user = $request->user();
        $availableShifts = Shift::getAvailableForUser($user);
        $shift = $availableShifts->firstWhere('id', $validated['shift_id']);

        if (!$shift) {
            return response()->json([
                'status' => 'error',
                'message' => 'Shift kerja yang dipilih tidak tersedia atau tidak berlaku untuk entitas perusahaan Anda.',
            ], 403);
        }

        $user->update(['shift_id' => $shift->id]);

        // Sinkronkan juga pada sesi absensi aktif yang sedang berjalan jika belum check-out
        try {
            $clientTz = $request->header('X-Timezone') ?: $request->input('timezone');
            $tzData = TimezoneService::getNowForUser($user, null, null, $clientTz);
            $activeAttendance = $this->resolveActiveAttendance($user, $tzData['today'], $tzData['carbon']);
            if ($activeAttendance && empty($activeAttendance->check_out_time)) {
                $activeAttendance->update(['shift_id' => $shift->id]);
            }
        } catch (\Throwable) {
        }

        return response()->json([
            'status' => 'success',
            'message' => "Shift kerja berhasil diatur menjadi '{$shift->name}' ({$shift->formatted_time}).",
            'data' => $shift,
        ]);
    }

    /**
     * Batalkan status Absen Libur hari ini agar karyawan dapat melakukan Absen Masuk.
     */
    public function cancelHoliday(Request $request): JsonResponse
    {
        $user = $request->user();
        $clientTz = $request->header('X-Timezone') ?: $request->input('timezone');
        $lat = $request->input('latitude') ? (float) $request->input('latitude') : null;
        $lng = $request->input('longitude') ? (float) $request->input('longitude') : null;
        $tzData = TimezoneService::getNowForUser($user, $lat, $lng, $clientTz);
        $today = $tzData['today'];

        $attendance = Attendance::where('user_id', $user->id)
            ->where('date', $today)
            ->where(function ($q) {
                $q->where('attendance_type', 'libur')
                  ->orWhere('status', 'holiday');
            })
            ->first();

        if (!$attendance) {
            return response()->json([
                'status' => 'error',
                'message' => 'Tidak ditemukan catatan absen libur hari ini yang dapat dibatalkan.',
            ], 404);
        }

        // Hapus catatan libur hari ini agar karyawan dapat melakukan absensi masuk
        $attendance->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Status Absen Libur hari ini berhasil dibatalkan. Anda sekarang dapat melakukan Absen Masuk kerja.',
        ]);
    }
}

