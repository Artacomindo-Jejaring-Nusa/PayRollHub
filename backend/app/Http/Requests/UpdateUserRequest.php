<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        $userId = $this->route('user')?->id ?? $this->route('id');

        return [
            'name' => ['required', 'string', 'max:150'],
            'email' => [
                'required',
                'email',
                'max:191',
                Rule::unique('users', 'email')->ignore($userId),
            ],
            'password' => ['nullable', 'string', 'min:6'],
            'role' => ['required', 'in:super_admin,admin,user,viewer,karyawan'],
            'company' => ['nullable', 'string', 'in:rbs,rimamandiri'],
            'nik' => ['nullable', 'string', 'max:50'],
            'school_unit' => ['nullable', 'string', 'max:200'],
            'marital_status' => ['nullable', 'string', 'max:50'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama pengguna wajib diisi.',
            'email.required' => 'Email wajib diisi.',
            'email.unique' => 'Email ini sudah digunakan oleh akun lain.',
            'password.min' => 'Kata sandi baru minimal 6 karakter.',
            'role.required' => 'Peran (role) pengguna wajib dipilih.',
            'role.in' => 'Peran harus berupa admin atau user.',
        ];
    }
}
