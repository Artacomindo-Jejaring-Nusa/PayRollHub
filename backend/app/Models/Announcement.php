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
        'attachment_path',
        'attachment_name',
        'attachment_type',
        'attachment_mime',
        'attachment_size',
        'category',
        'company',
        'author_id',
        'is_pinned',
        'published_at',
    ];

    protected $appends = [
        'attachment_url',
    ];

    protected $casts = [
        'is_pinned' => 'boolean',
        'published_at' => 'datetime',
        'attachment_size' => 'integer',
    ];

    public function getAttachmentUrlAttribute(): ?string
    {
        if (!$this->attachment_path) {
            return null;
        }

        if (str_starts_with($this->attachment_path, 'http://') || str_starts_with($this->attachment_path, 'https://')) {
            return $this->attachment_path;
        }

        return url('storage/' . $this->attachment_path);
    }

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
