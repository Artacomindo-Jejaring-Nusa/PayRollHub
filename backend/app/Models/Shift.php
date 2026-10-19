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

    /**
     * Dapatkan daftar shift yang tersedia untuk pengguna spesifik.
     * Riama dan Rimbun dipisahkan secara ketat agar karyawan tidak bingung.
     */
    public static function getAvailableForUser(User $user)
    {
        $rawCompany = strtolower(trim($user->company ?: 'rbs'));
        $isRiama = in_array($rawCompany, ['rimamandiri', 'riama']) || str_contains($rawCompany, 'riama') || str_contains($rawCompany, 'rimamandiri');

        $query = self::where('is_active', true);

        if ($isRiama) {
            // Khusus RIAMA (Security / Jasa Pengamanan):
            // Tampilkan SELURUH shift milik Riama (company: rimamandiri/riama) + shift bersama 'all'
            // dan singkirkan shift khusus milik RBS/Rimbun.
            return $query->where(function ($q) {
                $q->whereIn('company', ['rimamandiri', 'riama'])
                  ->orWhere('company', 'all');
            })->whereNotIn('company', ['rbs', 'rimbun'])
              ->orderByRaw("
                CASE 
                    WHEN code = 'SHIFT_1_3_SHIFT' THEN 1
                    WHEN code = 'SHIFT_2_3_SHIFT' THEN 2
                    WHEN code = 'SHIFT_3_3_SHIFT' THEN 3
                    WHEN code = 'SHIFT_1_2_SHIFT' THEN 4
                    WHEN code = 'SHIFT_2_2_SHIFT' THEN 5
                    WHEN code = '24 JAM' THEN 6
                    WHEN code = 'RIAMA-STD' THEN 7
                    ELSE 8 
                END ASC, start_time ASC
            ")->get();
        } else {
            // Khusus RBS / Rimbun Buana Sejahtera (Sekolah Rakyat, Operasional, Juru Masak, dll):
            // Tampilkan SELURUH shift yang dibuat untuk Rimbun (company: rbs/rimbun) + shift bersama 'all'/id 1,
            // dan singkirkan shift khusus satpam/security Riama.
            return $query->where(function ($q) {
                $q->whereIn('company', ['rbs', 'rimbun'])
                  ->orWhere('company', 'all')
                  ->orWhere('id', 1);
            })->whereNotIn('company', ['rimamandiri', 'riama'])
              ->orderByRaw("
                CASE 
                    WHEN id = 1 THEN 1
                    WHEN id = 2 THEN 2
                    WHEN id = 3 THEN 3
                    WHEN id = 4 THEN 4
                    WHEN id = 15 THEN 5
                    WHEN id = 16 THEN 6
                    ELSE 7 
                END ASC, start_time ASC
            ")->get();
        }
    }
}
