<?php

namespace App\Http\Controllers\Api;

use App\Exports\PayrollExport;
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
        $paginated = $this->payrollService->paginate($request);
        $metrics = $this->payrollService->getMetrics($request);
        $provinces = $this->payrollService->getDistinctProvinces();
        $periods = $this->payrollService->getDistinctPeriods();

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
                'positions' => $this->payrollService->getDistinctPositions(),
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

        if ($format === 'pdf') {
            $payrolls = Payroll::query()
                ->search($request->input('search'))
                ->byProvince($request->input('province'))
                ->byPeriod($request->input('period'))
                ->orderBy('id', 'desc')
                ->get();

            $pdf = Pdf::loadView('pdf.payroll_report', [
                'payrolls' => $payrolls,
                'period' => $request->input('period'),
                'province' => $request->input('province'),
                'hideSalary' => !$isAdmin,
            ])->setPaper('a4', 'landscape');

            return $pdf->download("{$filename}.pdf");
        }

        if ($format === 'csv') {
            $payrolls = Payroll::query()
                ->search($request->input('search'))
                ->byProvince($request->input('province'))
                ->byPeriod($request->input('period'))
                ->orderBy('id', 'asc')
                ->get();

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
                        'WILAYAH',
                        'SEKOLAH RAKYAT PERMANEN',
                        'NIK',
                        'NAMA LENGKAP',
                        'FUNGSI TENAGA KEPENDIDIKAN',
                        'TANGGAL MASUK',
                        'GAJI',
                        'NO REKENING',
                        'BANK',
                        'PERIODE',
                    ]);

                    foreach ($payrolls as $row) {
                        fputcsv($handle, [
                            $row->row_no ?: $row->id,
                            $row->province,
                            $row->school_unit ?? '-',
                            $row->nik ? "'" . $row->nik : '-',
                            $row->employee_name,
                            $row->position ?? '-',
                            $row->join_date ?? '-',
                            'Rp ' . number_format((float) $row->take_home_pay, 0, ',', '.'),
                            $row->bank_account ? "'" . $row->bank_account : '-',
                            $row->bank_name ?? '-',
                            $row->period,
                        ]);
                    }
                } else {
                    fputcsv($handle, [
                        'No',
                        'WILAYAH',
                        'SEKOLAH RAKYAT PERMANEN',
                        'NIK',
                        'NAMA LENGKAP',
                        'FUNGSI TENAGA KEPENDIDIKAN',
                        'TANGGAL MASUK',
                        'PERIODE',
                    ]);

                    foreach ($payrolls as $row) {
                        fputcsv($handle, [
                            $row->row_no ?: $row->id,
                            $row->province,
                            $row->school_unit ?? '-',
                            $row->nik ? "'" . $row->nik : '-',
                            $row->employee_name,
                            $row->position ?? '-',
                            $row->join_date ?? '-',
                            $row->period,
                        ]);
                    }
                }

                fclose($handle);
            }, 200, $headers);
        }

        // Default: xlsx via PhpSpreadsheet direct streaming
        $payrolls = Payroll::query()
            ->search($request->input('search'))
            ->byProvince($request->input('province'))
            ->byPeriod($request->input('period'))
            ->orderBy('id', 'asc')
            ->get();

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Rekap Data');

        if ($isAdmin) {
            $headings = [
                'No',
                'WILAYAH',
                'SEKOLAH RAKYAT PERMANEN',
                'NIK',
                'NAMA LENGKAP',
                'FUNGSI TENAGA KEPENDIDIKAN',
                'TANGGAL MASUK',
                'GAJI',
                'NO REKENING',
                'BANK',
                'PERIODE',
            ];
            $sheet->fromArray([$headings], null, 'A1');

            $rows = [];
            foreach ($payrolls as $row) {
                $rows[] = [
                    $row->row_no ?: $row->id,
                    $row->province,
                    $row->school_unit ?? '-',
                    $row->nik ? (string) $row->nik : '-',
                    $row->employee_name,
                    $row->position ?? '-',
                    $row->join_date ?? '-',
                    (float) $row->take_home_pay,
                    $row->bank_account ? (string) $row->bank_account : '-',
                    $row->bank_name ?? '-',
                    $row->period,
                ];
            }
            if (!empty($rows)) {
                $sheet->fromArray($rows, null, 'A2');
            }
            $sheet->getStyle('A1:K1')->applyFromArray([
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '004AC6'],
                ],
            ]);
            foreach (range('A', 'K') as $col) {
                $sheet->getColumnDimension($col)->setAutoSize(true);
            }
        } else {
            $headings = [
                'No',
                'WILAYAH',
                'SEKOLAH RAKYAT PERMANEN',
                'NIK',
                'NAMA LENGKAP',
                'FUNGSI TENAGA KEPENDIDIKAN',
                'TANGGAL MASUK',
                'PERIODE',
            ];
            $sheet->fromArray([$headings], null, 'A1');

            $rows = [];
            foreach ($payrolls as $row) {
                $rows[] = [
                    $row->row_no ?: $row->id,
                    $row->province,
                    $row->school_unit ?? '-',
                    $row->nik ? (string) $row->nik : '-',
                    $row->employee_name,
                    $row->position ?? '-',
                    $row->join_date ?? '-',
                    $row->period,
                ];
            }
            if (!empty($rows)) {
                $sheet->fromArray($rows, null, 'A2');
            }
            $sheet->getStyle('A1:H1')->applyFromArray([
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '004AC6'],
                ],
            ]);
            foreach (range('A', 'H') as $col) {
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

        $import = new PayrollImport();
        Excel::import($import, $request->file('file'));

        return response()->json([
            'status' => 'success',
            'message' => 'Proses import data selesai.',
            'data' => [
                'imported_count' => $import->getImportedCount(),
                'updated_count' => $import->getUpdatedCount(),
                'errors' => $import->getErrors(),
            ],
        ]);
    }
}
