<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\AttendanceLocation;
use App\Models\AttendanceSetting;
use App\Models\Shift;
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

    public function test_employee_who_already_checked_in_holiday_can_override_and_check_in_masuk(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');

        $employee = User::factory()->create([
            'role' => 'user',
            'company' => 'rbs',
            'school_unit' => 'SRP-005',
        ]);

        AttendanceLocation::create([
            'tenant_id' => 'rbs',
            'name' => 'Sekolah Rakyat Jakarta 05',
            'code' => 'SRP-005',
            'latitude' => -6.2087634,
            'longitude' => 106.8455990,
            'radius_meters' => 150,
            'is_active' => true,
        ]);

        // 1. Employee initially performs Absen Libur
        $liburRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'libur',
            'notes' => 'Tadinya libur',
        ]);
        $liburRes->assertStatus(200);

        // 2. Employee then comes to work and checks in masuk with selfie
        $fakePhoto = \Illuminate\Http\UploadedFile::fake()->image('selfie.jpg');
        $masukRes = $this->actingAs($employee, 'sanctum')->post('/api/employee/attendance/check-in', [
            'attendance_type' => 'masuk',
            'latitude' => -6.2088000,
            'longitude' => 106.8456000,
            'photo' => $fakePhoto,
        ]);

        $masukRes->assertStatus(200)
            ->assertJson([
                'status' => 'success',
            ]);

        $today = Carbon::today('Asia/Jakarta')->toDateString();
        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => $today,
            'attendance_type' => 'masuk',
        ]);
        $att = Attendance::where('user_id', $employee->id)->where('date', $today)->first();
        $this->assertContains($att->status, ['present', 'late']);
    }

    public function test_employee_can_cancel_holiday_attendance(): void
    {
        $employee = User::factory()->create([
            'role' => 'user',
            'company' => 'rbs',
        ]);

        // Check in as holiday
        $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'libur',
        ])->assertStatus(200);

        $today = Carbon::today('Asia/Jakarta')->toDateString();
        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => $today,
            'attendance_type' => 'libur',
        ]);

        // Cancel holiday
        $cancelRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/cancel-holiday');
        $cancelRes->assertStatus(200)
            ->assertJson([
                'status' => 'success',
            ]);

        $this->assertDatabaseMissing('attendances', [
            'user_id' => $employee->id,
            'date' => $today,
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

    public function test_admin_can_update_work_hours_and_tolerance_and_sync_shift(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'company' => 'rbs',
        ]);

        $response = $this->actingAs($admin, 'sanctum')->putJson('/api/admin/attendance-settings', [
            'work_start_time' => '07:30',
            'work_end_time' => '16:30',
            'late_tolerance_minutes' => 20,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.work_start_time', '07:30')
            ->assertJsonPath('data.work_end_time', '16:30')
            ->assertJsonPath('data.late_tolerance_minutes', 20);

        $this->assertDatabaseHas('attendance_settings', [
            'tenant_id' => 'rbs',
            'work_start_time' => '07:30',
            'work_end_time' => '16:30',
            'late_tolerance_minutes' => 20,
        ]);

        // Shift table should also be synced
        $this->assertDatabaseHas('shifts', [
            'code' => 'REGULER',
            'start_time' => '07:30',
            'end_time' => '16:30',
            'late_tolerance_minutes' => 20,
        ]);
    }

    public function test_attendance_summary_matches_active_employees_and_excludes_off_employees(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'company' => 'rbs',
        ]);

        // 1. Create 3 active employees and 1 off employee
        $empActive1 = User::factory()->create(['name' => 'Budi Active', 'role' => 'karyawan', 'company' => 'rbs', 'status' => 'active']);
        $empActive2 = User::factory()->create(['name' => 'Siti Active', 'role' => 'karyawan', 'company' => 'rbs', 'status' => 'active']);
        $empOff = User::factory()->create(['name' => 'Doni Off', 'role' => 'karyawan', 'company' => 'rbs', 'status' => 'off']);

        // 2. Query summary daily with role=karyawan
        $resDaily = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/attendances/summary?date=2026-10-16&role=karyawan');
        $resDaily->assertStatus(200)
            ->assertJsonPath('data.total_employees', 2) // Only 2 active employees, empOff excluded
            ->assertJsonPath('data.total_not_checked_in', 2);

        // Daily with all roles includes active admin + 2 active employees = 3
        $resDailyAll = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/attendances/summary?date=2026-10-16');
        $resDailyAll->assertStatus(200)
            ->assertJsonPath('data.total_employees', 3);

        // 3. Test SP period filtering
        \App\Models\Payroll::create([
            'employee_name' => 'Budi Active',
            'company' => 'rbs',
            'province' => 'DKI Jakarta',
            'period' => 'SP 8',
            'status' => 'active',
            'take_home_pay' => 3000000,
        ]);
        \App\Models\Payroll::create([
            'employee_name' => 'Doni Off',
            'company' => 'rbs',
            'province' => 'DKI Jakarta',
            'period' => 'SP 8',
            'status' => 'off',
            'take_home_pay' => 3000000,
        ]);

        $resSp = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/attendances/summary?sp_period=SP 8');
        $resSp->assertStatus(200)
            ->assertJsonPath('data.total_employees', 1); // Only Budi Active in SP 8
    }

    public function test_cross_day_shift_check_in_at_night_and_check_out_in_morning(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-19 23:01:00', 'Asia/Jakarta'));

        $shift = \App\Models\Shift::create([
            'company' => 'rbs',
            'name' => 'Shift 3 / Malam (Operasional)',
            'code' => 'SHIFT-10',
            'start_time' => '23:00:00',
            'end_time' => '07:00:00',
            'late_tolerance_minutes' => 15,
            'work_hours' => 8.0,
            'cross_day' => true,
            'is_active' => true,
        ]);

        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rbs',
            'shift_id' => $shift->id,
        ]);

        // 1. Employee checks in at 23:01 on 2026-10-19
        $checkInRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'dinas_luar',
            'notes' => 'Shift malam blora',
        ]);
        $checkInRes->assertStatus(200);

        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => '2026-10-19',
            'check_in_time' => '23:01:00',
            'check_out_time' => null,
            'shift_id' => $shift->id,
        ]);

        // 2. Morning arrives on next day: 2026-10-20 at 07:15
        Carbon::setTestNow(Carbon::parse('2026-10-20 07:15:00', 'Asia/Jakarta'));

        // Calling /today should return the active unclosed attendance from yesterday
        $todayRes = $this->actingAs($employee, 'sanctum')->getJson('/api/employee/attendance/today');
        $todayRes->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.attendance.date', '2026-10-19')
            ->assertJsonPath('data.attendance.check_in_time', '23:01:00')
            ->assertJsonPath('data.attendance.check_out_time', null);

        // 3. Employee checks out at 07:15
        $checkOutRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-out', [
            'notes' => 'Pulang shift malam',
        ]);
        $checkOutRes->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => '2026-10-19',
            'check_in_time' => '23:01:00',
            'check_out_time' => '07:15:00',
        ]);

        // 4. Employee opens dashboard again at 08:00 (Today is open, not locked with yesterday's checkout)
        Carbon::setTestNow(Carbon::parse('2026-10-20 08:00:00', 'Asia/Jakarta'));
        $todayResAfter = $this->actingAs($employee, 'sanctum')->getJson('/api/employee/attendance/today');
        $todayResAfter->assertStatus(200)
            ->assertJsonPath('data.attendance', null);

        // 5. Employee checks in again for the next shift on 2026-10-20 at 23:00
        Carbon::setTestNow(Carbon::parse('2026-10-20 23:00:00', 'Asia/Jakarta'));
        $nextShiftCheckIn = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'dinas_luar',
            'notes' => 'Masuk shift malam berikutnya',
        ]);
        $nextShiftCheckIn->assertStatus(200);

        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => '2026-10-20',
            'check_in_time' => '23:00:00',
            'check_out_time' => null,
        ]);

        Carbon::setTestNow(); // reset
    }

    public function test_cross_day_shift_check_in_past_midnight_and_check_out_in_morning(): void
    {
        $shift = \App\Models\Shift::create([
            'company' => 'rbs',
            'name' => 'Shift 3 / Malam (Operasional)',
            'code' => 'SHIFT-10',
            'start_time' => '23:00:00',
            'end_time' => '07:00:00',
            'late_tolerance_minutes' => 15,
            'work_hours' => 8.0,
            'cross_day' => true,
            'is_active' => true,
        ]);

        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rbs',
            'shift_id' => $shift->id,
        ]);

        // 1. Employee arrives late past midnight at 00:30 on 2026-10-20
        Carbon::setTestNow(Carbon::parse('2026-10-20 00:30:00', 'Asia/Jakarta'));

        $checkInRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'dinas_luar',
            'notes' => 'Masuk subuh dinas luar',
        ]);
        $checkInRes->assertStatus(200);

        // Attendance date must be anchored to shift start day (2026-10-19)
        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => '2026-10-19',
            'check_in_time' => '00:30:00',
            'check_out_time' => null,
            'shift_id' => $shift->id,
        ]);

        // 2. In the morning at 07:05 on 2026-10-20, check-out
        Carbon::setTestNow(Carbon::parse('2026-10-20 07:05:00', 'Asia/Jakarta'));

        $todayRes = $this->actingAs($employee, 'sanctum')->getJson('/api/employee/attendance/today');
        $todayRes->assertStatus(200)
            ->assertJsonPath('data.attendance.date', '2026-10-19')
            ->assertJsonPath('data.attendance.check_in_time', '00:30:00')
            ->assertJsonPath('data.attendance.check_out_time', null);

        $checkOutRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-out', [
            'notes' => 'Selesai shift',
        ]);
        $checkOutRes->assertStatus(200);

        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => '2026-10-19',
            'check_in_time' => '00:30:00',
            'check_out_time' => '07:05:00',
        ]);

        Carbon::setTestNow();
    }

    public function test_24_hour_shift_target_work_hours_not_met_at_8_hours(): void
    {
        $shift24 = Shift::create([
            'company' => 'rimamandiri',
            'name' => 'Shift 24 Jam',
            'code' => '24-JAM',
            'start_time' => '09:00:00',
            'end_time' => '08:59:00',
            'work_hours' => 24,
            'cross_day' => true,
            'is_active' => true,
        ]);

        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rimamandiri',
            'shift_id' => $shift24->id,
        ]);

        // 1. Check in at 09:00
        Carbon::setTestNow(Carbon::parse('2026-10-20 09:00:00', 'Asia/Jakarta'));
        $checkInRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'dinas_luar',
            'notes' => 'Mulai shift 24 jam',
        ]);
        $checkInRes->assertStatus(200);

        // 2. Check out after 8 hours at 17:00
        Carbon::setTestNow(Carbon::parse('2026-10-20 17:00:00', 'Asia/Jakarta'));
        $checkOutRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-out', [
            'notes' => 'Pulang setelah 8 jam',
        ]);
        $checkOutRes->assertStatus(200)
            ->assertJsonPath('work_duration.minutes', 480)
            ->assertJsonPath('work_duration.target_hours', 24)
            ->assertJsonPath('work_duration.target_minutes', 1440)
            ->assertJsonPath('work_duration.is_target_met', false)
            ->assertJsonPath('work_duration.is_eight_hours_met', false);

        $att = Attendance::where('user_id', $employee->id)->latest('id')->first();
        $this->assertFalse($att->is_eight_hours_met);

        // 3. If worked full 24 hours (until next morning 09:00)
        $att->update(['check_out_time' => null]);
        Carbon::setTestNow(Carbon::parse('2026-10-21 09:00:00', 'Asia/Jakarta'));
        $checkOut24Res = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-out', [
            'notes' => 'Pulang setelah 24 jam',
        ]);
        $checkOut24Res->assertStatus(200)
            ->assertJsonPath('work_duration.target_hours', 24)
            ->assertJsonPath('work_duration.is_target_met', true)
            ->assertJsonPath('work_duration.is_eight_hours_met', true);

        Carbon::setTestNow();
    }

    public function test_24_hour_shift_early_arrival_is_on_time_not_late(): void
    {
        $shift24 = Shift::create([
            'company' => 'rimamandiri',
            'name' => 'Shift 24 Jam Guard',
            'code' => '24-GUARD',
            'start_time' => '09:00:00',
            'end_time' => '08:59:00',
            'late_tolerance_minutes' => 15,
            'work_hours' => 24,
            'cross_day' => true,
            'is_active' => true,
        ]);

        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rimamandiri',
            'shift_id' => $shift24->id,
        ]);

        // Employee arrives 10 minutes early at 08:50
        Carbon::setTestNow(Carbon::parse('2026-10-20 08:50:00', 'Asia/Jakarta'));
        $checkInRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'dinas_luar',
            'notes' => 'Datang lebih awal 10 menit',
        ]);

        $checkInRes->assertStatus(200);

        $attendance = Attendance::where('user_id', $employee->id)->where('date', '2026-10-20')->first();
        $this->assertNotNull($attendance);
        $this->assertEquals('on_time', $attendance->check_in_status);
        $this->assertEquals('present', $attendance->status);

        Carbon::setTestNow();
    }

    public function test_24_hour_shift_checkout_slightly_past_24_hours_duration(): void
    {
        $shift24 = Shift::create([
            'company' => 'rimamandiri',
            'name' => 'Shift 24 Jam Guard 2',
            'code' => '24-GUARD-2',
            'start_time' => '09:00:00',
            'end_time' => '08:59:00',
            'late_tolerance_minutes' => 15,
            'work_hours' => 24,
            'cross_day' => true,
            'is_active' => true,
        ]);

        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rimamandiri',
            'shift_id' => $shift24->id,
        ]);

        // 1. Check in at 09:00 on Day 1
        Carbon::setTestNow(Carbon::parse('2026-10-20 09:00:00', 'Asia/Jakarta'));
        $checkInRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'dinas_luar',
            'notes' => 'Mulai shift 24 jam',
        ]);
        $checkInRes->assertStatus(200);

        // 2. Check out next day at 09:05 (24 hours and 5 minutes = 1445 minutes)
        Carbon::setTestNow(Carbon::parse('2026-10-21 09:05:00', 'Asia/Jakarta'));
        $checkOutRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-out', [
            'notes' => 'Pulang setelah 24 jam 5 menit',
        ]);

        $checkOutRes->assertStatus(200)
            ->assertJsonPath('work_duration.minutes', 1445)
            ->assertJsonPath('work_duration.target_hours', 24)
            ->assertJsonPath('work_duration.is_target_met', true)
            ->assertJsonPath('work_duration.is_eight_hours_met', true);

        $attendance = Attendance::where('user_id', $employee->id)->where('date', '2026-10-20')->first();
        $this->assertEquals(1445, $attendance->work_duration_minutes);
        $this->assertTrue($attendance->is_eight_hours_met);

        Carbon::setTestNow();
    }

    /**
     * REGRESI BUG VP: Memastikan upload ulang data gaji/Excel tidak akan pernah
     * me-revert penugasan lokasi atau unit sekolah karyawan yang sudah diubah manual oleh Admin.
     */
    public function test_payroll_reimport_does_not_revert_manually_assigned_employee_location(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'company' => 'rbs']);

        $locSrt6 = AttendanceLocation::create([
            'tenant_id' => 'rbs',
            'name' => 'SRT 6 Bogor',
            'latitude' => -6.5950,
            'longitude' => 106.8166,
            'radius_meters' => 100,
            'type' => 'school',
            'is_active' => true,
        ]);

        $locSrt5 = AttendanceLocation::create([
            'tenant_id' => 'rbs',
            'name' => 'SRT 5 Bogor',
            'latitude' => -6.5910,
            'longitude' => 106.8120,
            'radius_meters' => 120,
            'type' => 'school',
            'is_active' => true,
        ]);

        // Karyawan awalnya di SRT 6 Bogor
        $dean = User::factory()->create([
            'name' => 'Dean Karyawan',
            'role' => 'karyawan',
            'company' => 'rbs',
            'school_unit' => 'SRT 6 Bogor',
            'attendance_location_id' => $locSrt6->id,
        ]);

        // 1. Admin memindahkan Dean ke SRT 5 Bogor via assign-employees
        $assignRes = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/attendance-locations/{$locSrt5->id}/assign-employees", [
            'user_ids' => [$dean->id],
        ]);
        $assignRes->assertStatus(200);

        $deanFresh = $dean->fresh();
        $this->assertEquals($locSrt5->id, $deanFresh->attendance_location_id);
        $this->assertEquals('SRT 5 Bogor', $deanFresh->school_unit);

        // 2. Admin melakukan upload ulang data gaji di mana file Excel masih berisi data lama (SRT 6 Bogor)
        $oldPayroll = \App\Models\Payroll::create([
            'employee_name' => 'Dean Karyawan',
            'company' => 'rbs',
            'period' => '2026-10',
            'province' => 'Jawa Barat',
            'school_unit' => 'SRT 6 Bogor', // data lama di file Excel
            'status' => 'active',
            'take_home_pay' => 4500000,
        ]);

        // Proses sinkronisasi akun dari payroll Excel
        \App\Services\PayrollService::syncEmployeeAccount($oldPayroll);

        // 3. Admin atau sistem menjalankan sinkronisasi unit sekolah
        $syncRes = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/attendance-locations/sync-from-school-units', [
            'company' => 'rbs',
        ]);
        $syncRes->assertStatus(200);

        // 4. Verifikasi mutlak: Data Dean TETAP di SRT 5 Bogor, TIDAK revert ke SRT 6 Bogor
        $deanAfterSync = $dean->fresh();
        $this->assertEquals('SRT 5 Bogor', $deanAfterSync->school_unit, 'School unit karyawan tidak boleh revert ke data Excel lama!');
        $this->assertEquals($locSrt5->id, $deanAfterSync->attendance_location_id, 'Attendance location karyawan tidak boleh tertimpa!');

        // 5. Cek endpoint absensi karyawan (/today) mengunci ke SRT 5 Bogor
        $todayRes = $this->actingAs($deanAfterSync, 'sanctum')->getJson('/api/employee/attendance/today');
        $todayRes->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.assigned_location.id', $locSrt5->id)
            ->assertJsonPath('data.assigned_location.name', 'SRT 5 Bogor')
            ->assertJsonPath('data.assigned_location.radius_meters', 120);
    }

    /**
     * REGRESI BUG VP: Memastikan pencocokan nama lokasi spesifik (SRT 1 Kuantan Singingi
     * dan SRT 1 Kotawaringin Timur) tidak tertukar atau dibajak oleh unit umum 'SRT 1'.
     */
    public function test_exact_location_matching_prevents_hijacking_by_similar_names(): void
    {
        // 3 Lokasi dengan kemiripan nama
        $locGeneric = AttendanceLocation::create([
            'tenant_id' => 'rbs',
            'name' => 'SRT 1',
            'latitude' => -6.1000,
            'longitude' => 106.1000,
            'radius_meters' => 50,
            'type' => 'school',
            'is_active' => true,
        ]);

        $locKuantan = AttendanceLocation::create([
            'tenant_id' => 'rbs',
            'name' => 'SRT 1 Kuantan Singingi',
            'latitude' => -0.5333,
            'longitude' => 101.4500,
            'radius_meters' => 200,
            'type' => 'school',
            'is_active' => true,
        ]);

        $locKotawaringin = AttendanceLocation::create([
            'tenant_id' => 'rbs',
            'name' => 'SRT 1 Kotawaringin Timur',
            'latitude' => -2.5333,
            'longitude' => 112.9500,
            'radius_meters' => 300,
            'type' => 'school',
            'is_active' => true,
        ]);

        $empKuantan = User::factory()->create([
            'name' => 'Guru Kuantan',
            'role' => 'karyawan',
            'company' => 'rbs',
            'school_unit' => 'SRT 1 Kuantan Singingi',
        ]);

        $empKotawaringin = User::factory()->create([
            'name' => 'Guru Kotawaringin',
            'role' => 'karyawan',
            'company' => 'rbs',
            'school_unit' => 'SRT 1 Kotawaringin Timur',
        ]);

        $empGeneric = User::factory()->create([
            'name' => 'Guru Umum',
            'role' => 'karyawan',
            'company' => 'rbs',
            'school_unit' => 'SRT 1',
        ]);

        // Cek target lokasi masing-masing karyawan
        $resKuantan = $this->actingAs($empKuantan, 'sanctum')->getJson('/api/employee/attendance/today');
        $resKuantan->assertStatus(200)
            ->assertJsonPath('data.assigned_location.id', $locKuantan->id)
            ->assertJsonPath('data.assigned_location.name', 'SRT 1 Kuantan Singingi')
            ->assertJsonPath('data.assigned_location.radius_meters', 200);

        $resKotawaringin = $this->actingAs($empKotawaringin, 'sanctum')->getJson('/api/employee/attendance/today');
        $resKotawaringin->assertStatus(200)
            ->assertJsonPath('data.assigned_location.id', $locKotawaringin->id)
            ->assertJsonPath('data.assigned_location.name', 'SRT 1 Kotawaringin Timur')
            ->assertJsonPath('data.assigned_location.radius_meters', 300);

        $resGeneric = $this->actingAs($empGeneric, 'sanctum')->getJson('/api/employee/attendance/today');
        $resGeneric->assertStatus(200)
            ->assertJsonPath('data.assigned_location.id', $locGeneric->id)
            ->assertJsonPath('data.assigned_location.name', 'SRT 1')
            ->assertJsonPath('data.assigned_location.radius_meters', 50);
    }

    /**
     * REGRESI BUG VP: Memastikan pengubahan school_unit via manajemen pengguna
     * langsung otomatis menyelaraskan attendance_location_id ke lokasi sekolah baru.
     */
    public function test_updating_user_school_unit_syncs_attendance_location(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'company' => 'rbs']);

        $locNew = AttendanceLocation::create([
            'tenant_id' => 'rbs',
            'name' => 'SRT 5 Bogor',
            'latitude' => -6.5910,
            'longitude' => 106.8120,
            'radius_meters' => 100,
            'type' => 'school',
            'is_active' => true,
        ]);

        $soni = User::factory()->create([
            'name' => 'Soni Karyawan',
            'email' => 'soni@example.com',
            'role' => 'karyawan',
            'company' => 'rbs',
            'school_unit' => 'SRT 6 Bogor',
            'attendance_location_id' => null,
        ]);

        // Admin mengubah school_unit Soni menjadi SRT 5 Bogor
        $updateRes = $this->actingAs($admin, 'sanctum')->putJson("/api/users/{$soni->id}", [
            'name' => 'Soni Karyawan',
            'email' => 'soni@example.com',
            'role' => 'karyawan',
            'school_unit' => 'SRT 5 Bogor',
        ]);
        $updateRes->assertStatus(200);

        // Verifikasi attendance_location_id langsung terpasang ke SRT 5 Bogor
        $this->assertEquals($locNew->id, $soni->fresh()->attendance_location_id);
    }

    public function test_unclosed_yesterday_shift_is_auto_closed_when_checking_in_new_shift(): void
    {
        $shift = Shift::create([
            'company' => 'rbs',
            'name' => 'Shift 3 Malam',
            'code' => 'SHIFT-M',
            'start_time' => '23:00:00',
            'end_time' => '07:00:00',
            'late_tolerance_minutes' => 15,
            'work_hours' => 8.0,
            'cross_day' => true,
            'is_active' => true,
        ]);

        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rbs',
            'shift_id' => $shift->id,
        ]);

        // Yesterday 23:00 employee checks in but forgets to check out in morning
        Attendance::create([
            'user_id' => $employee->id,
            'date' => '2026-10-19',
            'check_in_time' => '23:00:00',
            'check_out_time' => null,
            'attendance_type' => 'masuk',
            'shift_id' => $shift->id,
        ]);

        // Next day 2026-10-20 at 22:50 employee checks in for the new shift
        Carbon::setTestNow(Carbon::parse('2026-10-20 22:50:00', 'Asia/Jakarta'));

        $checkInRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'dinas_luar',
            'notes' => 'Masuk shift baru malam kedua',
        ]);

        $checkInRes->assertStatus(200);

        // Yesterday's forgotten shift should be auto-closed
        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => '2026-10-19',
            'check_out_time' => '07:00:00',
        ]);

        // Today's new shift should be active
        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => '2026-10-20',
            'check_in_time' => '22:50:00',
            'check_out_time' => null,
        ]);

        Carbon::setTestNow();
    }

    public function test_employee_can_check_in_twice_in_one_day_after_checkout(): void
    {
        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rbs',
        ]);

        Carbon::setTestNow(Carbon::parse('2026-10-21 08:00:00', 'Asia/Jakarta'));

        // Sesi 1: Masuk pagi
        $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'dinas_luar',
            'notes' => 'Sesi 1 Pagi',
        ])->assertStatus(200);

        // Sesi 1: Pulang siang
        Carbon::setTestNow(Carbon::parse('2026-10-21 12:00:00', 'Asia/Jakarta'));
        $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-out', [
            'notes' => 'Selesai sesi 1',
        ])->assertStatus(200);

        // Sesi 2: Masuk lagi sore (absen 2x sehari)
        Carbon::setTestNow(Carbon::parse('2026-10-21 13:00:00', 'Asia/Jakarta'));
        $resSession2 = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'dinas_luar',
            'notes' => 'Sesi 2 Siang',
        ]);
        $resSession2->assertStatus(200);

        // Catatan sesi 1 terarsip di notes dan sesi 2 aktif masuk
        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => '2026-10-21',
            'check_in_time' => '13:00:00',
            'check_out_time' => null,
        ]);

        // Sesi 2: Pulang sore
        Carbon::setTestNow(Carbon::parse('2026-10-21 17:00:00', 'Asia/Jakarta'));
        $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-out', [
            'notes' => 'Selesai sesi 2',
        ])->assertStatus(200);

        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => '2026-10-21',
            'check_in_time' => '13:00:00',
            'check_out_time' => '17:00:00',
        ]);

        Carbon::setTestNow();
    }

    public function test_24_hour_shift_unclosed_is_auto_closed_when_checking_in_next_shift(): void
    {
        $shift24 = Shift::create([
            'company' => 'rbs',
            'name' => 'Shift 24 Jam Security',
            'code' => 'SHIFT-24H',
            'start_time' => '08:00:00',
            'end_time' => '08:00:00',
            'late_tolerance_minutes' => 30,
            'work_hours' => 24.0,
            'cross_day' => true,
            'is_active' => true,
        ]);

        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rbs',
            'shift_id' => $shift24->id,
        ]);

        // Day 1: 2026-10-18 08:00 employee checks in for 24h shift
        Attendance::create([
            'user_id' => $employee->id,
            'date' => '2026-10-18',
            'check_in_time' => '08:00:00',
            'check_out_time' => null,
            'attendance_type' => 'masuk',
            'shift_id' => $shift24->id,
        ]);

        // Day 3: 2026-10-20 08:00 employee checks in for the next rotation (Day 2 was off)
        // Employee forgot to check out on 2026-10-19 08:00
        Carbon::setTestNow(Carbon::parse('2026-10-20 08:00:00', 'Asia/Jakarta'));

        $checkInRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'dinas_luar',
            'notes' => 'Masuk shift 24 jam baru',
        ]);

        $checkInRes->assertStatus(200);

        // Previous 24h shift should be auto-closed with end_time '08:00:00'
        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => '2026-10-18',
            'check_out_time' => '08:00:00',
        ]);

        // Today's new shift should be active
        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => '2026-10-20',
            'check_in_time' => '08:00:00',
            'check_out_time' => null,
        ]);

        Carbon::setTestNow();
    }

    public function test_shift_3_employee_who_checked_out_this_morning_can_check_in_holiday_for_today(): void
    {
        $shift3 = Shift::create([
            'company' => 'all',
            'name' => 'Shift 3 Malam',
            'code' => 'SHIFT-3-MALAM',
            'start_time' => '23:00:00',
            'end_time' => '07:00:00',
            'late_tolerance_minutes' => 15,
            'work_hours' => 8.0,
            'cross_day' => true,
            'is_active' => true,
        ]);

        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rbs',
            'shift_id' => $shift3->id,
        ]);

        // Yesterday 2026-10-21: Check in 23:00
        $yesterdayAtt = Attendance::create([
            'user_id' => $employee->id,
            'date' => '2026-10-21',
            'check_in_time' => '23:00:00',
            'check_out_time' => null,
            'attendance_type' => 'masuk',
            'shift_id' => $shift3->id,
        ]);

        // Today 2026-10-22 at 07:00: Check out
        Carbon::setTestNow(Carbon::parse('2026-10-22 07:00:00', 'Asia/Jakarta'));
        $checkoutRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-out', []);
        $checkoutRes->assertStatus(200);

        $yesterdayAtt->refresh();
        $this->assertEquals('07:00:00', $yesterdayAtt->check_out_time);

        // At 07:05: Employee records Libur for today (Off shift)
        Carbon::setTestNow(Carbon::parse('2026-10-22 07:05:00', 'Asia/Jakarta'));
        $liburRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'libur',
            'notes' => 'Hari Libur Terjadwal / Off Shift 3',
        ]);

        $liburRes->assertStatus(200)
            ->assertJson([
                'status' => 'success',
            ]);

        // Assert database has today 2026-10-22 as libur
        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => '2026-10-22',
            'attendance_type' => 'libur',
            'status' => 'holiday',
        ]);

        // Yesterday's work shift remains intact
        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => '2026-10-21',
            'check_in_time' => '23:00:00',
            'check_out_time' => '07:00:00',
            'attendance_type' => 'masuk',
        ]);

        Carbon::setTestNow();
    }

    public function test_shift_3_employee_unclosed_yesterday_is_auto_closed_when_checking_in_as_libur(): void
    {
        $shift3 = Shift::create([
            'company' => 'all',
            'name' => 'Shift 3 Malam Test 2',
            'code' => 'SHIFT-3-TEST-2',
            'start_time' => '23:00:00',
            'end_time' => '07:00:00',
            'late_tolerance_minutes' => 15,
            'work_hours' => 8.0,
            'cross_day' => true,
            'is_active' => true,
        ]);

        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rbs',
            'shift_id' => $shift3->id,
        ]);

        // Yesterday 2026-10-21: Check in 23:00, forgot to checkout
        Attendance::create([
            'user_id' => $employee->id,
            'date' => '2026-10-21',
            'check_in_time' => '23:00:00',
            'check_out_time' => null,
            'attendance_type' => 'masuk',
            'shift_id' => $shift3->id,
        ]);

        // Today 2026-10-22 at 11:00: Employee records Libur directly without previous checkout
        Carbon::setTestNow(Carbon::parse('2026-10-22 11:00:00', 'Asia/Jakarta'));
        $liburRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'libur',
            'notes' => 'Hari Libur / Off',
        ]);

        $liburRes->assertStatus(200);

        // Yesterday should be auto-closed
        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => '2026-10-21',
            'check_out_time' => '07:00:00',
        ]);

        // Today is recorded as libur
        $this->assertDatabaseHas('attendances', [
            'user_id' => $employee->id,
            'date' => '2026-10-22',
            'attendance_type' => 'libur',
            'status' => 'holiday',
        ]);

        Carbon::setTestNow();
    }

    public function test_employee_who_checked_in_and_out_today_can_switch_to_holiday(): void
    {
        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rbs',
        ]);

        Carbon::setTestNow(Carbon::parse('2026-10-22 07:01:00', 'Asia/Jakarta'));

        // Accidental check in and out
        $att = Attendance::create([
            'user_id' => $employee->id,
            'date' => '2026-10-22',
            'check_in_time' => '07:01:00',
            'check_out_time' => '07:02:00',
            'attendance_type' => 'masuk',
            'status' => 'present',
        ]);

        // Employee switches to Libur
        Carbon::setTestNow(Carbon::parse('2026-10-22 07:05:00', 'Asia/Jakarta'));
        $liburRes = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/attendance/check-in', [
            'attendance_type' => 'libur',
            'notes' => 'Ternyata libur hari ini',
        ]);

        $liburRes->assertStatus(200);

        $att->refresh();
        $this->assertEquals('libur', $att->attendance_type);
        $this->assertEquals('holiday', $att->status);
        $this->assertStringContainsString('07:01:00', $att->notes);
        $this->assertStringContainsString('07:02:00', $att->notes);

        Carbon::setTestNow();
    }

    public function test_today_endpoint_returns_recent_completed_shift_when_shift_3_checked_out_today(): void
    {
        $shift3 = Shift::create([
            'company' => 'all',
            'name' => 'Shift 3 Malam Test 3',
            'code' => 'SHIFT-3-TEST-3',
            'start_time' => '23:00:00',
            'end_time' => '07:00:00',
            'work_hours' => 8.0,
            'cross_day' => true,
            'is_active' => true,
        ]);

        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rbs',
            'shift_id' => $shift3->id,
        ]);

        // Yesterday checked in and checked out
        Attendance::create([
            'user_id' => $employee->id,
            'date' => '2026-10-21',
            'check_in_time' => '23:00:00',
            'check_out_time' => '07:00:00',
            'attendance_type' => 'masuk',
            'shift_id' => $shift3->id,
        ]);

        Carbon::setTestNow(Carbon::parse('2026-10-22 07:10:00', 'Asia/Jakarta'));

        $todayRes = $this->actingAs($employee, 'sanctum')->getJson('/api/employee/attendance/today');
        $todayRes->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'attendance' => null,
                    'recent_completed_shift' => [
                        'date' => '2026-10-21',
                        'check_in_time' => '23:00:00',
                        'check_out_time' => '07:00:00',
                    ],
                ],
            ]);

        Carbon::setTestNow();
    }
}
