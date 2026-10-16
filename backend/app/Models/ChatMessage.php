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
}
