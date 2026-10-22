<?php

namespace App\Exports;

use App\Models\WorkReport;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class WorkReportExport implements FromCollection, WithHeadings, WithMapping, ShouldAutoSize, WithStyles
{
    protected ?string $status;
    protected ?string $date;
    protected ?string $startDate;
    protected ?string $endDate;
    protected ?string $search;
    protected array $ids = [];
    protected ?string $targetCompany = null;
    private int $rowNumber = 0;

    public function __construct(Request $request, array $ids = [], ?string $targetCompany = null)
    {
        $this->status = $request->input('status');
        $this->date = $request->input('date');
        $this->startDate = $request->input('start_date');
        $this->endDate = $request->input('end_date');
        $this->search = $request->input('search');

        if (!empty($ids)) {
            $this->ids = $ids;
        } else {
            $rawIds = $request->input('ids') ?: $request->input('report_ids');
            if ($rawIds) {
                $this->ids = is_array($rawIds) ? $rawIds : explode(',', (string) $rawIds);
                $this->ids = array_filter(array_map('intval', $this->ids));
            }
        }

        $this->targetCompany = $targetCompany ?: $request->input('company');
        if ($this->targetCompany === 'all') {
            $this->targetCompany = null;
        }
    }

    public function collection(): Collection
    {
        return WorkReport::with(['user', 'reviewer'])
            ->when(!empty($this->ids), fn ($q) => $q->whereIn('id', $this->ids))
            ->when($this->targetCompany, fn ($q) => $q->whereHas('user', fn ($u) => $u->where('company', $this->targetCompany)))
            ->when($this->status && $this->status !== 'all', fn ($q) => $q->where('status', $this->status))
            ->when($this->startDate && $this->endDate, fn ($q) => $q->whereBetween('report_date', [$this->startDate, $this->endDate]))
            ->when($this->date && !$this->startDate, fn ($q) => $q->whereDate('report_date', $this->date))
            ->when($this->search, function ($q, $s) {
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
    }

    public function headings(): array
    {
        return [
            'NO',
            'TANGGAL',
            'NIK',
            'NAMA KARYAWAN',
            'PERUSAHAAN',
            'NO. WA',
            '1. ABSEN MASUK (RINCIAN)',
            '1. FOTO ABSEN',
            '2. KEGIATAN 1 (RINCIAN)',
            '2. FOTO KEGIATAN 1',
            '3. KEGIATAN 2 (RINCIAN)',
            '3. FOTO KEGIATAN 2',
            '4. KEGIATAN LAIN (RINCIAN)',
            '4. FOTO KEGIATAN LAIN',
            'STATUS REVIEW',
            'REVIEWER',
            'TANGGAL REVIEW',
            'FEEDBACK / CATATAN EVALUASI',
        ];
    }

    public function map(mixed $row): array
    {
        $this->rowNumber++;

        $statusText = match ($row->status) {
            'approved' => 'Disetujui',
            'rejected' => 'Perlu Revisi',
            default => 'Menunggu Review',
        };

        $companyText = ($row->user?->company === 'rimamandiri') ? 'PT. Riama Mandiri Pratama' : 'PT. Rimbun Buana Sejahtera';

        $photoAbsen = $this->formatPhotoHyperlink($row->photo_absen);
        $keg1Path = $row->photo_kegiatan1 ?: $row->attachment_path;
        $photoKeg1 = $this->formatPhotoHyperlink($keg1Path);
        $photoKeg2 = $this->formatPhotoHyperlink($row->photo_kegiatan2);
        $photoKegLain = $this->formatPhotoHyperlink($row->photo_kegiatan_lain);

        return [
            $this->rowNumber,
            $row->report_date ? date('d/m/Y', strtotime($row->report_date)) : '-',
            $row->nik ? "'" . $row->nik : '-',
            $row->user?->name ?? 'Karyawan',
            $companyText,
            $row->user?->phone ?? '-',
            $row->desc_absen ?: '-',
            $photoAbsen,
            $row->desc_kegiatan1 ?: ($row->description ?: '-'),
            $photoKeg1,
            $row->desc_kegiatan2 ?: '-',
            $photoKeg2,
            $row->desc_kegiatan_lain ?: '-',
            $photoKegLain,
            $statusText,
            $row->reviewer?->name ?? '-',
            $row->reviewed_at ? date('d/m/Y H:i', strtotime($row->reviewed_at)) : '-',
            $row->feedback ?: '-',
        ];
    }

    protected function formatPhotoHyperlink(?string $path): string
    {
        if (empty($path)) {
            return 'Tidak Ada';
        }

        $url = $this->formatPhotoUrl($path);
        if (!$url) {
            return 'Tidak Ada';
        }

        return '=HYPERLINK("' . $url . '", "Lihat Foto")';
    }

    protected function formatPhotoUrl(?string $path): ?string
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

    public function styles(Worksheet $sheet): array
    {
        $lastRow = max(2, $this->rowNumber + 1);

        // Styling kolom foto: H (1. Foto Absen), J (2. Foto Kegiatan 1), L (3. Foto Kegiatan 2), N (4. Foto Kegiatan Lain)
        foreach (['H', 'J', 'L', 'N'] as $col) {
            $sheet->getStyle("{$col}2:{$col}{$lastRow}")
                ->getFont()
                ->getColor()
                ->setRGB('0066CC');
            $sheet->getStyle("{$col}2:{$col}{$lastRow}")
                ->getFont()
                ->setUnderline(true);
            $sheet->getStyle("{$col}2:{$col}{$lastRow}")
                ->getAlignment()
                ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);
        }

        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '004AC6'],
                ],
            ],
        ];
    }
}
