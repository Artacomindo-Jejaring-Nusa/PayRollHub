<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Payroll;
use App\Models\ProvincePayrollSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProvincePayrollSettingController extends Controller
{
    /**
     * Dapatkan daftar aturan perhitungan gaji per provinsi.
     */
    public function index(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        $company = $currentUser->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : 'all')
            : ($currentUser->company ?: 'rbs');

        $settings = ProvincePayrollSetting::where(function ($q) use ($company) {
            $q->where('company', $company)->orWhere('company', 'all');
        })
        ->orderBy('province', 'asc')
        ->get();

        return response()->json([
            'status' => 'success',
            'data' => $settings,
        ]);
    }

    /**
     * Simpan atau perbarui aturan perhitungan provinsi.
     */
    public function update(Request $request, string $province): JsonResponse
    {
        $currentUser = $request->user();
        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->input('company') && $request->input('company') !== 'all' ? $request->input('company') : 'all')
            : ($currentUser->company ?: 'rbs');

        $validated = $request->validate([
            'ump' => 'required|numeric|min:0',
            'bpjs_kes' => 'required|numeric|min:0',
            'bpjs_tk_jht' => 'required|numeric|min:0',
            'bpjs_tk_jp' => 'required|numeric|min:0',
            'notes' => 'nullable|string|max:500',
            'apply_to_employees' => 'nullable|boolean',
        ]);

        $bpjsTk = (float) $validated['bpjs_tk_jht'] + (float) $validated['bpjs_tk_jp'];

        $setting = ProvincePayrollSetting::updateOrCreate(
            [
                'province' => $province,
                'company' => $targetCompany,
            ],
            [
                'ump' => $validated['ump'],
                'bpjs_kes' => $validated['bpjs_kes'],
                'bpjs_tk_jht' => $validated['bpjs_tk_jht'],
                'bpjs_tk_jp' => $validated['bpjs_tk_jp'],
                'bpjs_tk' => $bpjsTk,
                'notes' => $validated['notes'] ?? null,
            ]
        );

        $affectedCount = 0;
        if (!empty($validated['apply_to_employees'])) {
            $affectedCount = $this->applySettingToEmployeesInternal($setting, $currentUser->isSuperAdmin() ? null : $currentUser->company);
        }

        ActivityLog::record(
            action: 'UPDATE_PROVINCE_SETTING',
            module: 'payroll',
            description: "Admin memperbarui pengaturan gaji provinsi {$province} (UMP: Rp " . number_format($validated['ump'], 0, ',', '.') . ", BPJS Kes: Rp " . number_format($validated['bpjs_kes'], 0, ',', '.') . ", BPJS TK: Rp " . number_format($bpjsTk, 0, ',', '.') . ")" . ($affectedCount > 0 ? " dan menerapkan ke {$affectedCount} karyawan" : ""),
            details: array_merge($validated, ['affected_employees' => $affectedCount]),
            company: $targetCompany
        );

        return response()->json([
            'status' => 'success',
            'message' => "Pengaturan perhitungan gaji provinsi {$province} berhasil disimpan." . ($affectedCount > 0 ? " ({$affectedCount} karyawan disinkronkan otomatis)" : ""),
            'data' => $setting,
            'affected_employees' => $affectedCount,
        ]);
    }

    /**
     * Terapkan nilai perhitungan provinsi ke seluruh karyawan aktif di provinsi ini.
     */
    public function applyToEmployees(Request $request, string $province): JsonResponse
    {
        $currentUser = $request->user();
        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : null)
            : ($currentUser->company ?: 'rbs');

        $setting = ProvincePayrollSetting::where('province', $province)
            ->whereIn('company', array_filter(['all', $targetCompany]))
            ->first();

        if (!$setting) {
            return response()->json([
                'status' => 'error',
                'message' => "Belum ada konfigurasi perhitungan gaji untuk provinsi {$province}.",
            ], 404);
        }

        $affectedCount = $this->applySettingToEmployeesInternal($setting, $targetCompany);

        ActivityLog::record(
            action: 'APPLY_PROVINCE_SETTING',
            module: 'payroll',
            description: "Admin menerapkan perhitungan provinsi {$province} ke {$affectedCount} data karyawan",
            details: ['province' => $province, 'affected_count' => $affectedCount],
            company: $targetCompany
        );

        return response()->json([
            'status' => 'success',
            'message' => "Perhitungan gaji provinsi {$province} berhasil disinkronkan ke {$affectedCount} karyawan.",
            'affected_employees' => $affectedCount,
        ]);
    }

    /**
     * Helper internal untuk mengupdate seluruh data karyawan di provinsi tertentu.
     */
    protected function applySettingToEmployeesInternal(ProvincePayrollSetting $setting, ?string $company): int
    {
        $query = Payroll::where('province', $setting->province);
        if ($company && $company !== 'all') {
            $query->where('company', $company);
        }

        $payrolls = $query->get();
        $count = 0;

        foreach ($payrolls as $payroll) {
            $payroll->bpjs_kes = $setting->bpjs_kes;
            $payroll->bpjs_tk_jht = $setting->bpjs_tk_jht;
            $payroll->bpjs_tk_jp = $setting->bpjs_tk_jp;
            $payroll->bpjs_tk = $setting->bpjs_tk;

            // Recalculate THP: Total Earnings - Total Deductions (BPJS TK bukan pengurang)
            $totalEarnings = (float) $payroll->basic_salary + (float) $payroll->bpjs_kes + (float) $payroll->allowance;
            $totalDeductions = (float) $payroll->absence_deduction + (float) $payroll->deduction + (float) $payroll->pph21;
            $payroll->take_home_pay = max(0, $totalEarnings - $totalDeductions);

            $payroll->save();
            $count++;
        }

        return $count;
    }
}
