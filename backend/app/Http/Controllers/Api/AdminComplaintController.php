<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Complaint;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminComplaintController extends Controller
{
    /**
     * Display a listing of complaints for Admin & HR.
     */
    public function index(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        $search = $request->input('search');
        $status = $request->input('status');
        $category = $request->input('category');

        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->input('company') && $request->input('company') !== 'all' ? $request->input('company') : null)
            : ($currentUser->company ?: 'rbs');

        $query = Complaint::with(['user:id,name,nik,school_unit,company,email,role', 'resolver:id,name'])
            ->latest();

        if ($targetCompany) {
            $query->where('company', $targetCompany);
        }

        if ($status && in_array($status, ['pending', 'in_progress', 'resolved', 'rejected'])) {
            $query->where('status', $status);
        }

        if ($category && in_array($category, ['gaji', 'absensi', 'fasilitas', 'teknis', 'sistem', 'saran', 'lainnya'])) {
            $query->where('category', $category);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('ticket_number', 'like', "%{$search}%")
                  ->orWhere('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($sub) use ($search) {
                      $sub->where('name', 'like', "%{$search}%")
                          ->orWhere('nik', 'like', "%{$search}%")
                          ->orWhere('school_unit', 'like', "%{$search}%");
                  });
            });
        }

        $complaints = $query->paginate(15);

        return response()->json([
            'status' => 'success',
            'data' => $complaints->items(),
            'meta' => [
                'current_page' => $complaints->currentPage(),
                'last_page' => $complaints->lastPage(),
                'total' => $complaints->total(),
            ],
        ]);
    }

    /**
     * Return summary counts of complaints for badges and dashboard metrics.
     */
    public function summary(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->input('company') && $request->input('company') !== 'all' ? $request->input('company') : null)
            : ($currentUser->company ?: 'rbs');

        $query = Complaint::query();
        if ($targetCompany) {
            $query->where('company', $targetCompany);
        }

        $total = (clone $query)->count();
        $pending = (clone $query)->where('status', 'pending')->count();
        $inProgress = (clone $query)->where('status', 'in_progress')->count();
        $resolved = (clone $query)->where('status', 'resolved')->count();
        $rejected = (clone $query)->where('status', 'rejected')->count();

        return response()->json([
            'status' => 'success',
            'data' => [
                'total' => $total,
                'pending' => $pending,
                'in_progress' => $inProgress,
                'resolved' => $resolved,
                'rejected' => $rejected,
            ],
        ]);
    }

    /**
     * Display the specified complaint details.
     */
    public function show(Request $request, Complaint $complaint): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => $complaint->load(['user:id,name,nik,school_unit,company,email,role', 'resolver:id,name']),
        ]);
    }

    /**
     * Update the complaint status and provide admin response notes.
     */
    public function update(Request $request, Complaint $complaint): JsonResponse
    {
        $currentUser = $request->user();

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:pending,in_progress,resolved,rejected'],
            'admin_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $complaint->update([
            'status' => $validated['status'],
            'admin_notes' => $validated['admin_notes'] ?? $complaint->admin_notes,
            'resolved_by' => $currentUser->id,
            'resolved_at' => now(),
        ]);

        ActivityLog::record(
            action: 'RESPOND_COMPLAINT',
            module: 'complaint',
            description: "Menanggapi keluhan karyawan ({$complaint->ticket_number}): Status diubah menjadi {$complaint->status_label}",
            details: [
                'ticket_number' => $complaint->ticket_number,
                'new_status' => $complaint->status,
                'admin_notes' => $complaint->admin_notes,
            ],
            company: $complaint->company
        );

        // Send Firebase Push Notification & In-App Notification to the employee
        try {
            $fcmService = app(\App\Services\FirebaseNotificationService::class);
            $statusLabel = match ($validated['status']) {
                'resolved' => 'Disetujui / Selesai ✅',
                'rejected' => 'Ditolak ❌',
                'in_progress' => 'Sedang Diproses ⏳',
                'pending' => 'Menunggu Respon 📝',
                default => ucfirst($validated['status']),
            };

            $title = "Pengaduan {$statusLabel}";
            $body = "Pengaduan Anda ({$complaint->ticket_number}) telah diperbarui menjadi {$statusLabel} oleh Admin."
                . (!empty($complaint->admin_notes) ? " Catatan: {$complaint->admin_notes}" : "");

            $fcmService->sendToUser(
                $complaint->user_id,
                $title,
                $body,
                'complaint_' . $validated['status'],
                [
                    'complaint_id' => (string) $complaint->id,
                    'ticket_number' => (string) $complaint->ticket_number,
                    'status' => (string) $validated['status'],
                    'admin_notes' => (string) ($complaint->admin_notes ?? ''),
                    'target_tab' => 'complaints',
                ]
            );
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('[AdminComplaint Notification] Failed to send push: ' . $e->getMessage());
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Status keluhan dan tanggapan berhasil diperbarui.',
            'data' => $complaint->load(['user:id,name,nik,school_unit,company', 'resolver:id,name']),
        ]);
    }

    /**
     * Delete a complaint and its photo evidence.
     */
    public function destroy(Request $request, Complaint $complaint): JsonResponse
    {
        $currentUser = $request->user();

        if (!$currentUser->isSuperAdmin()) {
            $userCompany = $currentUser->company ?: 'rbs';
            if ($complaint->company !== $userCompany) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Akses ditolak. Anda tidak berhak menghapus keluhan perusahaan lain.',
                ], 403);
            }
        }

        if ($complaint->photo_path && Storage::disk('public')->exists($complaint->photo_path)) {
            Storage::disk('public')->delete($complaint->photo_path);
        }

        $complaint->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Keluhan berhasil dihapus.',
        ]);
    }
}
