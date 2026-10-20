<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\AttendanceSetting;
use App\Models\PayrollPeriod;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Color;

class AdminAttendanceController extends Controller
{
    /**
     * Konversi kode SP/Periode ke rentang tanggal.
     * Prioritas: 1) Baca start_date/end_date dari tabel payroll_periods (DB-driven)
     *            2) Fallback ke mapping bulan kalender 2026 (backward compat)
     */
    public static function getSpDateRange(?string $sp): ?array
    {
        if (!$sp || strtolower(trim($sp)) === 'all') {
            return null;
        }

        // Prioritas 1: Ambil dari database payroll_periods
        $dbRange = PayrollPeriod::resolveDateRange($sp);
        if ($dbRange) {
            return $dbRange;
        }

        // Fallback: mapping bulan kalender (backward compat jika belum ada di DB)
        $clean = trim($sp);
        if (preg_match('/(?:SP|Surat\s+Pesanan)?\s*(\d+)/i', $clean, $matches)) {
            $monthNum = (int) $matches[1];
            if ($monthNum >= 1 && $monthNum <= 12) {
                $year = 2026;
                $start = Carbon::create($year, $monthNum, 1)->startOfMonth()->toDateString();
                $end = Carbon::create($year, $monthNum, 1)->endOfMonth()->toDateString();
                return [$start, $end];
            }
        }

        return null;
    }

    /**
     * Daftar seluruh absensi karyawan (dengan filter tanggal, SP 1-9, bulan, pencarian, status).
     */
    public function index(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        $date = $request->query('date', Carbon::today('Asia/Jakarta')->toDateString());
        $spPeriod = $request->query('sp_period') ?: $request->query('sp');
        $month = $request->query('month');
        $search = $request->query('search');
        $status = $request->query('status');
        $role = $request->query('role');

        $query = Attendance::with(['user' => function ($q) {
            $q->select('id', 'name', 'email', 'nik', 'company', 'phone', 'role', 'school_unit', 'shift_id')->with('shift');
        }, 'location', 'shift', 'approver']);

        // Strict company isolation:
        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : null)
            : ($currentUser->company ?: 'rbs');

        if ($targetCompany) {
            $query->whereHas('user', fn ($u) => $u->where('company', $targetCompany));
        }

        // Filter berdasarkan tipe akun / role (admin vs user lapangan)
        if ($role === 'admin') {
            $query->whereHas('user', fn ($u) => $u->whereIn('role', ['admin', 'super_admin']));
        } elseif ($role === 'user' || $role === 'karyawan') {
            $query->whereHas('user', fn ($u) => $u->whereIn('role', ['user', 'karyawan']));
        }

        // Filter rentang: SP Periode > Spesifik Tanggal > Bulan
        $spRange = $this->getSpDateRange($spPeriod);
        if ($spRange) {
            $query->whereBetween('date', $spRange);
        } elseif ($date && !$month) {
            $query->where('date', $date);
        } elseif ($month) {
            $query->where('date', 'like', "{$month}%");
        }

        $approvalStatus = $request->query('approval_status');
        if ($approvalStatus && $approvalStatus !== 'all') {
            $query->where('approval_status', $approvalStatus);
        }

        if ($status && $status !== 'all') {
            if ($status === 'late') {
                $query->where('check_in_status', 'late')->whereNotIn('attendance_type', ['libur', 'dinas_luar', 'sakit', 'izin']);
            } elseif ($status === 'on_time') {
                $query->where('check_in_status', 'on_time')->whereNotIn('attendance_type', ['libur', 'dinas_luar', 'sakit', 'izin']);
            } elseif ($status === 'holiday' || $status === 'libur') {
                $query->where(function ($q) {
                    $q->where('attendance_type', 'libur')->orWhere('status', 'holiday');
                });
            } elseif ($status === 'dinas_luar' || $status === 'business_trip') {
                $query->where('attendance_type', 'dinas_luar');
            } elseif ($status === 'sakit') {
                $query->where('attendance_type', 'sakit');
            } elseif ($status === 'izin') {
                $query->where('attendance_type', 'izin');
            } elseif ($status === 'pending_verification' || $status === 'pending') {
                $query->where('approval_status', 'pending');
            } else {
                $query->where('status', $status);
            }
        }

        if ($search) {
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('nik', 'like', "%{$search}%")
                    ->orWhere('school_unit', 'like', "%{$search}%");
            });
        }

        $attendances = $query->orderBy('date', 'desc')
            ->orderBy('check_in_time', 'desc')
            ->paginate($request->query('per_page', 25));

        return response()->json([
            'status' => 'success',
            'sp_period' => $spPeriod,
            'data' => $attendances,
        ]);
    }

    /**
     * Ringkasan statistik kehadiran harian atau per periode SP.
     */
    public function summary(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        $date = $request->query('date', Carbon::today('Asia/Jakarta')->toDateString());
        $spPeriod = $request->query('sp_period') ?: $request->query('sp');
        $role = $request->query('role');

        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : null)
            : ($currentUser->company ?: 'rbs');

        $usersQuery = User::query();
        $attendanceQuery = Attendance::query();

        // Dukungan filter role untuk Admin vs Karyawan
        if ($role === 'admin') {
            $usersQuery->whereIn('role', ['admin', 'super_admin']);
            $attendanceQuery->whereHas('user', fn ($u) => $u->whereIn('role', ['admin', 'super_admin']));
        } elseif ($role === 'user' || $role === 'karyawan') {
            $usersQuery->whereIn('role', ['user', 'karyawan']);
            $attendanceQuery->whereHas('user', fn ($u) => $u->whereIn('role', ['user', 'karyawan']));
        }

        if ($targetCompany) {
            $usersQuery->where('company', $targetCompany);
            $attendanceQuery->whereHas('user', fn ($u) => $u->where('company', $targetCompany));
        }

        $totalRegistered = 0;
        $totalOff = 0;

        $spRange = $this->getSpDateRange($spPeriod);
        if ($spRange && $spPeriod && strtolower(trim($spPeriod)) !== 'all') {
            $attendanceQuery->whereBetween('date', $spRange);
            $label = "Periode {$spPeriod}";

            // Filter karyawan yang terdaftar dan aktif di periode SP tersebut
            $spClean = trim($spPeriod);
            $payrollQuery = \App\Models\Payroll::where('period', $spClean)
                ->when($targetCompany, fn ($sq) => $sq->where('company', $targetCompany));

            $totalActivePayroll = (clone $payrollQuery)
                ->where(fn ($sq) => $sq->where('status', '!=', 'off')->orWhereNull('status'))
                ->count();
            $totalRegistered = (clone $payrollQuery)->count();
            $totalOff = (clone $payrollQuery)->where('status', 'off')->count();

            $usersQuery->whereIn('name', function ($q) use ($targetCompany, $spClean) {
                $q->select('employee_name')
                    ->from('payrolls')
                    ->where('period', $spClean)
                    ->when($targetCompany, fn ($sq) => $sq->where('company', $targetCompany))
                    ->where(fn ($sq) => $sq->where('status', '!=', 'off')->orWhereNull('status'));
            });

            $totalEmployees = $totalActivePayroll > 0 ? $totalActivePayroll : $usersQuery->count();
        } else {
            $attendanceQuery->where('date', $date);
            $label = $date;

            // Untuk absensi harian / global: sinkronkan patokan dengan master data payroll resmi
            if ($targetCompany) {
                $payrollQuery = \App\Models\Payroll::where('company', $targetCompany);
                $totalActivePayroll = (clone $payrollQuery)
                    ->where(fn ($sq) => $sq->where('status', '!=', 'off')->orWhereNull('status'))
                    ->count();
                $totalRegistered = (clone $payrollQuery)->count();
                $totalOff = (clone $payrollQuery)->where('status', 'off')->count();

                if ($totalActivePayroll > 0) {
                    $totalEmployees = $totalActivePayroll;
                } else {
                    $usersQuery->where(function ($q) {
                        $q->where('status', '!=', 'off')->orWhereNull('status');
                    });
                    $totalEmployees = $usersQuery->count();
                }
            } else {
                $usersQuery->where(function ($q) {
                    $q->where('status', '!=', 'off')->orWhereNull('status');
                });
                $totalEmployees = $usersQuery->count();
            }
        }

        $attendances = $attendanceQuery->get();

        $totalHoliday = $attendances->where('attendance_type', 'libur')->count();
        $totalBusinessTrip = $attendances->where('attendance_type', 'dinas_luar')->count();
        $totalSick = $attendances->where('attendance_type', 'sakit')->count();
        $totalPermit = $attendances->where('attendance_type', 'izin')->count();
        $totalPendingVerification = $attendances->where('approval_status', 'pending')->count();
        $presentAttendances = $attendances->whereNotIn('attendance_type', ['libur', 'dinas_luar', 'sakit', 'izin']);
        $totalPresent = $presentAttendances->count();
        $totalOnTime = $presentAttendances->where('check_in_status', 'on_time')->count();
        $totalLate = $presentAttendances->where('check_in_status', 'late')->count();
        $totalNotCheckedIn = max(0, $totalEmployees - ($totalPresent + $totalHoliday + $totalBusinessTrip + $totalSick + $totalPermit));

        $eightHoursMetCount = 0;
        foreach ($attendances as $att) {
            if ($att->is_eight_hours_met) {
                $eightHoursMetCount++;
            }
        }

        $avgDistance = $totalPresent > 0
            ? round($presentAttendances->avg('check_in_distance_meters'), 1)
            : 0;

        return response()->json([
            'status' => 'success',
            'data' => [
                'date' => $label,
                'sp_period' => $spPeriod,
                'company' => $targetCompany ?: 'all',
                'total_employees' => $totalEmployees,
                'total_registered' => $totalRegistered,
                'total_off' => $totalOff,
                'total_present' => $totalPresent,
                'total_business_trip' => $totalBusinessTrip,
                'total_holiday' => $totalHoliday,
                'total_sick' => $totalSick,
                'total_permit' => $totalPermit,
                'total_pending_verification' => $totalPendingVerification,
                'total_on_time' => $totalOnTime,
                'total_late' => $totalLate,
                'total_not_checked_in' => $totalNotCheckedIn,
                'total_eight_hours_met' => $eightHoursMetCount,
                'avg_distance_meters' => $avgDistance,
            ],
        ]);
    }

    /**
     * POINT 6: Rekapitulasi Presensi per Karyawan teragregasi untuk SP 1-9.
     */
    public function recapByEmployee(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : null)
            : ($currentUser->company ?: 'rbs');

        $spPeriod = $request->query('sp_period') ?: $request->query('sp');
        $spRange = $this->getSpDateRange($spPeriod) ?: [
            Carbon::today('Asia/Jakarta')->startOfMonth()->toDateString(),
            Carbon::today('Asia/Jakarta')->endOfMonth()->toDateString(),
        ];

        $search = $request->query('search');
        $role = $request->query('role');
        $rawUserIds = $request->query('user_ids') ?: $request->input('user_ids');
        $selectedUserIds = [];
        if ($rawUserIds) {
            $selectedUserIds = is_array($rawUserIds) ? $rawUserIds : explode(',', (string) $rawUserIds);
            $selectedUserIds = array_filter(array_map('intval', $selectedUserIds));
        }

        $usersQuery = User::query();
        if ($role === 'admin') {
            $usersQuery->whereIn('role', ['admin', 'super_admin']);
        } elseif ($role === 'user' || $role === 'karyawan') {
            $usersQuery->whereIn('role', ['user', 'karyawan']);
        }

        if ($targetCompany) {
            $usersQuery->where('company', $targetCompany);
        }

        // Filter karyawan yang terdaftar dan aktif di periode SP tersebut
        if ($spPeriod && strtolower(trim($spPeriod)) !== 'all') {
            $spClean = trim($spPeriod);
            $usersQuery->whereIn('name', function ($q) use ($targetCompany, $spClean) {
                $q->select('employee_name')
                    ->from('payrolls')
                    ->where('period', $spClean)
                    ->when($targetCompany, fn ($sq) => $sq->where('company', $targetCompany))
                    ->where(fn ($sq) => $sq->where('status', '!=', 'off')->orWhereNull('status'));
            });
        } else {
            $usersQuery->where(function ($q) {
                $q->where('status', '!=', 'off')->orWhereNull('status');
            });
        }
        if (!empty($selectedUserIds)) {
            $usersQuery->whereIn('id', $selectedUserIds);
        }
        if ($search) {
            $usersQuery->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('nik', 'like', "%{$search}%")
                    ->orWhere('school_unit', 'like', "%{$search}%");
            });
        }

        $users = $usersQuery->with('shift')->orderBy('name', 'asc')->get();
        $userIds = $users->pluck('id');

        // Tarik data absensi di periode SP yang dipilih (eager load shift untuk hindari N+1 query)
        $attendances = Attendance::with(['shift', 'user.shift'])
            ->whereIn('user_id', $userIds)
            ->whereBetween('date', $spRange)
            ->get()
            ->groupBy('user_id');

        $recap = $users->map(function ($user) use ($attendances) {
            $userLogs = $attendances->get($user->id, collect());
            $totalPresent = $userLogs->whereNotIn('attendance_type', ['libur', 'dinas_luar', 'sakit', 'izin'])->count();
            $totalOnTime = $userLogs->whereNotIn('attendance_type', ['libur', 'dinas_luar', 'sakit', 'izin'])->where('check_in_status', 'on_time')->count();
            $totalLate = $userLogs->whereNotIn('attendance_type', ['libur', 'dinas_luar', 'sakit', 'izin'])->where('check_in_status', 'late')->count();
            $totalBusinessTrip = $userLogs->where('attendance_type', 'dinas_luar')->count();
            $totalHoliday = $userLogs->where('attendance_type', 'libur')->count();
            $totalSick = $userLogs->where('attendance_type', 'sakit')->count();
            $totalPermit = $userLogs->where('attendance_type', 'izin')->count();
            $totalPending = $userLogs->where('approval_status', 'pending')->count();

            $totalWorkMinutes = 0;
            $eightHoursMetCount = 0;
            foreach ($userLogs as $log) {
                $dur = $log->work_duration_minutes;
                if ($dur !== null) {
                    $totalWorkMinutes += $dur;
                    if ($log->is_eight_hours_met) {
                        $eightHoursMetCount++;
                    }
                }
            }

            $hours = intdiv($totalWorkMinutes, 60);
            $mins = $totalWorkMinutes % 60;
            $formattedDuration = $totalWorkMinutes > 0 ? "{$hours}j {$mins}m" : "-";

            return [
                'user_id' => $user->id,
                'name' => $user->name,
                'nik' => $user->nik,
                'email' => $user->email,
                'role' => $user->role,
                'company' => $user->company,
                'position' => $user->position,
                'school_unit' => $user->school_unit,
                'total_records' => $userLogs->count(),
                'total_present' => $totalPresent,
                'total_on_time' => $totalOnTime,
                'total_late' => $totalLate,
                'total_business_trip' => $totalBusinessTrip,
                'total_holiday' => $totalHoliday,
                'total_sick' => $totalSick,
                'total_permit' => $totalPermit,
                'total_pending' => $totalPending,
                'eight_hours_met_count' => $eightHoursMetCount,
                'total_work_minutes' => $totalWorkMinutes,
                'total_work_formatted' => $formattedDuration,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => [
                'sp_period' => $spPeriod,
                'date_range' => $spRange,
                'items' => $recap,
                'total_employees' => $recap->count(),
            ],
        ]);
    }

    /**
     * POINT 7: Admin menambah presensi manual karyawan.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'date' => 'required|date_format:Y-m-d',
            'attendance_type' => 'required|in:masuk,dinas_luar,libur,sakit,izin',
            'check_in_time' => 'nullable|string',
            'check_out_time' => 'nullable|string',
            'check_in_status' => 'nullable|in:on_time,late',
            'status' => 'nullable|in:present,late,holiday,absent,permit',
            'approval_status' => 'nullable|in:pending,approved,rejected',
            'location_name' => 'nullable|string|max:150',
            'shift_id' => 'nullable|integer|exists:shifts,id',
            'notes' => 'nullable|string|max:500',
        ]);

        $currentUser = $request->user();
        $targetUser = User::findOrFail($validated['user_id']);

        if (!$currentUser->isSuperAdmin() && $currentUser->company && $targetUser->company !== $currentUser->company) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki hak akses untuk karyawan perusahaan lain.',
            ], 403);
        }

        $existing = Attendance::where('user_id', $targetUser->id)->where('date', $validated['date'])->first();
        if ($existing) {
            return response()->json([
                'status' => 'error',
                'message' => "Data presensi {$targetUser->name} pada tanggal {$validated['date']} sudah tercatat. Silakan gunakan tombol edit.",
            ], 422);
        }

        $type = $validated['attendance_type'];
        $checkInStatus = $validated['check_in_status'] ?? ($type === 'masuk' ? 'on_time' : null);
        $status = $validated['status'] ?? (match($type) {
            'libur' => 'holiday',
            'sakit', 'izin' => 'permit',
            default => 'present',
        });
        $approvalStatus = $validated['approval_status'] ?? 'approved';

        $attendance = Attendance::create([
            'user_id' => $targetUser->id,
            'date' => $validated['date'],
            'attendance_type' => $type,
            'check_in_time' => $validated['check_in_time'] ?: ($type === 'libur' ? null : '08:00:00'),
            'check_out_time' => $validated['check_out_time'] ?: null,
            'check_in_status' => $checkInStatus,
            'status' => $status,
            'approval_status' => $approvalStatus,
            'location_name' => $validated['location_name'] ?: ($type === 'dinas_luar' ? 'Perjalanan Dinas' : ($type === 'sakit' ? 'Sakit (Surat Dokter)' : ($type === 'izin' ? 'Izin Resmi' : 'Input Manual Admin'))),
            'shift_id' => $validated['shift_id'] ?? ($targetUser->shift_id ?: null),
            'notes' => $validated['notes'] ? '[Input Admin] ' . $validated['notes'] : '[Input Admin Manual]',
        ]);

        ActivityLog::record(
            action: 'ADMIN_CREATE_ATTENDANCE',
            module: 'attendance',
            description: "Admin menambahkan presensi manual untuk {$targetUser->name} ({$targetUser->nik}) pada tanggal {$validated['date']} ({$type})",
            details: $attendance->toArray(),
            company: $targetUser->company
        );

        return response()->json([
            'status' => 'success',
            'message' => "Presensi karyawan {$targetUser->name} berhasil ditambahkan secara manual.",
            'data' => $attendance->fresh(['user', 'location', 'shift', 'approver']),
        ]);
    }

    /**
     * POINT 7: Admin mengedit data presensi karyawan.
     */
    public function update(Request $request, Attendance $attendance): JsonResponse
    {
        $validated = $request->validate([
            'date' => 'required|date_format:Y-m-d',
            'attendance_type' => 'required|in:masuk,dinas_luar,libur,sakit,izin',
            'check_in_time' => 'nullable|string',
            'check_out_time' => 'nullable|string',
            'check_in_status' => 'nullable|in:on_time,late',
            'status' => 'nullable|in:present,late,holiday,absent,permit',
            'approval_status' => 'nullable|in:pending,approved,rejected',
            'location_name' => 'nullable|string|max:150',
            'shift_id' => 'nullable|integer|exists:shifts,id',
            'notes' => 'nullable|string|max:500',
        ]);

        $currentUser = $request->user();
        $targetUser = $attendance->user;

        if (!$currentUser->isSuperAdmin() && $currentUser->company && $targetUser && $targetUser->company !== $currentUser->company) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki hak akses untuk mengedit data ini.',
            ], 403);
        }

        $oldData = $attendance->toArray();

        $attendance->update([
            'date' => $validated['date'],
            'attendance_type' => $validated['attendance_type'],
            'check_in_time' => $validated['check_in_time'] ?: null,
            'check_out_time' => $validated['check_out_time'] ?: null,
            'check_in_status' => $validated['check_in_status'] ?? $attendance->check_in_status,
            'status' => $validated['status'] ?? $attendance->status,
            'approval_status' => $validated['approval_status'] ?? $attendance->approval_status,
            'location_name' => $validated['location_name'] ?? $attendance->location_name,
            'shift_id' => array_key_exists('shift_id', $validated) ? $validated['shift_id'] : $attendance->shift_id,
            'notes' => $validated['notes'],
        ]);

        ActivityLog::record(
            action: 'ADMIN_EDIT_ATTENDANCE',
            module: 'attendance',
            description: "Admin mengubah absensi ID #{$attendance->id} untuk " . ($targetUser->name ?? 'Karyawan') . " pada tanggal {$attendance->date}",
            details: [
                'old' => $oldData,
                'new' => $attendance->fresh()->toArray(),
            ],
            company: $targetUser->company ?? null
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Data presensi karyawan berhasil diperbarui.',
            'data' => $attendance->fresh(['user', 'location', 'shift', 'approver']),
        ]);
    }

    /**
     * POINT MAUN: Verifikasi Permohonan Absen Sakit / Izin oleh Admin.
     */
    public function verify(Request $request, Attendance $attendance): JsonResponse
    {
        $currentUser = $request->user();
        $targetUser = $attendance->user;

        // Validasi tenant
        if (!$currentUser->isSuperAdmin() && $currentUser->company && $targetUser && $targetUser->company !== $currentUser->company) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak berhak memverifikasi presensi karyawan dari perusahaan lain.',
            ], 403);
        }

        $validated = $request->validate([
            'action' => 'required|in:approve,reject',
            'rejection_reason' => 'nullable|string|max:500',
        ]);

        $action = $validated['action'];
        $typeLabel = $attendance->attendance_type === 'sakit' ? 'Sakit' : ($attendance->attendance_type === 'izin' ? 'Izin' : 'Presensi');

        if ($action === 'approve') {
            $attendance->update([
                'approval_status' => 'approved',
                'approved_by' => $currentUser->id,
                'approved_at' => now(),
                'status' => 'permit',
                'rejection_reason' => null,
            ]);

            ActivityLog::record(
                action: 'ADMIN_APPROVE_ATTENDANCE',
                module: 'attendance',
                description: "Admin menyetujui permohonan {$typeLabel} untuk " . ($targetUser->name ?? 'Karyawan') . " pada {$attendance->date}",
                details: ['attendance_id' => $attendance->id, 'type' => $attendance->attendance_type],
                company: $targetUser->company ?? null
            );

            return response()->json([
                'status' => 'success',
                'message' => "Permohonan {$typeLabel} untuk " . ($targetUser->name ?? 'Karyawan') . " berhasil disetujui.",
                'data' => $attendance->fresh(['user', 'location', 'shift', 'approver']),
            ]);
        } else {
            $reason = trim($validated['rejection_reason'] ?? '') ?: 'Dokumen/Surat keterangan tidak valid atau tidak lengkap.';
            $attendance->update([
                'approval_status' => 'rejected',
                'approved_by' => $currentUser->id,
                'approved_at' => now(),
                'status' => 'absent',
                'rejection_reason' => $reason,
            ]);

            ActivityLog::record(
                action: 'ADMIN_REJECT_ATTENDANCE',
                module: 'attendance',
                description: "Admin menolak permohonan {$typeLabel} untuk " . ($targetUser->name ?? 'Karyawan') . " pada {$attendance->date}. Alasan: {$reason}",
                details: ['attendance_id' => $attendance->id, 'reason' => $reason],
                company: $targetUser->company ?? null
            );

            return response()->json([
                'status' => 'success',
                'message' => "Permohonan {$typeLabel} untuk " . ($targetUser->name ?? 'Karyawan') . " telah ditolak. Status kehadiran diubah menjadi Tidak Hadir (Alpa).",
                'data' => $attendance->fresh(['user', 'location', 'shift', 'approver']),
            ]);
        }
    }

    /**
     * POINT 7: Admin menghapus data presensi karyawan.
     */
    public function destroy(Request $request, Attendance $attendance): JsonResponse
    {
        $currentUser = $request->user();
        $targetUser = $attendance->user;

        if (!$currentUser->isSuperAdmin() && $currentUser->company && $targetUser && $targetUser->company !== $currentUser->company) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki hak akses untuk menghapus data ini.',
            ], 403);
        }

        $recordInfo = "ID #{$attendance->id} (" . ($targetUser->name ?? 'Karyawan') . ", Tanggal {$attendance->date})";
        $attendance->delete();

        ActivityLog::record(
            action: 'ADMIN_DELETE_ATTENDANCE',
            module: 'attendance',
            description: "Admin menghapus data presensi {$recordInfo}",
            details: ['deleted_attendance_id' => $attendance->id],
            company: $targetUser->company ?? null
        );

        return response()->json([
            'status' => 'success',
            'message' => "Data presensi {$recordInfo} berhasil dihapus.",
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
        $hqLocation = AttendanceSetting::syncHeadquartersLocation($setting);

        return response()->json([
            'status' => 'success',
            'data' => array_merge($setting->toArray(), [
                'can_edit' => true,
                'can_edit_location' => $currentUser->isSuperAdmin(),
                'headquarters_location_id' => $hqLocation->id,
            ]),
        ]);
    }

    /**
     * Update konfigurasi lokasi kantor, jam kerja baku, & toleransi keterlambatan.
     * Jam kerja baku & toleransi keterlambatan dapat diatur oleh Admin dan Super Admin.
     * Koordinat & radius kantor pusat diatur khusus oleh Super Admin.
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        $isSuperAdmin = $currentUser->isSuperAdmin();

        if (!$isSuperAdmin && $currentUser->role !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Akses ditolak: Hanya Admin / Super Admin yang berwenang memperbarui konfigurasi jam kerja baku.',
            ], 403);
        }

        $rules = [
            'work_start_time' => 'required|string|max:10',
            'work_end_time' => 'required|string|max:10',
            'late_tolerance_minutes' => 'required|integer|min:0|max:120',
        ];

        if ($isSuperAdmin) {
            $rules['office_name'] = 'required|string|max:150';
            $rules['latitude'] = 'required|numeric|between:-90,90';
            $rules['longitude'] = 'required|numeric|between:-180,180';
            $rules['radius_meters'] = 'required|integer|min:10|max:10000';
        }

        $validated = $request->validate($rules);

        $targetCompany = $request->query('company') && $request->query('company') !== 'all'
            ? $request->query('company')
            : ($currentUser->company ?: 'rbs');

        $setting = AttendanceSetting::getActiveSetting($targetCompany);

        $updateData = [
            'work_start_time' => $validated['work_start_time'],
            'work_end_time' => $validated['work_end_time'],
            'late_tolerance_minutes' => $validated['late_tolerance_minutes'],
            'tenant_id' => $targetCompany,
        ];

        if ($isSuperAdmin) {
            $updateData['office_name'] = $validated['office_name'];
            $updateData['latitude'] = $validated['latitude'];
            $updateData['longitude'] = $validated['longitude'];
            $updateData['radius_meters'] = $validated['radius_meters'];
        }

        $setting->update($updateData);

        // Sinkronisasikan juga ke Master Shift REGULER agar jam masuk & toleransi karyawan otomatis terupdate
        $regulerShifts = \App\Models\Shift::where(function ($q) use ($targetCompany) {
            $q->where('company', $targetCompany)
              ->orWhere('company', 'all');
        })
            ->where('code', 'REGULER')
            ->get();

        foreach ($regulerShifts as $regulerShift) {
            $regulerShift->update([
                'start_time' => $validated['work_start_time'],
                'end_time' => $validated['work_end_time'],
                'late_tolerance_minutes' => $validated['late_tolerance_minutes'],
            ]);
        }

        // POINT 10: Sinkronisasikan langsung ke master lokasi sebagai 'headquarters'
        $hqLocation = AttendanceSetting::syncHeadquartersLocation($setting);

        ActivityLog::record(
            action: 'UPDATE_HEADQUARTERS_SETTING',
            module: 'attendance',
            description: "Admin memperbarui jam kerja baku ({$setting->work_start_time} - {$setting->work_end_time}, toleransi {$setting->late_tolerance_minutes}m) untuk {$targetCompany}",
            details: array_merge($validated, [
                'headquarters_location_id' => $hqLocation->id,
            ]),
            company: $targetCompany
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Pengaturan jam kerja baku & toleransi keterlambatan berhasil disimpan.',
            'data' => array_merge($setting->fresh()->toArray(), [
                'can_edit' => true,
                'can_edit_location' => $isSuperAdmin,
                'headquarters_location_id' => $hqLocation->id,
            ]),
        ]);
    }

    /**
     * Export rekapitulasi data absensi ke format Excel (.xlsx) atau CSV (Detail Log atau Rekap per Karyawan).
     * Mendukung seluruh filter: SP Periode, Tanggal Harian, Status Kehadiran, Pencarian Nama/NIK/Unit, & Tenant Perusahaan.
     */
    public function export(Request $request): StreamedResponse
    {
        $format = strtolower($request->query('format', 'xlsx')); // 'xlsx' | 'csv'
        $mode = $request->query('mode', 'detail'); // 'detail' | 'employee_recap'
        $date = $request->query('date');
        $spPeriod = $request->query('sp_period') ?: $request->query('sp');
        $month = $request->query('month');
        $status = $request->query('status');
        $role = $request->query('role');
        $search = $request->query('search');
        $rawUserIds = $request->query('user_ids') ?: $request->input('user_ids');
        $selectedUserIds = [];
        if ($rawUserIds) {
            $selectedUserIds = is_array($rawUserIds) ? $rawUserIds : explode(',', (string) $rawUserIds);
            $selectedUserIds = array_filter(array_map('intval', $selectedUserIds));
        }

        $currentUser = $request->user();
        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : null)
            : ($currentUser->company ?: 'rbs');

        $spRange = $this->getSpDateRange($spPeriod);

        // =========================================================================
        // MODE 1: REKAPITULASI AGREGAT PER KARYAWAN
        // =========================================================================
        if ($mode === 'employee_recap') {
            $range = $spRange ?: ($date ? [$date, $date] : ($month ? [
                Carbon::parse($month)->startOfMonth()->toDateString(),
                Carbon::parse($month)->endOfMonth()->toDateString(),
            ] : [
                Carbon::today('Asia/Jakarta')->startOfMonth()->toDateString(),
                Carbon::today('Asia/Jakarta')->endOfMonth()->toDateString(),
            ]));

            $usersQuery = User::query();
            if ($role === 'admin') {
                $usersQuery->whereIn('role', ['admin', 'super_admin']);
            } elseif ($role === 'user' || $role === 'karyawan') {
                $usersQuery->whereIn('role', ['user', 'karyawan']);
            }
            if ($targetCompany) {
                $usersQuery->where('company', $targetCompany);
            }

            // Filter karyawan yang terdaftar dan aktif di periode SP tersebut
            if ($spPeriod && strtolower(trim($spPeriod)) !== 'all') {
                $spClean = trim($spPeriod);
                $usersQuery->whereIn('name', function ($q) use ($targetCompany, $spClean) {
                    $q->select('employee_name')
                        ->from('payrolls')
                        ->where('period', $spClean)
                        ->when($targetCompany, fn ($sq) => $sq->where('company', $targetCompany))
                        ->where(fn ($sq) => $sq->where('status', '!=', 'off')->orWhereNull('status'));
                });
            } else {
                $usersQuery->where(function ($q) {
                    $q->where('status', '!=', 'off')->orWhereNull('status');
                });
            }
            if (!empty($selectedUserIds)) {
                $usersQuery->whereIn('id', $selectedUserIds);
            }
            if ($search) {
                $usersQuery->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('nik', 'like', "%{$search}%")
                        ->orWhere('school_unit', 'like', "%{$search}%");
                });
            }

            $users = $usersQuery->with('shift')->orderBy('name', 'asc')->get();
            $userIds = $users->pluck('id');

            $attendances = Attendance::with(['shift', 'user.shift'])
                ->whereIn('user_id', $userIds)
                ->whereBetween('date', $range)
                ->get()
                ->groupBy('user_id');

            $recapData = [];
            $no = 1;

            foreach ($users as $user) {
                $logs = $attendances->get($user->id, collect());
                $totalPresent = $logs->whereNotIn('attendance_type', ['libur', 'dinas_luar'])->count();
                $totalOnTime = $logs->whereNotIn('attendance_type', ['libur', 'dinas_luar'])->where('check_in_status', 'on_time')->count();
                $totalLate = $logs->whereNotIn('attendance_type', ['libur', 'dinas_luar'])->where('check_in_status', 'late')->count();
                $totalBusinessTrip = $logs->where('attendance_type', 'dinas_luar')->count();
                $totalHoliday = $logs->where('attendance_type', 'libur')->count();

                // Saring jika filter status aktif
                if ($status && $status !== 'all') {
                    if ($status === 'late' && $totalLate === 0) continue;
                    if ($status === 'on_time' && $totalOnTime === 0) continue;
                    if (($status === 'dinas_luar' || $status === 'business_trip') && $totalBusinessTrip === 0) continue;
                    if (($status === 'holiday' || $status === 'libur') && $totalHoliday === 0) continue;
                }

                $totalWorkMinutes = 0;
                $eightHoursCount = 0;
                foreach ($logs as $log) {
                    $dur = $log->work_duration_minutes;
                    if ($dur !== null) {
                        $totalWorkMinutes += $dur;
                        if ($log->is_eight_hours_met) {
                            $eightHoursCount++;
                        }
                    }
                }

                $h = intdiv($totalWorkMinutes, 60);
                $m = $totalWorkMinutes % 60;
                $durFormatted = $totalWorkMinutes > 0 ? "{$h} jam {$m} menit" : '-';

                $recapData[] = [
                    'no' => $no++,
                    'nik' => $user->nik ?? '-',
                    'name' => $user->name,
                    'company' => strtoupper($user->company ?? '-'),
                    'position' => $user->position ?? '-',
                    'school_unit' => $user->school_unit ?? '-',
                    'sp_period' => $spPeriod ?: "{$range[0]} s/d {$range[1]}",
                    'total_present' => $totalPresent,
                    'total_on_time' => $totalOnTime,
                    'total_late' => $totalLate,
                    'total_business_trip' => $totalBusinessTrip,
                    'total_holiday' => $totalHoliday,
                    'eight_hours_count' => $eightHoursCount,
                    'duration_formatted' => $durFormatted,
                ];
            }

            $suffixSelected = !empty($selectedUserIds) ? '_terpilih' : '';
            $filterLabel = $spPeriod ? str_replace(' ', '_', $spPeriod) : "{$range[0]}_{$range[1]}";
            $filename = "rekap_karyawan_absensi_{$filterLabel}{$suffixSelected}";

            if ($format === 'csv') {
                $headers = [
                    'Content-Type' => 'text/csv; charset=UTF-8',
                    'Content-Disposition' => "attachment; filename=\"{$filename}.csv\"",
                    'Pragma' => 'no-cache',
                    'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
                    'Expires' => '0',
                ];

                return response()->stream(function () use ($recapData) {
                    $handle = fopen('php://output', 'w');
                    fputs($handle, "\xEF\xBB\xBF"); // UTF-8 BOM

                    fputcsv($handle, [
                        'No',
                        'NIK',
                        'Nama Karyawan',
                        'Perusahaan',
                        'Jabatan',
                        'Unit Sekolah / Lokasi',
                        'Periode SP',
                        'Total Hadir Masuk',
                        'Tepat Waktu',
                        'Terlambat',
                        'Perjalanan Dinas',
                        'Libur / Off',
                        'Memenuhi Target Shift (Hari)',
                        'Total Durasi Kerja',
                    ]);

                    foreach ($recapData as $row) {
                        fputcsv($handle, [
                            $row['no'],
                            $row['nik'],
                            $row['name'],
                            $row['company'],
                            $row['position'],
                            $row['school_unit'],
                            $row['sp_period'],
                            $row['total_present'],
                            $row['total_on_time'],
                            $row['total_late'],
                            $row['total_business_trip'],
                            $row['total_holiday'],
                            $row['eight_hours_count'],
                            $row['duration_formatted'],
                        ]);
                    }

                    fclose($handle);
                }, 200, $headers);
            }

            // Export XLSX untuk Mode Rekap Karyawan
            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Rekap Kehadiran Karyawan');

            $headings = [
                'No',
                'NIK',
                'Nama Karyawan',
                'Perusahaan',
                'Jabatan',
                'Unit Sekolah / Lokasi',
                'Periode SP',
                'Total Hadir Masuk',
                'Tepat Waktu',
                'Terlambat',
                'Perjalanan Dinas',
                'Libur / Off',
                'Memenuhi Target Shift (Hari)',
                'Total Durasi Kerja',
            ];
            $sheet->fromArray([$headings], null, 'A1');

            $excelRows = [];
            foreach ($recapData as $row) {
                $excelRows[] = [
                    $row['no'],
                    (string) $row['nik'],
                    $row['name'],
                    $row['company'],
                    $row['position'],
                    $row['school_unit'],
                    $row['sp_period'],
                    $row['total_present'],
                    $row['total_on_time'],
                    $row['total_late'],
                    $row['total_business_trip'],
                    $row['total_holiday'],
                    $row['eight_hours_count'],
                    $row['duration_formatted'],
                ];
            }

            if (!empty($excelRows)) {
                $sheet->fromArray($excelRows, null, 'A2');
            }

            // Styling Header
            $sheet->getStyle('A1:N1')->applyFromArray([
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF'], 'size' => 11],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                    'vertical' => Alignment::VERTICAL_CENTER,
                ],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '004AC6'],
                ],
            ]);
            $sheet->getRowDimension(1)->setRowHeight(28);

            $lastRow = count($excelRows) + 1;

            // Total Row
            if (!empty($excelRows)) {
                $totalRow = $lastRow + 1;
                $sheet->setCellValue("A{$totalRow}", 'TOTAL');
                $sheet->mergeCells("A{$totalRow}:G{$totalRow}");
                $sheet->setCellValue("H{$totalRow}", "=SUM(H2:H{$lastRow})");
                $sheet->setCellValue("I{$totalRow}", "=SUM(I2:I{$lastRow})");
                $sheet->setCellValue("J{$totalRow}", "=SUM(J2:J{$lastRow})");
                $sheet->setCellValue("K{$totalRow}", "=SUM(K2:K{$lastRow})");
                $sheet->setCellValue("L{$totalRow}", "=SUM(L2:L{$lastRow})");
                $sheet->setCellValue("M{$totalRow}", "=SUM(M2:M{$lastRow})");
                $sheet->setCellValue("N{$totalRow}", '-');

                $sheet->getStyle("A{$totalRow}:N{$totalRow}")->applyFromArray([
                    'font' => ['bold' => true, 'color' => ['rgb' => '0F172A']],
                    'fill' => [
                        'fillType' => Fill::FILL_SOLID,
                        'startColor' => ['rgb' => 'E2E8F0'],
                    ],
                    'borders' => [
                        'top' => ['borderStyle' => Border::BORDER_THIN],
                        'bottom' => ['borderStyle' => Border::BORDER_DOUBLE],
                    ],
                ]);
                $sheet->getStyle("A{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle("H{$totalRow}:M{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getRowDimension($totalRow)->setRowHeight(24);
                $lastRow = $totalRow;
            }

            // Borders & Alignments
            $sheet->getStyle("A1:N{$lastRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
            $sheet->getStyle("A2:B{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle("D2:D{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle("G2:M{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

            $sheet->freezePane('A2');

            foreach (range('A', 'N') as $col) {
                $sheet->getColumnDimension($col)->setAutoSize(true);
            }

            $headers = [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => "attachment; filename=\"{$filename}.xlsx\"",
                'Cache-Control' => 'max-age=0',
            ];

            return response()->stream(function () use ($spreadsheet) {
                $writer = new Xlsx($spreadsheet);
                $writer->save('php://output');
            }, 200, $headers);
        }

        // =========================================================================
        // MODE 2: DETAIL LOG ABSENSI
        // =========================================================================
        $query = Attendance::with(['user.shift', 'location', 'shift']);

        if ($targetCompany) {
            $query->whereHas('user', fn ($u) => $u->where('company', $targetCompany));
        }

        if ($role === 'admin') {
            $query->whereHas('user', fn ($u) => $u->whereIn('role', ['admin', 'super_admin']));
        } elseif ($role === 'user' || $role === 'karyawan') {
            $query->whereHas('user', fn ($u) => $u->whereIn('role', ['user', 'karyawan']));
        }

        if (!empty($selectedUserIds)) {
            $query->whereIn('user_id', $selectedUserIds);
        }

        if ($spRange) {
            $query->whereBetween('date', $spRange);
            $cleanSp = str_replace(' ', '_', $spPeriod);
            $filterLabel = "SP_{$cleanSp}";
        } elseif ($date && !$month) {
            $query->where('date', $date);
            $filterLabel = "tanggal_{$date}";
        } elseif ($month) {
            $query->where('date', 'like', "{$month}%");
            $filterLabel = "bulan_{$month}";
        } else {
            $filterLabel = "semua";
        }

        if ($status && $status !== 'all') {
            if ($status === 'late') {
                $query->where('check_in_status', 'late')->whereNotIn('attendance_type', ['libur', 'dinas_luar', 'sakit', 'izin']);
            } elseif ($status === 'on_time') {
                $query->where('check_in_status', 'on_time')->whereNotIn('attendance_type', ['libur', 'dinas_luar', 'sakit', 'izin']);
            } elseif ($status === 'holiday' || $status === 'libur') {
                $query->where(function ($q) {
                    $q->where('attendance_type', 'libur')->orWhere('status', 'holiday');
                });
            } elseif ($status === 'dinas_luar' || $status === 'business_trip') {
                $query->where('attendance_type', 'dinas_luar');
            } elseif ($status === 'sakit') {
                $query->where('attendance_type', 'sakit');
            } elseif ($status === 'izin') {
                $query->where('attendance_type', 'izin');
            } elseif ($status === 'pending_verification' || $status === 'pending') {
                $query->where('approval_status', 'pending');
            } else {
                $query->where('status', $status);
            }
            $filterLabel .= "_{$status}";
        }

        if ($search) {
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('nik', 'like', "%{$search}%")
                    ->orWhere('school_unit', 'like', "%{$search}%");
            });
        }

        $attendances = $query->orderBy('date', 'desc')->orderBy('check_in_time', 'desc')->get();
        $suffixSelected = !empty($selectedUserIds) ? '_terpilih' : '';
        $filename = "rekap_absensi_detail_{$filterLabel}{$suffixSelected}";

        if ($format === 'csv') {
            $headers = [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => "attachment; filename=\"{$filename}.csv\"",
                'Pragma' => 'no-cache',
                'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
                'Expires' => '0',
            ];

            return response()->stream(function () use ($attendances) {
                $handle = fopen('php://output', 'w');
                fputs($handle, "\xEF\xBB\xBF"); // UTF-8 BOM

                fputcsv($handle, [
                    'No',
                    'Tanggal',
                    'NIK',
                    'Nama Karyawan',
                    'Perusahaan',
                    'Jabatan',
                    'Unit Sekolah',
                    'Jenis Absen',
                    'Titik Lokasi / Unit',
                    'Jam Masuk',
                    'Jarak Masuk (Meter)',
                    'Status Masuk',
                    'Jam Pulang',
                    'Jarak Pulang (Meter)',
                    'Durasi Kerja',
                    'Target Jam Kerja',
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

                    $targetHours = ($row->shift && $row->shift->work_hours > 0)
                        ? (float) $row->shift->work_hours
                        : ($row->user && $row->user->shift ? (float) $row->user->shift->work_hours : 8.0);
                    $targetHoursStr = (floor($targetHours) == $targetHours) ? (int) $targetHours : $targetHours;
                    $targetText = $row->is_eight_hours_met === true
                        ? "Terpenuhi ({$targetHoursStr} Jam)"
                        : ($row->is_eight_hours_met === false ? "Kurang (< {$targetHoursStr} Jam)" : '-');

                    fputcsv($handle, [
                        $no++,
                        $row->date ? Carbon::parse($row->date)->format('Y-m-d') : '-',
                        $row->user->nik ?? '-',
                        $row->user->name ?? '-',
                        strtoupper($row->user->company ?? '-'),
                        $row->user->position ?? '-',
                        $row->user->school_unit ?? '-',
                        $jenisAbsen,
                        $lokasi,
                        $row->check_in_time ? substr($row->check_in_time, 0, 5) : '-',
                        $row->check_in_distance_meters !== null ? $row->check_in_distance_meters . ' m' : '-',
                        $row->attendance_type === 'libur' ? 'Libur' : ($row->attendance_type === 'dinas_luar' ? 'Dinas Luar' : ($row->check_in_status === 'late' ? 'Terlambat' : 'Tepat Waktu')),
                        $row->check_out_time ? substr($row->check_out_time, 0, 5) : '-',
                        $row->check_out_distance_meters !== null ? $row->check_out_distance_meters . ' m' : '-',
                        $row->work_duration_formatted ?? '-',
                        $targetText,
                        $statusKehadiran,
                        $row->photo_full_url ?: ($row->photo_url ?: '-'),
                        $row->notes ?? '-',
                    ]);
                }

                fclose($handle);
            }, 200, $headers);
        }

        // Export XLSX untuk Mode Detail Log
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Detail Log Absensi');

        $headings = [
            'No',
            'Tanggal',
            'NIK',
            'Nama Karyawan',
            'Perusahaan',
            'Jabatan',
            'Unit Sekolah',
            'Jenis Absen',
            'Titik Lokasi / Unit',
            'Jam Masuk',
            'Jarak Masuk (Meter)',
            'Status Masuk',
            'Jam Pulang',
            'Jarak Pulang (Meter)',
            'Durasi Kerja',
            'Target Jam Kerja',
            'Status Kehadiran',
            'Foto Bukti',
            'Catatan',
        ];
        $sheet->fromArray([$headings], null, 'A1');

        $excelRows = [];
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

            $targetHours = ($row->shift && $row->shift->work_hours > 0)
                ? (float) $row->shift->work_hours
                : ($row->user && $row->user->shift ? (float) $row->user->shift->work_hours : 8.0);
            $targetHoursStr = (floor($targetHours) == $targetHours) ? (int) $targetHours : $targetHours;
            $targetText = $row->is_eight_hours_met === true
                ? "Terpenuhi ({$targetHoursStr} Jam)"
                : ($row->is_eight_hours_met === false ? "Kurang (< {$targetHoursStr} Jam)" : '-');

            $excelRows[] = [
                $no++,
                $row->date ? Carbon::parse($row->date)->format('Y-m-d') : '-',
                $row->user->nik ? (string) $row->user->nik : '-',
                $row->user->name ?? '-',
                strtoupper($row->user->company ?? '-'),
                $row->user->position ?? '-',
                $row->user->school_unit ?? '-',
                $jenisAbsen,
                $lokasi,
                $row->check_in_time ? substr($row->check_in_time, 0, 5) : '-',
                $row->check_in_distance_meters !== null ? $row->check_in_distance_meters . ' m' : '-',
                $row->attendance_type === 'libur' ? 'Libur' : ($row->attendance_type === 'dinas_luar' ? 'Dinas Luar' : ($row->check_in_status === 'late' ? 'Terlambat' : 'Tepat Waktu')),
                $row->check_out_time ? substr($row->check_out_time, 0, 5) : '-',
                $row->check_out_distance_meters !== null ? $row->check_out_distance_meters . ' m' : '-',
                $row->work_duration_formatted ?? '-',
                $targetText,
                $statusKehadiran,
                $row->photo_full_url ?: ($row->photo_url ?: '-'),
                $row->notes ?? '-',
            ];
        }

        if (!empty($excelRows)) {
            $sheet->fromArray($excelRows, null, 'A2');
        }

        // Header Styling
        $sheet->getStyle('A1:S1')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF'], 'size' => 11],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '004AC6'],
            ],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(28);

        $lastRow = count($excelRows) + 1;

        // Borders & Alignments
        $sheet->getStyle("A1:S{$lastRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("A2:C{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("E2:E{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("H2:H{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("J2:Q{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $sheet->freezePane('A2');

        foreach (range('A', 'S') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $headers = [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$filename}.xlsx\"",
            'Cache-Control' => 'max-age=0',
        ];

        return response()->stream(function () use ($spreadsheet) {
            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
        }, 200, $headers);
    }
}
