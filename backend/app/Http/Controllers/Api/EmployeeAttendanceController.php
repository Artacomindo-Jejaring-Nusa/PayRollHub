<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\AttendanceSetting;
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
        $today = Carbon::today('Asia/Jakarta')->toDateString();
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

        $attendance = Attendance::with('location')->where('user_id', $user->id)
            ->where('date', $today)
            ->first();

        // POINT 10 & Note Bang Maun: Karyawan tidak perlu memilih lokasi karena sudah terdaftar dan terkunci
        // sesuai penugasannya (Admin wajib di Kantor Pusat, Karyawan di unit sekolah / kantor).
        $isAdmin = $user->role === 'admin';
        $assignedLocation = $this->resolveUserAssignedLocation($user, $targetCompany, $setting, $hqLocation);
        $isLocationLocked = true;

        // Point Bang Maun: Default shift untuk karyawan sekolah / Riama
        $defaultShift = null;
        if (!empty($user->school_unit) || $targetCompany === 'rimamandiri') {
            $defaultShift = \App\Models\Shift::where('code', 'SHIFT_1_3_SHIFT')->first();
        }
        if (!$defaultShift) {
            $defaultShift = \App\Models\Shift::where('code', 'REGULER')->first();
        }

        $assignedShift = $user->shift ?: $defaultShift;

        return response()->json([
            'status' => 'success',
            'data' => [
                'today' => $today,
                'server_time' => Carbon::now('Asia/Jakarta')->format('H:i:s'),
                'attendance' => $attendance,
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
        $now = Carbon::now('Asia/Jakarta');
        $today = $now->toDateString();
        $currentTime = $now->format('H:i:s');
        $targetCompany = $user->company ?: 'rbs';

        // Cek apakah sudah check-in hari ini
        $existing = Attendance::where('user_id', $user->id)
            ->where('date', $today)
            ->first();

        if ($existing && $existing->check_in_time) {
            $jenis = $existing->attendance_type === 'libur' ? 'absen libur' : 'absen masuk';
            return response()->json([
                'status' => 'error',
                'message' => "Anda sudah melakukan {$jenis} hari ini pada pukul {$existing->check_in_time}.",
            ], 422);
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
                    'notes' => $notes,
                ]
            );

            return response()->json([
                'status' => 'success',
                'message' => "Absen Libur berhasil tercatat pada {$currentTime}. Anda tidak perlu absen pulang. Selamat beristirahat!",
                'data' => $attendance,
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
                ['user_id' => $user->id, 'date' => $today],
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
                    'notes' => $notes,
                    'photo_url' => $photoPath,
                ]
            );

            return response()->json([
                'status' => 'success',
                'message' => "Absen Perjalanan Dinas berhasil tercatat pada {$currentTime}. Selamat bertugas!",
                'data' => $attendance,
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
            $chosenShift = \App\Models\Shift::where('is_active', true)->find($validated['shift_id']);
            if ($chosenShift) {
                $user->update(['shift_id' => $chosenShift->id]);
                $userShift = $chosenShift;
            }
        }
        if (!$userShift) {
            $userShift = $user->shift;
            if (!$userShift) {
                if (!empty($user->school_unit) || $targetCompany === 'rimamandiri') {
                    $userShift = \App\Models\Shift::where('code', 'SHIFT_1_3_SHIFT')->first();
                }
                $userShift = $userShift ?: \App\Models\Shift::where('code', 'REGULER')->first();
            }
        }

        $shiftStartTime = $userShift ? $userShift->start_time : $setting->work_start_time;
        $shiftTolerance = $userShift ? (int) $userShift->late_tolerance_minutes : (int) $setting->late_tolerance_minutes;
        $shiftName = $userShift ? $userShift->name : 'Reguler';

        $workStart = Carbon::createFromTimeString($shiftStartTime);
        $lateThreshold = (clone $workStart)->addMinutes($shiftTolerance);

        $currentCheckInTime = Carbon::createFromTimeString($currentTime);
        $isLate = $currentCheckInTime->greaterThan($lateThreshold);
        $checkInStatus = $isLate ? 'late' : 'on_time';
        $overallStatus = $isLate ? 'late' : 'present';

        $attendance = Attendance::updateOrCreate(
            ['user_id' => $user->id, 'date' => $today],
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
                'notes' => $validated['notes'] ?? null,
                'photo_url' => $photoPath,
            ]
        );

        $statusMsg = $isLate
            ? "Terlambat (melewati batas toleransi {$shiftTolerance} menit dari jadwal {$shiftName})"
            : "Tepat Waktu ({$shiftName})";

        return response()->json([
            'status' => 'success',
            'message' => "Absen masuk berhasil tercatat pada {$currentTime} ({$statusMsg}) di lokasi '{$locationName}'. Jarak: {$distance} meter.",
            'data' => $attendance,
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
        $now = Carbon::now('Asia/Jakarta');
        $today = $now->toDateString();
        $currentTime = $now->format('H:i:s');
        $targetCompany = $user->company ?: 'rbs';

        // Cek absensi hari ini
        $attendance = Attendance::where('user_id', $user->id)
            ->where('date', $today)
            ->first();

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
        $lat = $validated['latitude'] ?? null;
        $lng = $validated['longitude'] ?? null;

        if ($lat !== null && $lng !== null && $attendance->attendance_type !== 'dinas_luar') {
            if ($attendance->location_id) {
                $loc = \App\Models\AttendanceLocation::find($attendance->location_id);
                if ($loc) {
                    $distance = \App\Models\AttendanceLocation::calculateDistanceInMeters(
                        (float) $lat,
                        (float) $lng,
                        $loc->latitude,
                        $loc->longitude
                    );
                }
            }

            if ($distance === null) {
                $setting = \App\Models\AttendanceSetting::getActiveSetting($targetCompany);
                $distance = \App\Models\AttendanceSetting::calculateDistanceInMeters(
                    (float) $lat,
                    (float) $lng,
                    $setting->latitude,
                    $setting->longitude
                );
            }
        }

        // Hitung durasi jam kerja dari jam masuk ke jam pulang
        $durationFormatted = null;
        $isEightHours = false;
        $durationMinutes = 0;

        if ($attendance->check_in_time) {
            try {
                $checkIn = Carbon::createFromTimeString($attendance->check_in_time);
                $checkOut = Carbon::createFromTimeString($currentTime);
                if ($checkOut->lessThan($checkIn)) {
                    $checkOut->addDay();
                }
                $durationMinutes = (int) $checkIn->diffInMinutes($checkOut);
                $hours = intdiv($durationMinutes, 60);
                $mins = $durationMinutes % 60;
                $durationFormatted = "{$hours} jam {$mins} menit";
                $isEightHours = $durationMinutes >= 480;
            } catch (\Throwable) {
            }
        }

        $attendance->update([
            'check_out_time' => $currentTime,
            'check_out_lat' => $lat,
            'check_out_lng' => $lng,
            'check_out_distance_meters' => $distance,
            'notes' => $validated['notes'] ? ($attendance->notes ? $attendance->notes . ' | ' . $validated['notes'] : $validated['notes']) : $attendance->notes,
        ]);

        $fresh = $attendance->fresh();
        $durationText = $durationFormatted ? " Durasi kerja: {$durationFormatted}." : "";
        $eightHoursText = $isEightHours ? " (✓ 8 Jam Kerja Terpenuhi)" : " (Kurang dari 8 Jam Kerja)";

        return response()->json([
            'status' => 'success',
            'message' => "Absen pulang berhasil tercatat pada {$currentTime}.{$durationText}{$eightHoursText} Selamat beristirahat!",
            'data' => $fresh,
            'work_duration' => [
                'minutes' => $durationMinutes,
                'formatted' => $durationFormatted,
                'is_eight_hours_met' => $isEightHours,
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

        $query = Attendance::with('location')
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

            $loc = \App\Models\AttendanceLocation::where('is_active', true)
                ->where(function ($q) use ($targetCompany) {
                    $q->where('tenant_id', $targetCompany)->orWhere('tenant_id', 'all');
                })
                ->get()
                ->first(function ($l) use ($cleanLower) {
                    $name = strtolower(trim($l->name));
                    $code = strtolower(trim($l->code ?? ''));
                    return $name === $cleanLower
                        || $code === $cleanLower
                        || ($code !== '' && str_contains($cleanLower, $code))
                        || ($name !== '' && (str_contains($cleanLower, $name) || str_contains($name, $cleanLower)));
                });

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
     * Karyawan memilih shift kerja aktif (misal dari 5 pilihan shift sekolah).
     */
    public function selectShift(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'shift_id' => 'required|integer|exists:shifts,id',
        ]);

        $user = $request->user();
        $shift = Shift::where('is_active', true)->findOrFail($validated['shift_id']);

        $user->update(['shift_id' => $shift->id]);

        return response()->json([
            'status' => 'success',
            'message' => "Shift kerja berhasil diatur menjadi '{$shift->name}' ({$shift->formatted_time}).",
            'data' => $shift,
        ]);
    }
}

