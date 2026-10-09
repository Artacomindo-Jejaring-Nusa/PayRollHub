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
        $company = $request->input('company');
        $search = $request->input('search');

        $announcements = Announcement::with('author:id,name')
            ->when($company && $company !== 'all', fn ($q) => $q->where('company', $company))
            ->when($search, fn ($q, $s) => $q->where('title', 'like', "%{$s}%")->orWhere('content', 'like', "%{$s}%"))
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
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'content' => ['required', 'string'],
            'category' => ['required', 'string', 'max:50'],
            'company' => ['required', 'string', 'in:all,rbs,rimamandiri'],
            'is_pinned' => ['boolean'],
        ]);

        $announcement = Announcement::create([
            ...$validated,
            'author_id' => $request->user()->id,
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
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'content' => ['required', 'string'],
            'category' => ['required', 'string', 'max:50'],
            'company' => ['required', 'string', 'in:all,rbs,rimamandiri'],
            'is_pinned' => ['boolean'],
        ]);

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
    public function destroy(Announcement $announcement): JsonResponse
    {
        $announcement->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Pengumuman berhasil dihapus.',
        ]);
    }
}
