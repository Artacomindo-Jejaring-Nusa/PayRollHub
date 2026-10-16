<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WebSocketService
{
    /**
     * Broadcast an event to a WebSocket channel
     *
     * @param string $channel (e.g. 'session_1', 'admin_omnichannel')
     * @param string $event (e.g. 'new_message', 'session_updated', 'status_changed')
     * @param array $data
     */
    public static function broadcast(string $channel, string $event, array $data): bool
    {
        try {
            $wsUrl = config('services.websocket.url', 'http://127.0.0.1:6001/broadcast');
            $secret = config('services.websocket.secret', 'payrollhub_ws_secure_token_2026');

            $response = Http::timeout(0.8)
                ->withHeaders([
                    'X-WS-SECRET' => $secret,
                    'Content-Type' => 'application/json',
                ])
                ->post($wsUrl, [
                    'channel' => $channel,
                    'event' => $event,
                    'data' => $data,
                ]);

            return $response->successful();
        } catch (\Throwable $e) {
            // Silently log in debug, never interrupt user HTTP flow
            Log::debug('[WebSocket] broadcast failed: ' . $e->getMessage());
            return false;
        }
    }
}
