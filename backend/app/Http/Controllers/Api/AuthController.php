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

        // 1. Try finding user directly by email
        $user = User::where('email', $identifier)->first();

        // 2. If not found by email and looks like NIK, try to find user by linked employee name or fallback
        if (!$user && preg_match('/^\d+$/', $identifier)) {
            $payroll = Payroll::where('nik', $identifier)->first();
            if ($payroll) {
                // If payroll exists, match by name or fallback user
                $user = User::where('name', 'like', "%{$payroll->employee_name}%")->first();
            }
        }

        if (!$user || !Hash::check($password, $user->password)) {
            RateLimiter::hit($throttleKey, 60);

            return response()->json([
                'status' => 'error',
                'message' => 'Email/NIK atau kata sandi tidak cocok. Silakan coba lagi.',
            ], 422);
        }

        RateLimiter::clear($throttleKey);

        // Delete old tokens if not remember_me or generate fresh token
        $tokenName = $request->boolean('remember_me') ? 'auth_token_remembered' : 'auth_token';
        $token = $user->createToken($tokenName)->plainTextToken;

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
