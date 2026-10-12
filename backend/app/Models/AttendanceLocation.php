<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceLocation extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'name',
        'code',
        'address',
        'latitude',
        'longitude',
        'radius_meters',
        'type',
        'is_active',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'radius_meters' => 'integer',
        'is_active' => 'boolean',
    ];

    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class, 'location_id');
    }

    public function assignedUsers(): HasMany
    {
        return $this->hasMany(User::class, 'attendance_location_id');
    }

    /**
     * Scope query untuk tenant tertentu.
     */
    public function scopeForTenant($query, ?string $tenantId = null)
    {
        if (!$tenantId || $tenantId === 'all') {
            return $query;
        }

        return $query->where(function ($q) use ($tenantId) {
            $q->where('tenant_id', $tenantId)
              ->orWhere('tenant_id', 'all');
        });
    }

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
     * Cari lokasi terdekat dari koordinat user, dengan prioritas unit sekolah jika cocok.
     *
     * @return array{location: self|null, distance_meters: float|null, is_within_radius: bool}
     */
    public static function findNearest(float $lat, float $lng, string $tenantId, ?string $preferredCode = null): array
    {
        $locations = self::forTenant($tenantId)->where('is_active', true)->get();

        if ($locations->isEmpty()) {
            return [
                'location' => null,
                'distance_meters' => null,
                'is_within_radius' => false,
            ];
        }

        // 1. Coba periksa apakah lokasi yang memiliki kode/unit sekolah sama berada dalam radius
        if (!empty($preferredCode)) {
            $cleanPref = strtolower(trim($preferredCode));
            $matchedLocation = $locations->first(function ($loc) use ($cleanPref) {
                $locName = strtolower(trim($loc->name));
                $locCode = strtolower(trim($loc->code ?? ''));
                return $locCode === $cleanPref
                    || $locName === $cleanPref
                    || ($locCode !== '' && str_contains($cleanPref, $locCode))
                    || ($locName !== '' && (str_contains($cleanPref, $locName) || str_contains($locName, $cleanPref)));
            });

            if ($matchedLocation) {
                $dist = self::calculateDistanceInMeters($lat, $lng, $matchedLocation->latitude, $matchedLocation->longitude);
                if ($dist <= $matchedLocation->radius_meters) {
                    return [
                        'location' => $matchedLocation,
                        'distance_meters' => $dist,
                        'is_within_radius' => true,
                    ];
                }
            }
        }

        // 2. Cari lokasi terdekat dari seluruh 100+ lokasi aktif
        $closestLocation = null;
        $minDistance = null;

        foreach ($locations as $loc) {
            $dist = self::calculateDistanceInMeters($lat, $lng, $loc->latitude, $loc->longitude);
            if ($minDistance === null || $dist < $minDistance) {
                $minDistance = $dist;
                $closestLocation = $loc;
            }
        }

        $isWithin = $closestLocation !== null && $minDistance !== null && $minDistance <= $closestLocation->radius_meters;

        return [
            'location' => $closestLocation,
            'distance_meters' => $minDistance,
            'is_within_radius' => $isWithin,
        ];
    }
}
