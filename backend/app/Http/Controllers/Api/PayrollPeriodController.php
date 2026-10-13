<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Payroll;
use App\Models\PayrollPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PayrollPeriodController extends Controller
{
    /**
     * Display a listing of payroll periods / target SP.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $company = $request->input('company') ?: ($user?->company ?: 'all');

        $query = PayrollPeriod::query()
            ->forCompany($company);

        // Karyawan hanya bisa melihat periode yang diizinkan (is_visible_to_user = true)
        if ($user && $user->role === 'karyawan') {
            $query->visibleToUser();
        }

        $periods = $query->orderBy('id', 'asc')->get();

        // Jika dipanggil oleh Admin, sertakan total karyawan terdaftar di periode ini
        if ($user && $user->isAdmin()) {
            $periodsData = $periods->map(function ($period) use ($company) {
                $payrollCountQuery = Payroll::where('period', $period->code);
                if ($company && $company !== 'all') {
                    $payrollCountQuery->where('company', $company);
                }

                $data = $period->toArray();
                $data['employee_count'] = $payrollCountQuery->count();
                return $data;
            });
        } else {
            $periodsData = $periods;
        }

        return response()->json([
            'status' => 'success',
            'data' => $periodsData,
        ]);
    }

    /**
     * Store a newly created period / target SP (Admin only).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50'],
            'name' => ['required', 'string', 'max:150'],
            'company' => ['nullable', 'string', 'in:all,rbs,rimamandiri'],
            'is_sp' => ['nullable', 'boolean'],
            'is_visible_to_user' => ['nullable', 'boolean'],
            'description' => ['nullable', 'string', 'max:500'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
        ]);

        $code = trim($validated['code']);
        $company = $validated['company'] ?? 'all';

        // Check if code already exists for this company
        $exists = PayrollPeriod::where('code', $code)
            ->where(function ($q) use ($company) {
                $q->where('company', 'all')->orWhere('company', $company);
            })
            ->exists();

        if ($exists) {
            return response()->json([
                'status' => 'error',
                'message' => "Target Periode / SP dengan kode '{$code}' sudah ada dalam sistem.",
            ], 422);
        }

        $period = PayrollPeriod::create([
            'code' => $code,
            'name' => trim($validated['name']),
            'company' => $company,
            'is_sp' => $request->boolean('is_sp', false),
            'is_visible_to_user' => $request->boolean('is_visible_to_user', false),
            'description' => $validated['description'] ?? null,
            'start_date' => $validated['start_date'] ?? null,
            'end_date' => $validated['end_date'] ?? null,
        ]);

        ActivityLog::record(
            action: 'CREATE',
            module: 'payroll_period',
            description: "Menambahkan Target SP / Periode baru: {$period->code} ({$period->name}). Visibilitas user: " . ($period->is_visible_to_user ? 'Tampil' : 'Sembunyi'),
            details: $period->toArray(),
            company: $company,
            user: $request->user()
        );

        return response()->json([
            'status' => 'success',
            'message' => "Target Periode '{$period->code}' berhasil ditambahkan.",
            'data' => $period,
        ], 201);
    }

    /**
     * Update an existing period / target SP.
     */
    public function update(Request $request, PayrollPeriod $payrollPeriod): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'company' => ['nullable', 'string', 'in:all,rbs,rimamandiri'],
            'is_sp' => ['nullable', 'boolean'],
            'is_visible_to_user' => ['nullable', 'boolean'],
            'description' => ['nullable', 'string', 'max:500'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'sync_payrolls' => ['nullable', 'boolean'],
        ]);

        $oldVisibility = $payrollPeriod->is_visible_to_user;

        $payrollPeriod->update([
            'name' => isset($validated['name']) ? trim($validated['name']) : $payrollPeriod->name,
            'company' => $validated['company'] ?? $payrollPeriod->company,
            'is_sp' => $request->has('is_sp') ? $request->boolean('is_sp') : $payrollPeriod->is_sp,
            'is_visible_to_user' => $request->has('is_visible_to_user') ? $request->boolean('is_visible_to_user') : $payrollPeriod->is_visible_to_user,
            'description' => $validated['description'] ?? $payrollPeriod->description,
            'start_date' => array_key_exists('start_date', $validated) ? $validated['start_date'] : $payrollPeriod->start_date,
            'end_date' => array_key_exists('end_date', $validated) ? $validated['end_date'] : $payrollPeriod->end_date,
        ]);

        // Jika visibilitas berubah dan diminta sync_payrolls, update seluruh payroll terkait
        if ($request->boolean('sync_payrolls') && $oldVisibility !== $payrollPeriod->is_visible_to_user) {
            Payroll::where('period', $payrollPeriod->code)
                ->update(['is_visible_to_user' => $payrollPeriod->is_visible_to_user]);
        }

        ActivityLog::record(
            action: 'UPDATE',
            module: 'payroll_period',
            description: "Memperbarui Target SP / Periode: {$payrollPeriod->code}. Visibilitas user: " . ($payrollPeriod->is_visible_to_user ? 'Tampil' : 'Sembunyi'),
            details: $payrollPeriod->toArray(),
            company: $payrollPeriod->company,
            user: $request->user()
        );

        return response()->json([
            'status' => 'success',
            'message' => "Target Periode '{$payrollPeriod->code}' berhasil diperbarui.",
            'data' => $payrollPeriod,
        ]);
    }

    /**
     * Delete a custom period (Standard SP 1 - SP 12 protected).
     */
    public function destroy(Request $request, PayrollPeriod $payrollPeriod): JsonResponse
    {
        if (preg_match('/^SP\s*(1[0-2]|[1-9])$/i', $payrollPeriod->code)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Periode standar SP 1 s/d SP 12 adalah master resmi dan tidak dapat dihapus.',
            ], 422);
        }

        $code = $payrollPeriod->code;
        $countPayrolls = Payroll::where('period', $code)->count();

        if ($countPayrolls > 0 && !$request->boolean('force')) {
            return response()->json([
                'status' => 'error',
                'message' => "Periode '{$code}' masih digunakan oleh {$countPayrolls} data karyawan. Hapus atau pindahkan data karyawan terlebih dahulu.",
            ], 422);
        }

        $payrollPeriod->delete();

        ActivityLog::record(
            action: 'DELETE',
            module: 'payroll_period',
            description: "Menghapus Target SP / Periode: {$code}",
            details: ['code' => $code],
            company: $payrollPeriod->company,
            user: $request->user()
        );

        return response()->json([
            'status' => 'success',
            'message' => "Target Periode '{$code}' berhasil dihapus.",
        ]);
    }
}
