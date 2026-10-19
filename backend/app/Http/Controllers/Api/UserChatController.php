<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\ChatSession;
use App\Services\ChatBotAiService;
use App\Services\WebSocketService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class UserChatController extends Controller
{
    protected ChatBotAiService $aiService;

    public function __construct(ChatBotAiService $aiService)
    {
        $this->aiService = $aiService;
    }

    /**
     * Dapatkan sesi chat aktif untuk pengguna saat ini
     */
    public function getActiveSession(Request $request)
    {
        $user = $request->user();

        // Cari sesi yang belum closed
        $session = ChatSession::where('user_id', $user->id)
            ->where('status', '!=', 'closed')
            ->orderBy('created_at', 'desc')
            ->first();

        $isNewSession = false;

        if (!$session) {
            $isNewSession = true;
            $rawCompany = $user->company ?? $user->company_name ?? ($request->header('X-Tenant-Id') ?: 'riama');
            if (str_contains(strtolower($rawCompany), 'rimbun') || str_contains(strtolower($rawCompany), 'rbs')) {
                $company = 'rimbun';
            } else {
                $company = 'riama';
            }

            $session = ChatSession::create([
                'session_code' => 'CHAT-' . date('Ymd') . '-' . strtoupper(Str::random(6)),
                'user_id' => $user->id,
                'role' => $user->role ?? 'karyawan',
                'company_name' => strtolower($company),
                'user_name' => $user->name,
                'user_nik' => $user->nik,
                'user_email' => $user->email,
                'user_phone' => $user->phone ?? null,
                'status' => 'bot',
                'subject' => 'Bantuan Langsung & AI Support',
                'last_message_text' => 'Halo! Saya AI Virtual Assistant. Ada yang bisa dibantu?',
                'last_message_sender' => 'bot',
                'last_message_at' => now(),
            ]);

            // Kirim pesan pembuka awal dari Bot AI
            ChatMessage::create([
                'chat_session_id' => $session->id,
                'sender_type' => 'bot',
                'sender_name' => 'AI Virtual Assistant',
                'message' => "Halo **{$user->name}**! 👋\n\nSelamat datang di **Live Chat & Bantuan Cepat**. Saya adalah asisten virtual yang siap menjawab pertanyaan seputar slip gaji, presensi geofencing, atau laporan kerja.\n\nJika butuh bantuan lebih lanjut, Anda juga dapat terhubung langsung dengan **Tim CS / Agent HRD** kami kapan saja.",
                'suggested_actions' => [
                    ['label' => '💰 Jadwal Gaji', 'action' => 'ask_payroll_schedule'],
                    ['label' => '📍 Kendala Absensi GPS', 'action' => 'ask_attendance_guide'],
                    ['label' => '👤 Hubungi CS / Agent Live', 'action' => 'request_agent'],
                ],
                'is_read_by_user' => true,
                'is_read_by_agent' => true,
            ]);
        }

        // Ambil pesan
        $messages = $session->messages()->orderBy('created_at', 'asc')->get();

        // Tandai pesan sebagai dibaca oleh user
        ChatMessage::where('chat_session_id', $session->id)
            ->where('is_read_by_user', false)
            ->update(['is_read_by_user' => true]);

        $session->update(['unread_user_count' => 0]);

        return response()->json([
            'success' => true,
            'is_new' => $isNewSession,
            'session' => $session->load('assignedAgent:id,name,role'),
            'messages' => $messages,
        ]);
    }

    /**
     * Kirim pesan dari pengguna
     */
    public function sendMessage(Request $request)
    {
        $request->validate([
            'session_id' => 'required|exists:chat_sessions,id',
            'message' => 'nullable|string',
            'photo' => 'nullable|file|mimes:jpg,jpeg,png,webp|max:10240',
            'action_code' => 'nullable|string',
        ]);

        $user = $request->user();
        $session = ChatSession::where('id', $request->session_id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($session->status === 'closed') {
            return response()->json([
                'success' => false,
                'message' => 'Sesi chat ini sudah ditutup. Silakan mulai sesi bantuan baru.',
            ], 400);
        }

        $photoUrl = null;
        if ($request->hasFile('photo')) {
            $path = $request->file('photo')->store('chat_attachments', 'public');
            $photoUrl = '/api/storage/' . $path;
        }

        $messageContent = trim($request->input('message') ?? '');
        if ($request->filled('action_code') && empty($messageContent)) {
            // Jika user klik quick pill button
            $actionMap = [
                'request_agent' => 'Tolong sambungkan saya ke CS / Agent HRD.',
                'ask_payroll_schedule' => 'Bisa info jadwal pembayaran gaji?',
                'ask_attendance_guide' => 'Bagaimana solusi kendala absensi di luar radius?',
                'ask_slip_guide' => 'Bagaimana cara cek slip gaji saya?',
                'open_complaints' => 'Saya ingin mengajukan keluhan resmi.',
            ];
            $messageContent = $actionMap[$request->action_code] ?? $request->action_code;
        }

        if (empty($messageContent) && empty($photoUrl)) {
            return response()->json([
                'success' => false,
                'message' => 'Pesan tidak boleh kosong.',
            ], 422);
        }

        // Simpan pesan dari User
        $userMsg = ChatMessage::create([
            'chat_session_id' => $session->id,
            'sender_type' => 'user',
            'sender_id' => $user->id,
            'sender_name' => $user->name,
            'message' => $messageContent,
            'attachment_url' => $photoUrl,
            'attachment_type' => $photoUrl ? 'image' : null,
            'is_read_by_user' => true,
            'is_read_by_agent' => false,
        ]);

        $session->update([
            'last_message_text' => Str::limit($messageContent ?: '[Foto Terlampir]', 100),
            'last_message_sender' => 'user',
            'last_message_at' => now(),
            'unread_agent_count' => $session->unread_agent_count + 1,
        ]);

        WebSocketService::broadcast("session_{$session->id}", 'new_message', $userMsg->toArray());
        WebSocketService::broadcast("admin_omnichannel", 'session_updated', $session->fresh()->toArray());

        $botMsg = null;

        // Jika user minta agen secara langsung
        if ($request->action_code === 'request_agent' || str_contains(strtolower($messageContent), 'sambungkan ke cs') || str_contains(strtolower($messageContent), 'hubungi cs')) {
            $session->update(['status' => 'waiting_agent']);

            $botMsg = ChatMessage::create([
                'chat_session_id' => $session->id,
                'sender_type' => 'system',
                'sender_name' => 'Sistem Antrean CS',
                'message' => "🔔 **Permintaan Diterima:** Percakapan Anda telah dialihkan ke antrean **Agent CS HRD**.\n\nAgen kami akan segera bergabung untuk membantu kendala Anda. Mohon tetap buka layar ini ya!",
                'is_read_by_user' => true,
                'is_read_by_agent' => false,
            ]);

            WebSocketService::broadcast("session_{$session->id}", 'new_message', $botMsg->toArray());
            WebSocketService::broadcast("session_{$session->id}", 'status_changed', ['status' => 'waiting_agent']);
            WebSocketService::broadcast("admin_omnichannel", 'session_waiting', $session->fresh()->toArray());

            return response()->json([
                'success' => true,
                'session' => $session->fresh(),
                'user_message' => $userMsg,
                'bot_message' => $botMsg,
            ]);
        }

        // Jika sesi masih status 'bot' -> AI Bot menjawab otomatis
        if ($session->status === 'bot') {
            $aiResult = $this->aiService->generateResponse($messageContent, $session);

            $botMsg = ChatMessage::create([
                'chat_session_id' => $session->id,
                'sender_type' => 'bot',
                'sender_name' => 'AI Virtual Assistant',
                'message' => $aiResult['message'],
                'suggested_actions' => $aiResult['suggested_actions'],
                'is_read_by_user' => true,
                'is_read_by_agent' => true,
            ]);

            $session->update([
                'last_message_text' => Str::limit($aiResult['message'], 100),
                'last_message_sender' => 'bot',
                'last_message_at' => now(),
            ]);

            WebSocketService::broadcast("session_{$session->id}", 'new_message', $botMsg->toArray());
            WebSocketService::broadcast("admin_omnichannel", 'session_updated', $session->fresh()->toArray());
        }

        return response()->json([
            'success' => true,
            'session' => $session->fresh(),
            'user_message' => $userMsg,
            'bot_message' => $botMsg,
        ]);
    }

    /**
     * Tombol aksi eksplisit: Hubungkan ke CS / Agent Live
     */
    public function requestAgent(Request $request)
    {
        $request->validate([
            'session_id' => 'required|exists:chat_sessions,id',
        ]);

        $user = $request->user();
        $session = ChatSession::where('id', $request->session_id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $session->update([
            'status' => 'waiting_agent',
            'last_message_text' => 'Permintaan terhubung ke Agent CS',
            'last_message_sender' => 'system',
            'last_message_at' => now(),
            'unread_agent_count' => $session->unread_agent_count + 1,
        ]);

        $systemMsg = ChatMessage::create([
            'chat_session_id' => $session->id,
            'sender_type' => 'system',
            'sender_name' => 'Sistem Antrean CS',
            'message' => "🔔 **Permintaan Diterima:** Percakapan Anda kini berada di antrean prioritas **Customer Service HRD**.\n\nAgen kami sedang bersiap merespons pesan Anda. Terima kasih atas kesabaran Anda!",
            'is_read_by_user' => true,
            'is_read_by_agent' => false,
        ]);

        WebSocketService::broadcast("session_{$session->id}", 'new_message', $systemMsg->toArray());
        WebSocketService::broadcast("session_{$session->id}", 'status_changed', ['status' => 'waiting_agent']);
        WebSocketService::broadcast("admin_omnichannel", 'session_waiting', $session->fresh()->toArray());

        return response()->json([
            'success' => true,
            'session' => $session->fresh(),
            'system_message' => $systemMsg,
        ]);
    }

    /**
     * Polling cepat real-time untuk pengguna
     */
    public function pollMessages(Request $request, $sessionId)
    {
        $user = $request->user();
        $session = ChatSession::where('id', $sessionId)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $lastId = (int) $request->query('last_id', 0);

        $newMessages = ChatMessage::where('chat_session_id', $session->id)
            ->where('id', '>', $lastId)
            ->orderBy('created_at', 'asc')
            ->get();

        if ($newMessages->isNotEmpty()) {
            ChatMessage::where('chat_session_id', $session->id)
                ->where('id', '>', $lastId)
                ->where('is_read_by_user', false)
                ->update(['is_read_by_user' => true]);

            $session->update(['unread_user_count' => 0]);
        }

        return response()->json([
            'success' => true,
            'status' => $session->status,
            'assigned_agent' => $session->assignedAgent ? [
                'id' => $session->assignedAgent->id,
                'name' => $session->assignedAgent->name,
            ] : null,
            'messages' => $newMessages,
        ]);
    }

    /**
     * Tutup sesi obrolan dari sisi pengguna
     */
    public function closeSession(Request $request)
    {
        $request->validate([
            'session_id' => 'required|exists:chat_sessions,id',
        ]);

        $user = $request->user();
        $session = ChatSession::where('id', $request->session_id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $session->update([
            'status' => 'closed',
            'closed_at' => now(),
            'closed_by' => $user->id,
            'close_reason' => 'Ditutup oleh Pengguna',
        ]);

        ChatMessage::create([
            'chat_session_id' => $session->id,
            'sender_type' => 'system',
            'sender_name' => 'Sistem',
            'message' => '🔒 Sesi obrolan telah ditutup oleh pengguna. Terima kasih telah menghubungi layanan kami!',
            'is_read_by_user' => true,
            'is_read_by_agent' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Sesi chat berhasil ditutup.',
        ]);
    }
}
