<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'identifier' => ['required_without:email', 'string'],
            'email' => ['required_without:identifier', 'string'],
            'password' => ['required', 'string'],
            'remember_me' => ['nullable', 'boolean'],
            'company' => ['nullable', 'string', 'max:50'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'identifier.required_without' => 'Email atau NIK wajib diisi.',
            'email.required_without' => 'Email atau NIK wajib diisi.',
            'password.required' => 'Kata sandi wajib diisi.',
        ];
    }
}
