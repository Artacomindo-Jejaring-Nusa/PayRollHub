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
        $search = $request->input('search');
        $role = $request->input('role');

        $query = User::query()
            ->when($search, fn ($q, $s) => 
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%")
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
    public function show(User $user): JsonResponse
    {
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
        $data = $request->validated();
        $data['password'] = Hash::make($data['password']);

        $user = User::create($data);

        \App\Models\ActivityLog::record(
            action: 'CREATE_USER',
            module: 'user',
            description: "Membuat akun pengguna baru: {$user->name} ({$user->email}, Role: {$user->role})",
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
        $data = $request->validated();

        if (!empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $user->update($data);

        \App\Models\ActivityLog::record(
            action: 'UPDATE_USER',
            module: 'user',
            description: "Mengubah data akun pengguna: {$user->name} ({$user->email}, Role: {$user->role})",
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
        if ($request->user()->id === $user->id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak dapat menghapus akun Anda sendiri.',
            ], 422);
        }

        \App\Models\ActivityLog::record(
            action: 'DELETE_USER',
            module: 'user',
            description: "MENGHAPUS akun pengguna: {$user->name} ({$user->email}, Role: {$user->role})",
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
