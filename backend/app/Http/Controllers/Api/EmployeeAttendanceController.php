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

        // Ambil daftar 100+ lokasi aktif untuk perusahaan ini
        $locations = \App\Models\AttendanceLocation::forTenant($targetCompany)
            ->where('is_active', true)
            ->orderBy('name', 'asc')
            ->get();

        $attendance = Attendance::with('location')->where('user_id', $user->id)
            ->where('date', $today)
            ->first();

        // Cari lokasi penugasan jika user memiliki attendance_location_id atau unit sekolah
        $assignedLocation = null;
        if (!empty($user->attendance_location_id)) {
            $assignedLocation = $locations->firstWhere('id', $user->attendance_location_id);
        }

        if (!$assignedLocation && !empty($user->school_unit)) {
            $cleanUserSchool = strtolower(trim($user->school_unit));
            $assignedLocation = $locations->first(function ($loc) use ($cleanUserSchool) {
                $locName = strtolower(trim($loc->name));
                $locCode = strtolower(trim($loc->code ?? ''));
                return $locCode === $cleanUserSchool
                    || $locName === $cleanUserSchool
                    || ($locCode !== '' && str_contains($cleanUserSchool, $locCode))
                    || ($locName !== '' && (str_contains($cleanUserSchool, $locName) || str_contains($locName, $cleanUserSchool)));
            });

            // Tautkan otomatis ke attendance_location_id jika cocok
            if ($assignedLocation && empty($user->attendance_location_id)) {
                $user->update(['attendance_location_id' => $assignedLocation->id]);
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'today' => $today,
                'server_time' => Carbon::now('Asia/Jakarta')->format('H:i:s'),
                'attendance' => $attendance,
                'assigned_location' => $assignedLocation,
                'is_location_locked' => $assignedLocation !== null,
                'total_locations' => $locations->count(),
                'locations' => $locations,
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

        // Prioritaskan lokasi penugasan karyawan jika ada (baik via attendance_location_id atau unit sekolah)
        $assignedLocation = null;
        if (!empty($user->attendance_location_id)) {
            $assignedLocation = \App\Models\AttendanceLocation::where('id', $user->attendance_location_id)
                ->where('is_active', true)
                ->first();
        }

        if (!$assignedLocation && !empty($user->school_unit)) {
            $cleanUserSchool = strtolower(trim($user->school_unit));
            $assignedLocation = \App\Models\AttendanceLocation::forTenant($targetCompany)
                ->where('is_active', true)
                ->get()
                ->first(function ($loc) use ($cleanUserSchool) {
                    $locName = strtolower(trim($loc->name));
                    $locCode = strtolower(trim($loc->code ?? ''));
                    return $locCode === $cleanUserSchool
                        || $locName === $cleanUserSchool
                        || ($locCode !== '' && str_contains($cleanUserSchool, $locCode))
                        || ($locName !== '' && (str_contains($cleanUserSchool, $locName) || str_contains($locName, $cleanUserSchool)));
                });
            if ($assignedLocation && empty($user->attendance_location_id)) {
                $user->update(['attendance_location_id' => $assignedLocation->id]);
            }
        }

        // Cari lokasi tujuan:
        $matchedLocation = null;
        $distance = null;
        $isWithinRadius = false;

        if ($assignedLocation) {
            $matchedLocation = $assignedLocation;
            $distance = \App\Models\AttendanceLocation::calculateDistanceInMeters($lat, $lng, $matchedLocation->latitude, $matchedLocation->longitude);
            $isWithinRadius = $distance <= $matchedLocation->radius_meters;
        } elseif (!empty($validated['location_id'])) {
            $matchedLocation = \App\Models\AttendanceLocation::where('id', $validated['location_id'])
                ->where('is_active', true)
                ->first();
            if ($matchedLocation) {
                $distance = \App\Models\AttendanceLocation::calculateDistanceInMeters($lat, $lng, $matchedLocation->latitude, $matchedLocation->longitude);
                $isWithinRadius = $distance <= $matchedLocation->radius_meters;
            }
        }

        if (!$matchedLocation) {
            // Cari lokasi terdekat dari 100+ lokasi aktif (prioritaskan unit sekolah user jika ada)
            $nearestResult = \App\Models\AttendanceLocation::findNearest($lat, $lng, $targetCompany, $user->school_unit);
            $matchedLocation = $nearestResult['location'];
            $distance = $nearestResult['distance_meters'];
            $isWithinRadius = $nearestResult['is_within_radius'];
        }

        // Fallback jika belum ada data di attendance_locations
        if (!$matchedLocation) {
            $setting = \App\Models\AttendanceSetting::getActiveSetting($targetCompany);
            $distance = \App\Models\AttendanceSetting::calculateDistanceInMeters(
                $lat, $lng,
                $setting->latitude, $setting->longitude
            );
            $isWithinRadius = $distance <= $setting->radius_meters;
            $locationName = $setting->office_name;
            $radiusLimit = $setting->radius_meters;
            $locationId = null;
        } else {
            $locationName = $matchedLocation->name;
            $radiusLimit = $matchedLocation->radius_meters;
            $locationId = $matchedLocation->id;
        }

        // Validasi Radius Geofencing
        if (!$isWithinRadius) {
            return response()->json([
                'status' => 'error',
                'message' => "Gagal Absen: Anda berada di luar radius lokasi terdekat ({$locationName})! Jarak Anda saat ini: {$distance} meter (Batas radius lokasi: {$radiusLimit} meter). Silakan mendekat ke lokasi kerja.",
                'distance_meters' => $distance,
                'max_radius_meters' => $radiusLimit,
                'nearest_location' => $locationName,
            ], 422);
        }

        // Tentukan status keterlambatan
        $setting = \App\Models\AttendanceSetting::getActiveSetting($targetCompany);
        $workStart = Carbon::createFromTimeString($setting->work_start_time);
        $lateThreshold = (clone $workStart)->addMinutes($setting->late_tolerance_minutes);

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
                'location_name' => $locationName,
                'check_in_distance_meters' => $distance,
                'check_in_status' => $checkInStatus,
                'status' => $overallStatus,
                'notes' => $validated['notes'] ?? null,
                'photo_url' => $photoPath,
            ]
        );

        $statusMsg = $isLate ? "Terlambat (melewati toleransi {$setting->late_tolerance_minutes} menit)" : "Tepat Waktu";

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
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
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

        // Hitung jarak saat pulang jika bukan perjalanan dinas
        $isDinasLuar = $attendance->attendance_type === 'dinas_luar';
        $distance = null;

        if (!$isDinasLuar) {
            if ($attendance->location_id) {
                $loc = \App\Models\AttendanceLocation::find($attendance->location_id);
                if ($loc) {
                    $distance = \App\Models\AttendanceLocation::calculateDistanceInMeters(
                        (float) $validated['latitude'],
                        (float) $validated['longitude'],
                        $loc->latitude,
                        $loc->longitude
                    );
                }
            }

            if ($distance === null) {
                $setting = \App\Models\AttendanceSetting::getActiveSetting($targetCompany);
                $distance = \App\Models\AttendanceSetting::calculateDistanceInMeters(
                    (float) $validated['latitude'],
                    (float) $validated['longitude'],
                    $setting->latitude,
                    $setting->longitude
                );
            }
        }

        $attendance->update([
            'check_out_time' => $currentTime,
            'check_out_lat' => $validated['latitude'],
            'check_out_lng' => $validated['longitude'],
            'check_out_distance_meters' => $distance,
            'notes' => $validated['notes'] ? ($attendance->notes ? $attendance->notes . ' | ' . $validated['notes'] : $validated['notes']) : $attendance->notes,
        ]);

        $distanceText = $distance !== null ? " Jarak: {$distance} meter." : "";

        return response()->json([
            'status' => 'success',
            'message' => "Absen pulang berhasil tercatat pada {$currentTime}.{$distanceText} Selamat beristirahat!",
            'data' => $attendance,
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
     * Helper untuk memproses dan menyimpan file / base64 foto bukti kehadiran.
     */
    protected function storeAttendancePhoto(Request $request, int $userId): ?string
    {
        // 1. Dukungan file upload multipart (photo)
        if ($request->hasFile('photo')) {
            $file = $request->file('photo');
            if ($file->isValid()) {
                $ext = $file->getClientOriginalExtension() ?: 'jpg';
                $filename = 'attendance_' . $userId . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
                return $file->storeAs('attendance_photos', $filename, 'public');
            }
        }

        // 2. Dukungan string base64 (dari kamera canvas / webcam)
        $photoData = $request->input('photo');
        if (is_string($photoData) && !empty($photoData)) {
            $imageExtension = 'jpg';
            if (preg_match('/^data:image\/(\w+);base64,/', $photoData, $matches)) {
                $imageExtension = strtolower($matches[1]);
                if ($imageExtension === 'jpeg') {
                    $imageExtension = 'jpg';
                }
                $photoData = substr($photoData, strpos($photoData, ',') + 1);
            }

            $decoded = base64_decode($photoData, true);
            if ($decoded !== false && strlen($decoded) > 50) {
                $filename = 'attendance_' . $userId . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $imageExtension;
                Storage::disk('public')->put('attendance_photos/' . $filename, $decoded);
                return 'attendance_photos/' . $filename;
            }
        }

        return null;
    }
}
