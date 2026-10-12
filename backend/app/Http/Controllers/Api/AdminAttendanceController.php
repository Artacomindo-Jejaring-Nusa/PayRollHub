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
        $currentUser = $request->user();
        $date = $request->query('date', Carbon::today('Asia/Jakarta')->toDateString());
        $month = $request->query('month');
        $search = $request->query('search');
        $status = $request->query('status');

        $query = Attendance::with(['user' => function ($q) {
            $q->select('id', 'name', 'email', 'nik', 'company', 'phone', 'role', 'school_unit');
        }, 'location']);

        // Strict company isolation:
        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : null)
            : ($currentUser->company ?: 'rbs');

        if ($targetCompany) {
            $query->whereHas('user', fn ($u) => $u->where('company', $targetCompany));
        }

        if ($date && !$month) {
            $query->where('date', $date);
        } elseif ($month) {
            $query->where('date', 'like', "{$month}%");
        }

        if ($status && $status !== 'all') {
            if ($status === 'late') {
                $query->where('check_in_status', 'late')->whereNotIn('attendance_type', ['libur', 'dinas_luar']);
            } elseif ($status === 'on_time') {
                $query->where('check_in_status', 'on_time')->whereNotIn('attendance_type', ['libur', 'dinas_luar']);
            } elseif ($status === 'holiday' || $status === 'libur') {
                $query->where(function ($q) {
                    $q->where('attendance_type', 'libur')->orWhere('status', 'holiday');
                });
            } elseif ($status === 'dinas_luar' || $status === 'business_trip') {
                $query->where('attendance_type', 'dinas_luar');
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
        $currentUser = $request->user();
        $date = $request->query('date', Carbon::today('Asia/Jakarta')->toDateString());

        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : null)
            : ($currentUser->company ?: 'rbs');

        $usersQuery = User::where('role', '!=', 'admin')->where('role', '!=', 'super_admin');
        $attendanceQuery = Attendance::where('date', $date);

        if ($targetCompany) {
            $usersQuery->where('company', $targetCompany);
            $attendanceQuery->whereHas('user', fn ($u) => $u->where('company', $targetCompany));
        }

        $totalEmployees = $usersQuery->count();
        $todayAttendances = $attendanceQuery->get();
        
        $totalHoliday = $todayAttendances->where('attendance_type', 'libur')->count();
        $totalBusinessTrip = $todayAttendances->where('attendance_type', 'dinas_luar')->count();
        $presentAttendances = $todayAttendances->whereNotIn('attendance_type', ['libur', 'dinas_luar']);
        $totalPresent = $presentAttendances->count();
        $totalOnTime = $presentAttendances->where('check_in_status', 'on_time')->count();
        $totalLate = $presentAttendances->where('check_in_status', 'late')->count();
        $totalNotCheckedIn = max(0, $totalEmployees - ($totalPresent + $totalHoliday + $totalBusinessTrip));

        $avgDistance = $totalPresent > 0
            ? round($presentAttendances->avg('check_in_distance_meters'), 1)
            : 0;

        return response()->json([
            'status' => 'success',
            'data' => [
                'date' => $date,
                'company' => $targetCompany ?: 'all',
                'total_employees' => $totalEmployees,
                'total_present' => $totalPresent,
                'total_business_trip' => $totalBusinessTrip,
                'total_holiday' => $totalHoliday,
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
        $currentUser = $request->user();
        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : 'rbs')
            : ($currentUser->company ?: 'rbs');

        $setting = AttendanceSetting::getActiveSetting($targetCompany);

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

        $currentUser = $request->user();
        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : 'rbs')
            : ($currentUser->company ?: 'rbs');

        $setting = AttendanceSetting::getActiveSetting($targetCompany);
        $setting->update(array_merge($validated, ['tenant_id' => $targetCompany]));

        \App\Models\ActivityLog::record(
            action: 'UPDATE_ATTENDANCE_SETTING',
            module: 'attendance',
            description: "Memperbarui konfigurasi lokasi kantor '{$setting->office_name}' ({$targetCompany}) (Radius: {$setting->radius_meters}m, Jam Kerja: {$setting->work_start_time} - {$setting->work_end_time})",
            details: $validated,
            company: $targetCompany
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

        $currentUser = $request->user();
        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : null)
            : ($currentUser->company ?: 'rbs');

        $query = Attendance::with('user');

        if ($targetCompany) {
            $query->whereHas('user', fn ($u) => $u->where('company', $targetCompany));
        }

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
                'Jenis Absen',
                'Lokasi / Unit',
                'Jam Masuk',
                'Jarak Masuk (Meter)',
                'Status Masuk',
                'Jam Pulang',
                'Jarak Pulang (Meter)',
                'Status Kehadiran',
                'Foto Bukti',
                'Catatan',
            ]);

            $no = 1;
            foreach ($attendances as $row) {
                $jenisAbsen = match ($row->attendance_type) {
                    'libur' => 'Libur / Off',
                    'dinas_luar' => 'Perjalanan Dinas',
                    default => 'Masuk Kerja',
                };
                $lokasi = $row->location_name ?: ($row->location->name ?? '-');
                $statusKehadiran = $row->attendance_type === 'libur'
                    ? 'Libur'
                    : ($row->attendance_type === 'dinas_luar'
                        ? 'Dinas Luar'
                        : ($row->status === 'present' ? 'Hadir' : ($row->status === 'late' ? 'Terlambat' : ucfirst($row->status))));

                fputcsv($handle, [
                    $no++,
                    $row->date ? Carbon::parse($row->date)->format('Y-m-d') : '-',
                    $row->user->nik ?? '-',
                    $row->user->name ?? '-',
                    $row->user->position ?? '-',
                    $jenisAbsen,
                    $lokasi,
                    $row->check_in_time ? substr($row->check_in_time, 0, 5) : '-',
                    $row->check_in_distance_meters !== null ? $row->check_in_distance_meters . ' m' : '-',
                    $row->attendance_type === 'libur' ? 'Libur' : ($row->attendance_type === 'dinas_luar' ? 'Dinas Luar' : ($row->check_in_status === 'late' ? 'Terlambat' : 'Tepat Waktu')),
                    $row->check_out_time ? substr($row->check_out_time, 0, 5) : '-',
                    $row->check_out_distance_meters !== null ? $row->check_out_distance_meters . ' m' : '-',
                    $statusKehadiran,
                    $row->photo_full_url ?: ($row->photo_url ?: '-'),
                    $row->notes ?? '-',
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }
}
