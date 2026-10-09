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
    protected ?string $search;

    public function __construct(Request $request)
    {
        $this->status = $request->input('status');
        $this->date = $request->input('date');
        $this->search = $request->input('search');
    }

    public function collection(): Collection
    {
        return WorkReport::with(['user', 'reviewer'])
            ->when($this->status && $this->status !== 'all', fn ($q) => $q->where('status', $this->status))
            ->when($this->date, fn ($q) => $q->whereDate('report_date', $this->date))
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
        static $index = 0;
        $index++;

        $statusText = match ($row->status) {
            'approved' => 'Disetujui',
            'rejected' => 'Perlu Revisi',
            default => 'Menunggu Review',
        };

        $companyText = ($row->user?->company === 'rimamandiri') ? 'PT. Riama Mandiri Pratama' : 'PT. Rimbun Buana Sejahtera';

        return [
            $index,
            $row->report_date ? date('d/m/Y', strtotime($row->report_date)) : '-',
            $row->nik ? "'" . $row->nik : '-',
            $row->user?->name ?? 'Karyawan',
            $companyText,
            $row->user?->phone ?? '-',
            $row->desc_absen ?: '-',
            $row->photo_absen ? 'Ada Foto' : 'Tidak Ada',
            $row->desc_kegiatan1 ?: ($row->description ?: '-'),
            $row->photo_kegiatan1 ?: ($row->attachment_path ? 'Ada Foto' : 'Tidak Ada'),
            $row->desc_kegiatan2 ?: '-',
            $row->photo_kegiatan2 ? 'Ada Foto' : 'Tidak Ada',
            $row->desc_kegiatan_lain ?: '-',
            $row->photo_kegiatan_lain ? 'Ada Foto' : 'Tidak Ada',
            $statusText,
            $row->reviewer?->name ?? '-',
            $row->reviewed_at ? date('d/m/Y H:i', strtotime($row->reviewed_at)) : '-',
            $row->feedback ?: '-',
        ];
    }

    public function styles(Worksheet $sheet): array
    {
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
