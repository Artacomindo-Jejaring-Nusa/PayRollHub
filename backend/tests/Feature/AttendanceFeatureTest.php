<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\AttendanceLocation;
use App\Models\AttendanceSetting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttendanceFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Setup default setting
        AttendanceSetting::create([
            'tenant_id' => 'rbs',
            'office_name' => 'Kantor Pusat RBS',
            'latitude' => -6.2000000,
            'longitude' => 106.8166667,
            'radius_meters' => 100,
            'work_start_time' => '08:00',
            'work_end_time' => '17:00',
            'late_tolerance_minutes' => 15,
            'is_active' => true,
        ]);
    }

    public function test_employee_can_check_in_holiday_without_gps_radius(): void
    {
        $employee = User::factory()->create([
            'role' => 'user',
            'company' => 'rbs',
        ]);

        $response = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'libur',
            'notes' => 'Hari Libur Terjadwal',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
            ]);

        $today = Carbon::today('Asia/Jakarta')->toDateString();
        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => $today,
            'attendance_type' => 'libur',
            'status' => 'holiday',
            'check_in_distance_meters' => null,
        ]);
    }

    public function test_employee_check_in_masuk_fails_when_outside_radius_of_100_locations(): void
    {
        $employee = User::factory()->create([
            'role' => 'user',
            'company' => 'rbs',
        ]);

        // Create location in Jakarta
        AttendanceLocation::create([
            'tenant_id' => 'rbs',
            'name' => 'Sekolah Rakyat Jakarta 01',
            'code' => 'SRP-001',
            'latitude' => -6.2000000,
            'longitude' => 106.8166667,
            'radius_meters' => 100,
            'is_active' => true,
        ]);

        // Attempt check-in far away (e.g. Bandung)
        $response = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'masuk',
            'latitude' => -6.9174639,
            'longitude' => 107.6191228,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'status' => 'error',
            ]);
    }

    public function test_employee_check_in_masuk_fails_without_photo(): void
    {
        $employee = User::factory()->create([
            'role' => 'user',
            'company' => 'rbs',
        ]);

        AttendanceLocation::create([
            'tenant_id' => 'rbs',
            'name' => 'Sekolah Rakyat Jakarta 01',
            'code' => 'SRP-001',
            'latitude' => -6.2000000,
            'longitude' => 106.8166667,
            'radius_meters' => 100,
            'is_active' => true,
        ]);

        // Attempt check in without photo
        $response = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'masuk',
            'latitude' => -6.2000100,
            'longitude' => 106.8166667,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'status' => 'error',
                'message' => 'Foto bukti kehadiran (selfie) wajib diambil sebelum melakukan absen masuk.',
            ]);
    }

    public function test_employee_check_in_masuk_succeeds_when_within_location_radius_with_photo(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');

        $employee = User::factory()->create([
            'role' => 'user',
            'company' => 'rbs',
            'school_unit' => 'SRP-005',
        ]);

        // Create 2 locations
        AttendanceLocation::create([
            'tenant_id' => 'rbs',
            'name' => 'Sekolah Rakyat Surabaya',
            'code' => 'SRP-002',
            'latitude' => -7.2574719,
            'longitude' => 112.7520883,
            'radius_meters' => 150,
            'is_active' => true,
        ]);

        $loc = AttendanceLocation::create([
            'tenant_id' => 'rbs',
            'name' => 'Sekolah Rakyat Jakarta 05',
            'code' => 'SRP-005',
            'latitude' => -6.2087634,
            'longitude' => 106.8455990,
            'radius_meters' => 150,
            'is_active' => true,
        ]);

        $fakePhoto = \Illuminate\Http\UploadedFile::fake()->image('selfie.jpg');

        // Check in ~30 meters from location SRP-005 with photo
        $response = $this->actingAs($employee, 'sanctum')->post('/api/employee/attendance/check-in', [
            'attendance_type' => 'masuk',
            'latitude' => -6.2088000,
            'longitude' => 106.8456000,
            'photo' => $fakePhoto,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
            ]);

        $today = Carbon::today('Asia/Jakarta')->toDateString();
        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => $today,
            'attendance_type' => 'masuk',
            'location_id' => $loc->id,
            'location_name' => $loc->name,
        ]);
    }

    public function test_employee_can_check_in_dinas_luar_without_radius(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');

        $employee = User::factory()->create([
            'role' => 'user',
            'company' => 'rbs',
        ]);

        // Employee is far away (e.g. Yogyakarta)
        $fakePhoto = \Illuminate\Http\UploadedFile::fake()->image('kegiatan_dinas.jpg');

        $response = $this->actingAs($employee, 'sanctum')->post('/api/employee/attendance/check-in', [
            'attendance_type' => 'dinas_luar',
            'latitude' => -7.7956,
            'longitude' => 110.3695,
            'notes' => 'Kunjungan Koordinasi Dinas Pendidikan',
            'photo' => $fakePhoto,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
            ]);

        $today = Carbon::today('Asia/Jakarta')->toDateString();
        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => $today,
            'attendance_type' => 'dinas_luar',
            'status' => 'present',
            'location_name' => 'Perjalanan Dinas',
            'check_in_distance_meters' => null,
            'notes' => 'Kunjungan Koordinasi Dinas Pendidikan',
        ]);
    }

    public function test_admin_can_download_location_template(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'company' => 'rbs',
        ]);

        $response = $this->actingAs($admin, 'sanctum')->get('/api/admin/attendance-locations/template');

        $response->assertStatus(200);
        $response->assertHeader('Content-Disposition', 'attachment; filename="template_import_lokasi_absensi.xlsx"');
    }

    public function test_admin_can_clear_all_locations(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'company' => 'rbs',
        ]);

        AttendanceLocation::query()->delete();

        AttendanceLocation::create([
            'tenant_id' => 'rbs',
            'name' => 'Lokasi Test 1',
            'latitude' => -6.2,
            'longitude' => 106.8,
            'radius_meters' => 100,
        ]);

        $this->assertDatabaseCount('attendance_locations', 1);

        $response = $this->actingAs($admin, 'sanctum')->deleteJson('/api/admin/attendance-locations/clear-all');

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'deleted_count' => 1,
            ]);

        $this->assertDatabaseCount('attendance_locations', 0);
    }

    public function test_admin_can_preview_and_import_locations_with_comma_coordinates(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'company' => 'rbs',
        ]);

        $csvContent = "Nama Lokasi*,Kode Unit,Latitude*,Longitude*,Radius Meter*,Alamat,Tipe\n" .
            "Sekolah Rakyat Cibinong 01,SRP-001,\"-6,482711\",\"106,845612\",100,\"Jl. Pemuda No. 12\",school\n" .
            "Kantor Pusat,PUSAT,\"-6.1954\",\"106.8521\",150,\"Salemba\",headquarters\n";

        $file = \Illuminate\Http\UploadedFile::fake()->createWithContent('lokasi.csv', $csvContent);

        // Test Preview
        $previewRes = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/attendance-locations/import/preview', [
            'file' => $file,
        ]);

        $previewRes->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'summary' => [
                    'total_rows' => 2,
                    'valid_rows' => 2,
                    'invalid_rows' => 0,
                    'create_count' => 2,
                ],
            ]);

        // Test Import
        $importFile = \Illuminate\Http\UploadedFile::fake()->createWithContent('lokasi.csv', $csvContent);
        $importRes = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/attendance-locations/import', [
            'file' => $importFile,
        ]);

        $importRes->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'imported_count' => 2,
                ],
            ]);

        $this->assertDatabaseHas('attendance_locations', [
            'tenant_id' => 'rbs',
            'code' => 'SRP-001',
            'type' => 'school',
            'latitude' => -6.482711,
            'longitude' => 106.845612,
        ]);
    }

    public function test_admin_can_fetch_school_units_and_sync_locations(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'company' => 'rbs',
        ]);

        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rbs',
            'school_unit' => 'Sekolah Rakyat Jakarta Barat 01',
        ]);

        // Cek fetch school-units
        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/attendance-locations/school-units');
        $res->assertStatus(200)
            ->assertJsonPath('status', 'success');

        // Sync from school units
        $syncRes = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/attendance-locations/sync-from-school-units');
        $syncRes->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseHas('attendance_locations', [
            'tenant_id' => 'rbs',
            'name' => 'Sekolah Rakyat Jakarta Barat 01',
        ]);

        // Karyawan harusnya otomatis terhubung
        $employee->refresh();
        $this->assertNotNull($employee->attendance_location_id);
    }

    public function test_employee_today_locks_location_to_assigned_school(): void
    {
        $location = AttendanceLocation::create([
            'tenant_id' => 'rbs',
            'name' => 'Sekolah Rakyat Bandung 02',
            'latitude' => -6.9175,
            'longitude' => 107.6191,
            'radius_meters' => 150,
            'type' => 'school',
            'is_active' => true,
        ]);

        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rbs',
            'school_unit' => 'Sekolah Rakyat Bandung 02',
        ]);

        $res = $this->actingAs($employee, 'sanctum')->getJson('/api/employee/attendance/today');
        $res->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.is_location_locked', true)
            ->assertJsonPath('data.assigned_location.name', 'Sekolah Rakyat Bandung 02');
    }

    public function test_admin_can_assign_employees_manually_to_location(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'company' => 'rbs',
        ]);

        $location = AttendanceLocation::create([
            'tenant_id' => 'rbs',
            'name' => 'Sekolah Rakyat Surabaya 01',
            'latitude' => -7.2575,
            'longitude' => 112.7521,
            'radius_meters' => 100,
            'type' => 'school',
            'is_active' => true,
        ]);

        $emp1 = User::factory()->create(['role' => 'karyawan', 'company' => 'rbs']);
        $emp2 = User::factory()->create(['role' => 'karyawan', 'company' => 'rbs']);

        // Assign emp1 dan emp2 manual
        $res = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/attendance-locations/{$location->id}/assign-employees", [
            'user_ids' => [$emp1->id, $emp2->id],
        ]);

        $res->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('assigned_count', 2);

        $this->assertEquals($location->id, $emp1->fresh()->attendance_location_id);
        $this->assertEquals($location->id, $emp2->fresh()->attendance_location_id);
    }

    public function test_employee_location_is_strictly_locked_and_cannot_spoof_other_location(): void
    {
        $setting = AttendanceSetting::getActiveSetting('rbs');
        $setting->update([
            'latitude' => -6.2088,
            'longitude' => 106.8456,
            'radius_meters' => 100,
        ]);

        $locHome = AttendanceLocation::create([
            'tenant_id' => 'rbs',
            'name' => 'Sekolah Ditugaskan',
            'latitude' => -6.2088,
            'longitude' => 106.8456,
            'radius_meters' => 100,
            'is_active' => true,
        ]);

        $locOther = AttendanceLocation::create([
            'tenant_id' => 'rbs',
            'name' => 'Sekolah Lain Jauh',
            'latitude' => -7.2575,
            'longitude' => 112.7521,
            'radius_meters' => 100,
            'is_active' => true,
        ]);

        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rbs',
            'attendance_location_id' => $locHome->id,
            'school_unit' => 'Sekolah Ditugaskan',
        ]);

        // 1. In today endpoint, employee only receives their locked location
        $todayRes = $this->actingAs($employee, 'sanctum')->getJson('/api/employee/attendance/today');
        $todayRes->assertStatus(200)
            ->assertJsonPath('data.is_location_locked', true)
            ->assertJsonPath('data.total_locations', 1)
            ->assertJsonPath('data.assigned_location.id', $locHome->id);

        // 2. If employee tries to check-in near locOther by sending location_id = locOther->id,
        // it must be rejected because they are outside their assigned location radius
        $checkInRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'masuk',
            'latitude' => -7.2575,
            'longitude' => 112.7521,
            'location_id' => $locOther->id,
            'photo' => 'data:image/jpeg;base64,' . base64_encode(str_repeat('A', 200)),
        ]);

        $checkInRes->assertStatus(422)
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('nearest_location', 'Sekolah Ditugaskan');
    }
}
