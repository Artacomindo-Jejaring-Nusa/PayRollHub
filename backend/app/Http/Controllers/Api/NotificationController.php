<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\FcmDeviceToken;
use App\Services\FirebaseNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    protected FirebaseNotificationService $firebaseService;

    public function __construct(FirebaseNotificationService $firebaseService)
    {
        $this->firebaseService = $firebaseService;
    }

    /**
     * Register or refresh employee's FCM device token.
     */
    public function registerToken(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:500'],
            'platform' => ['nullable', 'string', 'in:android,ios,web'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $user = $request->user();

        $deviceToken = FcmDeviceToken::updateOrCreate(
            [
                'user_id' => $user->id,
                'token' => $validated['token'],
            ],
            [
                'platform' => $validated['platform'] ?? 'android',
                'device_name' => $validated['device_name'] ?? null,
                'last_active_at' => now(),
            ]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'FCM Token berhasil didaftarkan.',
            'data' => $deviceToken,
        ]);
    }

    /**
     * Remove FCM device token (e.g., when logging out).
     */
    public function removeToken(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
        ]);

        FcmDeviceToken::where('user_id', $request->user()->id)
            ->where('token', $request->input('token'))
            ->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'FCM Token berhasil dihapus.',
        ]);
    }

    /**
     * Get recent in-app notifications for Web Dashboard & Mobile.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $company = $user->company ?: 'all';

        $query = AppNotification::forUser($user->id, $company)
            ->latest();

        $unreadCount = AppNotification::forUser($user->id, $company)
            ->unread()
            ->count();

        $notifications = $query->paginate($request->input('per_page', 20));

        return response()->json([
            'status' => 'success',
            'data' => $notifications->items(),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'total' => $notifications->total(),
                'unread_count' => $unreadCount,
            ],
        ]);
    }

    /**
     * Mark single notification as read.
     */
    public function markAsRead(Request $request, int $id): JsonResponse
    {
        $notification = AppNotification::findOrFail($id);

        $notification->update([
            'is_read' => true,
            'read_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Notifikasi ditandai telah dibaca.',
        ]);
    }

    /**
     * Mark all notifications as read for current user.
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $user = $request->user();
        $company = $user->company ?: 'all';

        AppNotification::forUser($user->id, $company)
            ->unread()
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Semua notifikasi berhasil ditandai telah dibaca.',
        ]);
    }

    /**
     * Test push notification endpoint for developer & QA.
     */
    public function testPush(Request $request): JsonResponse
    {
        $user = $request->user();

        $tokensCount = FcmDeviceToken::where('user_id', $user->id)->count();

        $sentCount = $this->firebaseService->sendToUser(
            $user->id,
            '🔔 Uji Coba Notifikasi Firebase',
            'Halo ' . $user->name . '! Sistem Push Notification FCM berhasil terhubung dengan perangkat Anda.',
            'test_notification',
            ['timestamp' => now()->toIso8601String(), 'target' => 'dashboard']
        );

        return response()->json([
            'status' => 'success',
            'message' => "Push notification dikirim ke {$sentCount} dari {$tokensCount} perangkat terdaftar.",
            'data' => [
                'user_id' => $user->id,
                'registered_tokens' => $tokensCount,
                'delivered_devices' => $sentCount,
            ],
        ]);
    }
}
