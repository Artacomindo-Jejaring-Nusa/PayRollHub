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
        'shift_id',
        'status',
        'approval_status',
        'approved_by',
        'approved_at',
        'rejection_reason',
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
            $shift = $this->shift ?: ($this->user ? $this->user->shift : null);
            $is24HoursOrCrossDay = $shift && ($shift->cross_day || $shift->work_hours >= 20 || $shift->start_time > $shift->end_time);

            $dateStr = $this->date ? \Carbon\Carbon::parse($this->date)->toDateString() : null;
            if (!$dateStr && $this->created_at) {
                $dateStr = $this->created_at->toDateString();
            }

            if ($dateStr) {
                $in = \Carbon\Carbon::parse("{$dateStr} {$this->check_in_time}");
                $out = \Carbon\Carbon::parse("{$dateStr} {$this->check_out_time}");

                $updatedDate = $this->updated_at ? $this->updated_at->toDateString() : null;

                if ($updatedDate && $updatedDate > $dateStr) {
                    $out->addDay();
                } elseif ($out->lessThan($in)) {
                    $out->addDay();
                } elseif ($is24HoursOrCrossDay && $out->equalTo($in)) {
                    $out->addDay();
                } elseif ($is24HoursOrCrossDay && (!$updatedDate || $updatedDate > $dateStr) && $in->diffInMinutes($out) <= 180) {
                    $out->addDay();
                }

                return (int) $in->diffInMinutes($out);
            }

            $in = \Carbon\Carbon::createFromTimeString($this->check_in_time);
            $out = \Carbon\Carbon::createFromTimeString($this->check_out_time);

            if ($out->lessThan($in)) {
                $out->addDay();
            } elseif ($is24HoursOrCrossDay && ($out->equalTo($in) || $in->diffInMinutes($out) <= 180)) {
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
        $shift = $this->shift ?: ($this->user ? $this->user->shift : null);
        $targetHours = ($shift && $shift->work_hours > 0) ? (float) $shift->work_hours : 8.0;
        $targetMinutes = (int) round($targetHours * 60);

        // Toleransi 1 menit untuk shift 24 jam dengan jadwal berakhir di menit 59 (misal 09:00 - 08:59 = 1439 menit)
        if ($targetMinutes === 1440 && $minutes >= 1439) {
            return true;
        }

        return $minutes >= $targetMinutes;
    }

    public function getPhotoFullUrlAttribute(): ?string
    {
        if (!$this->photo_url) {
            return null;
        }

        if (str_starts_with($this->photo_url, 'http://') || str_starts_with($this->photo_url, 'https://') || str_starts_with($this->photo_url, 'data:image')) {
            return $this->photo_url;
        }

        $cleanPath = ltrim($this->photo_url, '/');
        $root = request() && request()->root() ? request()->root() : url('/');
        return rtrim($root, '/') . '/api/storage/' . $cleanPath;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(AttendanceLocation::class, 'location_id');
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class, 'shift_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
