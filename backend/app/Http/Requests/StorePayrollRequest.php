<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePayrollRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'row_no' => ['nullable', 'string', 'max:50'],
            'employee_name' => ['required', 'string', 'max:150'],
            'nik' => ['nullable', 'string', 'max:50'],
            'province' => ['required', 'string', 'max:100'],
            'school_unit' => ['nullable', 'string', 'max:200'],
            'position' => ['nullable', 'string', 'max:100'],
            'birth_date' => ['nullable', 'string', 'max:50'],
            'gender' => ['nullable', 'string', 'max:30'],
            'marital_status' => ['nullable', 'string', 'max:50'],
            'whatsapp' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'string', 'email', 'max:100'],
            'join_date' => ['nullable', 'string', 'max:50'],
            'resign_date' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'string', 'in:active,off'],
            'company' => ['nullable', 'string', 'max:50'],
            'period' => ['required', 'string', 'max:50'],
            'is_visible_to_user' => ['nullable', 'boolean'],
            'net_base_price' => ['nullable', 'numeric', 'min:0'],
            'bpjs_kes' => ['nullable', 'numeric', 'min:0'],
            'bpjs_tk' => ['nullable', 'numeric', 'min:0'],
            'basic_salary' => ['required', 'numeric', 'min:0'],
            'allowance' => ['nullable', 'numeric', 'min:0'],
            'deduction' => ['nullable', 'numeric', 'min:0'],
            'attended_days' => ['nullable', 'integer', 'min:0'],
            'holiday_days' => ['nullable', 'integer', 'min:0'],
            'custom_deductions' => ['nullable', 'array'],
            'custom_deductions.*.name' => ['nullable', 'string', 'max:150'],
            'custom_deductions.*.amount' => ['nullable', 'numeric', 'min:0'],
            'absence_count' => ['nullable', 'integer', 'min:0'],
            'absence_rate' => ['nullable', 'numeric', 'min:0'],
            'absence_deduction' => ['nullable', 'numeric', 'min:0'],
            'absence_note' => ['nullable', 'string', 'max:255'],
            'pph21' => ['nullable', 'numeric', 'min:0'],
            'take_home_pay' => ['nullable', 'numeric', 'min:0'],
            'bank_account' => ['nullable', 'string', 'max:50'],
            'bank_name' => ['nullable', 'string', 'max:50'],
            'bpjs_tk_jht' => ['nullable', 'numeric', 'min:0'],
            'bpjs_tk_jp' => ['nullable', 'numeric', 'min:0'],
            'replaced_payroll_id' => ['nullable', 'integer'],
            'replaced_employee_name' => ['nullable', 'string', 'max:150'],
            'replacement_note' => ['nullable', 'string', 'max:500'],
            'replacement_date' => ['nullable', 'date'],
        ];
    }

    /**
     * Prepare inputs before validation.
     */
    protected function prepareForValidation(): void
    {
        $basicSalary = (float) ($this->basic_salary ?? 0);
        $bpjsKes = (float) ($this->bpjs_kes ?? 0);
        $bpjsTk = (float) ($this->bpjs_tk ?? 0);
        $netBase = (float) ($this->net_base_price ?? 0);

        $absenceCount = (int) ($this->absence_count ?? 0);
        $absenceRate = (float) ($this->absence_rate ?? 0);
        $absenceDeduction = (float) ($this->absence_deduction ?? 0);
        if ($absenceCount > 0 && $absenceRate > 0 && $absenceDeduction <= 0) {
            $absenceDeduction = $absenceCount * $absenceRate;
        }

        // Backward compatibility: if basic_salary is omitted but net_base_price exists
        if ($basicSalary <= 0 && $netBase > 0) {
            $basicSalary = max(0, $netBase - $bpjsKes - $bpjsTk);
        }

        $deduction = (float) ($this->deduction ?? 0);
        if (!empty($this->custom_deductions) && is_array($this->custom_deductions)) {
            $customSum = collect($this->custom_deductions)->sum(fn($i) => (float)($i['amount'] ?? 0));
            if ($customSum > 0 || empty($this->deduction)) {
                $deduction = $customSum;
            }
        }

        $bpjsTkJht = (float) ($this->bpjs_tk_jht ?? 0);
        $bpjsTkJp = (float) ($this->bpjs_tk_jp ?? 0);
        if (($bpjsTkJht > 0 || $bpjsTkJp > 0) && $bpjsTk <= 0) {
            $bpjsTk = $bpjsTkJht + $bpjsTkJp;
        }

        $this->merge([
            'net_base_price' => $netBase,
            'bpjs_kes' => $bpjsKes,
            'bpjs_tk' => $bpjsTk,
            'bpjs_tk_jht' => $bpjsTkJht,
            'bpjs_tk_jp' => $bpjsTkJp,
            'basic_salary' => $basicSalary,
            'allowance' => $this->allowance ?? 0,
            'deduction' => $deduction,
            'absence_count' => $absenceCount,
            'absence_rate' => $absenceRate,
            'absence_deduction' => $absenceDeduction,
            'status' => $this->status ?: (!empty($this->resign_date) ? 'off' : 'active'),
            'company' => $this->company ?: 'rbs',
        ]);
    }

    /**
     * Custom validation messages.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'employee_name.required' => 'Nama lengkap karyawan wajib diisi.',
            'province.required' => 'Wilayah / Provinsi wajib dipilih.',
            'period.required' => 'Surat Pesanan (SP) / Periode wajib diisi.',
            'basic_salary.required' => 'Gaji pokok / Take Home Pay wajib diisi.',
            'basic_salary.min' => 'Gaji pokok tidak boleh bernilai negatif.',
        ];
    }
}
