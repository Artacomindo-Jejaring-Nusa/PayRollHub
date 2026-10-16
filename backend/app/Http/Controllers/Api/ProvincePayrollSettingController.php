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

        $query = ProvincePayrollSetting::query();

        if ($company && $company !== 'all') {
            $query->where(function ($q) use ($company) {
                $q->where('company', $company)->orWhere('company', 'all');
            })
            // Dahulukan record spesifik company di atas record default 'all'
            ->orderByRaw("CASE WHEN company = ? THEN 0 ELSE 1 END", [$company]);
        } else {
            $query->orderBy('company', 'asc');
        }

        $query->orderBy('province', 'asc');
        $allSettings = $query->get();

        // Jika company ditentukan (misal 'rbs' atau 'rimamandiri'), deduplikasi agar tiap provinsi hanya muncul 1x
        // Record spesifik company akan dipertahankan dan menimpa record 'all'
        if ($company && $company !== 'all') {
            $settings = $allSettings->unique(function ($item) {
                return strtoupper(trim($item->province));
            })->values();
        } else {
            // Jika 'all', tetap rapikan jika ada duplikat persis company + province
            $settings = $allSettings->unique(function ($item) {
                return ($item->company ?: 'all') . '|' . strtoupper(trim($item->province));
            })->values();
        }

        return response()->json([
            'status' => 'success',
            'data' => $settings,
        ]);
    }

    /**
     * Simpan atau perbarui aturan perhitungan provinsi.
     * $identifier bisa berupa ID numerik (PK) atau nama provinsi.
     */
    public function update(Request $request, string $identifier): JsonResponse
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

        $setting = null;
        if (is_numeric($identifier)) {
            $setting = ProvincePayrollSetting::find($identifier);
            if ($setting) {
                $setting->update([
                    'ump' => $validated['ump'],
                    'bpjs_kes' => $validated['bpjs_kes'],
                    'bpjs_tk_jht' => $validated['bpjs_tk_jht'],
                    'bpjs_tk_jp' => $validated['bpjs_tk_jp'],
                    'bpjs_tk' => $bpjsTk,
                    'notes' => $validated['notes'] ?? null,
                ]);
            }
        }

        if (!$setting) {
            $province = $identifier;
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
        }

        $affectedCount = 0;
        if (!empty($validated['apply_to_employees'])) {
            $affectedCount = $this->applySettingToEmployeesInternal($setting, $currentUser->isSuperAdmin() ? null : $currentUser->company);
        }

        ActivityLog::record(
            action: 'UPDATE_PROVINCE_SETTING',
            module: 'payroll',
            description: "Admin memperbarui pengaturan gaji provinsi {$setting->province} (UMP/GP: Rp " . number_format($validated['ump'], 0, ',', '.') . ", BPJS Kes: Rp " . number_format($validated['bpjs_kes'], 0, ',', '.') . ", BPJS TK: Rp " . number_format($bpjsTk, 0, ',', '.') . ")" . ($affectedCount > 0 ? " dan menerapkan ke {$affectedCount} karyawan" : ""),
            details: array_merge($validated, ['affected_employees' => $affectedCount]),
            company: $targetCompany
        );

        return response()->json([
            'status' => 'success',
            'message' => "Pengaturan perhitungan gaji provinsi {$setting->province} berhasil disimpan." . ($affectedCount > 0 ? " ({$affectedCount} karyawan disinkronkan otomatis)" : ""),
            'data' => $setting,
            'affected_employees' => $affectedCount,
        ]);
    }

    /**
     * Terapkan nilai perhitungan provinsi ke seluruh data karyawan di provinsi ini.
     * $identifier bisa berupa ID numerik (PK) atau nama provinsi.
     */
    public function applyToEmployees(Request $request, string $identifier): JsonResponse
    {
        $currentUser = $request->user();
        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : null)
            : ($currentUser->company ?: 'rbs');

        $setting = null;
        if (is_numeric($identifier)) {
            $setting = ProvincePayrollSetting::find($identifier);
        }

        if (!$setting) {
            $province = $identifier;
            $setting = ProvincePayrollSetting::where(function ($q) use ($province) {
                $q->where('province', $province)
                  ->orWhereRaw('LOWER(TRIM(province)) = ?', [strtolower(trim($province))]);
            })
            ->whereIn('company', array_filter(['all', $targetCompany]))
            ->orderByRaw("CASE WHEN company = ? THEN 0 ELSE 1 END", [$targetCompany ?: 'rbs'])
            ->first();
        }

        if (!$setting) {
            return response()->json([
                'status' => 'error',
                'message' => "Belum ada konfigurasi perhitungan gaji untuk provinsi {$identifier}.",
            ], 404);
        }

        $affectedCount = $this->applySettingToEmployeesInternal($setting, $targetCompany);

        ActivityLog::record(
            action: 'APPLY_PROVINCE_SETTING',
            module: 'payroll',
            description: "Admin menerapkan perhitungan gaji provinsi {$setting->province} (UMP: Rp " . number_format((float) $setting->ump, 0, ',', '.') . ") ke {$affectedCount} data karyawan",
            details: ['province' => $setting->province, 'affected_count' => $affectedCount, 'ump' => $setting->ump],
            company: $targetCompany
        );

        return response()->json([
            'status' => 'success',
            'message' => "Perhitungan gaji provinsi {$setting->province} berhasil disinkronkan ke {$affectedCount} karyawan.",
            'affected_employees' => $affectedCount,
        ]);
    }

    /**
     * Hapus konfigurasi provinsi (opsional jika ada duplikat atau salah entry).
     */
    public function destroy(Request $request, string $identifier): JsonResponse
    {
        $currentUser = $request->user();
        if ($currentUser->role !== 'admin' && !$currentUser->isSuperAdmin()) {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized.'], 403);
        }

        $setting = null;
        if (is_numeric($identifier)) {
            $setting = ProvincePayrollSetting::find($identifier);
        } else {
            $setting = ProvincePayrollSetting::where('province', $identifier)->first();
        }

        if (!$setting) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pengaturan provinsi tidak ditemukan.',
            ], 404);
        }

        $provName = $setting->province;
        $setting->delete();

        ActivityLog::record(
            action: 'DELETE_PROVINCE_SETTING',
            module: 'payroll',
            description: "Admin menghapus pengaturan gaji provinsi {$provName}",
            details: ['province' => $provName],
            company: $setting->company
        );

        return response()->json([
            'status' => 'success',
            'message' => "Pengaturan gaji provinsi {$provName} berhasil dihapus.",
        ]);
    }

    /**
     * Helper internal untuk mengupdate seluruh data karyawan di provinsi tertentu.
     * Mengupdate Gaji Pokok (sesuai UMP jika diset > 0), BPJS Kesehatan, dan BPJS TK,
     * lalu menghitung ulang Take Home Pay (THP).
     */
    protected function applySettingToEmployeesInternal(ProvincePayrollSetting $setting, ?string $company): int
    {
        $normalizedProvince = trim($setting->province);

        $query = Payroll::where(function ($q) use ($normalizedProvince) {
            $q->where('province', $normalizedProvince)
              ->orWhereRaw('LOWER(TRIM(province)) = ?', [strtolower($normalizedProvince)]);
        });

        if ($company && $company !== 'all') {
            $query->where('company', $company);
        }

        $payrolls = $query->get();
        $count = 0;

        foreach ($payrolls as $payroll) {
            // Perbarui Gaji Pokok sesuai UMP jika UMP diset > 0
            if ((float) $setting->ump > 0) {
                $payroll->basic_salary = (float) $setting->ump;
            }

            $payroll->bpjs_kes = (float) $setting->bpjs_kes;
            $payroll->bpjs_tk_jht = (float) $setting->bpjs_tk_jht;
            $payroll->bpjs_tk_jp = (float) $setting->bpjs_tk_jp;
            $payroll->bpjs_tk = (float) $setting->bpjs_tk;

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
