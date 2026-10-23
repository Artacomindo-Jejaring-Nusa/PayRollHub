<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WorkReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'nik',
        'report_date',
        'title',
        'description',
        'attachment_path',
        'photo_absen',
        'desc_absen',
        'photo_kegiatan1',
        'desc_kegiatan1',
        'photo_kegiatan2',
        'desc_kegiatan2',
        'photo_kegiatan_lain',
        'desc_kegiatan_lain',
        'status',
        'feedback',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'report_date' => 'date:Y-m-d',
        'reviewed_at' => 'datetime',
    ];

    protected $appends = [
        'activities',
    ];

    /**
     * Get 4 standardized activity blocks for this report.
     */
    public function getActivitiesAttribute(): array
    {
        if ($this->photo_absen || $this->desc_absen || $this->photo_kegiatan1 || $this->desc_kegiatan1) {
            return [
                [
                    'key' => 'absen',
                    'title' => '1. Absen Masuk',
                    'subtitle' => 'Foto Masuk Bertugas',
                    'description' => $this->desc_absen ?? '',
                    'photo' => $this->photo_absen,
                    'required' => true,
                ],
                [
                    'key' => 'kegiatan1',
                    'title' => '2. Kegiatan 1',
                    'subtitle' => 'Tugas / Kegiatan Pertama',
                    'description' => $this->desc_kegiatan1 ?? '',
                    'photo' => $this->photo_kegiatan1,
                    'required' => true,
                ],
                [
                    'key' => 'kegiatan2',
                    'title' => '3. Kegiatan 2',
                    'subtitle' => 'Tugas / Kegiatan Kedua',
                    'description' => $this->desc_kegiatan2 ?? '',
                    'photo' => $this->photo_kegiatan2,
                    'required' => true,
                ],
                [
                    'key' => 'kegiatan_lain',
                    'title' => '4. Kegiatan Lain',
                    'subtitle' => 'Tugas Lainnya (Opsional)',
                    'description' => $this->desc_kegiatan_lain ?? '',
                    'photo' => $this->photo_kegiatan_lain,
                    'required' => false,
                ],
            ];
        }

        // Fallback backward-compatible for older reports
        return [
            [
                'key' => 'absen',
                'title' => '1. Absen Masuk',
                'subtitle' => 'Foto Masuk Bertugas',
                'description' => 'Tercatat di sistem lama',
                'photo' => null,
                'required' => true,
            ],
            [
                'key' => 'kegiatan1',
                'title' => '2. Kegiatan 1',
                'subtitle' => 'Aktivitas Utama',
                'description' => $this->description ?: '-',
                'photo' => $this->attachment_path,
                'required' => true,
            ],
            [
                'key' => 'kegiatan2',
                'title' => '3. Kegiatan 2',
                'subtitle' => 'Aktivitas Tambahan',
                'description' => '-',
                'photo' => null,
                'required' => true,
            ],
            [
                'key' => 'kegiatan_lain',
                'title' => '4. Kegiatan Lain',
                'subtitle' => 'Opsional',
                'description' => '-',
                'photo' => null,
                'required' => false,
            ],
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
