<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

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
     * Store a newly created announcement with optional attachment (photo/document).
     */
    public function store(Request $request): JsonResponse
    {
        $currentUser = $request->user();

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'content' => ['required', 'string'],
            'category' => ['required', 'string', 'max:50'],
            'company' => ['required', 'string', 'in:all,rbs,rimamandiri'],
            'is_pinned' => ['nullable'],
            'attachment' => ['nullable', 'file', 'max:25600'], // max 25MB (photo or document)
        ]);

        if (!$currentUser->isSuperAdmin()) {
            $validated['company'] = $currentUser->company ?: 'rbs';
        }

        $attachmentData = [];
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $mime = $file->getMimeType() ?: $file->getClientMimeType() ?: '';
            $isImage = str_starts_with($mime, 'image/');
            $path = $file->store('announcements', 'public');

            $attachmentData = [
                'attachment_path' => $path,
                'attachment_name' => $file->getClientOriginalName(),
                'attachment_type' => $isImage ? 'image' : 'file',
                'attachment_mime' => $mime,
                'attachment_size' => $file->getSize(),
            ];
        }

        $announcement = Announcement::create([
            'title' => $validated['title'],
            'content' => $validated['content'],
            'category' => $validated['category'],
            'company' => $validated['company'],
            'is_pinned' => filter_var($request->input('is_pinned', false), FILTER_VALIDATE_BOOLEAN),
            'author_id' => $currentUser->id,
            'published_at' => now(),
            ...$attachmentData,
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
            'is_pinned' => ['nullable'],
            'attachment' => ['nullable', 'file', 'max:25600'],
            'remove_attachment' => ['nullable'],
        ]);

        if (!$currentUser->isSuperAdmin()) {
            $validated['company'] = $currentUser->company ?: 'rbs';
        }

        $updateData = [
            'title' => $validated['title'],
            'content' => $validated['content'],
            'category' => $validated['category'],
            'company' => $validated['company'],
            'is_pinned' => filter_var($request->input('is_pinned', false), FILTER_VALIDATE_BOOLEAN),
        ];

        // Hapus attachment lama jika diminta
        if (filter_var($request->input('remove_attachment', false), FILTER_VALIDATE_BOOLEAN)) {
            if ($announcement->attachment_path && Storage::disk('public')->exists($announcement->attachment_path)) {
                Storage::disk('public')->delete($announcement->attachment_path);
            }
            $updateData['attachment_path'] = null;
            $updateData['attachment_name'] = null;
            $updateData['attachment_type'] = null;
            $updateData['attachment_mime'] = null;
            $updateData['attachment_size'] = null;
        }

        // Upload attachment baru jika ada
        if ($request->hasFile('attachment')) {
            if ($announcement->attachment_path && Storage::disk('public')->exists($announcement->attachment_path)) {
                Storage::disk('public')->delete($announcement->attachment_path);
            }
            $file = $request->file('attachment');
            $mime = $file->getMimeType() ?: $file->getClientMimeType() ?: '';
            $isImage = str_starts_with($mime, 'image/');
            $path = $file->store('announcements', 'public');

            $updateData['attachment_path'] = $path;
            $updateData['attachment_name'] = $file->getClientOriginalName();
            $updateData['attachment_type'] = $isImage ? 'image' : 'file';
            $updateData['attachment_mime'] = $mime;
            $updateData['attachment_size'] = $file->getSize();
        }

        $announcement->update($updateData);

        return response()->json([
            'status' => 'success',
            'message' => 'Pengumuman berhasil diperbarui.',
            'data' => $announcement->load('author:id,name'),
        ]);
    }

    /**
     * Delete an announcement and its attachment file.
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

        if ($announcement->attachment_path && Storage::disk('public')->exists($announcement->attachment_path)) {
            Storage::disk('public')->delete($announcement->attachment_path);
        }

        $announcement->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Pengumuman berhasil dihapus.',
        ]);
    }
}
