<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\Payroll;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * Handle an authentication attempt.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $identifier = trim($request->input('identifier') ?? $request->input('email'));
        $password = $request->input('password');

        $throttleKey = Str::transliterate(Str::lower($identifier).'|'.$request->ip());

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            return response()->json([
                'status' => 'error',
                'message' => "Terlalu banyak percobaan login. Silakan coba lagi dalam {$seconds} detik.",
            ], 429);
        }

        // Detect requested company / portal from body, header, or domain origin
        $requestedCompany = $request->input('company') ?: $request->header('X-Tenant-ID');
        if (empty($requestedCompany)) {
            $origin = $request->header('Origin') ?: $request->header('Referer') ?: $request->getHost();
            if ($origin) {
                $originLower = strtolower($origin);
                if (str_contains($originLower, 'riama') || str_contains($originLower, 'rimamandiri')) {
                    $requestedCompany = 'rimamandiri';
                } elseif (str_contains($originLower, 'rimbun')) {
                    $requestedCompany = 'rbs';
                }
            }
        }
        if ($requestedCompany) {
            $reqLower = strtolower($requestedCompany);
            if (in_array($reqLower, ['rimamandiri', 'rima', 'riamamandiripratama'])) {
                $requestedCompany = 'rimamandiri';
            } elseif (in_array($reqLower, ['rbs', 'rimbun', 'rimbunbuanasejahtera'])) {
                $requestedCompany = 'rbs';
            } else {
                $requestedCompany = null;
            }
        }

        // 1. Try finding user directly by email or NIK
        $userQuery = User::where(function ($q) use ($identifier) {
            $q->where('email', $identifier)->orWhere('nik', $identifier);
        });

        if ($requestedCompany) {
            // Priority: find user belonging to this company or super_admin
            $user = (clone $userQuery)->where(function ($q) use ($requestedCompany) {
                $q->where('company', $requestedCompany)->orWhere('role', 'super_admin');
            })->first();

            // If not found, look for any user with this identifier to detect wrong portal
            if (!$user) {
                $user = $userQuery->first();
            }
        } else {
            $user = $userQuery->first();
        }

        // 2. If not found in users, check if valid employee NIK in payrolls (Auto-provisioning karyawan)
        if (!$user && preg_match('/^[A-Za-z0-9\-]+$/', $identifier)) {
            $payrollQuery = Payroll::where('nik', $identifier);
            if ($requestedCompany) {
                $payrollQuery->where('company', $requestedCompany);
            }
            $payroll = $payrollQuery->latest('period')->first();
            if (!$payroll && !$requestedCompany) {
                $payroll = Payroll::where('nik', $identifier)->latest('period')->first();
            }
            if ($payroll) {
                $user = \App\Services\PayrollService::syncEmployeeAccount($payroll);
            }
        }

        $isPasswordValid = $user && Hash::check($password, $user->password);

        // Fallback untuk akun karyawan: izinkan login dengan NIK atau password123 sebagai kata sandi default
        if (!$isPasswordValid && $user && $user->role === 'karyawan') {
            if ((!empty($user->nik) && $password === $user->nik) || $password === 'password123') {
                $isPasswordValid = true;
                $user->password = Hash::make($password);
                $user->save();
            }
        }

        if (!$user || !$isPasswordValid) {
            RateLimiter::hit($throttleKey, 60);

            return response()->json([
                'status' => 'error',
                'message' => 'Email/NIK atau kata sandi tidak cocok. Silakan coba lagi.',
            ], 422);
        }

        // 3. Strict portal boundary enforcement: Only Super Admin can access both dashboards
        if ($user->role !== 'super_admin' && $requestedCompany) {
            $userCompany = in_array(strtolower($user->company ?: ''), ['rimamandiri', 'rima', 'riamamandiripratama']) ? 'rimamandiri' : 'rbs';
            if ($userCompany !== $requestedCompany) {
                $targetPortal = $userCompany === 'rimamandiri'
                    ? 'PT. Riama Mandiri Pratama (riamamandiripratama.com)'
                    : 'PT. Rimbun Buana Sejahtera (rimbunbuanasejahtera.com)';
                $currentPortal = $requestedCompany === 'rimamandiri' ? 'Riama Mandiri' : 'RBS Global';

                RateLimiter::hit($throttleKey, 60);

                return response()->json([
                    'status' => 'error',
                    'message' => "Akun Anda terdaftar di {$targetPortal}. Anda tidak dapat login melalui portal {$currentPortal}. Silakan gunakan portal yang sesuai.",
                ], 403);
            }
        }

        RateLimiter::clear($throttleKey);

        // Update last login timestamp & IP
        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        // Delete old tokens if not remember_me or generate fresh token
        $tokenName = $request->boolean('remember_me') ? 'auth_token_remembered' : 'auth_token';
        $token = $user->createToken($tokenName)->plainTextToken;

        // Catat activity log login
        \App\Models\ActivityLog::record(
            action: 'LOGIN',
            module: 'auth',
            description: "Pengguna {$user->name} ({$user->role}) berhasil masuk ke sistem.",
            details: ['email' => $user->email, 'role' => $user->role],
            company: $user->company,
            user: $user
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Login berhasil.',
            'data' => [
                'user' => new UserResource($user),
                'token' => $token,
                'role' => $user->role,
            ],
        ]);
    }

    /**
     * Revoke current user's token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Logout berhasil. Sesi telah diakhiri.',
        ]);
    }

    /**
     * Get the authenticated user profile.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => new UserResource($request->user()),
        ]);
    }
}
