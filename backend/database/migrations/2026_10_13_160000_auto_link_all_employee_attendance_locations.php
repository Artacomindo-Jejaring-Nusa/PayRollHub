<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Models\User;
use App\Models\AttendanceLocation;
use App\Models\AttendanceSetting;
use App\Models\Payroll;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Otomatis sinkronkan dan tautkan seluruh karyawan ke titik lokasi absensi masing-masing (Point Bang Maun:
     * Karyawan tidak perlu memilih lokasi karena sudah terdaftar dan terkunci sesuai penugasannya).
     */
    public function up(): void
    {
        $companies = ['rbs', 'rmp'];

        foreach ($companies as $comp) {
            $setting = AttendanceSetting::getActiveSetting($comp);
            $hqLocation = AttendanceSetting::syncHeadquartersLocation($setting);

            $defaultLat = $setting->latitude ?: -6.2088;
            $defaultLng = $setting->longitude ?: 106.8456;
            $defaultRadius = $setting->radius_meters ?: 100;

            // 1. Ambil seluruh unit sekolah unik dari User & Payroll
            $userUnits = User::where(function ($q) use ($comp) {
                    $q->where('company', $comp);
                    if ($comp === 'rbs') {
                        $q->orWhereNull('company');
                    }
                })
                ->whereNotNull('school_unit')
                ->where('school_unit', '!=', '')
                ->distinct()
                ->pluck('school_unit');

            $payrollUnits = Payroll::where('company', $comp)
                ->whereNotNull('school_unit')
                ->where('school_unit', '!=', '')
                ->distinct()
                ->pluck('school_unit');

            $allUnits = $userUnits->merge($payrollUnits)->map(fn ($u) => trim($u))->filter()->unique();

            // 2. Buat / pastikan setiap unit sekolah memiliki record di attendance_locations
            foreach ($allUnits as $schoolName) {
                $cleanLower = strtolower($schoolName);

                $loc = AttendanceLocation::where('tenant_id', $comp)
                    ->get()
                    ->first(function ($l) use ($cleanLower) {
                        $name = strtolower(trim($l->name));
                        $code = strtolower(trim($l->code ?? ''));
                        return $name === $cleanLower || $code === $cleanLower;
                    });

                if (!$loc) {
                    $loc = AttendanceLocation::create([
                        'tenant_id' => $comp,
                        'name' => $schoolName,
                        'code' => null,
                        'address' => 'Unit Penugasan ' . $schoolName,
                        'latitude' => $defaultLat,
                        'longitude' => $defaultLng,
                        'radius_meters' => $defaultRadius,
                        'type' => 'school',
                        'is_active' => true,
                    ]);
                }

                // Tautkan user dengan unit sekolah ini
                User::where(function ($q) use ($comp) {
                        $q->where('company', $comp);
                        if ($comp === 'rbs') {
                            $q->orWhereNull('company');
                        }
                    })
                    ->where('school_unit', $schoolName)
                    ->update(['attendance_location_id' => $loc->id]);
            }

            // 3. Karyawan kantor/staf yang tidak memiliki unit sekolah, otomatis ditautkan ke Kantor Pusat
            User::where(function ($q) use ($comp) {
                    $q->where('company', $comp);
                    if ($comp === 'rbs') {
                        $q->orWhereNull('company');
                    }
                })
                ->whereNull('attendance_location_id')
                ->update(['attendance_location_id' => $hqLocation->id]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Non-destructive: data asosiasi lokasi tidak perlu dihapus
    }
};
