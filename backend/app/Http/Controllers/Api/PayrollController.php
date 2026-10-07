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
            ])->setPaper('a4', 'landscape');

            return $pdf->download("{$filename}.pdf");
        }

        if ($format === 'csv') {
            return Excel::download(new PayrollExport($request), "{$filename}.csv", \Maatwebsite\Excel\Excel::CSV);
        }

        // Default: xlsx
        return Excel::download(new PayrollExport($request), "{$filename}.xlsx", \Maatwebsite\Excel\Excel::XLSX);
    }

    /**
     * Download single payslip as PDF.
     */
    public function slipPdf(Payroll $payroll): Response
    {
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
