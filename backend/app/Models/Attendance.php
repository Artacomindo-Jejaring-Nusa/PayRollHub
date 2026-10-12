<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'attendance_type',
        'date',
        'check_in_time',
        'check_in_lat',
        'check_in_lng',
        'location_id',
        'location_name',
        'check_in_distance_meters',
        'check_in_status',
        'check_out_time',
        'check_out_lat',
        'check_out_lng',
        'check_out_distance_meters',
        'photo_url',
        'status',
        'notes',
    ];

    protected $appends = [
        'photo_full_url',
    ];

    protected $casts = [
        'date' => 'date:Y-m-d',
        'check_in_lat' => 'float',
        'check_in_lng' => 'float',
        'check_in_distance_meters' => 'float',
        'check_out_lat' => 'float',
        'check_out_lng' => 'float',
        'check_out_distance_meters' => 'float',
    ];

    public function getPhotoFullUrlAttribute(): ?string
    {
        if (!$this->photo_url) {
            return null;
        }

        if (str_starts_with($this->photo_url, 'http://') || str_starts_with($this->photo_url, 'https://') || str_starts_with($this->photo_url, 'data:image')) {
            return $this->photo_url;
        }

        return url('storage/' . $this->photo_url);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(AttendanceLocation::class, 'location_id');
    }
}
