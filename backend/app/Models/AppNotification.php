<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppNotification extends Model
{
    protected $table = 'app_notifications';

    protected $fillable = [
        'user_id',
        'company',
        'title',
        'body',
        'type',
        'data',
        'is_read',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'is_read' => 'boolean',
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope for a specific user and company (includes broadcast notifications).
     */
    public function scopeForUser(Builder $query, int $userId, string $company = 'all'): Builder
    {
        return $query->where(function ($q) use ($userId, $company) {
            $q->where('user_id', $userId)
              ->orWhere(function ($sub) use ($company) {
                  $sub->whereNull('user_id')
                      ->where(function ($c) use ($company) {
                          $c->where('company', 'all')
                            ->orWhere('company', $company);
                      });
              });
        });
    }

    /**
     * Scope for unread only.
     */
    public function scopeUnread(Builder $query): Builder
    {
        return $query->where('is_read', false);
    }
}
