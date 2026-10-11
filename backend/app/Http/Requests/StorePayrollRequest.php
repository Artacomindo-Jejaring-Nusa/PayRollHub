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
            'whatsapp' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'string', 'email', 'max:100'],
            'join_date' => ['nullable', 'string', 'max:50'],
            'resign_date' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'string', 'in:active,off'],
            'company' => ['nullable', 'string', 'max:50'],
            'period' => ['required', 'string', 'max:50'],
            'net_base_price' => ['nullable', 'numeric', 'min:0'],
            'bpjs_kes' => ['nullable', 'numeric', 'min:0'],
            'bpjs_tk' => ['nullable', 'numeric', 'min:0'],
            'basic_salary' => ['required', 'numeric', 'min:0'],
            'allowance' => ['nullable', 'numeric', 'min:0'],
            'deduction' => ['nullable', 'numeric', 'min:0'],
            'absence_count' => ['nullable', 'integer', 'min:0'],
            'absence_rate' => ['nullable', 'numeric', 'min:0'],
            'absence_deduction' => ['nullable', 'numeric', 'min:0'],
            'absence_note' => ['nullable', 'string', 'max:255'],
            'pph21' => ['nullable', 'numeric', 'min:0'],
            'bank_account' => ['nullable', 'string', 'max:50'],
            'bank_name' => ['nullable', 'string', 'max:50'],
        ];
    }

    /**
     * Prepare inputs before validation.
     */
    protected function prepareForValidation(): void
    {
        $netBase = (float) ($this->net_base_price ?? 0);
        $bpjsKes = (float) ($this->bpjs_kes ?? 0);
        $bpjsTk = (float) ($this->bpjs_tk ?? 0);
        $basicSalary = (float) ($this->basic_salary ?? 0);

        if ($netBase > 0) {
            if ($bpjsKes <= 0) {
                $bpjsKes = round($netBase * 0.05, 2);
            }
            if ($bpjsTk <= 0) {
                $bpjsTk = round($netBase * 0.0924, 2);
            }
            if ($basicSalary <= 0) {
                $basicSalary = $netBase - $bpjsKes - $bpjsTk;
            }
        }

        $absenceCount = (int) ($this->absence_count ?? 0);
        $absenceRate = (float) ($this->absence_rate ?? 0);
        $absenceDeduction = (float) ($this->absence_deduction ?? 0);
        if ($absenceCount > 0 && $absenceRate > 0 && $absenceDeduction <= 0) {
            $absenceDeduction = $absenceCount * $absenceRate;
        }

        $this->merge([
            'net_base_price' => $netBase,
            'bpjs_kes' => $bpjsKes,
            'bpjs_tk' => $bpjsTk,
            'basic_salary' => $basicSalary,
            'allowance' => $this->allowance ?? 0,
            'deduction' => $this->deduction ?? 0,
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
