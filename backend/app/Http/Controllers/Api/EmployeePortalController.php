<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PayrollResource;
use App\Http\Resources\UserResource;
use App\Models\Announcement;
use App\Models\Complaint;
use App\Models\Payroll;
use App\Models\WorkReport;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class EmployeePortalController extends Controller
{
    /**
     * Get employee dashboard overview summary.
     */
    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();

        // 1. Latest Payroll strictly scoped to employee's company
        $latestPayroll = null;
        if ($user->nik) {
            $cleanNik = trim(ltrim((string) $user->nik, "'"));
            $latestPayroll = Payroll::where(function ($q) use ($cleanNik) {
                    $q->where('nik', $cleanNik)
                      ->orWhere('nik', "'{$cleanNik}");
                })
                ->where('company', $user->company ?: 'rbs')
                ->where('is_visible_to_user', true)
                ->latest('period')
                ->first();
        }

        // 2. Announcements
        $announcements = Announcement::forCompany($user->company ?? 'all')
            ->orderByDesc('is_pinned')
            ->latest('published_at')
            ->take(5)
            ->get();

        // 3. Work Reports stats
        $totalReports = WorkReport::where('user_id', $user->id)->count();
        $pendingReports = WorkReport::where('user_id', $user->id)->where('status', 'pending')->count();
        $approvedReports = WorkReport::where('user_id', $user->id)->where('status', 'approved')->count();

        // 4. Total Payroll periods strictly scoped
        $totalPayrolls = 0;
        if ($user->nik) {
            $cleanNik = trim(ltrim((string) $user->nik, "'"));
            $totalPayrolls = Payroll::where(function ($q) use ($cleanNik) {
                    $q->where('nik', $cleanNik)
                      ->orWhere('nik', "'{$cleanNik}");
                })
                ->where('company', $user->company ?: 'rbs')
                ->where('is_visible_to_user', true)
                ->count();
        }

        // 5. Complaints stats for current employee
        $totalComplaints = Complaint::where('user_id', $user->id)->count();
        $pendingComplaints = Complaint::where('user_id', $user->id)->where('status', 'pending')->count();
        $inProgressComplaints = Complaint::where('user_id', $user->id)->where('status', 'in_progress')->count();
        $resolvedComplaints = Complaint::where('user_id', $user->id)->where('status', 'resolved')->count();
        $recentComplaints = Complaint::where('user_id', $user->id)
            ->latest()
            ->take(5)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'user' => new UserResource($user),
                'latest_payroll' => $latestPayroll ? new PayrollResource($latestPayroll) : null,
                'total_payrolls' => $totalPayrolls,
                'work_reports_summary' => [
                    'total' => $totalReports,
                    'pending' => $pendingReports,
                    'approved' => $approvedReports,
                ],
                'recent_announcements' => $announcements,
                'complaints_summary' => [
                    'total' => $totalComplaints,
                    'pending' => $pendingComplaints,
                    'in_progress' => $inProgressComplaints,
                    'resolved' => $resolvedComplaints,
                ],
                'recent_complaints' => $recentComplaints,
            ],
        ]);
    }

    /**
     * List all payroll history for current employee.
     */
    public function payrolls(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->nik) {
            return response()->json([
                'status' => 'success',
                'data' => [],
                'message' => 'NIK belum terhubung dengan akun ini.',
            ]);
        }

        $cleanNik = trim(ltrim((string) $user->nik, "'"));
        $query = Payroll::where(function ($q) use ($cleanNik) {
                $q->where('nik', $cleanNik)
                  ->orWhere('nik', "'{$cleanNik}");
            })
            ->where('company', $user->company ?: 'rbs')
            ->where('is_visible_to_user', true);

        if ($request->filled('period') && $request->input('period') !== 'all') {
            $query->byPeriod($request->input('period'));
        }

        if ($request->filled('start_period') || $request->filled('end_period')) {
            $query->byPeriodRange($request->input('start_period'), $request->input('end_period'));
        }

        $payrolls = $query->latest('period')->get();

        return response()->json([
            'status' => 'success',
            'data' => PayrollResource::collection($payrolls),
        ]);
    }

    /**
     * Show single payroll detail for current employee.
     */
    public function showPayroll(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $cleanNik = trim(ltrim((string) $user->nik, "'"));

        $payroll = Payroll::where('id', $id)
            ->where(function ($q) use ($cleanNik) {
                $q->where('nik', $cleanNik)
                  ->orWhere('nik', "'{$cleanNik}");
            })
            ->where('company', $user->company ?: 'rbs')
            ->where('is_visible_to_user', true)
            ->first();

        if (!$payroll) {
            return response()->json([
                'status' => 'error',
                'message' => 'Slip gaji tidak ditemukan atau Anda tidak memiliki akses.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => new PayrollResource($payroll),
        ]);
    }

    /**
     * Download PDF slip gaji for current employee.
     */
    public function downloadSlipPdf(Request $request, int $id)
    {
        $user = $request->user();
        $cleanNik = trim(ltrim((string) $user->nik, "'"));

        $payroll = Payroll::where('id', $id)
            ->where(function ($q) use ($cleanNik) {
                $q->where('nik', $cleanNik)
                  ->orWhere('nik', "'{$cleanNik}");
            })
            ->where('company', $user->company ?: 'rbs')
            ->where('is_visible_to_user', true)
            ->first();

        if (!$payroll) {
            return response()->json([
                'status' => 'error',
                'message' => 'Slip gaji tidak ditemukan.',
            ], 404);
        }

        $pdf = Pdf::loadView('pdf.payroll_slip', [
            'payroll' => $payroll,
        ]);

        $fileName = 'Slip_Gaji_' . Str::slug($payroll->employee_name) . '_' . $payroll->period . '.pdf';

        return $pdf->download($fileName);
    }

    /**
     * Get employee profile info.
     */
    public function profile(Request $request): JsonResponse
    {
        $user = $request->user();
        $latestPayroll = null;
        if ($user->nik) {
            $cleanNik = trim(ltrim((string) $user->nik, "'"));
            $latestPayroll = Payroll::where(function ($q) use ($cleanNik) {
                    $q->where('nik', $cleanNik)
                      ->orWhere('nik', "'{$cleanNik}");
                })
                ->latest('period')
                ->first();
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'user' => new UserResource($user),
                'job_details' => $latestPayroll ? [
                    'position' => $latestPayroll->position,
                    'school_unit' => $latestPayroll->school_unit,
                    'province' => $latestPayroll->province,
                    'status' => $latestPayroll->status,
                    'join_date' => $latestPayroll->join_date,
                    'company' => $latestPayroll->company,
                ] : null,
            ],
        ]);
    }

    /**
     * Update employee personal profile.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'nik' => ['nullable', 'string', 'max:50', 'unique:users,nik,' . $user->id],
            'phone' => ['nullable', 'string', 'max:50'],
            'birth_date' => ['nullable', 'string', 'max:50'],
            'gender' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'string', 'email', 'max:150', 'unique:users,email,' . $user->id],
            'bank_name' => ['nullable', 'string', 'max:100'],
            'bank_account' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:500'],
            'current_password' => ['nullable', 'string'],
            'new_password' => ['nullable', 'string', 'min:6'],
        ]);

        // If changing password, verify current password
        if (!empty($validated['new_password'])) {
            if (empty($validated['current_password']) || !Hash::check($validated['current_password'], $user->password)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Kata sandi saat ini tidak cocok.',
                ], 422);
            }
            $user->password = Hash::make($validated['new_password']);
        }

        if (array_key_exists('nik', $validated)) {
            $cleanedNik = trim((string) $validated['nik']);
            $user->nik = $cleanedNik !== '' ? $cleanedNik : null;
        }

        if (array_key_exists('phone', $validated)) {
            $user->phone = $validated['phone'];
        }
        if (array_key_exists('birth_date', $validated)) {
            $user->birth_date = $validated['birth_date'];
        }
        if (array_key_exists('gender', $validated)) {
            $user->gender = $validated['gender'];
        }
        if (!empty($validated['email'])) {
            $user->email = $validated['email'];
        }
        if (array_key_exists('bank_name', $validated)) {
            $user->bank_name = $validated['bank_name'];
        }
        if (array_key_exists('bank_account', $validated)) {
            $user->bank_account = $validated['bank_account'];
        }
        if (array_key_exists('address', $validated)) {
            $user->address = $validated['address'];
        }
        $user->save();

        // Also update latest payroll record if relevant so slip gaji matches updated info
        if (!empty($user->nik)) {
            Payroll::where('nik', $user->nik)
                ->latest('period')
                ->first()
                ?->update(array_filter([
                    'bank_name' => $user->bank_name,
                    'bank_account' => $user->bank_account,
                    'birth_date' => $user->birth_date,
                    'gender' => $user->gender,
                    'whatsapp' => $user->phone,
                ], fn($v) => !is_null($v)));
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Profil berhasil diperbarui.',
            'data' => new UserResource($user),
        ]);
    }

    /**
     * List work reports submitted by this employee.
     */
    public function workReports(Request $request): JsonResponse
    {
        $user = $request->user();

        $reports = WorkReport::where('user_id', $user->id)
            ->with('reviewer:id,name')
            ->latest('report_date')
            ->paginate(15);

        return response()->json([
            'status' => 'success',
            'data' => $reports->items(),
            'meta' => [
                'current_page' => $reports->currentPage(),
                'last_page' => $reports->lastPage(),
                'total' => $reports->total(),
            ],
        ]);
    }

    /**
     * Submit a new work report with 4 standardized activities (Absen, Kegiatan 1, Kegiatan 2, Kegiatan Lain).
     */
    public function storeWorkReport(Request $request): JsonResponse
    {
        $user = $request->user();

        // Check if 4-column format or legacy format
        if ($request->has('desc_absen') || $request->hasFile('photo_absen')) {
            $validated = $request->validate([
                'report_date' => ['required', 'date'],
                'photo_absen' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
                'desc_absen' => ['required', 'string', 'max:1500'],
                'photo_kegiatan1' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
                'desc_kegiatan1' => ['required', 'string', 'max:1500'],
                'photo_kegiatan2' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
                'desc_kegiatan2' => ['required', 'string', 'max:1500'],
                'photo_kegiatan_lain' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
                'desc_kegiatan_lain' => ['nullable', 'string', 'max:1500'],
            ], [
                'photo_absen.required' => 'Foto absen masuk wajib dilampirkan.',
                'desc_absen.required' => 'Rincian laporan absen masuk wajib diisi.',
                'photo_kegiatan1.required' => 'Foto bukti Kegiatan 1 wajib dilampirkan.',
                'desc_kegiatan1.required' => 'Rincian laporan Kegiatan 1 wajib diisi.',
                'photo_kegiatan2.required' => 'Foto bukti Kegiatan 2 wajib dilampirkan.',
                'desc_kegiatan2.required' => 'Rincian laporan Kegiatan 2 wajib diisi.',
            ]);

            $photoAbsen = $request->file('photo_absen')->store('work_reports', 'public');
            $photoKegiatan1 = $request->file('photo_kegiatan1')->store('work_reports', 'public');
            $photoKegiatan2 = $request->file('photo_kegiatan2')->store('work_reports', 'public');
            $photoKegiatanLain = $request->hasFile('photo_kegiatan_lain')
                ? $request->file('photo_kegiatan_lain')->store('work_reports', 'public')
                : null;

            $combinedDesc = "1. Absen Masuk: {$validated['desc_absen']}\n"
                . "2. Kegiatan 1: {$validated['desc_kegiatan1']}\n"
                . "3. Kegiatan 2: {$validated['desc_kegiatan2']}"
                . (!empty($validated['desc_kegiatan_lain']) ? "\n4. Kegiatan Lain: {$validated['desc_kegiatan_lain']}" : '');

            $report = WorkReport::create([
                'user_id' => $user->id,
                'nik' => $user->nik ?? 'TBA',
                'report_date' => $validated['report_date'],
                'title' => 'Laporan Harian (' . $validated['report_date'] . ')',
                'description' => $combinedDesc,
                'attachment_path' => $photoAbsen,
                'photo_absen' => $photoAbsen,
                'desc_absen' => $validated['desc_absen'],
                'photo_kegiatan1' => $photoKegiatan1,
                'desc_kegiatan1' => $validated['desc_kegiatan1'],
                'photo_kegiatan2' => $photoKegiatan2,
                'desc_kegiatan2' => $validated['desc_kegiatan2'],
                'photo_kegiatan_lain' => $photoKegiatanLain,
                'desc_kegiatan_lain' => $validated['desc_kegiatan_lain'] ?? null,
                'status' => 'pending',
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Laporan kerja harian berhasil dikirim.',
                'data' => $report,
            ], 201);
        }

        // Legacy fallback
        $validated = $request->validate([
            'report_date' => ['required', 'date'],
            'title' => ['required', 'string', 'max:200'],
            'description' => ['required', 'string', 'max:2000'],
            'attachment' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
        ]);

        $attachmentPath = null;
        if ($request->hasFile('attachment')) {
            $attachmentPath = $request->file('attachment')->store('work_reports', 'public');
        }

        $report = WorkReport::create([
            'user_id' => $user->id,
            'nik' => $user->nik ?? 'TBA',
            'report_date' => $validated['report_date'],
            'title' => $validated['title'],
            'description' => $validated['description'],
            'attachment_path' => $attachmentPath,
            'status' => 'pending',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Laporan kerja berhasil dikirim.',
            'data' => $report,
        ], 201);
    }

    /**
     * List announcements relevant to employee's company.
     */
    public function announcements(Request $request): JsonResponse
    {
        $user = $request->user();

        $announcements = Announcement::forCompany($user->company ?? 'all')
            ->with('author:id,name')
            ->orderByDesc('is_pinned')
            ->latest('published_at')
            ->paginate(15);

        return response()->json([
            'status' => 'success',
            'data' => $announcements->items(),
            'meta' => [
                'current_page' => $announcements->currentPage(),
                'last_page' => $announcements->lastPage(),
                'total' => $announcements->total(),
            ],
        ]);
    }
}
