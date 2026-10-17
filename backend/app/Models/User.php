<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'nik',
        'phone',
        'birth_date',
        'gender',
        'marital_status',
        'company',
        'school_unit',
        'attendance_location_id',
        'shift_id',
        'bank_name',
        'bank_account',
        'address',
        'avatar',
        'password',
        'role',
        'status',
        'last_login_at',
        'last_login_ip',
    ];

    /**
     * Lokasi absensi penugasan spesifik untuk karyawan ini.
     */
    public function attendanceLocation()
    {
        return $this->belongsTo(AttendanceLocation::class, 'attendance_location_id');
    }

    /**
     * Jadwal / Pola Shift penugasan untuk karyawan ini.
     */
    public function shift()
    {
        return $this->belongsTo(Shift::class, 'shift_id');
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Check if user is admin (admin or super_admin).
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin' || $this->role === 'super_admin';
    }

    /**
     * Check if user is super admin.
     */
    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    /**
     * Check if user is standard user (HR / Staff view & search).
     */
    public function isUser(): bool
    {
        return $this->role === 'user' || $this->role === 'viewer';
    }

    /**
     * Check if user is employee.
     */
    public function isEmployee(): bool
    {
        return $this->role === 'karyawan';
    }

    /**
     * Check if user is active.
     */
    public function isActive(): bool
    {
        return $this->status !== 'off';
    }

    /**
     * Scope query to only include active users.
     */
    public function scopeActive($query)
    {
        return $query->where(function ($q) {
            $q->where('status', '!=', 'off')->orWhereNull('status');
        });
    }

    /**
     * Payroll records linked to this employee by NIK.
     */
    public function payrolls()
    {
        return $this->hasMany(Payroll::class, 'nik', 'nik')->latest('period');
    }

    /**
     * Work reports submitted by this user.
     */
    public function workReports()
    {
        return $this->hasMany(WorkReport::class)->latest('report_date');
    }

    /**
     * Announcements authored by this user.
     */
    public function announcements()
    {
        return $this->hasMany(Announcement::class, 'author_id');
    }
}
