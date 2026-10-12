<?php

namespace App\Http\Controllers\Api;

use App\Exports\PayrollExport;
use App\Exports\PayrollTemplateExporter;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePayrollRequest;
use App\Http\Requests\UpdatePayrollRequest;
use App\Http\Resources\PayrollResource;
use App\Imports\PayrollImport;
use App\Models\Payroll;
use App\Services\PayrollService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

class PayrollController extends Controller
{
    public function __construct(
        protected PayrollService $payrollService
    ) {}

    /**
     * Display a listing of payrolls with search, filters, and metrics.
     */
    public function index(Request $request): JsonResponse
    {
        $company = $this->payrollService->resolveCompany($request);
        $paginated = $this->payrollService->paginate($request);
        $metrics = $this->payrollService->getMetrics($request);
        $provinces = $this->payrollService->getDistinctProvinces($company);
        $periods = $this->payrollService->getDistinctPeriods($company);
        $positions = $this->payrollService->getDistinctPositions($company);

        $user = $request->user();
        if ($user && $user->role !== 'admin') {
            $metrics['total_basic_salary'] = 0;
            $metrics['total_allowance'] = 0;
            $metrics['total_deduction'] = 0;
            $metrics['total_take_home_pay'] = 0;
        }

        return response()->json([
            'status' => 'success',
            'data' => PayrollResource::collection($paginated->items()),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'from' => $paginated->firstItem(),
                'to' => $paginated->lastItem(),
            ],
            'metrics' => $metrics,
            'filters' => [
                'provinces' => $provinces,
                'periods' => $periods,
                'positions' => $positions,
                'statuses' => ['active', 'off'],
                'companies' => ['rbs', 'rimamandiri'],
                'active_company' => $company,
            ],
        ]);
    }

    /**
     * Display the specified payroll record.
     */
    public function show(Request $request, Payroll $payroll): JsonResponse
    {
        $this->authorizePayrollCompany($payroll, $request);

        return response()->json([
            'status' => 'success',
            'data' => new PayrollResource($payroll),
        ]);
    }

    /**
     * Store a newly created payroll record in storage. (Admin only)
     */
    public function store(StorePayrollRequest $request): JsonResponse
    {
        $data = $request->validated();
        $company = $this->payrollService->resolveCompany($request);

        // Non-superadmin cannot create payroll for another company
        if (!$request->user()->isSuperAdmin() || empty($data['company'])) {
            $data['company'] = $company;
        }

        $payroll = $this->payrollService->create($data);

        \App\Models\ActivityLog::record(
            action: 'CREATE_PAYROLL',
            module: 'payroll',
            description: "Menambahkan data gaji karyawan: {$payroll->employee_name} ({$payroll->period}) - Wilayah: {$payroll->province}, THP: Rp " . number_format((float) $payroll->take_home_pay, 0, ',', '.'),
            details: [
                'payroll_id' => $payroll->id,
                'employee_name' => $payroll->employee_name,
                'nik' => $payroll->nik,
                'period' => $payroll->period,
                'take_home_pay' => (float) $payroll->take_home_pay,
            ],
            company: $payroll->company
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Data penggajian berhasil ditambahkan.',
            'data' => new PayrollResource($payroll),
        ], 201);
    }

    /**
     * Update the specified payroll record in storage. (Admin only)
     */
    public function update(UpdatePayrollRequest $request, Payroll $payroll): JsonResponse
    {
        $this->authorizePayrollCompany($payroll, $request);

        $data = $request->validated();
        if (!$request->user()->isSuperAdmin()) {
            unset($data['company']); // Cannot switch payroll to another company
        }

        $updated = $this->payrollService->update($payroll, $data);

        \App\Models\ActivityLog::record(
            action: 'UPDATE_PAYROLL',
            module: 'payroll',
            description: "Mengubah data gaji karyawan: {$updated->employee_name} ({$updated->period}) - THP: Rp " . number_format((float) $updated->take_home_pay, 0, ',', '.'),
            details: [
                'payroll_id' => $updated->id,
                'employee_name' => $updated->employee_name,
                'nik' => $updated->nik,
                'period' => $updated->period,
                'take_home_pay' => (float) $updated->take_home_pay,
            ],
            company: $updated->company
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Data penggajian berhasil diperbarui.',
            'data' => new PayrollResource($updated),
        ]);
    }

    /**
     * Remove the specified payroll record from storage. (Admin only)
     */
    public function destroy(Request $request, Payroll $payroll): JsonResponse
    {
        $this->authorizePayrollCompany($payroll, $request);

        \App\Models\ActivityLog::record(
            action: 'DELETE_PAYROLL',
            module: 'payroll',
            description: "MENGHAPUS data gaji karyawan: {$payroll->employee_name} (NIK: {$payroll->nik}, Periode: {$payroll->period})",
            details: [
                'payroll_id' => $payroll->id,
                'employee_name' => $payroll->employee_name,
                'nik' => $payroll->nik,
                'period' => $payroll->period,
            ],
            company: $payroll->company
        );

        $this->payrollService->delete($payroll);

        return response()->json([
            'status' => 'success',
            'message' => 'Data penggajian berhasil dihapus.',
        ]);
    }

    /**
     * Clear / takeout existing payroll records (e.g. for starting fresh with new template).
     */
    public function clearAll(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            abort(403, 'Akses ditolak. Fitur ini hanya dapat diakses oleh Administrator.');
        }

        $period = $request->input('period');
        $company = $this->payrollService->resolveCompany($request);

        $query = Payroll::query();
        if ($company) {
            $query->where('company', $company);
        }
        if (!empty($period) && $period !== 'all') {
            $query->where('period', $period);
        }

        $count = $query->count();
        $query->delete();

        \App\Models\ActivityLog::record(
            action: 'CLEAR_PAYROLLS',
            module: 'payroll',
            description: "Menghapus/Take-out {$count} data penggajian (Periode: " . ($period ?: 'Semua') . ", Perusahaan: " . ($company ?: 'Semua') . ")",
            details: ['deleted_count' => $count, 'period' => $period, 'company' => $company],
            company: $company
        );

        return response()->json([
            'status' => 'success',
            'message' => "Berhasil mengeluarkan/menghapus {$count} data penggajian.",
            'data' => ['deleted_count' => $count],
        ]);
    }

    /**
     * Update employee employment status ('active' or 'off') with optional resign date. (Admin only)
     */
    public function updateStatus(Request $request, Payroll $payroll): JsonResponse
    {
        $this->authorizePayrollCompany($payroll, $request);

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:active,off'],
            'resign_date' => ['nullable', 'string', 'max:50'],
        ]);

        $updated = $this->payrollService->toggleStatus(
            $payroll,
            $validated['status'],
            $validated['resign_date'] ?? null
        );

        \App\Models\ActivityLog::record(
            action: 'UPDATE_STATUS',
            module: 'payroll',
            description: "Mengubah status karyawan {$updated->employee_name} menjadi " . ($validated['status'] === 'off' ? 'OFF / NON-AKTIF' : 'AKTIF') . (!empty($validated['resign_date']) ? " (Tgl Keluar: {$validated['resign_date']})" : ''),
            details: [
                'payroll_id' => $updated->id,
                'employee_name' => $updated->employee_name,
                'status' => $validated['status'],
                'resign_date' => $validated['resign_date'] ?? null,
            ],
            company: $updated->company
        );

        return response()->json([
            'status' => 'success',
            'message' => $validated['status'] === 'off'
                ? 'Status karyawan berhasil diubah menjadi Non-Aktif (Off).'
                : 'Status karyawan berhasil diaktifkan kembali.',
            'data' => new PayrollResource($updated),
        ]);
    }

    /**
     * Export payroll records to Excel, CSV, or PDF.
     */
    public function export(Request $request): Response
    {
        $user = $request->user();
        $isAdmin = $user && $user->isAdmin();

        if (!$isAdmin) {
            abort(403, 'Akses ditolak. Fitur ekspor laporan hanya dapat diakses oleh Administrator.');
        }

        $format = strtolower($request->input('format', 'xlsx'));
        $filename = 'rekap_payroll_' . date('Ymd_His');

        $resolvedCompany = $this->payrollService->resolveCompany($request);

        \App\Models\ActivityLog::record(
            action: 'EXPORT_DATA',
            module: 'payroll',
            description: "Mengekspor data penggajian format " . strtoupper($format),
            details: [
                'format' => $format,
                'period' => $request->input('period'),
                'company' => $resolvedCompany,
            ],
            company: $resolvedCompany
        );

        $baseQuery = Payroll::query()
            ->search($request->input('search'))
            ->byProvince($request->input('province'))
            ->byPosition($request->input('position'))
            ->byPeriod($request->input('period'))
            ->byStatus($request->input('status'))
            ->byCompany($resolvedCompany);

        if ($format === 'pdf') {
            $payrolls = (clone $baseQuery)->orderBy('id', 'desc')->get();

            $pdf = Pdf::loadView('pdf.payroll_report', [
                'payrolls' => $payrolls,
                'period' => $request->input('period'),
                'province' => $request->input('province'),
                'hideSalary' => !$isAdmin,
            ])->setPaper('a4', 'landscape');

            return $pdf->download("{$filename}.pdf");
        }

        if ($format === 'csv') {
            $payrolls = (clone $baseQuery)->orderBy('id', 'asc')->get();

            $headers = [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => "attachment; filename=\"{$filename}.csv\"",
                'Pragma' => 'no-cache',
                'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
                'Expires' => '0',
            ];

            return response()->stream(function () use ($payrolls, $isAdmin) {
                $handle = fopen('php://output', 'w');
                // UTF-8 BOM for Microsoft Excel compatibility
                fputs($handle, "\xEF\xBB\xBF");

                if ($isAdmin) {
                    fputcsv($handle, [
                        'No',
                        'STATUS',
                        'WILAYAH',
                        'SEKOLAH RAKYAT PERMANEN',
                        'NIK',
                        'NAMA LENGKAP',
                        'FUNGSI TENAGA KEPENDIDIKAN',
                        'TANGGAL MASUK',
                        'TANGGAL KELUAR',
                        'GAJI POKOK',
                        'BPJS KESEHATAN',
                        'BPJS TK',
                        'POTONGAN ABSENSI',
                        'KETERANGAN ABSENSI',
                        'TOTAL DITERIMA (TAKE HOME PAY)',
                        'NO REKENING',
                        'BANK',
                        'PERIODE',
                    ]);

                    foreach ($payrolls as $row) {
                        fputcsv($handle, [
                            $row->row_no ?: $row->id,
                            strtoupper($row->status ?: 'active'),
                            $row->province,
                            $row->school_unit ?? '-',
                            $row->nik ? "'" . $row->nik : '-',
                            $row->employee_name,
                            $row->position ?? '-',
                            $row->join_date ?? '-',
                            $row->resign_date ?? '-',
                            (float) $row->basic_salary,
                            (float) $row->bpjs_kes,
                            (float) $row->bpjs_tk,
                            (float) $row->absence_deduction,
                            $row->absence_note ?? '-',
                            'Rp ' . number_format((float) $row->take_home_pay, 0, ',', '.'),
                            $row->bank_account ? "'" . $row->bank_account : '-',
                            $row->bank_name ?? '-',
                            $row->period,
                        ]);
                    }
                } else {
                    fputcsv($handle, [
                        'No',
                        'STATUS',
                        'WILAYAH',
                        'SEKOLAH RAKYAT PERMANEN',
                        'NIK',
                        'NAMA LENGKAP',
                        'FUNGSI TENAGA KEPENDIDIKAN',
                        'TANGGAL MASUK',
                        'TANGGAL KELUAR',
                        'PERIODE',
                    ]);

                    foreach ($payrolls as $row) {
                        fputcsv($handle, [
                            $row->row_no ?: $row->id,
                            strtoupper($row->status ?: 'active'),
                            $row->province,
                            $row->school_unit ?? '-',
                            $row->nik ? "'" . $row->nik : '-',
                            $row->employee_name,
                            $row->position ?? '-',
                            $row->join_date ?? '-',
                            $row->resign_date ?? '-',
                            $row->period,
                        ]);
                    }
                }

                fclose($handle);
            }, 200, $headers);
        }

        // Default: xlsx via PhpSpreadsheet direct streaming
        $payrolls = (clone $baseQuery)->orderBy('id', 'asc')->get();

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Rekap Data');

        if ($isAdmin) {
            $headings = [
                'No',
                'STATUS',
                'WILAYAH',
                'SEKOLAH RAKYAT PERMANEN',
                'NIK',
                'NAMA LENGKAP',
                'FUNGSI TENAGA KEPENDIDIKAN',
                'TANGGAL MASUK',
                'TANGGAL KELUAR',
                'GAJI POKOK',
                'BPJS KESEHATAN',
                'BPJS TK',
                'POTONGAN ABSENSI',
                'KETERANGAN ABSENSI',
                'TOTAL DITERIMA (TAKE HOME PAY)',
                'NO REKENING',
                'BANK',
                'PERIODE',
            ];
            $sheet->fromArray([$headings], null, 'A1');

            $rows = [];
            foreach ($payrolls as $row) {
                $rows[] = [
                    $row->row_no ?: $row->id,
                    strtoupper($row->status ?: 'active'),
                    $row->province,
                    $row->school_unit ?? '-',
                    $row->nik ? (string) $row->nik : '-',
                    $row->employee_name,
                    $row->position ?? '-',
                    $row->join_date ?? '-',
                    $row->resign_date ?? '-',
                    (float) $row->basic_salary,
                    (float) $row->bpjs_kes,
                    (float) $row->bpjs_tk,
                    (float) $row->absence_deduction,
                    $row->absence_note ?? '-',
                    (float) $row->take_home_pay,
                    $row->bank_account ? (string) $row->bank_account : '-',
                    $row->bank_name ?? '-',
                    $row->period,
                ];
            }
            if (!empty($rows)) {
                $sheet->fromArray($rows, null, 'A2');
            }
            $sheet->getStyle('A1:R1')->applyFromArray([
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '004AC6'],
                ],
            ]);
            foreach (range('A', 'R') as $col) {
                $sheet->getColumnDimension($col)->setAutoSize(true);
            }
        } else {
            $headings = [
                'No',
                'STATUS',
                'WILAYAH',
                'SEKOLAH RAKYAT PERMANEN',
                'NIK',
                'NAMA LENGKAP',
                'FUNGSI TENAGA KEPENDIDIKAN',
                'TANGGAL MASUK',
                'TANGGAL KELUAR',
                'PERIODE',
            ];
            $sheet->fromArray([$headings], null, 'A1');

            $rows = [];
            foreach ($payrolls as $row) {
                $rows[] = [
                    $row->row_no ?: $row->id,
                    strtoupper($row->status ?: 'active'),
                    $row->province,
                    $row->school_unit ?? '-',
                    $row->nik ? (string) $row->nik : '-',
                    $row->employee_name,
                    $row->position ?? '-',
                    $row->join_date ?? '-',
                    $row->resign_date ?? '-',
                    $row->period,
                ];
            }
            if (!empty($rows)) {
                $sheet->fromArray($rows, null, 'A2');
            }
            $sheet->getStyle('A1:J1')->applyFromArray([
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '004AC6'],
                ],
            ]);
            foreach (range('A', 'J') as $col) {
                $sheet->getColumnDimension($col)->setAutoSize(true);
            }
        }

        $headers = [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$filename}.xlsx\"",
            'Cache-Control' => 'max-age=0',
        ];

        return response()->stream(function () use ($spreadsheet) {
            $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
            $writer->save('php://output');
        }, 200, $headers);
    }

    /**
     * Download single payslip as PDF. (Admin only)
     */
    public function slipPdf(Request $request, Payroll $payroll): Response
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            abort(403, 'Akses ditolak. Pengunduhan slip gaji hanya dapat diakses oleh Administrator.');
        }

        $this->authorizePayrollCompany($payroll, $request);

        $pdf = Pdf::loadView('pdf.payroll_slip', [
            'payroll' => $payroll,
        ])->setPaper('a4', 'portrait');

        $cleanName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $payroll->employee_name);
        return $pdf->download("slip_gaji_{$cleanName}_{$payroll->period}.pdf");
    }

    /**
     * Authorize that the current user has access to this payroll record's company.
     */
    protected function authorizePayrollCompany(Payroll $payroll, Request $request): void
    {
        $user = $request->user();
        if ($user && !$user->isSuperAdmin()) {
            $userCompany = $this->payrollService->resolveCompany($request);
            $payrollCompany = in_array(strtolower($payroll->company ?: ''), ['rimamandiri', 'rima', 'riamamandiripratama']) ? 'rimamandiri' : 'rbs';
            if ($payrollCompany !== $userCompany) {
                abort(403, 'Akses ditolak. Anda tidak memiliki izin untuk mengelola data perusahaan lain.');
            }
        }
    }

    /**
     * Download the official payroll import spreadsheet template (Excel multi-sheet or CSV).
     */
    public function downloadTemplate(Request $request): Response
    {
        $format = strtolower($request->input('format', 'xlsx'));

        if ($format === 'csv') {
            $csv = PayrollTemplateExporter::createCsvContent();
            return response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="template_import_payrollhub.csv"',
                'Pragma' => 'no-cache',
                'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
                'Expires' => '0',
            ]);
        }

        // Default: Excel .xlsx with 2 sheets (DATA_PENGGAJIAN & PETUNJUK_PENGISIAN)
        $spreadsheet = PayrollTemplateExporter::createSpreadsheet();

        $headers = [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="template_import_payrollhub.xlsx"',
            'Cache-Control' => 'max-age=0',
        ];

        return response()->stream(function () use ($spreadsheet) {
            $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
            $writer->save('php://output');
        }, 200, $headers);
    }

    /**
     * Preview uploaded payroll spreadsheet before saving to database. (Admin only)
     */
    public function previewImport(Request $request): JsonResponse
    {
        @set_time_limit(300);
        @ini_set('max_execution_time', '300');
        @ini_set('memory_limit', '512M');

        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'], // max 10MB
        ], [
            'file.required' => 'File spreadsheet wajib diunggah untuk pratinjau.',
            'file.mimes' => 'Format file harus berupa Excel (.xlsx, .xls) atau CSV (.csv).',
            'file.max' => 'Ukuran file tidak boleh melebihi 10MB.',
        ]);

        config(['excel.temporary_files.local_path' => sys_get_temp_dir()]);

        $period = $request->input('period') ?: date('Y-m');
        $company = $this->payrollService->resolveCompany($request) ?: $request->input('company', 'rbs');
        $targetSheet = $this->resolveTargetSheet($request->file('file'), $period);
        $import = new PayrollImport($period, isPreview: true, targetSheet: $targetSheet, defaultCompany: $company);
        Excel::import($import, $request->file('file'));

        return response()->json([
            'status' => 'success',
            'message' => 'File berhasil dianalisis untuk pratinjau data.',
            'data' => [
                'filename' => $request->file('file')->getClientOriginalName(),
                'file_size' => $request->file('file')->getSize(),
                'total_rows' => count($import->getPreviewRows()),
                'active_count' => $import->getActiveCount(),
                'off_count' => $import->getOffCount(),
                'total_estimated_thp' => $import->getTotalEstimatedThp(),
                'rows' => $import->getPreviewRows(),
                'warnings' => $import->getWarnings(),
                'errors' => $import->getErrors(),
            ],
        ]);
    }

    /**
     * Import payroll data from Excel or CSV file. (Admin only)
     */
    public function import(Request $request): JsonResponse
    {
        @set_time_limit(300);
        @ini_set('max_execution_time', '300');
        @ini_set('memory_limit', '512M');

        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'], // max 10MB
        ], [
            'file.required' => 'File spreadsheet wajib diunggah.',
            'file.mimes' => 'Format file harus berupa Excel (.xlsx, .xls) atau CSV (.csv).',
            'file.max' => 'Ukuran file tidak boleh melebihi 10MB.',
        ]);

        config(['excel.temporary_files.local_path' => sys_get_temp_dir()]);

        $period = $request->input('period') ?: date('Y-m');
        $company = $this->payrollService->resolveCompany($request) ?: $request->input('company', 'rbs');
        $targetSheet = $this->resolveTargetSheet($request->file('file'), $period);
        $import = new PayrollImport($period, isPreview: false, targetSheet: $targetSheet, defaultCompany: $company);
        Excel::import($import, $request->file('file'));

        $totalSaved = $import->getImportedCount() + $import->getUpdatedCount();
        \App\Models\ActivityLog::record(
            action: 'IMPORT_EXCEL',
            module: 'payroll',
            description: "Mengimpor data penggajian Excel periode {$period} (Entitas: " . strtoupper($company) . ") - Total: {$totalSaved} baris berhasil diproses (Baru: {$import->getImportedCount()}, Diperbarui: {$import->getUpdatedCount()}).",
            details: [
                'period' => $period,
                'company' => $company,
                'total_saved' => $totalSaved,
                'imported_count' => $import->getImportedCount(),
                'updated_count' => $import->getUpdatedCount(),
                'file_name' => $request->file('file')?->getClientOriginalName(),
            ],
            company: $company
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Proses import data selesai dan berhasil disimpan.',
            'data' => [
                'imported_count' => $import->getImportedCount(),
                'updated_count' => $import->getUpdatedCount(),
                'active_count' => $import->getActiveCount(),
                'off_count' => $import->getOffCount(),
                'total_estimated_thp' => $import->getTotalEstimatedThp(),
                'errors' => $import->getErrors(),
                'warnings' => $import->getWarnings(),
            ],
        ]);
    }

    /**
     * Determine which worksheet to read, ensuring PETUNJUK_PENGISIAN is never loaded.
     */
    protected function resolveTargetSheet($file, string $period): int|string
    {
        $extension = strtolower($file->getClientOriginalExtension());
        if (!in_array($extension, ['xlsx', 'xls'])) {
            return 0;
        }

        try {
            $reader = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($file->getRealPath());
            $sheetNames = $reader->listWorksheetNames($file->getRealPath());

            if (in_array('DATA_PENGGAJIAN', $sheetNames)) {
                return 'DATA_PENGGAJIAN';
            }

            $monthNum = substr($period, 5, 2);
            $monthNames = [
                '01' => ['Januari', 'Jan', 'JANUARI', 'JAN'],
                '02' => ['Februari', 'Feb', 'FEBRUARI', 'FEB'],
                '03' => ['Maret', 'Mar', 'MARET', 'MAR'],
                '04' => ['April', 'Apr', 'APRIL', 'APR'],
                '05' => ['Mei', 'May', 'MEI', 'MAY'],
                '06' => ['Juni', 'Jun', 'JUNI', 'JUN'],
                '07' => ['Juli', 'Jul', 'JULI', 'JUL'],
                '08' => ['Agustus', 'Ags', 'AGSTS', 'AGUSTUS', 'AGS'],
                '09' => ['September', 'Sep', 'SEPTEMBER', 'SEP'],
                '10' => ['Oktober', 'Okt', 'OKTOBER', 'OKT'],
                '11' => ['November', 'Nov', 'NOVEMBER', 'NOV'],
                '12' => ['Desember', 'Des', 'DESEMBER', 'DES'],
            ];

            if (!empty($monthNames[$monthNum])) {
                foreach ($monthNames[$monthNum] as $mName) {
                    if (in_array($mName, $sheetNames)) {
                        return $mName;
                    }
                }
            }

            foreach ($sheetNames as $name) {
                if ($name !== 'PETUNJUK_PENGISIAN' && $name !== 'Petunjuk' && $name !== 'Panduan') {
                    return $name;
                }
            }
        } catch (\Throwable) {
        }

        return 0;
    }
}
