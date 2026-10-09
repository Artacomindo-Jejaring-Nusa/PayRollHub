<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PayrollResource;
use App\Http\Resources\UserResource;
use App\Models\Announcement;
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

        // 1. Latest Payroll
        $latestPayroll = null;
        if ($user->nik) {
            $latestPayroll = Payroll::where('nik', $user->nik)->latest('period')->first();
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

        // 4. Total Payroll periods
        $totalPayrolls = $user->nik ? Payroll::where('nik', $user->nik)->count() : 0;

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

        $payrolls = Payroll::where('nik', $user->nik)
            ->latest('period')
            ->get();

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

        $payroll = Payroll::where('id', $id)
            ->where('nik', $user->nik)
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

        $payroll = Payroll::where('id', $id)
            ->where('nik', $user->nik)
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
        $latestPayroll = $user->nik ? Payroll::where('nik', $user->nik)->latest('period')->first() : null;

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
            'phone' => ['nullable', 'string', 'max:30'],
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

        $user->phone = $validated['phone'] ?? $user->phone;
        $user->bank_name = $validated['bank_name'] ?? $user->bank_name;
        $user->bank_account = $validated['bank_account'] ?? $user->bank_account;
        $user->address = $validated['address'] ?? $user->address;
        $user->save();

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
