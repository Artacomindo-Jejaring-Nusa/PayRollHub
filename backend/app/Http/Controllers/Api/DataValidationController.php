<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DataValidationService;
use App\Services\PayrollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DataValidationController extends Controller
{
    public function __construct(
        protected DataValidationService $validationService,
        protected PayrollService $payrollService
    ) {}

    /**
     * Upload and analyze a spreadsheet of new/prospective data against existing database.
     */
    public function uploadAndValidate(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:20480'], // max 20MB
            'target_period' => ['nullable', 'string', 'max:50'],
            'company' => ['nullable', 'string', 'max:50'],
        ], [
            'file.required' => 'File spreadsheet wajib diunggah untuk validasi.',
            'file.mimes' => 'Format file harus berupa Excel (.xlsx, .xls) atau CSV (.csv).',
            'file.max' => 'Ukuran file tidak boleh melebihi 20MB.',
        ]);

        $resolvedCompany = $this->payrollService->resolveCompany($request) ?: $request->input('company', 'rbs');
        $targetPeriod = $request->input('target_period');

        $result = $this->validationService->validateSpreadsheet(
            $request->file('file'),
            $resolvedCompany,
            $targetPeriod
        );

        \App\Models\ActivityLog::record(
            action: 'VALIDATE_DATA_SPREADSHEET',
            module: 'validation',
            description: "Melakukan validasi cerdas data baru: {$request->file('file')->getClientOriginalName()} ({$result['summary']['total_rows']} baris dianalisis)",
            details: [
                'filename' => $request->file('file')->getClientOriginalName(),
                'summary' => $result['summary'],
                'company' => $resolvedCompany,
                'target_period' => $targetPeriod,
            ],
            company: $resolvedCompany
        );

        return response()->json([
            'status' => 'success',
            'message' => "Analisis validasi selesai. {$result['summary']['total_rows']} baris data berhasil diperiksa silang.",
            'data' => $result,
        ]);
    }

    /**
     * Quick instant search / check for single person.
     */
    public function quickCheck(Request $request): JsonResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'min:2'],
            'province' => ['nullable', 'string'],
            'school_unit' => ['nullable', 'string'],
            'nik' => ['nullable', 'string'],
            'company' => ['nullable', 'string'],
        ], [
            'name.required' => 'Nama personil/karyawan wajib diisi.',
            'name.min' => 'Nama minimal terdiri dari 2 karakter.',
        ]);

        $resolvedCompany = $this->payrollService->resolveCompany($request) ?: $request->input('company', 'rbs');

        $result = $this->validationService->checkSingle(
            $resolvedCompany,
            $request->input('name'),
            $request->input('province'),
            $request->input('school_unit'),
            $request->input('nik')
        );

        return response()->json($result);
    }

    /**
     * Export the analyzed validation results into formatted Excel report.
     */
    public function exportReport(Request $request): Response
    {
        $rows = $request->input('rows', []);
        $summary = $request->input('summary', []);

        if (empty($rows)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Tidak ada data hasil validasi untuk diekspor.',
            ], 422);
        }

        $resolvedCompany = $this->payrollService->resolveCompany($request) ?: 'rbs';

        \App\Models\ActivityLog::record(
            action: 'EXPORT_VALIDATION_REPORT',
            module: 'validation',
            description: "Mengekspor laporan hasil validasi data (" . count($rows) . " baris)",
            details: ['count' => count($rows), 'company' => $resolvedCompany],
            company: $resolvedCompany
        );

        return $this->validationService->exportValidationReport($rows, $summary);
    }

    /**
     * Commit approved/validated rows safely into Payrolls table.
     * Guaranteed NOT to overwrite or delete existing records ("ga nabrak yg existing").
     */
    public function commitToPayroll(Request $request): JsonResponse
    {
        $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'target_period' => ['required', 'string', 'max:50'],
            'company' => ['nullable', 'string'],
        ], [
            'rows.required' => 'Pilih minimal satu data yang tervalidasi untuk dimasukkan ke sistem.',
            'target_period.required' => 'Target periode / SP wajib ditentukan (contoh: SP 9 atau SP 10).',
        ]);

        $resolvedCompany = $this->payrollService->resolveCompany($request) ?: $request->input('company', 'rbs');
        $targetPeriod = $request->input('target_period');

        $result = $this->validationService->commitToPayroll(
            $request->input('rows'),
            $targetPeriod,
            $resolvedCompany,
            $request->user()?->id
        );

        return response()->json([
            'status' => 'success',
            'message' => "Berhasil memproses data: {$result['inserted_count']} data berhasil dimasukkan ke periode {$targetPeriod}. ({$result['skipped_count']} dilewati karena sudah ada).",
            'data' => $result,
        ]);
    }
}
