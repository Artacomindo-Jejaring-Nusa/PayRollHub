<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Announcement extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'content',
        'category',
        'company',
        'author_id',
        'is_pinned',
        'published_at',
    ];

    protected $casts = [
        'is_pinned' => 'boolean',
        'published_at' => 'datetime',
    ];

    public function author()
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * Scope announcements by company target or global.
     */
    public function scopeForCompany($query, ?string $company)
    {
        if (!$company || $company === 'all') {
            return $query;
        }

        return $query->where(function ($q) use ($company) {
            $q->where('company', $company)
              ->orWhere('company', 'all');
        });
    }
}
