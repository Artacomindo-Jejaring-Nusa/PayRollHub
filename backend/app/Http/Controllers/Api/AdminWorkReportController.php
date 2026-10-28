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
        if (!$currentUser || !$currentUser->isAdmin()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Akses ditolak: Pengguna dengan role User tidak memiliki wewenang mengakses menu Laporan Kerja.',
            ], 403);
        }

        $status = $request->input('status');
        $search = $request->input('search');
        $date = $request->input('date');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
        $spPeriod = $request->input('sp_period') ?: $request->input('sp');

        $perPage = (int) $request->input('per_page', 15);
        if ($perPage <= 0 || $perPage > 100) {
            $perPage = 15;
        }

        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->input('company') && $request->input('company') !== 'all' ? $request->input('company') : null)
            : ($currentUser->company ?: 'rbs');

        $query = WorkReport::with(['user:id,name,nik,company,phone', 'reviewer:id,name'])
            ->when($targetCompany, fn ($q) => $q->whereHas('user', fn ($u) => $u->where('company', $targetCompany)))
            ->when($status && $status !== 'all', fn ($q) => $q->where('status', $status));

        if ($spPeriod && strtolower(trim($spPeriod)) !== 'all') {
            $spClean = trim($spPeriod);
            $query->whereHas('user', function ($uq) use ($targetCompany, $spClean) {
                $uq->whereIn('name', function ($sq) use ($targetCompany, $spClean) {
                    $sq->select('employee_name')
                        ->from('payrolls')
                        ->where('period', $spClean)
                        ->when($targetCompany, fn ($ssq) => $ssq->where('company', $targetCompany))
                        ->where(fn ($ssq) => $ssq->where('status', '!=', 'off')->orWhereNull('status'));
                });
            });
        }

        if ($startDate && $endDate) {
            $query->whereBetween('report_date', [$startDate, $endDate]);
        } elseif ($date && $date !== 'all') {
            $query->whereDate('report_date', $date);
        }

        $reports = $query->when($search, function ($q, $s) {
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
            ->orderByDesc('report_date')
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'data' => $reports->items(),
            'meta' => [
                'current_page' => $reports->currentPage(),
                'last_page' => $reports->lastPage(),
                'per_page' => $reports->perPage(),
                'total' => $reports->total(),
                'from' => $reports->firstItem(),
                'to' => $reports->lastItem(),
            ],
        ]);
    }

    /**
     * Update review status and feedback on a work report.
     */
    public function updateStatus(Request $request, WorkReport $workReport): JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser || !$currentUser->isAdmin()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Akses ditolak: Pengguna dengan role User tidak memiliki wewenang mengelola Laporan Kerja.',
            ], 403);
        }

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

        // Send Firebase Push Notification & In-App Notification to employee
        try {
            $fcmService = app(\App\Services\FirebaseNotificationService::class);
            $statusLabel = match ($validated['status']) {
                'approved' => 'Disetujui ✅',
                'rejected' => 'Ditolak ❌',
                default => 'Ditinjau 📝',
            };
            $reportDate = $workReport->report_date ? date('d M Y', strtotime($workReport->report_date)) : 'Hari ini';
            $title = "Laporan Kerja {$statusLabel}";
            $body = "Laporan kerja Anda tanggal {$reportDate} telah {$statusLabel} oleh {$currentUser->name}."
                . (!empty($validated['feedback']) ? " Catatan: {$validated['feedback']}" : '');

            $fcmService->sendToUser(
                $workReport->user_id,
                $title,
                $body,
                'work_report_' . $validated['status'],
                [
                    'report_id' => (string) $workReport->id,
                    'status' => $validated['status'],
                    'feedback' => $validated['feedback'] ?? '',
                    'target_tab' => 'reports',
                ]
            );
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('[WorkReport Notification] Failed to send push: ' . $e->getMessage());
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Status laporan kerja berhasil diperbarui.',
            'data' => $workReport->load(['user:id,name,nik,company', 'reviewer:id,name']),
        ]);
    }

    /**
     * Bulk approve work reports (either by selected IDs or all pending under current active filters).
     */
    public function bulkApprove(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser || !$currentUser->isAdmin()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Akses ditolak: Pengguna dengan role User tidak memiliki wewenang mengelola Laporan Kerja.',
            ], 403);
        }

        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->input('company') && $request->input('company') !== 'all' ? $request->input('company') : null)
            : ($currentUser->company ?: 'rbs');

        $rawIds = $request->input('ids') ?: $request->input('report_ids');
        $ids = [];
        if ($rawIds) {
            $ids = is_array($rawIds) ? $rawIds : explode(',', (string) $rawIds);
            $ids = array_filter(array_map('intval', $ids));
        }

        $query = WorkReport::query()
            ->when($targetCompany, fn ($q) => $q->whereHas('user', fn ($u) => $u->where('company', $targetCompany)));

        if (!empty($ids)) {
            $query->whereIn('id', $ids);
        } else {
            // Bulk approve all pending matching the current active filter
            $status = $request->input('status', 'pending');
            $date = $request->input('date');
            $startDate = $request->input('start_date');
            $endDate = $request->input('end_date');
            $spPeriod = $request->input('sp_period') ?: $request->input('sp');
            $search = $request->input('search');

            $query->when($status && $status !== 'all', fn ($q) => $q->where('status', $status), fn ($q) => $q->where('status', 'pending'));

            if ($spPeriod && strtolower(trim($spPeriod)) !== 'all') {
                $spClean = trim($spPeriod);
                $query->whereHas('user', function ($uq) use ($targetCompany, $spClean) {
                    $uq->whereIn('name', function ($sq) use ($targetCompany, $spClean) {
                        $sq->select('employee_name')
                            ->from('payrolls')
                            ->where('period', $spClean)
                            ->when($targetCompany, fn ($ssq) => $ssq->where('company', $targetCompany))
                            ->where(fn ($ssq) => $ssq->where('status', '!=', 'off')->orWhereNull('status'));
                    });
                });
            }

            if ($startDate && $endDate) {
                $query->whereBetween('report_date', [$startDate, $endDate]);
            } elseif ($date && $date !== 'all') {
                $query->whereDate('report_date', $date);
            }

            if ($search) {
                $query->where(function ($sub) use ($search) {
                    $sub->where('title', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhere('desc_absen', 'like', "%{$search}%")
                        ->orWhere('desc_kegiatan1', 'like', "%{$search}%")
                        ->orWhere('desc_kegiatan2', 'like', "%{$search}%")
                        ->orWhere('desc_kegiatan_lain', 'like', "%{$search}%")
                        ->orWhere('nik', 'like', "%{$search}%")
                        ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%"));
                });
            }
        }

        $reportsToApprove = $query->get(['id', 'user_id', 'report_date', 'status']);
        $count = $reportsToApprove->count();

        if ($count === 0) {
            return response()->json([
                'status' => 'success',
                'message' => 'Tidak ada laporan kerja yang memenuhi syarat untuk disetujui.',
                'count' => 0,
            ]);
        }

        $feedback = $request->input('feedback') ?: 'Disetujui oleh admin';
        $reportIds = $reportsToApprove->pluck('id')->toArray();

        WorkReport::whereIn('id', $reportIds)->update([
            'status' => 'approved',
            'feedback' => $feedback,
            'reviewed_by' => $currentUser->id,
            'reviewed_at' => now(),
            'updated_at' => now(),
        ]);

        // Push notification ke karyawan yang laporannya disetujui
        try {
            $fcmService = app(\App\Services\FirebaseNotificationService::class);
            $userReports = $reportsToApprove->groupBy('user_id');
            foreach ($userReports as $userId => $userReps) {
                $repCount = $userReps->count();
                $title = "Laporan Kerja Disetujui ✅";
                $body = $repCount > 1
                    ? "Sebanyak {$repCount} laporan kerja Anda telah disetujui oleh {$currentUser->name}."
                    : "Laporan kerja Anda telah disetujui oleh {$currentUser->name}.";

                $fcmService->sendToUser(
                    $userId,
                    $title,
                    $body,
                    'work_report_approved',
                    [
                        'report_id' => (string) $userReps->first()->id,
                        'status' => 'approved',
                        'target_tab' => 'reports',
                    ]
                );
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('[WorkReport BulkApprove Notification] ' . $e->getMessage());
        }

        return response()->json([
            'status' => 'success',
            'message' => "Berhasil menyetujui {$count} laporan kerja.",
            'count' => $count,
        ]);
    }

    /**
     * Export all filtered work reports to Excel (.xlsx) or Summary PDF (.pdf).
     */
    public function export(Request $request)
    {
        @ini_set('memory_limit', '512M');
        @set_time_limit(180);

        $currentUser = $request->user();
        if (!$currentUser || !$currentUser->isAdmin()) {
            abort(403, 'Akses ditolak: Pengguna dengan role User tidak memiliki wewenang mengunduh Laporan Kerja.');
        }

        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->input('company') && $request->input('company') !== 'all' ? $request->input('company') : null)
            : ($currentUser->company ?: 'rbs');

        $format = strtolower($request->input('format', 'xlsx'));

        $status = $request->input('status');
        $date = $request->input('date');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
        $spPeriod = $request->input('sp_period') ?: $request->input('sp');
        $search = $request->input('search');

        $rawIds = $request->input('ids') ?: $request->input('report_ids');
        $ids = [];
        if ($rawIds) {
            $ids = is_array($rawIds) ? $rawIds : explode(',', (string) $rawIds);
            $ids = array_filter(array_map('intval', $ids));
        }

        $suffixSelected = !empty($ids) ? '_terpilih_' . count($ids) : '';
        $filename = 'rekap_laporan_kerja_' . date('Ymd_His') . $suffixSelected;

        if ($format === 'pdf') {
            $reportsQuery = WorkReport::with(['user', 'reviewer'])
                ->when(!empty($ids), fn ($q) => $q->whereIn('id', $ids))
                ->when($targetCompany, fn ($q) => $q->whereHas('user', fn ($u) => $u->where('company', $targetCompany)))
                ->when($status && $status !== 'all', fn ($q) => $q->where('status', $status));

            if ($spPeriod && strtolower(trim($spPeriod)) !== 'all') {
                $spClean = trim($spPeriod);
                $reportsQuery->whereHas('user', function ($uq) use ($targetCompany, $spClean) {
                    $uq->whereIn('name', function ($sq) use ($targetCompany, $spClean) {
                        $sq->select('employee_name')
                            ->from('payrolls')
                            ->where('period', $spClean)
                            ->when($targetCompany, fn ($ssq) => $ssq->where('company', $targetCompany))
                            ->where(fn ($ssq) => $ssq->where('status', '!=', 'off')->orWhereNull('status'));
                    });
                });
            }

            $reports = $reportsQuery
                ->when($startDate && $endDate, fn ($q) => $q->whereBetween('report_date', [$startDate, $endDate]))
                ->when($date && !$startDate, fn ($q) => $q->whereDate('report_date', $date))
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

            // Persiapkan thumbnail foto dan URL agar tampil langsung di PDF rekap
            foreach ($reports as $report) {
                $report->photo_absen_thumb = $this->getThumbnailBase64($report->photo_absen, 250);
                $report->photo_absen_url = $this->formatPhotoUrl($report->photo_absen);

                $keg1Path = $report->photo_kegiatan1 ?: $report->attachment_path;
                $report->photo_kegiatan1_thumb = $this->getThumbnailBase64($keg1Path, 250);
                $report->photo_kegiatan1_url = $this->formatPhotoUrl($keg1Path);

                $report->photo_kegiatan2_thumb = $this->getThumbnailBase64($report->photo_kegiatan2, 250);
                $report->photo_kegiatan2_url = $this->formatPhotoUrl($report->photo_kegiatan2);

                $report->photo_kegiatan_lain_thumb = $this->getThumbnailBase64($report->photo_kegiatan_lain, 250);
                $report->photo_kegiatan_lain_url = $this->formatPhotoUrl($report->photo_kegiatan_lain);
            }

            $pdf = Pdf::loadView('pdf.work_reports_summary', [
                'reports' => $reports,
                'filterDate' => $date ?: ($startDate && $endDate ? "{$startDate} s/d {$endDate}" : null),
                'filterStatus' => $status,
                'selectedCount' => count($ids),
            ])->setPaper('a4', 'landscape');

            return $pdf->download("{$filename}.pdf");
        }

        return Excel::download(new WorkReportExport($request, $ids, $targetCompany), "{$filename}.xlsx");
    }

    /**
     * Download official single PDF sheet of a work report with 4 activities & embedded photos.
     */
    public function downloadSinglePdf(WorkReport $workReport)
    {
        $currentUser = request()->user();
        if (!$currentUser || !$currentUser->isAdmin()) {
            abort(403, 'Akses ditolak: Pengguna dengan role User tidak memiliki wewenang mengunduh Laporan Kerja.');
        }

        $workReport->load(['user', 'reviewer']);

        if ($currentUser && !$currentUser->isSuperAdmin()) {
            if ($workReport->user && $workReport->user->company !== $currentUser->company) {
                abort(403, 'Akses ditolak. Anda tidak memiliki izin mengunduh laporan kerja perusahaan lain.');
            }
        }

        $photos = [
            'absen' => $this->getThumbnailBase64($workReport->photo_absen, 650),
            'kegiatan1' => $this->getThumbnailBase64($workReport->photo_kegiatan1 ?: $workReport->attachment_path, 650),
            'kegiatan2' => $this->getThumbnailBase64($workReport->photo_kegiatan2, 650),
            'kegiatan_lain' => $this->getThumbnailBase64($workReport->photo_kegiatan_lain, 650),
        ];

        $pdf = Pdf::loadView('pdf.work_report_single', [
            'report' => $workReport,
            'photos' => $photos,
        ])->setPaper('a4', 'portrait');

        $cleanName = Str::slug($workReport->user?->name ?? 'karyawan');
        $dateStr = $workReport->report_date ? date('Ymd', strtotime($workReport->report_date)) : 'laporan';
        return $pdf->download("Laporan_Kerja_{$cleanName}_{$dateStr}.pdf");
    }

    public function formatPhotoUrl(?string $path): ?string
    {
        if (empty($path)) return null;
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }
        $clean = ltrim($path, '/');
        if (str_starts_with($clean, 'storage/')) {
            return url($clean);
        }
        return url('storage/' . $clean);
    }

    public function getPhotoStoragePath(?string $path): ?string
    {
        if (empty($path)) return null;
        $clean = ltrim($path, '/');
        if (str_starts_with($clean, 'storage/')) {
            $clean = substr($clean, 8);
        }
        return storage_path('app/public/' . $clean);
    }

    public function getThumbnailBase64(?string $path, int $maxDim = 250): ?string
    {
        if (empty($path)) return null;
        $fullPath = $this->getPhotoStoragePath($path);
        if (!$fullPath || !file_exists($fullPath)) return null;

        // Jika file relatif kecil (< 80KB), langsung encode base64
        if (filesize($fullPath) < 81920) {
            $mime = mime_content_type($fullPath) ?: 'image/jpeg';
            return "data:{$mime};base64," . base64_encode(file_get_contents($fullPath));
        }

        // Downscale dengan GD jika tersedia agar render PDF cepat dan hemat memori
        if (extension_loaded('gd')) {
            try {
                $imageInfo = @getimagesize($fullPath);
                if ($imageInfo) {
                    [$w, $h] = $imageInfo;
                    if ($w > $maxDim || $h > $maxDim) {
                        $ratio = min($maxDim / $w, $maxDim / $h);
                        $newW = max(1, (int) round($w * $ratio));
                        $newH = max(1, (int) round($h * $ratio));

                        $srcImg = match ($imageInfo[2]) {
                            IMAGETYPE_JPEG => @imagecreatefromjpeg($fullPath),
                            IMAGETYPE_PNG => @imagecreatefrompng($fullPath),
                            IMAGETYPE_WEBP => @imagecreatefromwebp($fullPath),
                            default => null,
                        };

                        if ($srcImg) {
                            $thumb = imagecreatetruecolor($newW, $newH);
                            if ($imageInfo[2] === IMAGETYPE_PNG) {
                                imagealphablending($thumb, false);
                                imagesavealpha($thumb, true);
                            }
                            imagecopyresampled($thumb, $srcImg, 0, 0, 0, 0, $newW, $newH, $w, $h);
                            ob_start();
                            imagejpeg($thumb, null, 75);
                            $thumbData = ob_get_clean();
                            imagedestroy($thumb);
                            imagedestroy($srcImg);

                            return 'data:image/jpeg;base64,' . base64_encode($thumbData);
                        }
                    }
                }
            } catch (\Throwable $e) {
                // Fallback jika proses GD mengalami kendala
            }
        }

        $mime = mime_content_type($fullPath) ?: 'image/jpeg';
        return "data:{$mime};base64," . base64_encode(file_get_contents($fullPath));
    }

    private function convertPhotoToBase64(?string $path): ?string
    {
        return $this->getThumbnailBase64($path, 650);
    }
}
