<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnnouncementController extends Controller
{
    /**
     * Display a listing of announcements (Admin & HR view).
     */
    public function index(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        $search = $request->input('search');

        $targetCompany = $currentUser->isSuperAdmin()
            ? ($request->input('company') && $request->input('company') !== 'all' ? $request->input('company') : null)
            : ($currentUser->company ?: 'rbs');

        $query = Announcement::with('author:id,name');

        if ($targetCompany) {
            $query->whereIn('company', ['all', $targetCompany]);
        }

        $announcements = $query
            ->when($search, fn ($q, $s) => $q->where(fn ($sub) => $sub->where('title', 'like', "%{$s}%")->orWhere('content', 'like', "%{$s}%")))
            ->orderByDesc('is_pinned')
            ->latest('published_at')
            ->paginate(15);

        return response()->json([
            'status' => 'success',
            'data' => $announcements->items(),
            'meta' => [
                'current_page' => $announcements->currentPage(),
                'last_page' => $announcements->lastPage(),
                'total' => $announcements->total(),
            ],
        ]);
    }

    /**
     * Store a newly created announcement.
     */
    public function store(Request $request): JsonResponse
    {
        $currentUser = $request->user();

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'content' => ['required', 'string'],
            'category' => ['required', 'string', 'max:50'],
            'company' => ['required', 'string', 'in:all,rbs,rimamandiri'],
            'is_pinned' => ['boolean'],
        ]);

        if (!$currentUser->isSuperAdmin()) {
            $validated['company'] = $currentUser->company ?: 'rbs';
        }

        $announcement = Announcement::create([
            ...$validated,
            'author_id' => $currentUser->id,
            'published_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Pengumuman berhasil dipublikasikan.',
            'data' => $announcement->load('author:id,name'),
        ], 201);
    }

    /**
     * Update an existing announcement.
     */
    public function update(Request $request, Announcement $announcement): JsonResponse
    {
        $currentUser = $request->user();

        if (!$currentUser->isSuperAdmin()) {
            $userCompany = $currentUser->company ?: 'rbs';
            if ($announcement->company !== $userCompany && $announcement->company !== 'all') {
                abort(403, 'Akses ditolak. Anda tidak memiliki izin mengubah pengumuman perusahaan lain.');
            }
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'content' => ['required', 'string'],
            'category' => ['required', 'string', 'max:50'],
            'company' => ['required', 'string', 'in:all,rbs,rimamandiri'],
            'is_pinned' => ['boolean'],
        ]);

        if (!$currentUser->isSuperAdmin()) {
            $validated['company'] = $currentUser->company ?: 'rbs';
        }

        $announcement->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Pengumuman berhasil diperbarui.',
            'data' => $announcement->load('author:id,name'),
        ]);
    }

    /**
     * Delete an announcement.
     */
    public function destroy(Request $request, Announcement $announcement): JsonResponse
    {
        $currentUser = $request->user();

        if (!$currentUser->isSuperAdmin()) {
            $userCompany = $currentUser->company ?: 'rbs';
            if ($announcement->company !== $userCompany && $announcement->company !== 'all') {
                abort(403, 'Akses ditolak. Anda tidak memiliki izin menghapus pengumuman perusahaan lain.');
            }
        }

        $announcement->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Pengumuman berhasil dihapus.',
        ]);
    }
}
