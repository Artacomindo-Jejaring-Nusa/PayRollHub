<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ChatMessage extends Model
{
    use HasFactory;

    protected $table = 'chat_messages';

    protected $fillable = [
        'chat_session_id',
        'sender_type',
        'sender_id',
        'sender_name',
        'message',
        'attachment_url',
        'attachment_type',
        'suggested_actions',
        'is_read_by_user',
        'is_read_by_agent',
    ];

    protected $casts = [
        'suggested_actions' => 'array',
        'is_read_by_user' => 'boolean',
        'is_read_by_agent' => 'boolean',
    ];

    public function session()
    {
        return $this->belongsTo(ChatSession::class, 'chat_session_id');
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    /**
     * Pastikan attachment_url selalu mengembalikan full absolute URL
     * sehingga gambar dapat langsung ditampilkan di Mobile (Flutter) maupun Web Dashboard.
     */
    public function getAttachmentUrlAttribute($value): ?string
    {
        if (empty($value)) {
            return null;
        }

        if (str_starts_with($value, 'http://') || str_starts_with($value, 'https://') || str_starts_with($value, 'data:image')) {
            if (str_contains($value, 'localhost') || str_contains($value, '127.0.0.1')) {
                $parsed = parse_url($value);
                $path = $parsed['path'] ?? '';
                $company = $this->session?->company_name ?? '';
                $domain = stripos($company, 'riama') !== false
                    ? 'https://riamamandiripratama.com'
                    : 'https://rimbunbuanasejahtera.com';
                return $domain . $path;
            }
            return $value;
        }

        $root = null;
        if (function_exists('request') && request() && request()->root()) {
            $reqRoot = request()->root();
            if (!str_contains($reqRoot, 'localhost') && !str_contains($reqRoot, '127.0.0.1')) {
                $root = $reqRoot;
            }
        }

        if (empty($root)) {
            $company = $this->session?->company_name ?? '';
            if (stripos($company, 'riama') !== false) {
                $root = 'https://riamamandiripratama.com';
            } else {
                $appUrl = config('app.url');
                if (!empty($appUrl) && !str_contains($appUrl, 'localhost') && !str_contains($appUrl, '127.0.0.1')) {
                    $root = $appUrl;
                } else {
                    $root = 'https://rimbunbuanasejahtera.com';
                }
            }
        }

        $root = rtrim($root, '/');
        $clean = ltrim($value, '/');

        if (!str_starts_with($clean, 'api/storage/') && !str_starts_with($clean, 'storage/')) {
            $clean = 'api/storage/' . $clean;
        }

        return $root . '/' . $clean;
    }
}
