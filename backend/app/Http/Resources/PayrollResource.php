<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PayrollResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'row_no' => $this->row_no,
            'employee_name' => $this->employee_name,
            'nik' => $this->nik,
            'province' => $this->province,
            'school_unit' => $this->school_unit,
            'position' => $this->position,
            'join_date' => $this->formatJoinDate($this->join_date),
            'period' => $this->period,
            'basic_salary' => (float) $this->basic_salary,
            'allowance' => (float) $this->allowance,
            'deduction' => (float) $this->deduction,
            'take_home_pay' => (float) $this->take_home_pay,
            'bank_account' => $this->bank_account,
            'bank_name' => $this->bank_name,
            'formatted_basic_salary' => 'Rp ' . number_format((float) $this->basic_salary, 0, ',', '.'),
            'formatted_allowance' => 'Rp ' . number_format((float) $this->allowance, 0, ',', '.'),
            'formatted_deduction' => 'Rp ' . number_format((float) $this->deduction, 0, ',', '.'),
            'formatted_take_home_pay' => 'Rp ' . number_format((float) $this->take_home_pay, 0, ',', '.'),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }

    private function formatJoinDate(?string $val): ?string
    {
        if (!$val) {
            return null;
        }
        $val = trim($val);
        if (is_numeric($val) && (int) $val > 20000 && (int) $val < 80000) {
            try {
                $dt = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((int) $val);
                $months = [
                    1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
                    5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
                    9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
                ];
                $d = $dt->format('j');
                $m = (int) $dt->format('n');
                $y = $dt->format('Y');
                return "{$d} {$months[$m]} {$y}";
            } catch (\Throwable) {
            }
        }
        return preg_replace('/\s+/', ' ', $val);
    }
}
