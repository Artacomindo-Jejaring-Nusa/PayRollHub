<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Carbon\Carbon;

class Shift extends Model
{
    use HasFactory;

    protected $fillable = [
        'company',
        'name',
        'code',
        'start_time',
        'end_time',
        'late_tolerance_minutes',
        'work_hours',
        'cross_day',
        'description',
        'is_active',
    ];

    protected $casts = [
        'late_tolerance_minutes' => 'integer',
        'work_hours' => 'float',
        'cross_day' => 'boolean',
        'is_active' => 'boolean',
    ];

    protected $appends = [
        'formatted_time',
        'employees_count',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'shift_id');
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class, 'shift_id');
    }

    public function getFormattedTimeAttribute(): string
    {
        $start = substr($this->start_time ?? '08:00', 0, 5);
        $end = substr($this->end_time ?? '17:00', 0, 5);
        $cross = $this->cross_day ? ' (+1 hari)' : '';
        return "{$start} - {$end}{$cross}";
    }

    public function getEmployeesCountAttribute(): int
    {
        return $this->relationLoaded('users') ? $this->users->count() : $this->users()->count();
    }

    /**
     * Hitung status keterlambatan absensi masuk berdasarkan jam mulai shift dan batas toleransi.
     */
    public function checkLateness(string $currentTime): array
    {
        $start = Carbon::createFromTimeString($this->start_time);
        $tolerance = (int) ($this->late_tolerance_minutes ?? 15);
        $lateThreshold = (clone $start)->addMinutes($tolerance);

        $checkIn = Carbon::createFromTimeString($currentTime);
        $isLate = $checkIn->greaterThan($lateThreshold);
        $lateMinutes = $isLate ? (int) $lateThreshold->diffInMinutes($checkIn) : 0;

        return [
            'is_late' => $isLate,
            'check_in_status' => $isLate ? 'late' : 'on_time',
            'late_minutes' => $lateMinutes,
            'threshold_time' => $lateThreshold->format('H:i'),
        ];
    }

    /**
     * Dapatkan daftar shift yang tersedia untuk entitas perusahaan tertentu.
     */
    public static function getAvailableForCompany(?string $company = null)
    {
        $query = self::where('is_active', true);
        if ($company && $company !== 'all') {
            $query->where(function ($q) use ($company) {
                $q->where('company', 'all')
                  ->orWhere('company', $company);
            });
        }
        return $query->orderBy('start_time', 'asc')->get();
    }
}
