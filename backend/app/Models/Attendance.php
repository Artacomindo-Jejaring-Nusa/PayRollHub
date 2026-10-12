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
        'work_duration_minutes',
        'work_duration_formatted',
        'is_eight_hours_met',
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

    public function getWorkDurationMinutesAttribute(): ?int
    {
        if (!$this->check_in_time || !$this->check_out_time) {
            return null;
        }
        try {
            $in = \Carbon\Carbon::createFromTimeString($this->check_in_time);
            $out = \Carbon\Carbon::createFromTimeString($this->check_out_time);
            if ($out->lessThan($in)) {
                $out->addDay();
            }
            return (int) $in->diffInMinutes($out);
        } catch (\Throwable) {
            return null;
        }
    }

    public function getWorkDurationFormattedAttribute(): ?string
    {
        $minutes = $this->work_duration_minutes;
        if ($minutes === null) {
            return null;
        }
        $hours = intdiv($minutes, 60);
        $remMinutes = $minutes % 60;
        return "{$hours}j {$remMinutes}m";
    }

    public function getIsEightHoursMetAttribute(): ?bool
    {
        $minutes = $this->work_duration_minutes;
        if ($minutes === null) {
            return null;
        }
        return $minutes >= 480; // 8 jam kerja = 480 menit
    }

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
