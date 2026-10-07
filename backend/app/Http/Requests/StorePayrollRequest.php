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
            'join_date' => ['nullable', 'string', 'max:50'],
            'period' => ['required', 'string', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'basic_salary' => ['required', 'numeric', 'min:0'],
            'allowance' => ['nullable', 'numeric', 'min:0'],
            'deduction' => ['nullable', 'numeric', 'min:0'],
            'bank_account' => ['nullable', 'string', 'max:50'],
            'bank_name' => ['nullable', 'string', 'max:50'],
        ];
    }

    /**
     * Prepare inputs before validation.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'allowance' => $this->allowance ?? 0,
            'deduction' => $this->deduction ?? 0,
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
            'period.required' => 'Periode gaji wajib diisi.',
            'period.regex' => 'Format periode harus YYYY-MM (contoh: 2026-03).',
            'basic_salary.required' => 'Gaji pokok / Take Home Pay wajib diisi.',
            'basic_salary.min' => 'Gaji pokok tidak boleh bernilai negatif.',
        ];
    }
}
