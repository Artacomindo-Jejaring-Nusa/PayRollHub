<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AiBotKnowledge extends Model
{
    use HasFactory;

    protected $table = 'ai_bot_knowledge';

    protected $fillable = [
        'category',
        'intent_code',
        'title',
        'keywords',
        'bot_answer',
        'quick_buttons',
        'is_active',
        'priority',
    ];

    protected $casts = [
        'quick_buttons' => 'array',
        'is_active' => 'boolean',
        'priority' => 'integer',
    ];
}
