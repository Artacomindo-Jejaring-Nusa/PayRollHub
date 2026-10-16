<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\ChatAiToken;
use App\Models\ChatMessage;
use App\Models\ChatSession;
use App\Models\Complaint;
use App\Models\Payroll;
use App\Models\User;
use App\Services\WebSocketService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminChatController extends Controller
{
    /**
     * Daftar antrean & sesi chat untuk Admin/CS
     */
    public function getSessions(Request $request)
    {
        $query = ChatSession::query();

        // Filter Perusahaan
        if ($request->filled('company') && $request->company !== 'all') {
            $query->where('company_name', strtolower($request->company));
        }

        // Filter Status Tab
        $status = $request->query('status', 'all');
        if ($status !== 'all') {
            $query->where('status', $status);
        }

        // Search
        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('user_name', 'like', "%{$search}%")
                  ->orWhere('user_nik', 'like', "%{$search}%")
                  ->orWhere('session_code', 'like', "%{$search}%")
                  ->orWhere('last_message_text', 'like', "%{$search}%");
            });
        }

        // Hitung Counter Tabs
        $baseCompanyQuery = ChatSession::query();
        if ($request->filled('company') && $request->company !== 'all') {
            $baseCompanyQuery->where('company_name', strtolower($request->company));
        }

        $counters = [
            'all' => (clone $baseCompanyQuery)->count(),
            'waiting_agent' => (clone $baseCompanyQuery)->where('status', 'waiting_agent')->count(),
            'active_agent' => (clone $baseCompanyQuery)->where('status', 'active_agent')->count(),
            'bot' => (clone $baseCompanyQuery)->where('status', 'bot')->count(),
            'closed' => (clone $baseCompanyQuery)->where('status', 'closed')->count(),
        ];

        // Ordering: Prioritaskan yang waiting_agent di paling atas, lalu yang pesannya paling baru
        $query->orderByRaw("CASE WHEN status = 'waiting_agent' THEN 1 WHEN status = 'active_agent' THEN 2 WHEN status = 'bot' THEN 3 ELSE 4 END ASC")
              ->orderBy('last_message_at', 'desc');

        $sessions = $query->with('assignedAgent:id,name,role')->paginate(20);

        return response()->json([
            'success' => true,
            'counters' => $counters,
            'data' => $sessions->items(),
            'meta' => [
                'current_page' => $sessions->currentPage(),
                'last_page' => $sessions->lastPage(),
                'total' => $sessions->total(),
            ],
        ]);
    }

    /**
     * Dapatkan detail sesi percakapan & Contact 360 profil karyawan
     */
    public function getSessionDetail($id)
    {
        $session = ChatSession::with('assignedAgent:id,name,role')->findOrFail($id);

        // Tandai pesan sudah dibaca oleh admin
        ChatMessage::where('chat_session_id', $session->id)
            ->where('is_read_by_agent', false)
            ->update(['is_read_by_agent' => true]);

        $session->update(['unread_agent_count' => 0]);

        $messages = $session->messages()->orderBy('created_at', 'asc')->get();

        // Contact 360 data jika user terdaftar
        $contact360 = null;
        if ($session->user_id) {
            $user = User::find($session->user_id);
            if ($user) {
                // Slip gaji terakhir
                $latestPayroll = null;
                if (!empty($user->nik)) {
                    $latestPayroll = Payroll::where('nik', $user->nik)
                        ->orderBy('created_at', 'desc')
                        ->first();
                }

                // Presensi hari ini
                $todayAttendance = Attendance::where('user_id', $user->id)
                    ->whereDate('date', today())
                    ->first();

                // Keluhan sebelumnya
                $complaintsCount = Complaint::where('user_id', $user->id)->count();

                $contact360 = [
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'nik' => $user->nik ?? '-',
                    'email' => $user->email ?? '-',
                    'phone' => $user->phone ?? '-',
                    'role' => $user->role,
                    'school_unit' => $user->school_unit ?? ($latestPayroll->school_unit ?? '-'),
                    'position' => $latestPayroll->position ?? 'Karyawan',
                    'status' => $user->status ?? 'active',
                    'latest_thp' => $latestPayroll ? (float) $latestPayroll->take_home_pay : 0,
                    'latest_period' => $latestPayroll ? $latestPayroll->period : null,
                    'today_check_in' => $todayAttendance ? $todayAttendance->check_in_time : null,
                    'today_check_out' => $todayAttendance ? $todayAttendance->check_out_time : null,
                    'complaints_count' => $complaintsCount,
                ];
            }
        }

        return response()->json([
            'success' => true,
            'session' => $session,
            'contact360' => $contact360,
            'messages' => $messages,
        ]);
    }

    /**
     * Klaim / Ambil alih percakapan oleh CS Agent
     */
    public function claimSession(Request $request, $id)
    {
        $admin = $request->user();
        $session = ChatSession::findOrFail($id);

        $session->update([
            'status' => 'active_agent',
            'assigned_agent_id' => $admin->id,
            'agent_joined_at' => now(),
            'unread_user_count' => $session->unread_user_count + 1,
            'last_message_text' => "Agen {$admin->name} telah bergabung ke percakapan.",
            'last_message_sender' => 'agent',
            'last_message_at' => now(),
        ]);

        $joinMsg = ChatMessage::create([
            'chat_session_id' => $session->id,
            'sender_type' => 'agent',
            'sender_id' => $admin->id,
            'sender_name' => $admin->name,
            'message' => "👋 **Halo {$session->user_name}!**\n\nSaya **{$admin->name}** dari Tim Customer Service HRD. Saya telah mengambil alih percakapan ini untuk membantu Anda secara langsung.\n\nBisa tolong jelaskan lebih detail kendala yang dialami?",
            'is_read_by_user' => false,
            'is_read_by_agent' => true,
        ]);

        WebSocketService::broadcast("session_{$session->id}", 'agent_claimed', $session->fresh()->load('assignedAgent:id,name,role')->toArray());
        WebSocketService::broadcast("session_{$session->id}", 'new_message', $joinMsg->toArray());
        WebSocketService::broadcast("admin_omnichannel", 'session_updated', $session->fresh()->toArray());

        return response()->json([
            'success' => true,
            'session' => $session->fresh()->load('assignedAgent:id,name,role'),
            'message' => $joinMsg,
        ]);
    }

    /**
     * Kirim balasan pesan dari Agent / CS
     */
    public function replySession(Request $request, $id)
    {
        $request->validate([
            'message' => 'nullable|string',
            'photo' => 'nullable|file|mimes:jpg,jpeg,png,webp,pdf|max:10240',
        ]);

        $admin = $request->user();
        $session = ChatSession::findOrFail($id);

        if ($session->status === 'closed') {
            return response()->json([
                'success' => false,
                'message' => 'Sesi chat ini sudah ditutup.',
            ], 400);
        }

        $photoUrl = null;
        if ($request->hasFile('photo')) {
            $path = $request->file('photo')->store('chat_attachments', 'public');
            $photoUrl = '/api/storage/' . $path;
        }

        $messageText = trim($request->input('message') ?? '');
        if (empty($messageText) && empty($photoUrl)) {
            return response()->json([
                'success' => false,
                'message' => 'Pesan tidak boleh kosong.',
            ], 422);
        }

        // Jika belum assigned ke agent ini, auto-assign
        if ($session->assigned_agent_id !== $admin->id) {
            $session->update([
                'assigned_agent_id' => $admin->id,
                'status' => 'active_agent',
            ]);
        }

        $agentMsg = ChatMessage::create([
            'chat_session_id' => $session->id,
            'sender_type' => 'agent',
            'sender_id' => $admin->id,
            'sender_name' => $admin->name,
            'message' => $messageText,
            'attachment_url' => $photoUrl,
            'attachment_type' => $photoUrl ? 'image' : null,
            'is_read_by_user' => false,
            'is_read_by_agent' => true,
        ]);

        $session->update([
            'status' => 'active_agent',
            'last_message_text' => Str::limit($messageText ?: '[Lampiran]', 100),
            'last_message_sender' => 'agent',
            'last_message_at' => now(),
            'unread_user_count' => $session->unread_user_count + 1,
        ]);

        WebSocketService::broadcast("session_{$session->id}", 'new_message', $agentMsg->toArray());
        WebSocketService::broadcast("admin_omnichannel", 'session_updated', $session->fresh()->toArray());

        return response()->json([
            'success' => true,
            'message' => $agentMsg,
            'session' => $session->fresh(),
        ]);
    }

    /**
     * Selesaikan & Tutup Sesi Obrolan
     */
    public function closeSession(Request $request, $id)
    {
        $admin = $request->user();
        $session = ChatSession::findOrFail($id);

        $session->update([
            'status' => 'closed',
            'closed_at' => now(),
            'closed_by' => $admin->id,
            'close_reason' => $request->input('reason', 'Selesai ditangani oleh CS HRD'),
        ]);

        $closeMsg = ChatMessage::create([
            'chat_session_id' => $session->id,
            'sender_type' => 'system',
            'sender_name' => 'Sistem CS',
            'message' => "✅ **Sesi Bantuan Selesai:** Percakapan ini telah ditutup oleh agen **{$admin->name}**.\n\nJika ada pertanyaan lain di kemudian hari, Anda dapat memulai obrolan baru kapan saja. Terima kasih!",
            'is_read_by_user' => false,
            'is_read_by_agent' => true,
        ]);

        WebSocketService::broadcast("session_{$session->id}", 'new_message', $closeMsg->toArray());
        WebSocketService::broadcast("session_{$session->id}", 'session_closed', ['session_id' => $session->id]);
        WebSocketService::broadcast("admin_omnichannel", 'session_updated', $session->fresh()->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Sesi berhasil ditutup.',
            'session' => $session->fresh(),
        ]);
    }

    /**
     * Statistik & Transparansi Token AI Live Chat
     */
    public function getStats(Request $request)
    {
        $tokenRecord = ChatAiToken::first();
        if (!$tokenRecord) {
            $tokenRecord = ChatAiToken::create([
                'company_name' => 'all',
                'package_name' => 'Token AI Live Chat (Pro Enterprise)',
                'total_package_price' => 1500000.00,
                'total_quota_tokens' => 150000,
                'used_tokens' => 18450,
                'is_active' => true,
            ]);
        }

        $remainingTokens = max(0, $tokenRecord->total_quota_tokens - $tokenRecord->used_tokens);
        $percentUsed = $tokenRecord->total_quota_tokens > 0 
            ? round(($tokenRecord->used_tokens / $tokenRecord->total_quota_tokens) * 100, 1)
            : 0;

        return response()->json([
            'success' => true,
            'token_ai' => [
                'package_name' => $tokenRecord->package_name,
                'package_price' => (float) $tokenRecord->total_package_price, // Rp 1.500.000,00
                'package_price_formatted' => 'Rp ' . number_format($tokenRecord->total_package_price, 2, ',', '.'),
                'total_quota_tokens' => $tokenRecord->total_quota_tokens,
                'used_tokens' => $tokenRecord->used_tokens,
                'remaining_tokens' => $remainingTokens,
                'percent_used' => $percentUsed,
            ],
            'sessions' => [
                'waiting_agent' => ChatSession::where('status', 'waiting_agent')->count(),
                'active_agent' => ChatSession::where('status', 'active_agent')->count(),
                'bot_handled' => ChatSession::where('status', 'bot')->count(),
                'closed_today' => ChatSession::where('status', 'closed')->whereDate('closed_at', today())->count(),
                'total_all' => ChatSession::count(),
            ]
        ]);
    }

    /**
     * Template balasan cepat (Quick Replies) untuk efisiensi CS
     */
    public function getQuickReplies()
    {
        $templates = [
            [
                'id' => 1,
                'title' => 'Salam Pembuka',
                'text' => 'Halo! Terima kasih telah menghubungi kami. Ada kendala atau hal yang bisa saya bantu terkait absensi atau gaji?',
            ],
            [
                'id' => 2,
                'title' => 'Minta Foto / Bukti Dokumen',
                'text' => 'Bisa tolong lampirkan foto bukti fisik / tangkapan layar pendukung agar dapat segera kami telusuri di sistem?',
            ],
            [
                'id' => 3,
                'title' => 'Konfirmasi Penyesuaian Gaji',
                'text' => 'Data selisih komponen gaji Anda telah kami verifikasi dan akan disesuaikan pada pencairan periode berikutnya.',
            ],
            [
                'id' => 4,
                'title' => 'Solusi Titik Lokasi GPS',
                'text' => 'Titik koordinat penempatan unit Anda telah kami perbarui di sistem. Silakan coba kembali melakukan Presensi sekarang.',
            ],
            [
                'id' => 5,
                'title' => 'Salam Penutup / Selesai',
                'text' => 'Baik, kendala Anda telah kami catat dan selesaikan. Apakah ada hal lain yang bisa kami bantu?',
            ],
        ];

        return response()->json([
            'success' => true,
            'templates' => $templates,
        ]);
    }

    /**
     * Hapus sesi obrolan (termasuk seluruh pesan dan file lampirannya dari storage)
     */
    public function destroy($id)
    {
        $session = ChatSession::findOrFail($id);

        // Hapus file-file lampiran yang tersimpan di disk
        foreach ($session->messages as $msg) {
            if ($msg->attachment_url) {
                $filePath = str_replace('/api/storage/', '', $msg->attachment_url);
                \Illuminate\Support\Facades\Storage::disk('public')->delete($filePath);
            }
        }

        $session->delete();

        return response()->json([
            'success' => true,
            'message' => 'Sesi percakapan dan seluruh lampiran berhasil dihapus.',
        ]);
    }
}
