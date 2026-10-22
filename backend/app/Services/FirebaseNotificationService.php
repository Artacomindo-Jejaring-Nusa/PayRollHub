<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\FcmDeviceToken;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FirebaseNotificationService
{
    protected ?string $projectId = null;
    protected ?string $clientEmail = null;
    protected ?string $privateKey = null;

    public function __construct()
    {
        $this->loadCredentials();
    }

    /**
     * Load Firebase Service Account Credentials from storage.
     */
    protected function loadCredentials(): void
    {
        $path = storage_path('app/firebase/firebase_credentials.json');

        if (!file_exists($path)) {
            // File kredensial Firebase opsional, jangan spam warning log di setiap request API
            return;
        }

        try {
            $json = json_decode(file_get_contents($path), true);
            $this->projectId = $json['project_id'] ?? null;
            $this->clientEmail = $json['client_email'] ?? null;
            $this->privateKey = $json['private_key'] ?? null;
        } catch (\Throwable $e) {
            Log::error('[FCM] Failed to parse Firebase credentials: ' . $e->getMessage());
        }
    }

    /**
     * Check if service is configured.
     */
    public function isConfigured(): bool
    {
        return !empty($this->projectId) && !empty($this->clientEmail) && !empty($this->privateKey);
    }

    /**
     * Obtain OAuth 2.0 Access Token for Google APIs using Service Account private key.
     */
    public function getAccessToken(): ?string
    {
        if (!$this->isConfigured()) {
            return null;
        }

        return Cache::remember('firebase_fcm_access_token', 3300, function () {
            $now = time();
            $header = [
                'alg' => 'RS256',
                'typ' => 'JWT',
            ];

            $claim = [
                'iss' => $this->clientEmail,
                'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
                'aud' => 'https://oauth2.googleapis.com/token',
                'iat' => $now,
                'exp' => $now + 3600,
            ];

            $encodedHeader = $this->base64UrlEncode(json_encode($header));
            $encodedClaim = $this->base64UrlEncode(json_encode($claim));
            $dataToSign = "{$encodedHeader}.{$encodedClaim}";

            $signature = '';
            $success = openssl_sign($dataToSign, $signature, $this->privateKey, OPENSSL_ALGO_SHA256);
            if (!$success) {
                Log::error('[FCM] openssl_sign failed when generating JWT for Firebase');
                return null;
            }

            $jwt = "{$dataToSign}." . $this->base64UrlEncode($signature);

            $response = Http::asForm()->post('https://oauth2.googleapis.com/token', [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $jwt,
            ]);

            if ($response->successful()) {
                return $response->json('access_token');
            }

            Log::error('[FCM] Failed to get OAuth token from Google: ' . $response->body());
            return null;
        });
    }

    /**
     * Send notification to a single FCM device token.
     */
    public function sendToToken(string $token, string $title, string $body, array $data = []): bool
    {
        $accessToken = $this->getAccessToken();
        if (!$accessToken) {
            Log::warning('[FCM] Skipped sending notification: no valid access token');
            return false;
        }

        // Format data values as strings for FCM compatibility
        $stringData = array_map(fn($v) => is_scalar($v) ? (string) $v : json_encode($v), $data);
        $stringData['click_action'] = 'FLUTTER_NOTIFICATION_CLICK';

        $payload = [
            'message' => [
                'token' => $token,
                'notification' => [
                    'title' => $title,
                    'body' => $body,
                ],
                'data' => $stringData,
                'android' => [
                    'priority' => 'HIGH',
                    'notification' => [
                        'channel_id' => 'high_importance_channel',
                        'sound' => 'default',
                        'notification_priority' => 'PRIORITY_HIGH',
                        'default_vibrate_timings' => true,
                    ],
                ],
            ],
        ];

        $url = "https://fcm.googleapis.com/v1/projects/{$this->projectId}/messages:send";

        $response = Http::withToken($accessToken)
            ->withHeaders(['Content-Type' => 'application/json'])
            ->post($url, $payload);

        if ($response->successful()) {
            return true;
        }

        $resBody = $response->body();
        Log::warning("[FCM] Push failed for token: {$resBody}");

        // Automatically delete invalid / unregistered tokens from DB
        if (str_contains($resBody, 'UNREGISTERED') || str_contains($resBody, 'NOT_FOUND') || str_contains($resBody, 'INVALID_ARGUMENT')) {
            FcmDeviceToken::where('token', $token)->delete();
            Log::info("[FCM] Deleted stale device token from database: " . substr($token, 0, 15) . '...');
        }

        return false;
    }

    /**
     * Send push notification to a specific user (all their registered devices) + save in-app notification.
     */
    public function sendToUser(int $userId, string $title, string $body, string $type = 'general', array $data = []): int
    {
        $user = User::find($userId);
        if (!$user) {
            return 0;
        }

        // 1. Record In-App Notification (for Web & Mobile notification center)
        AppNotification::create([
            'user_id' => $userId,
            'company' => $user->company ?: 'all',
            'title' => $title,
            'body' => $body,
            'type' => $type,
            'data' => $data,
            'is_read' => false,
        ]);

        // 2. Send FCM to all user's registered devices
        $tokens = FcmDeviceToken::where('user_id', $userId)->pluck('token');
        $successCount = 0;

        foreach ($tokens as $token) {
            if ($this->sendToToken($token, $title, $body, array_merge($data, ['type' => $type]))) {
                $successCount++;
            }
        }

        return $successCount;
    }

    /**
     * Broadcast notification to all employees in a company (or all companies) + save in-app notification.
     */
    public function broadcastAnnouncement(string $title, string $body, string $company = 'all', array $data = []): int
    {
        // 1. Record In-App broadcast notification
        AppNotification::create([
            'user_id' => null, // broadcast to all
            'company' => $company,
            'title' => $title,
            'body' => $body,
            'type' => 'announcement',
            'data' => $data,
            'is_read' => false,
        ]);

        // 2. Fetch all eligible device tokens
        $query = FcmDeviceToken::query();
        if ($company !== 'all') {
            $query->whereHas('user', function ($q) use ($company) {
                $q->where('company', $company);
            });
        }

        $tokens = $query->pluck('token')->unique();
        $sentCount = 0;

        foreach ($tokens as $token) {
            if ($this->sendToToken($token, $title, $body, array_merge($data, ['type' => 'announcement', 'company' => $company]))) {
                $sentCount++;
            }
        }

        return $sentCount;
    }

    /**
     * Notify Admins & Super Admins (Push notification + In-App notification).
     * Used when new complaints or feedbacks are submitted by employees.
     */
    public function notifyAdmins(string $title, string $body, string $company = 'all', string $type = 'admin_complaint', array $data = []): int
    {
        $admins = User::active()
            ->whereIn('role', ['admin', 'super_admin', 'lord_admin'])
            ->get();

        $sentCount = 0;
        foreach ($admins as $admin) {
            // Super admins get notifications for all companies.
            // Regular admins only get notifications for their company or if target is 'all'.
            if (!$admin->isSuperAdmin() && $company !== 'all' && $admin->company && $admin->company !== $company) {
                continue;
            }

            // 1. Record In-App notification for this admin
            AppNotification::create([
                'user_id' => $admin->id,
                'company' => $admin->company ?: ($company ?: 'all'),
                'title' => $title,
                'body' => $body,
                'type' => $type,
                'data' => $data,
                'is_read' => false,
            ]);

            // 2. Push to all device tokens of this admin
            $tokens = FcmDeviceToken::where('user_id', $admin->id)->pluck('token');
            foreach ($tokens as $token) {
                if ($this->sendToToken($token, $title, $body, array_merge($data, ['type' => $type]))) {
                    $sentCount++;
                }
            }
        }

        return $sentCount;
    }

    /**
     * Helper to base64url encode.
     */
    protected function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
