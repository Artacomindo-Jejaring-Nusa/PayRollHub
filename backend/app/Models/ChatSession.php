<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ChatSession extends Model
{
    use HasFactory;

    protected $table = 'chat_sessions';

    protected $fillable = [
        'session_code',
        'user_id',
        'role',
        'company_name',
        'user_name',
        'user_nik',
        'user_email',
        'user_phone',
        'status',
        'assigned_agent_id',
        'subject',
        'last_message_text',
        'last_message_sender',
        'last_message_at',
        'unread_user_count',
        'unread_agent_count',
        'bot_tokens_used',
        'agent_joined_at',
        'closed_at',
        'closed_by',
        'close_reason',
    ];

    protected $casts = [
        'last_message_at' => 'datetime',
        'agent_joined_at' => 'datetime',
        'closed_at' => 'datetime',
        'unread_user_count' => 'integer',
        'unread_agent_count' => 'integer',
        'bot_tokens_used' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function assignedAgent()
    {
        return $this->belongsTo(User::class, 'assigned_agent_id');
    }

    public function closedByUser()
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function messages()
    {
        return $this->hasMany(ChatMessage::class, 'chat_session_id')->orderBy('created_at', 'asc');
    }
}
