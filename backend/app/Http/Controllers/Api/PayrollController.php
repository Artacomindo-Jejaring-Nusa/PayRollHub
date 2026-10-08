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
    public function show(Payroll $payroll): JsonResponse
    {
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
        $payroll = $this->payrollService->create($request->validated());

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
        $updated = $this->payrollService->update($payroll, $request->validated());

        return response()->json([
            'status' => 'success',
            'message' => 'Data penggajian berhasil diperbarui.',
            'data' => new PayrollResource($updated),
        ]);
    }

    /**
     * Remove the specified payroll record from storage. (Admin only)
     */
    public function destroy(Payroll $payroll): JsonResponse
    {
        $this->payrollService->delete($payroll);

        return response()->json([
            'status' => 'success',
            'message' => 'Data penggajian berhasil dihapus.',
        ]);
    }

    /**
     * Update employee employment status ('active' or 'off') with optional resign date. (Admin only)
     */
    public function updateStatus(Request $request, Payroll $payroll): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:active,off'],
            'resign_date' => ['nullable', 'string', 'max:50'],
        ]);

        $updated = $this->payrollService->toggleStatus(
            $payroll,
            $validated['status'],
            $validated['resign_date'] ?? null
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
        $isAdmin = $user && $user->role === 'admin';

        if (!$isAdmin) {
            abort(403, 'Akses ditolak. Fitur ekspor laporan hanya dapat diakses oleh Administrator.');
        }

        $format = strtolower($request->input('format', 'xlsx'));
        $filename = 'rekap_payroll_' . date('Ymd_His');

        $baseQuery = Payroll::query()
            ->search($request->input('search'))
            ->byProvince($request->input('province'))
            ->byPosition($request->input('position'))
            ->byPeriod($request->input('period'))
            ->byStatus($request->input('status'))
            ->byCompany($this->payrollService->resolveCompany($request));

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
                        'HARGA DASAR (NET PPH & FEE)',
                        'BPJS KES 5%',
                        'BPJS TK 9.24%',
                        'GAJI POKOK',
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
                            (float) $row->net_base_price,
                            (float) $row->bpjs_kes,
                            (float) $row->bpjs_tk,
                            (float) $row->basic_salary,
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
                'HARGA DASAR (NET PPH & FEE)',
                'BPJS KES 5%',
                'BPJS TK 9.24%',
                'GAJI POKOK',
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
                    (float) $row->net_base_price,
                    (float) $row->bpjs_kes,
                    (float) $row->bpjs_tk,
                    (float) $row->basic_salary,
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
            $sheet->getStyle('A1:S1')->applyFromArray([
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '004AC6'],
                ],
            ]);
            foreach (range('A', 'S') as $col) {
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
        if (!$user || $user->role !== 'admin') {
            abort(403, 'Akses ditolak. Pengunduhan slip gaji hanya dapat diakses oleh Administrator.');
        }

        $pdf = Pdf::loadView('pdf.payroll_slip', [
            'payroll' => $payroll,
        ])->setPaper('a4', 'portrait');

        $cleanName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $payroll->employee_name);
        return $pdf->download("slip_gaji_{$cleanName}_{$payroll->period}.pdf");
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
