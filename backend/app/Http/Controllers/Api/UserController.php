<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    /**
     * Display a listing of users.
     */
    public function index(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        $search = $request->input('search');
        $role = $request->input('role');
        $company = $request->input('company');

        $query = User::query();

        // 1. Strict company scoping:
        if ($currentUser->isSuperAdmin()) {
            if (!empty($company) && $company !== 'all') {
                $query->where('company', $company);
            }
        } else {
            // Admin biasa hanya bisa melihat akun di perusahaannya sendiri & tidak bisa melihat akun Super Admin
            $userCompany = $currentUser->company ?: 'rbs';
            $query->where('company', $userCompany)
                  ->where('role', '!=', 'super_admin');
        }

        $query->when($search, fn ($q, $s) => 
            $q->where(function ($sub) use ($s) {
                $sub->where('name', 'like', "%{$s}%")
                    ->orWhere('email', 'like', "%{$s}%")
                    ->orWhere('nik', 'like', "%{$s}%");
            })
        )
        ->when($role && in_array($role, ['super_admin', 'admin', 'viewer', 'user', 'karyawan']), fn ($q) => 
            $q->where('role', $role)
        )
        ->latest('id');

        $users = $query->paginate(10)->withQueryString();

        return response()->json([
            'status' => 'success',
            'data' => UserResource::collection($users->items()),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    /**
     * Display the specified user.
     */
    public function show(Request $request, User $user): JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser->isSuperAdmin()) {
            if ($user->company !== $currentUser->company || $user->isSuperAdmin()) {
                abort(403, 'Akses ditolak. Anda tidak memiliki izin untuk melihat pengguna perusahaan lain.');
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => new UserResource($user),
        ]);
    }

    /**
     * Store a newly created user.
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $currentUser = $request->user();
        $data = $request->validated();

        if (!$currentUser->isSuperAdmin()) {
            // Force user to current admin's company
            $data['company'] = $currentUser->company ?: 'rbs';
            if (($data['role'] ?? '') === 'super_admin') {
                abort(403, 'Akses ditolak. Hanya Super Admin yang berhak membuat akun Super Admin.');
            }
        }

        $data['password'] = Hash::make($data['password']);

        $user = User::create($data);

        \App\Models\ActivityLog::record(
            action: 'CREATE_USER',
            module: 'user',
            description: "Membuat akun pengguna baru: {$user->name} ({$user->email}, Role: {$user->role}) - Perusahaan: " . ($user->company ?: 'Umum'),
            details: [
                'target_user_id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'company' => $user->company,
            ],
            company: $user->company
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Pengguna baru berhasil ditambahkan.',
            'data' => new UserResource($user),
        ], 201);
    }

    /**
     * Update the specified user.
     */
    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser->isSuperAdmin()) {
            if ($user->company !== $currentUser->company || $user->isSuperAdmin()) {
                abort(403, 'Akses ditolak. Anda tidak memiliki izin untuk mengubah pengguna perusahaan lain.');
            }
        }

        $data = $request->validated();

        if (!$currentUser->isSuperAdmin()) {
            unset($data['company']); // Cannot switch user to another company
            if (($data['role'] ?? '') === 'super_admin') {
                unset($data['role']);
            }
        }

        if (!empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $user->update($data);

        \App\Models\ActivityLog::record(
            action: 'UPDATE_USER',
            module: 'user',
            description: "Mengubah data akun pengguna: {$user->name} ({$user->email}, Role: {$user->role}) - Perusahaan: " . ($user->company ?: 'Umum'),
            details: [
                'target_user_id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'company' => $user->company,
            ],
            company: $user->company
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Data pengguna berhasil diperbarui.',
            'data' => new UserResource($user->fresh()),
        ]);
    }

    /**
     * Remove the specified user.
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        $currentUser = $request->user();

        if ($currentUser->id === $user->id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak dapat menghapus akun Anda sendiri.',
            ], 422);
        }

        if (!$currentUser->isSuperAdmin()) {
            if ($user->company !== $currentUser->company || $user->isSuperAdmin()) {
                abort(403, 'Akses ditolak. Anda tidak memiliki izin untuk menghapus pengguna perusahaan lain.');
            }
        }

        \App\Models\ActivityLog::record(
            action: 'DELETE_USER',
            module: 'user',
            description: "MENGHAPUS akun pengguna: {$user->name} ({$user->email}, Role: {$user->role}) - Perusahaan: " . ($user->company ?: 'Umum'),
            details: [
                'target_user_id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'company' => $user->company,
            ],
            company: $user->company
        );

        $user->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Pengguna berhasil dihapus.',
        ]);
    }
}
