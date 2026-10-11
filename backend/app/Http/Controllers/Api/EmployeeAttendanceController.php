<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\AttendanceSetting;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeAttendanceController extends Controller
{
    /**
     * Ambil status absensi hari ini beserta setting kantor & radius.
     */
    public function today(Request $request): JsonResponse
    {
        $user = $request->user();
        $today = Carbon::today('Asia/Jakarta')->toDateString();
        $setting = AttendanceSetting::getActiveSetting($user->company ?: 'rbs');

        $attendance = Attendance::where('user_id', $user->id)
            ->where('date', $today)
            ->first();

        return response()->json([
            'status' => 'success',
            'data' => [
                'today' => $today,
                'server_time' => Carbon::now('Asia/Jakarta')->format('H:i:s'),
                'attendance' => $attendance,
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
     * Proses Absen Masuk (Check-in) dengan Validasi Radius Geofencing.
     * Tanpa verifikasi foto muka agar hemat storage server.
     */
    public function checkIn(Request $request): JsonResponse
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

        // Cek apakah sudah check-in hari ini
        $existing = Attendance::where('user_id', $user->id)
            ->where('date', $today)
            ->first();

        if ($existing && $existing->check_in_time) {
            return response()->json([
                'status' => 'error',
                'message' => "Anda sudah melakukan absen masuk hari ini pada pukul {$existing->check_in_time}.",
            ], 422);
        }

        // Ambil konfigurasi lokasi kantor
        $setting = AttendanceSetting::getActiveSetting($user->company ?: 'rbs');

        // Hitung jarak real-time dari posisi pengguna ke kantor
        $distance = AttendanceSetting::calculateDistanceInMeters(
            (float) $validated['latitude'],
            (float) $validated['longitude'],
            $setting->latitude,
            $setting->longitude
        );

        // Validasi Radius Geofencing
        if ($distance > $setting->radius_meters) {
            return response()->json([
                'status' => 'error',
                'message' => "Gagal Absen: Anda berada di luar radius kantor! Jarak Anda saat ini: {$distance} meter (Batas radius kantor: {$setting->radius_meters} meter). Silakan mendekat ke lokasi kantor.",
                'distance_meters' => $distance,
                'max_radius_meters' => $setting->radius_meters,
            ], 422);
        }

        // Tentukan status keterlambatan
        $workStart = Carbon::createFromTimeString($setting->work_start_time);
        $lateThreshold = (clone $workStart)->addMinutes($setting->late_tolerance_minutes);
        
        $currentCheckInTime = Carbon::createFromTimeString($currentTime);
        $isLate = $currentCheckInTime->greaterThan($lateThreshold);
        $checkInStatus = $isLate ? 'late' : 'on_time';
        $overallStatus = $isLate ? 'late' : 'present';

        $attendance = Attendance::updateOrCreate(
            ['user_id' => $user->id, 'date' => $today],
            [
                'check_in_time' => $currentTime,
                'check_in_lat' => $validated['latitude'],
                'check_in_lng' => $validated['longitude'],
                'check_in_distance_meters' => $distance,
                'check_in_status' => $checkInStatus,
                'status' => $overallStatus,
                'notes' => $validated['notes'] ?? null,
            ]
        );

        $statusMsg = $isLate ? "Terlambat (melewati toleransi {$setting->late_tolerance_minutes} menit)" : "Tepat Waktu";

        return response()->json([
            'status' => 'success',
            'message' => "Absen masuk berhasil tercatat pada {$currentTime} ({$statusMsg}). Jarak ke kantor: {$distance} meter.",
            'data' => $attendance,
        ]);
    }

    /**
     * Proses Absen Pulang (Check-out) dengan Validasi Radius Geofencing.
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

        if ($attendance->check_out_time) {
            return response()->json([
                'status' => 'error',
                'message' => "Anda sudah melakukan absen pulang hari ini pada pukul {$attendance->check_out_time}.",
            ], 422);
        }

        // Ambil konfigurasi lokasi kantor
        $setting = AttendanceSetting::getActiveSetting($user->company ?: 'rbs');

        // Hitung jarak real-time dari posisi pengguna ke kantor
        $distance = AttendanceSetting::calculateDistanceInMeters(
            (float) $validated['latitude'],
            (float) $validated['longitude'],
            $setting->latitude,
            $setting->longitude
        );

        // Validasi Radius Geofencing
        if ($distance > $setting->radius_meters) {
            return response()->json([
                'status' => 'error',
                'message' => "Gagal Absen Pulang: Anda berada di luar radius kantor! Jarak Anda saat ini: {$distance} meter (Batas radius kantor: {$setting->radius_meters} meter). Silakan mendekat ke lokasi kantor.",
                'distance_meters' => $distance,
                'max_radius_meters' => $setting->radius_meters,
            ], 422);
        }

        $attendance->update([
            'check_out_time' => $currentTime,
            'check_out_lat' => $validated['latitude'],
            'check_out_lng' => $validated['longitude'],
            'check_out_distance_meters' => $distance,
            'notes' => $validated['notes'] ? ($attendance->notes ? $attendance->notes . ' | ' . $validated['notes'] : $validated['notes']) : $attendance->notes,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => "Absen pulang berhasil tercatat pada {$currentTime}. Jarak ke kantor: {$distance} meter. Selamat beristirahat!",
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

        $query = Attendance::where('user_id', $user->id)
            ->where('date', 'like', "{$month}%")
            ->orderBy('date', 'desc');

        $attendances = $query->paginate(31);

        return response()->json([
            'status' => 'success',
            'data' => $attendances,
        ]);
    }
}
