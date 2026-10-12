<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\EmployeeReplacement;
use App\Models\Payroll;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeReplacementController extends Controller
{
    /**
     * Dapatkan daftar rekam jejak pergantian karyawan.
     */
    public function index(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : null)
            : ($currentUser->company ?: 'rbs');

        $search = $request->query('search');

        $query = EmployeeReplacement::with(['newPayroll', 'oldPayroll', 'creator:id,name']);

        if ($targetCompany) {
            $query->where('company', $targetCompany);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('new_employee_name', 'like', "%{$search}%")
                    ->orWhere('old_employee_name', 'like', "%{$search}%")
                    ->orWhere('new_nik', 'like', "%{$search}%")
                    ->orWhere('old_nik', 'like', "%{$search}%")
                    ->orWhere('school_unit', 'like', "%{$search}%")
                    ->orWhere('reason', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%");
            });
        }

        $replacements = $query->latest('replacement_date')->paginate($request->query('per_page', 20));

        return response()->json([
            'status' => 'success',
            'data' => $replacements->items(),
            'meta' => [
                'current_page' => $replacements->currentPage(),
                'last_page' => $replacements->lastPage(),
                'total' => $replacements->total(),
            ],
        ]);
    }

    /**
     * Dapatkan daftar karyawan off/keluar untuk dipilih di dropdown penggantian.
     */
    public function offEmployees(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : null)
            : ($currentUser->company ?: 'rbs');

        $search = $request->query('search');

        $query = Payroll::where(function ($q) {
            $q->where('status', 'off')
              ->orWhereNotNull('resign_date')
              ->orWhere('resign_date', '!=', '');
        });

        if ($targetCompany) {
            $query->where('company', $targetCompany);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('employee_name', 'like', "%{$search}%")
                    ->orWhere('nik', 'like', "%{$search}%")
                    ->orWhere('school_unit', 'like', "%{$search}%");
            });
        }

        $offList = $query->select('id', 'employee_name', 'nik', 'school_unit', 'position', 'resign_date', 'company')
            ->orderBy('employee_name', 'asc')
            ->limit(100)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $offList,
        ]);
    }

    /**
     * Catat pergantian karyawan baru menggantikan karyawan off.
     */
    public function store(Request $request): JsonResponse
    {
        $currentUser = $request->user();

        $validated = $request->validate([
            'new_payroll_id' => 'required|exists:payrolls,id',
            'old_payroll_id' => 'nullable|exists:payrolls,id',
            'replacement_date' => 'required|date',
            'reason' => 'nullable|string|max:200',
            'notes' => 'nullable|string|max:500',
        ]);

        $newPayroll = Payroll::findOrFail($validated['new_payroll_id']);
        $oldPayroll = !empty($validated['old_payroll_id']) ? Payroll::find($validated['old_payroll_id']) : null;

        // Validasi hak akses company
        if (!$currentUser->isSuperAdmin() && $currentUser->company && $newPayroll->company !== $currentUser->company) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki akses ke data karyawan perusahaan lain.',
            ], 403);
        }

        $oldName = $oldPayroll ? $oldPayroll->employee_name : ($request->input('old_employee_name') ?: '-');
        $oldNik = $oldPayroll ? $oldPayroll->nik : null;

        // 1. Simpan ke tabel rekam jejak
        $replacement = EmployeeReplacement::create([
            'company' => $newPayroll->company ?: 'rbs',
            'new_payroll_id' => $newPayroll->id,
            'new_employee_name' => $newPayroll->employee_name,
            'new_nik' => $newPayroll->nik,
            'old_payroll_id' => $oldPayroll?->id,
            'old_employee_name' => $oldName,
            'old_nik' => $oldNik,
            'school_unit' => $newPayroll->school_unit ?: $oldPayroll?->school_unit,
            'position' => $newPayroll->position ?: $oldPayroll?->position,
            'replacement_date' => $validated['replacement_date'],
            'reason' => $validated['reason'] ?? 'Menggantikan karyawan keluar',
            'notes' => $validated['notes'] ?? null,
            'created_by' => $currentUser->id,
        ]);

        // 2. Tandai data payroll baru
        $newPayroll->update([
            'replaced_payroll_id' => $oldPayroll?->id,
            'replaced_employee_name' => $oldName,
            'replacement_note' => $validated['notes'] ?: "Menggantikan {$oldName}" . ($oldNik ? " ({$oldNik})" : ""),
            'replacement_date' => $validated['replacement_date'],
        ]);

        // 3. Pastikan data karyawan lama berstatus 'off'
        if ($oldPayroll && $oldPayroll->status !== 'off') {
            $oldPayroll->update([
                'status' => 'off',
                'resign_date' => $oldPayroll->resign_date ?: $validated['replacement_date'],
            ]);
        }

        ActivityLog::record(
            action: 'CREATE_EMPLOYEE_REPLACEMENT',
            module: 'payroll',
            description: "Admin mencatat pergantian karyawan: {$newPayroll->employee_name} ({$newPayroll->nik}) menggantikan {$oldName} pada unit {$newPayroll->school_unit}",
            details: $replacement->toArray(),
            company: $newPayroll->company
        );

        return response()->json([
            'status' => 'success',
            'message' => "Rekam jejak pergantian karyawan berhasil dicatat.",
            'data' => $replacement->load(['newPayroll', 'oldPayroll', 'creator:id,name']),
        ], 201);
    }

    /**
     * Hapus catatan rekam jejak pergantian karyawan.
     */
    public function destroy(Request $request, EmployeeReplacement $replacement): JsonResponse
    {
        $currentUser = $request->user();

        if (!$currentUser->isSuperAdmin() && $currentUser->company && $replacement->company !== $currentUser->company) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki izin menghapus data ini.',
            ], 403);
        }

        // Reset kolom di payroll baru jika masih terhubung
        if ($replacement->newPayroll) {
            $replacement->newPayroll->update([
                'replaced_payroll_id' => null,
                'replaced_employee_name' => null,
                'replacement_note' => null,
                'replacement_date' => null,
            ]);
        }

        $info = "{$replacement->new_employee_name} menggantikan {$replacement->old_employee_name}";
        $replacement->delete();

        ActivityLog::record(
            action: 'DELETE_EMPLOYEE_REPLACEMENT',
            module: 'payroll',
            description: "Admin menghapus catatan rekam jejak pergantian karyawan: {$info}",
            details: ['deleted_id' => $replacement->id],
            company: $replacement->company
        );

        return response()->json([
            'status' => 'success',
            'message' => "Catatan pergantian karyawan berhasil dihapus.",
        ]);
    }
}
