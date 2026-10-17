<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shift;
use App\Models\User;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminShiftController extends Controller
{
    /**
     * Daftar seluruh master shift (mendukung isolasi multi-tenant Riama & Rimbun).
     */
    public function index(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : null)
            : ($currentUser->company ?: 'rbs');

        $query = Shift::withCount('users');

        if ($targetCompany) {
            $query->where(function ($q) use ($targetCompany) {
                $q->where('company', 'all')
                  ->orWhere('company', $targetCompany);
            });
        }

        $shifts = $query->orderBy('start_time', 'asc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $shifts,
        ]);
    }

    /**
     * Tambah Master Shift Baru.
     */
    public function store(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser->isAdmin() && !$currentUser->isSuperAdmin()) {
            return response()->json(['status' => 'error', 'message' => 'Hanya Admin yang berhak mengelola shift.'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'code' => 'required|string|max:50|unique:shifts,code',
            'company' => ['required', Rule::in(['all', 'rbs', 'rimamandiri'])],
            'start_time' => 'required|string',
            'end_time' => 'required|string',
            'late_tolerance_minutes' => 'nullable|integer|min:0|max:120',
            'work_hours' => 'nullable|numeric|min:1|max:24',
            'cross_day' => 'nullable|boolean',
            'description' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
        ]);

        // Standarisasi format waktu HH:MM:SS
        $validated['start_time'] = strlen($validated['start_time']) === 5 ? $validated['start_time'] . ':00' : $validated['start_time'];
        $validated['end_time'] = strlen($validated['end_time']) === 5 ? $validated['end_time'] . ':00' : $validated['end_time'];
        $validated['late_tolerance_minutes'] = $validated['late_tolerance_minutes'] ?? 15;
        $validated['work_hours'] = $validated['work_hours'] ?? 8.00;
        $validated['cross_day'] = (bool) ($validated['cross_day'] ?? false);
        $validated['is_active'] = isset($validated['is_active']) ? (bool) $validated['is_active'] : true;

        $shift = Shift::create($validated);

        ActivityLog::record(
            action: 'CREATE_SHIFT',
            module: 'shift',
            description: "Menambahkan master shift baru: {$shift->name} ({$shift->formatted_time}) untuk entitas {$shift->company}",
            details: ['shift_id' => $shift->id, 'code' => $shift->code, 'start_time' => $shift->start_time, 'end_time' => $shift->end_time],
            company: $shift->company,
            user: $currentUser
        );

        return response()->json([
            'status' => 'success',
            'message' => "Master Shift '{$shift->name}' berhasil ditambahkan.",
            'data' => $shift->loadCount('users'),
        ], 201);
    }

    /**
     * Perbarui Master Shift.
     */
    public function update(Request $request, Shift $shift): JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser->isAdmin() && !$currentUser->isSuperAdmin()) {
            return response()->json(['status' => 'error', 'message' => 'Hanya Admin yang berhak mengelola shift.'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'code' => ['required', 'string', 'max:50', Rule::unique('shifts', 'code')->ignore($shift->id)],
            'company' => ['required', Rule::in(['all', 'rbs', 'rimamandiri'])],
            'start_time' => 'required|string',
            'end_time' => 'required|string',
            'late_tolerance_minutes' => 'nullable|integer|min:0|max:120',
            'work_hours' => 'nullable|numeric|min:1|max:24',
            'cross_day' => 'nullable|boolean',
            'description' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
        ]);

        $validated['start_time'] = strlen($validated['start_time']) === 5 ? $validated['start_time'] . ':00' : $validated['start_time'];
        $validated['end_time'] = strlen($validated['end_time']) === 5 ? $validated['end_time'] . ':00' : $validated['end_time'];

        $shift->update($validated);

        ActivityLog::record(
            action: 'UPDATE_SHIFT',
            module: 'shift',
            description: "Memperbarui master shift: {$shift->name} ({$shift->formatted_time})",
            details: ['shift_id' => $shift->id, 'code' => $shift->code, 'start_time' => $shift->start_time, 'end_time' => $shift->end_time],
            company: $shift->company,
            user: $currentUser
        );

        return response()->json([
            'status' => 'success',
            'message' => "Master Shift '{$shift->name}' berhasil diperbarui.",
            'data' => $shift->loadCount('users'),
        ]);
    }

    /**
     * Hapus / Nonaktifkan Master Shift.
     */
    public function destroy(Request $request, Shift $shift): JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser->isAdmin() && !$currentUser->isSuperAdmin()) {
            return response()->json(['status' => 'error', 'message' => 'Hanya Admin yang berhak mengelola shift.'], 403);
        }

        // Cek apakah shift sedang digunakan di data absensi historis
        $attendanceCount = $shift->attendances()->count();
        if ($attendanceCount > 0) {
            // Jika ada relasi historis, nonaktifkan saja agar integritas audit tidak rusak
            $shift->update(['is_active' => false]);
            $message = "Shift '{$shift->name}' memiliki {$attendanceCount} data absensi tercatat, status shift dialihkan menjadi Nonaktif.";
        } else {
            // Lepaskan user yang ter-assign ke shift ini
            User::where('shift_id', $shift->id)->update(['shift_id' => null]);
            $shift->delete();
            $message = "Shift '{$shift->name}' berhasil dihapus.";
        }

        ActivityLog::record(
            action: 'DELETE_SHIFT',
            module: 'shift',
            description: "Menghapus / menonaktifkan shift: {$shift->name}",
            details: ['shift_id' => $shift->id, 'name' => $shift->name],
            company: $shift->company,
            user: $currentUser
        );

        return response()->json([
            'status' => 'success',
            'message' => $message,
        ]);
    }

    /**
     * Penugasan Shift ke Karyawan (Mendukung Satuan, Bulk Array, atau Berdasarkan Unit Sekolah).
     */
    public function assign(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser->isAdmin() && !$currentUser->isSuperAdmin()) {
            return response()->json(['status' => 'error', 'message' => 'Hanya Admin yang berhak menetapkan shift.'], 403);
        }

        $validated = $request->validate([
            'shift_id' => 'required|exists:shifts,id',
            'user_ids' => 'nullable|array',
            'user_ids.*' => 'integer|exists:users,id',
            'school_unit' => 'nullable|string|max:150',
            'company' => 'nullable|string|max:50',
        ]);

        $shift = Shift::findOrFail($validated['shift_id']);
        $query = User::whereNotIn('role', ['admin', 'super_admin']);

        // Multi-tenant check
        if (!$currentUser->isSuperAdmin()) {
            $query->where('company', $currentUser->company ?: 'rbs');
        } elseif (!empty($validated['company']) && $validated['company'] !== 'all') {
            $query->where('company', $validated['company']);
        }

        if (!empty($validated['user_ids'])) {
            $query->whereIn('id', $validated['user_ids']);
        } elseif (!empty($validated['school_unit'])) {
            $query->where('school_unit', $validated['school_unit']);
        } else {
            return response()->json([
                'status' => 'error',
                'message' => 'Pilih karyawan spesifik (user_ids) atau pilih unit sekolah untuk menetapkan shift.',
            ], 422);
        }

        $updatedCount = $query->update(['shift_id' => $shift->id]);

        ActivityLog::record(
            action: 'ASSIGN_SHIFT',
            module: 'shift',
            description: "Menetapkan shift '{$shift->name}' ke {$updatedCount} karyawan.",
            details: ['shift_id' => $shift->id, 'updated_count' => $updatedCount],
            company: $shift->company,
            user: $currentUser
        );

        return response()->json([
            'status' => 'success',
            'message' => "Berhasil menetapkan {$shift->name} ke {$updatedCount} karyawan.",
            'updated_count' => $updatedCount,
        ]);
    }

    /**
     * Daftar Karyawan beserta Shift Aktifnya (dengan filter unit, nama, NIK, shift_id).
     */
    public function employees(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : null)
            : ($currentUser->company ?: 'rbs');

        $query = User::whereNotIn('role', ['admin', 'super_admin'])
            ->with(['shift', 'attendanceLocation']);

        if ($targetCompany) {
            $query->where('company', $targetCompany);
        }

        if ($request->query('shift_id')) {
            if ($request->query('shift_id') === 'none') {
                $query->whereNull('shift_id');
            } else {
                $query->where('shift_id', $request->query('shift_id'));
            }
        }

        if ($request->query('school_unit')) {
            $query->where('school_unit', $request->query('school_unit'));
        }

        if ($request->query('search')) {
            $s = $request->query('search');
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('nik', 'like', "%{$s}%")
                  ->orWhere('school_unit', 'like', "%{$s}%");
            });
        }

        $employees = $query->orderBy('name', 'asc')->paginate($request->query('per_page', 25));

        return response()->json([
            'status' => 'success',
            'data' => $employees,
        ]);
    }
}
