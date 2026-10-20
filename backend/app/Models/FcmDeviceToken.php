<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FcmDeviceToken extends Model
{
    protected $table = 'fcm_device_tokens';

    protected $fillable = [
        'user_id',
        'token',
        'platform',
        'device_name',
        'last_active_at',
    ];

    protected function casts(): array
    {
        return [
            'last_active_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
