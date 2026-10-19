<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Auth;

class PayrollResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var User|null $user */
        $user = $request->user() ?: Auth::user();
        $isAdmin = $user instanceof User ? $user->isAdmin() : false;

        $userNik = !empty($user->nik) ? trim(ltrim((string) $user->nik, "'")) : null;
        $payrollNik = !empty($this->nik) ? trim(ltrim((string) $this->nik, "'")) : null;
        $isOwner = $user && $userNik && $payrollNik && ($userNik === $payrollNik);
        $canViewFinancials = $isAdmin || $isOwner;

        return [
            'id' => $this->id,
            'row_no' => $this->row_no,
            'employee_name' => $this->employee_name,
            'nik' => $this->nik,
            'province' => $this->province,
            'school_unit' => $this->school_unit,
            'position' => $this->position,
            'birth_date' => $this->birth_date,
            'gender' => $this->gender,
            'marital_status' => $isAdmin ? $this->marital_status : null,
            'whatsapp' => $this->whatsapp,
            'email' => $this->email,
            'join_date' => $this->formatJoinDate($this->join_date),
            'resign_date' => $this->formatJoinDate($this->resign_date),
            'status' => $this->status ?: 'active',
            'company' => $this->company ?: 'rbs',
            'period' => $this->period,
            'is_visible_to_user' => (bool) ($this->is_visible_to_user ?? true),
            'net_base_price' => $canViewFinancials ? (float) $this->net_base_price : 0,
            'bpjs_kes' => $canViewFinancials ? (float) $this->bpjs_kes : 0,
            'bpjs_tk' => $canViewFinancials ? (float) $this->bpjs_tk : 0,
            'basic_salary' => $canViewFinancials ? (float) $this->basic_salary : 0,
            'allowance' => $canViewFinancials ? (float) $this->allowance : 0,
            'deduction' => $canViewFinancials ? (float) $this->deduction : 0,
            'attended_days' => $canViewFinancials ? (int) ($this->attended_days ?? 0) : 0,
            'holiday_days' => $canViewFinancials ? (int) ($this->holiday_days ?? 0) : 0,
            'custom_deductions' => $canViewFinancials ? ($this->custom_deductions ?? []) : [],
            'absence_count' => $canViewFinancials ? (int) $this->absence_count : 0,
            'absence_rate' => $canViewFinancials ? (float) $this->absence_rate : 0,
            'absence_deduction' => $canViewFinancials ? (float) $this->absence_deduction : 0,
            'absence_note' => $canViewFinancials ? $this->absence_note : null,
            'pph21' => $canViewFinancials ? (float) $this->pph21 : 0,
            'take_home_pay' => $canViewFinancials ? (function () {
                $earnings = (float) $this->basic_salary + (float) $this->bpjs_kes + (float) $this->allowance;
                $deductions = (float) $this->absence_deduction + (float) $this->deduction + (float) $this->pph21;
                return $earnings > 0 ? max(0, $earnings - $deductions) : (float) $this->take_home_pay;
            })() : 0,
            'bank_account' => $canViewFinancials ? $this->bank_account : null,
            'bank_name' => $canViewFinancials ? $this->bank_name : null,
            'formatted_pph21' => $canViewFinancials ? ('Rp ' . number_format((float) $this->pph21, 0, ',', '.')) : '-',
            'formatted_net_base_price' => $canViewFinancials ? ('Rp ' . number_format((float) $this->net_base_price, 0, ',', '.')) : '-',
            'formatted_bpjs_kes' => $canViewFinancials ? ('Rp ' . number_format((float) $this->bpjs_kes, 0, ',', '.')) : '-',
            'formatted_bpjs_tk' => $canViewFinancials ? ('Rp ' . number_format((float) $this->bpjs_tk, 0, ',', '.')) : '-',
            'formatted_basic_salary' => $canViewFinancials ? ('Rp ' . number_format((float) $this->basic_salary, 0, ',', '.')) : '-',
            'formatted_allowance' => $canViewFinancials ? ('Rp ' . number_format((float) $this->allowance, 0, ',', '.')) : '-',
            'formatted_deduction' => $canViewFinancials ? ('Rp ' . number_format((float) $this->deduction, 0, ',', '.')) : '-',
            'formatted_absence_deduction' => $canViewFinancials ? ('Rp ' . number_format((float) $this->absence_deduction, 0, ',', '.')) : '-',
            'formatted_take_home_pay' => $canViewFinancials ? (function () {
                $earnings = (float) $this->basic_salary + (float) $this->bpjs_kes + (float) $this->allowance;
                $deductions = (float) $this->absence_deduction + (float) $this->deduction + (float) $this->pph21;
                $thp = $earnings > 0 ? max(0, $earnings - $deductions) : (float) $this->take_home_pay;
                return 'Rp ' . number_format($thp, 0, ',', '.');
            })() : '-',
            'bpjs_tk_jht' => $canViewFinancials ? (float) ($this->bpjs_tk_jht ?? 0) : 0,
            'bpjs_tk_jp' => $canViewFinancials ? (float) ($this->bpjs_tk_jp ?? 0) : 0,
            'formatted_bpjs_tk_jht' => $canViewFinancials ? ('Rp ' . number_format((float) ($this->bpjs_tk_jht ?? 0), 0, ',', '.')) : '-',
            'formatted_bpjs_tk_jp' => $canViewFinancials ? ('Rp ' . number_format((float) ($this->bpjs_tk_jp ?? 0), 0, ',', '.')) : '-',
            'is_duplicate_bank_account' => (bool) ($this->is_duplicate_bank_account ?? false),
            'duplicate_account_count' => (int) ($this->duplicate_account_count ?? 1),
            'replaced_payroll_id' => $this->replaced_payroll_id,
            'replaced_employee_name' => $this->replaced_employee_name,
            'replacement_note' => $this->replacement_note,
            'replacement_date' => $this->replacement_date ? (is_string($this->replacement_date) ? $this->replacement_date : $this->replacement_date->format('Y-m-d')) : null,
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
