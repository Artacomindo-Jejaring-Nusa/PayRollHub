<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\AttendanceSetting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminAttendanceController extends Controller
{
    /**
     * Daftar seluruh absensi karyawan (dengan filter tanggal, bulan, pencarian, status).
     */
    public function index(Request $request): JsonResponse
    {
        $date = $request->query('date', Carbon::today('Asia/Jakarta')->toDateString());
        $month = $request->query('month');
        $search = $request->query('search');
        $status = $request->query('status');

        $query = Attendance::with(['user' => function ($q) {
            $q->select('id', 'name', 'email', 'nik', 'company', 'phone', 'role');
        }]);

        if ($date && !$month) {
            $query->where('date', $date);
        } elseif ($month) {
            $query->where('date', 'like', "{$month}%");
        }

        if ($status && $status !== 'all') {
            if ($status === 'late') {
                $query->where('check_in_status', 'late');
            } elseif ($status === 'on_time') {
                $query->where('check_in_status', 'on_time');
            } else {
                $query->where('status', $status);
            }
        }

        if ($search) {
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('nik', 'like', "%{$search}%");
            });
        }

        $attendances = $query->orderBy('date', 'desc')
            ->orderBy('check_in_time', 'desc')
            ->paginate($request->query('per_page', 25));

        return response()->json([
            'status' => 'success',
            'data' => $attendances,
        ]);
    }

    /**
     * Ringkasan statistik kehadiran harian.
     */
    public function summary(Request $request): JsonResponse
    {
        $date = $request->query('date', Carbon::today('Asia/Jakarta')->toDateString());
        $totalEmployees = User::where('role', '!=', 'admin')->count();

        $todayAttendances = Attendance::where('date', $date)->get();
        $totalPresent = $todayAttendances->count();
        $totalOnTime = $todayAttendances->where('check_in_status', 'on_time')->count();
        $totalLate = $todayAttendances->where('check_in_status', 'late')->count();
        $totalNotCheckedIn = max(0, $totalEmployees - $totalPresent);

        $avgDistance = $totalPresent > 0
            ? round($todayAttendances->avg('check_in_distance_meters'), 1)
            : 0;

        return response()->json([
            'status' => 'success',
            'data' => [
                'date' => $date,
                'total_employees' => $totalEmployees,
                'total_present' => $totalPresent,
                'total_on_time' => $totalOnTime,
                'total_late' => $totalLate,
                'total_not_checked_in' => $totalNotCheckedIn,
                'avg_distance_meters' => $avgDistance,
            ],
        ]);
    }

    /**
     * Dapatkan konfigurasi lokasi kantor & radius aktif.
     */
    public function getSettings(Request $request): JsonResponse
    {
        $setting = AttendanceSetting::getActiveSetting();

        return response()->json([
            'status' => 'success',
            'data' => $setting,
        ]);
    }

    /**
     * Update konfigurasi lokasi kantor & radius.
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'office_name' => 'required|string|max:150',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'radius_meters' => 'required|integer|min:10|max:10000',
            'work_start_time' => 'required|string|max:10',
            'work_end_time' => 'required|string|max:10',
            'late_tolerance_minutes' => 'required|integer|min:0|max:120',
        ]);

        $setting = AttendanceSetting::getActiveSetting();
        $setting->update($validated);

        \App\Models\ActivityLog::record(
            action: 'UPDATE_ATTENDANCE_SETTING',
            module: 'attendance',
            description: "Memperbarui konfigurasi lokasi kantor '{$setting->office_name}' (Radius: {$setting->radius_meters}m, Jam Kerja: {$setting->work_start_time} - {$setting->work_end_time})",
            details: $validated,
            company: $setting->tenant_id
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Pengaturan lokasi kantor & radius absensi berhasil disimpan.',
            'data' => $setting->fresh(),
        ]);
    }

    /**
     * Export rekapitulasi data absensi ke format CSV/Excel.
     */
    public function export(Request $request): StreamedResponse
    {
        $date = $request->query('date');
        $month = $request->query('month', Carbon::now('Asia/Jakarta')->format('Y-m'));

        $query = Attendance::with('user');
        if ($date) {
            $query->where('date', $date);
            $filename = "rekap_absensi_{$date}.csv";
        } else {
            $query->where('date', 'like', "{$month}%");
            $filename = "rekap_absensi_bulan_{$month}.csv";
        }

        $attendances = $query->orderBy('date', 'asc')->orderBy('check_in_time', 'asc')->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        return response()->stream(function () use ($attendances) {
            $handle = fopen('php://output', 'w');
            // UTF-8 BOM untuk Excel
            fputs($handle, "\xEF\xBB\xBF");

            // Header kolom
            fputcsv($handle, [
                'No',
                'Tanggal',
                'NIK',
                'Nama Karyawan',
                'Jabatan',
                'Jam Masuk',
                'Jarak Masuk (Meter)',
                'Status Masuk',
                'Jam Pulang',
                'Jarak Pulang (Meter)',
                'Status Kehadiran',
                'Catatan',
            ]);

            $no = 1;
            foreach ($attendances as $row) {
                fputcsv($handle, [
                    $no++,
                    $row->date ? Carbon::parse($row->date)->format('Y-m-d') : '-',
                    $row->user->nik ?? '-',
                    $row->user->name ?? '-',
                    $row->user->position ?? '-',
                    $row->check_in_time ? substr($row->check_in_time, 0, 5) : '-',
                    $row->check_in_distance_meters !== null ? $row->check_in_distance_meters . ' m' : '-',
                    $row->check_in_status === 'late' ? 'Terlambat' : 'Tepat Waktu',
                    $row->check_out_time ? substr($row->check_out_time, 0, 5) : '-',
                    $row->check_out_distance_meters !== null ? $row->check_out_distance_meters . ' m' : '-',
                    $row->status === 'present' ? 'Hadir' : ($row->status === 'late' ? 'Terlambat' : ucfirst($row->status)),
                    $row->notes ?? '-',
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }
}
