<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ChatAiToken extends Model
{
    use HasFactory;

    protected $table = 'chat_ai_tokens';

    protected $fillable = [
        'company_name',
        'package_name',
        'total_package_price',
        'total_quota_tokens',
        'used_tokens',
        'is_active',
    ];

    protected $casts = [
        'total_package_price' => 'decimal:2',
        'total_quota_tokens' => 'integer',
        'used_tokens' => 'integer',
        'is_active' => 'boolean',
    ];
}
