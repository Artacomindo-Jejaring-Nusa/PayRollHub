<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AttendanceSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'office_name',
        'latitude',
        'longitude',
        'radius_meters',
        'work_start_time',
        'work_end_time',
        'late_tolerance_minutes',
        'is_active',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'radius_meters' => 'integer',
        'late_tolerance_minutes' => 'integer',
        'is_active' => 'boolean',
    ];

    /**
     * Hitung jarak dua titik koordinat (dalam meter) menggunakan formula Haversine.
     */
    public static function calculateDistanceInMeters(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6371000; // Radius bumi dalam meter
        $latFrom = deg2rad($lat1);
        $lonFrom = deg2rad($lon1);
        $latTo = deg2rad($lat2);
        $lonTo = deg2rad($lon2);

        $latDelta = $latTo - $latFrom;
        $lonDelta = $lonTo - $lonFrom;

        $angle = 2 * asin(sqrt(pow(sin($latDelta / 2), 2) +
            cos($latFrom) * cos($latTo) * pow(sin($lonDelta / 2), 2)));

        return round($angle * $earthRadius, 1);
    }

    /**
     * Dapatkan setting aktif untuk tenant tertentu atau default.
     */
    public static function getActiveSetting(?string $tenantId = null): self
    {
        $setting = null;
        if ($tenantId && $tenantId !== 'all') {
            $setting = self::where('tenant_id', $tenantId)->where('is_active', true)->first();
        }

        if (!$setting) {
            $setting = self::where('is_active', true)->first();
        }

        if (!$setting) {
            // Buat default jika belum ada di database
            $setting = self::create([
                'tenant_id' => ($tenantId && $tenantId !== 'all') ? $tenantId : 'rbs',
                'office_name' => 'Kantor Pusat Operasional',
                'latitude' => -6.2236611,
                'longitude' => 106.9481394,
                'radius_meters' => 100,
                'work_start_time' => '08:00',
                'work_end_time' => '17:00',
                'late_tolerance_minutes' => 15,
                'is_active' => true,
            ]);
        }

        return $setting;
    }

    /**
     * POINT 10: Sinkronisasikan pengaturan Kantor Pusat ke tabel attendance_locations (tipe 'headquarters').
     * Kantor Pusat ini dibuat/ditetapkan oleh Super Admin sebagai patokan wajib absensi seluruh Admin.
     */
    public static function syncHeadquartersLocation(self $setting): AttendanceLocation
    {
        $tenant = $setting->tenant_id ?: 'rbs';
        return AttendanceLocation::updateOrCreate(
            [
                'tenant_id' => $tenant,
                'type' => 'headquarters',
            ],
            [
                'name' => $setting->office_name ?: 'Kantor Pusat Operasional',
                'code' => 'KP-01',
                'address' => 'Kantor Pusat Operasional (' . strtoupper($tenant) . ')',
                'latitude' => $setting->latitude,
                'longitude' => $setting->longitude,
                'radius_meters' => $setting->radius_meters,
                'is_active' => true,
            ]
        );
    }
}
