<?php

namespace App\Services;

use App\Models\AiBotKnowledge;
use App\Models\ChatAiToken;
use App\Models\ChatSession;

class ChatBotAiService
{
    /**
     * Stopwords bahasa Indonesia sederhana
     */
    protected array $stopWords = [
        'yang', 'di', 'ke', 'dari', 'ini', 'itu', 'dan', 'atau', 'untuk',
        'pada', 'adalah', 'dengan', 'saya', 'aku', 'kami', 'kita', 'kamu',
        'anda', 'dia', 'mereka', 'apa', 'apakah', 'bagaimana', 'kenapa',
        'mengapa', 'kapan', 'dimana', 'dong', 'sih', 'deh', 'nih', 'ya',
        'kan', 'kok', 'mau', 'tolong', 'bisa', 'mohon', 'ingin', 'tanya'
    ];

    /**
     * Proses pesan pengguna dan hasilkan jawaban AI
     */
    public function generateResponse(string $userMessage, ChatSession $session): array
    {
        $rawMessage = trim($userMessage);
        $cleanMessage = strtolower($rawMessage);

        // 1. Deteksi cepat jika ada niat spesifik minta CS / Agen Manusia
        if ($this->isExplicitAgentRequest($cleanMessage)) {
            $tokensUsed = 65;
            $this->recordTokenUsage($tokensUsed, $session);

            return [
                'message' => "🔔 **Permintaan Terhubung ke Agent CS:**\n\nBaik, saya telah menerima permintaan Anda untuk berbicara langsung dengan **Tim Customer Service / Agent HRD**.\n\nSilakan tekan tombol di bawah ini untuk meneruskan tiket chat Anda ke antrean agen kami sekarang.",
                'suggested_actions' => [
                    ['label' => '👤 Hubungkan ke CS Live Sekarang', 'action' => 'request_agent'],
                ],
                'tokens_used' => $tokensUsed,
                'is_agent_request' => true,
                'intent_matched' => 'request_agent',
            ];
        }

        // 2. Tokenisasi input pengguna
        $userWords = $this->tokenize($cleanMessage);

        // 3. Ambil seluruh knowledge base aktif
        $knowledgeItems = AiBotKnowledge::where('is_active', true)
            ->orderBy('priority', 'desc')
            ->get();

        $bestMatch = null;
        $highestScore = 0.0;

        foreach ($knowledgeItems as $item) {
            $score = $this->calculateScore($cleanMessage, $userWords, $item);
            if ($score > $highestScore) {
                $highestScore = $score;
                $bestMatch = $item;
            }
        }

        // 4. Threshold kelayakan jawaban (Machine Learning scoring >= 0.40)
        if ($bestMatch && $highestScore >= 0.40) {
            $responseText = $bestMatch->bot_answer;
            $buttons = $bestMatch->quick_buttons ?? [];

            // Pastikan selalu ada opsi hubungi agen jika butuh eskalasi
            $hasAgentBtn = false;
            foreach ($buttons as $b) {
                if (($b['action'] ?? '') === 'request_agent') {
                    $hasAgentBtn = true;
                    break;
                }
            }
            if (!$hasAgentBtn) {
                $buttons[] = ['label' => '👤 Hubungi CS / Agent Live', 'action' => 'request_agent'];
            }

            $tokensUsed = (int) ceil((strlen($rawMessage) + strlen($responseText)) / 3.8) + 40;
            $this->recordTokenUsage($tokensUsed, $session);

            return [
                'message' => $responseText,
                'suggested_actions' => $buttons,
                'tokens_used' => $tokensUsed,
                'is_agent_request' => false,
                'intent_matched' => $bestMatch->intent_code,
            ];
        }

        // 5. Fallback jika tidak menemukan jawaban yang pasti di basis pengetahuan
        $fallbackText = "Halo! Saya adalah **AI Virtual Assistant** 🤖\n\nMaaf, saya belum menemukan jawaban yang spesifik untuk pertanyaan tersebut di basis pengetahuan saat ini.\n\nApakah Anda ingin saya sambungkan langsung ke **Tim Customer Service / Agent HRD** yang sedang bertugas?";
        $fallbackButtons = [
            ['label' => '👤 Hubungkan ke CS / Agent Live', 'action' => 'request_agent'],
            ['label' => '💰 Jadwal Gaji', 'action' => 'ask_payroll_schedule'],
            ['label' => '📍 Kendala Absensi GPS', 'action' => 'ask_attendance_guide'],
        ];

        $tokensUsed = (int) ceil((strlen($rawMessage) + strlen($fallbackText)) / 3.8) + 30;
        $this->recordTokenUsage($tokensUsed, $session);

        return [
            'message' => $fallbackText,
            'suggested_actions' => $fallbackButtons,
            'tokens_used' => $tokensUsed,
            'is_agent_request' => false,
            'intent_matched' => 'fallback',
        ];
    }

    /**
     * Hitung kemiripan semantik dan kecocokan kata kunci
     */
    protected function calculateScore(string $cleanMessage, array $userWords, AiBotKnowledge $item): float
    {
        $score = 0.0;
        $keywordsRaw = strtolower($item->keywords . ', ' . $item->title);
        $keywordList = array_map('trim', explode(',', $keywordsRaw));

        // Exact substring match bonus
        foreach ($keywordList as $kw) {
            if (!empty($kw) && str_contains($cleanMessage, $kw)) {
                $score += 0.65;
            }
        }

        // Jaccard word token similarity
        $itemWords = $this->tokenize($keywordsRaw);
        if (!empty($itemWords) && !empty($userWords)) {
            $intersection = count(array_intersect($userWords, $itemWords));
            $union = count(array_unique(array_merge($userWords, $itemWords)));
            if ($union > 0) {
                $score += ($intersection / $union) * 0.50;
            }
        }

        // Priority weighting
        $score += ($item->priority * 0.02);

        return $score;
    }

    /**
     * Cek apakah teks secara eksplisit meminta terhubung dengan CS/Agen
     */
    protected function isExplicitAgentRequest(string $text): bool
    {
        $patterns = [
            'hubungi cs',
            'bicara dengan cs',
            'bicara sama cs',
            'bicara sama orang',
            'bicara dengan admin',
            'sambungkan ke agen',
            'sambungkan ke cs',
            'customer service',
            'agent live',
            'panggil admin',
            'minta tolong cs',
            'bantuan manusia',
            'admin live',
        ];

        foreach ($patterns as $pattern) {
            if (str_contains($text, $pattern)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Bersihkan teks dari tanda baca dan stopwords untuk tokenisasi
     */
    protected function tokenize(string $text): array
    {
        $clean = preg_replace('/[^a-z0-9\s]/', ' ', $text);
        $words = preg_split('/\s+/', $clean, -1, PREG_SPLIT_NO_EMPTY);
        
        return array_values(array_filter($words, function ($w) {
            return strlen($w) > 2 && !in_array($w, $this->stopWords, true);
        }));
    }

    /**
     * Catat penggunaan token AI untuk transparansi kuota
     */
    protected function recordTokenUsage(int $tokens, ChatSession $session): void
    {
        $session->increment('bot_tokens_used', $tokens);

        $tokenRecord = ChatAiToken::where('is_active', true)->first();
        if ($tokenRecord) {
            $tokenRecord->increment('used_tokens', $tokens);
        }
    }
}
