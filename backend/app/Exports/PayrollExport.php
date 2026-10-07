<?php

namespace App\Exports;

use App\Models\Payroll;
use Illuminate\Http\Request;
use Illuminate\Support\Enumerable;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class PayrollExport implements FromCollection, WithHeadings, WithMapping, ShouldAutoSize, WithStyles
{
    protected ?string $search;
    protected ?string $province;
    protected ?string $period;

    public function __construct(Request $request)
    {
        $this->search = $request->input('search');
        $this->province = $request->input('province');
        $this->period = $request->input('period');
    }

    public function collection(): Enumerable
    {
        return Payroll::query()
            ->search($this->search)
            ->byProvince($this->province)
            ->byPeriod($this->period)
            ->orderBy('id', 'asc')
            ->get();
    }

    public function headings(): array
    {
        return [
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
    }

    public function map(mixed $row): array
    {
        return [
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
        ];
    }

    public function styles(Worksheet $sheet): ?array
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
