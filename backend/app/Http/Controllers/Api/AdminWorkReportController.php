<?php

namespace App\Http\Controllers\Api;

use App\Exports\WorkReportExport;
use App\Http\Controllers\Controller;
use App\Models\WorkReport;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;

class AdminWorkReportController extends Controller
{
    /**
     * Display a listing of work reports from employees.
     */
    public function index(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        $status = $request->input('status');
        $search = $request->input('search');
        $date = $request->input('date');

        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->input('company') && $request->input('company') !== 'all' ? $request->input('company') : null)
            : ($currentUser->company ?: 'rbs');

        $reports = WorkReport::with(['user:id,name,nik,company,phone', 'reviewer:id,name'])
            ->when($targetCompany, fn ($q) => $q->whereHas('user', fn ($u) => $u->where('company', $targetCompany)))
            ->when($status && $status !== 'all', fn ($q) => $q->where('status', $status))
            ->when($date, fn ($q) => $q->whereDate('report_date', $date))
            ->when($search, function ($q, $s) {
                $q->where(function ($sub) use ($s) {
                    $sub->where('title', 'like', "%{$s}%")
                        ->orWhere('description', 'like', "%{$s}%")
                        ->orWhere('desc_absen', 'like', "%{$s}%")
                        ->orWhere('desc_kegiatan1', 'like', "%{$s}%")
                        ->orWhere('desc_kegiatan2', 'like', "%{$s}%")
                        ->orWhere('desc_kegiatan_lain', 'like', "%{$s}%")
                        ->orWhere('nik', 'like', "%{$s}%")
                        ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$s}%"));
                });
            })
            ->latest('report_date')
            ->paginate(15);

        return response()->json([
            'status' => 'success',
            'data' => $reports->items(),
            'meta' => [
                'current_page' => $reports->currentPage(),
                'last_page' => $reports->lastPage(),
                'total' => $reports->total(),
            ],
        ]);
    }

    /**
     * Update review status and feedback on a work report.
     */
    public function updateStatus(Request $request, WorkReport $workReport): JsonResponse
    {
        $currentUser = $request->user();
        $workReport->load('user');
        if (!$currentUser->isSuperAdmin()) {
            if ($workReport->user && $workReport->user->company !== $currentUser->company) {
                abort(403, 'Akses ditolak. Anda tidak memiliki izin memeriksa laporan kerja perusahaan lain.');
            }
        }

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:approved,rejected,pending'],
            'feedback' => ['nullable', 'string', 'max:1000'],
        ]);

        $workReport->update([
            'status' => $validated['status'],
            'feedback' => $validated['feedback'] ?? $workReport->feedback,
            'reviewed_by' => $currentUser->id,
            'reviewed_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Status laporan kerja berhasil diperbarui.',
            'data' => $workReport->load(['user:id,name,nik,company', 'reviewer:id,name']),
        ]);
    }

    /**
     * Export all filtered work reports to Excel (.xlsx) or Summary PDF (.pdf).
     */
    public function export(Request $request)
    {
        $currentUser = $request->user();
        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->input('company') && $request->input('company') !== 'all' ? $request->input('company') : null)
            : ($currentUser->company ?: 'rbs');

        $format = strtolower($request->input('format', 'xlsx'));
        $filename = 'rekap_laporan_kerja_' . date('Ymd_His');

        $status = $request->input('status');
        $date = $request->input('date');
        $search = $request->input('search');

        if ($format === 'pdf') {
            $reports = WorkReport::with(['user', 'reviewer'])
                ->when($targetCompany, fn ($q) => $q->whereHas('user', fn ($u) => $u->where('company', $targetCompany)))
                ->when($status && $status !== 'all', fn ($q) => $q->where('status', $status))
                ->when($date, fn ($q) => $q->whereDate('report_date', $date))
                ->when($search, function ($q, $s) {
                    $q->where(function ($sub) use ($s) {
                        $sub->where('title', 'like', "%{$s}%")
                            ->orWhere('description', 'like', "%{$s}%")
                            ->orWhere('desc_absen', 'like', "%{$s}%")
                            ->orWhere('desc_kegiatan1', 'like', "%{$s}%")
                            ->orWhere('desc_kegiatan2', 'like', "%{$s}%")
                            ->orWhere('desc_kegiatan_lain', 'like', "%{$s}%")
                            ->orWhere('nik', 'like', "%{$s}%")
                            ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$s}%"));
                    });
                })
                ->latest('report_date')
                ->get();

            $pdf = Pdf::loadView('pdf.work_reports_summary', [
                'reports' => $reports,
                'filterDate' => $date,
                'filterStatus' => $status,
            ])->setPaper('a4', 'landscape');

            return $pdf->download("{$filename}.pdf");
        }

        return Excel::download(new WorkReportExport($request), "{$filename}.xlsx");
    }

    /**
     * Download official single PDF sheet of a work report with 4 activities & embedded photos.
     */
    public function downloadSinglePdf(WorkReport $workReport)
    {
        $currentUser = request()->user();
        $workReport->load(['user', 'reviewer']);

        if ($currentUser && !$currentUser->isSuperAdmin()) {
            if ($workReport->user && $workReport->user->company !== $currentUser->company) {
                abort(403, 'Akses ditolak. Anda tidak memiliki izin mengunduh laporan kerja perusahaan lain.');
            }
        }

        $photos = [
            'absen' => $this->convertPhotoToBase64($workReport->photo_absen),
            'kegiatan1' => $this->convertPhotoToBase64($workReport->photo_kegiatan1 ?: $workReport->attachment_path),
            'kegiatan2' => $this->convertPhotoToBase64($workReport->photo_kegiatan2),
            'kegiatan_lain' => $this->convertPhotoToBase64($workReport->photo_kegiatan_lain),
        ];

        $pdf = Pdf::loadView('pdf.work_report_single', [
            'report' => $workReport,
            'photos' => $photos,
        ])->setPaper('a4', 'portrait');

        $cleanName = Str::slug($workReport->user?->name ?? 'karyawan');
        $dateStr = $workReport->report_date ? date('Ymd', strtotime($workReport->report_date)) : 'laporan';
        return $pdf->download("Laporan_Kerja_{$cleanName}_{$dateStr}.pdf");
    }

    private function convertPhotoToBase64(?string $path): ?string
    {
        if (!$path) return null;
        $fullPath = storage_path('app/public/' . $path);
        if (!file_exists($fullPath)) return null;

        $mime = mime_content_type($fullPath) ?: 'image/jpeg';
        $data = base64_encode(file_get_contents($fullPath));
        return "data:{$mime};base64,{$data}";
    }
}
