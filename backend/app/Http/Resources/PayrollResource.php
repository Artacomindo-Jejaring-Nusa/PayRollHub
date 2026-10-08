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
        $user = $request->user();
        $isAdmin = $user && $user->role === 'admin';

        return [
            'id' => $this->id,
            'row_no' => $this->row_no,
            'employee_name' => $this->employee_name,
            'nik' => $this->nik,
            'province' => $this->province,
            'school_unit' => $this->school_unit,
            'position' => $this->position,
            'join_date' => $this->formatJoinDate($this->join_date),
            'resign_date' => $this->formatJoinDate($this->resign_date),
            'status' => $this->status ?: 'active',
            'company' => $this->company ?: 'rbs',
            'period' => $this->period,
            'net_base_price' => $isAdmin ? (float) $this->net_base_price : 0,
            'bpjs_kes' => $isAdmin ? (float) $this->bpjs_kes : 0,
            'bpjs_tk' => $isAdmin ? (float) $this->bpjs_tk : 0,
            'basic_salary' => $isAdmin ? (float) $this->basic_salary : 0,
            'allowance' => $isAdmin ? (float) $this->allowance : 0,
            'deduction' => $isAdmin ? (float) $this->deduction : 0,
            'absence_count' => $isAdmin ? (int) $this->absence_count : 0,
            'absence_rate' => $isAdmin ? (float) $this->absence_rate : 0,
            'absence_deduction' => $isAdmin ? (float) $this->absence_deduction : 0,
            'absence_note' => $isAdmin ? $this->absence_note : null,
            'take_home_pay' => $isAdmin ? (float) $this->take_home_pay : 0,
            'bank_account' => $isAdmin ? $this->bank_account : null,
            'bank_name' => $isAdmin ? $this->bank_name : null,
            'formatted_net_base_price' => $isAdmin ? ('Rp ' . number_format((float) $this->net_base_price, 0, ',', '.')) : '-',
            'formatted_bpjs_kes' => $isAdmin ? ('Rp ' . number_format((float) $this->bpjs_kes, 0, ',', '.')) : '-',
            'formatted_bpjs_tk' => $isAdmin ? ('Rp ' . number_format((float) $this->bpjs_tk, 0, ',', '.')) : '-',
            'formatted_basic_salary' => $isAdmin ? ('Rp ' . number_format((float) $this->basic_salary, 0, ',', '.')) : '-',
            'formatted_allowance' => $isAdmin ? ('Rp ' . number_format((float) $this->allowance, 0, ',', '.')) : '-',
            'formatted_deduction' => $isAdmin ? ('Rp ' . number_format((float) $this->deduction, 0, ',', '.')) : '-',
            'formatted_absence_deduction' => $isAdmin ? ('Rp ' . number_format((float) $this->absence_deduction, 0, ',', '.')) : '-',
            'formatted_take_home_pay' => $isAdmin ? ('Rp ' . number_format((float) $this->take_home_pay, 0, ',', '.')) : '-',
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
