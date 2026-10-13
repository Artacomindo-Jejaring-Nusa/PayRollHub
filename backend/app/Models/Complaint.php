<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Complaint extends Model
{
    use HasFactory;

    protected $fillable = [
        'ticket_number',
        'user_id',
        'company',
        'school_unit',
        'title',
        'category',
        'description',
        'photo_path',
        'photo_name',
        'status',
        'admin_notes',
        'resolved_by',
        'resolved_at',
    ];

    protected $appends = [
        'photo_full_url',
        'category_label',
        'status_label',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function getPhotoFullUrlAttribute(): ?string
    {
        if (!$this->photo_path) {
            return null;
        }

        if (str_starts_with($this->photo_path, 'http://') || str_starts_with($this->photo_path, 'https://') || str_starts_with($this->photo_path, 'data:image')) {
            return $this->photo_path;
        }

        $cleanPath = ltrim($this->photo_path, '/');
        $root = request() && request()->root() ? request()->root() : url('/');
        return rtrim($root, '/') . '/api/storage/' . $cleanPath;
    }

    public function getCategoryLabelAttribute(): string
    {
        return match ($this->category) {
            'sistem' => 'Kendala Sistem',
            'saran' => 'Saran & Masukan',
            'gaji' => 'Gaji & Slip',
            'absensi' => 'Absensi & Lokasi',
            'fasilitas' => 'Fasilitas & Operasional',
            'teknis' => 'Kendala Aplikasi / Akun',
            default => 'Lainnya',
        };
    }

    public function getStatusLabelAttribute(): string
    {
        return match ($this->status) {
            'pending' => 'Menunggu Respon',
            'in_progress' => 'Sedang Ditinjau',
            'resolved' => 'Selesai Ditangani',
            'rejected' => 'Ditolak',
            default => ucfirst($this->status),
        };
    }

    public function scopeForCompany($query, ?string $company)
    {
        if (!$company || $company === 'all') {
            return $query;
        }

        return $query->where('company', $company);
    }
}
