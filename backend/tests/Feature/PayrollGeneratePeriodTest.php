<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Payroll;
use App\Models\PayrollPeriod;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PayrollGeneratePeriodTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $employee1;
    protected User $employee2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'company' => 'rbs',
        ]);

        $this->employee1 = User::factory()->create([
            'name' => 'Budi Santoso',
            'nik' => '1234567890123456',
            'role' => 'karyawan',
            'company' => 'rbs',
        ]);

        $this->employee2 = User::factory()->create([
            'name' => 'Siti Rahma',
            'nik' => '9876543210987654',
            'role' => 'karyawan',
            'company' => 'rbs',
        ]);
    }

    public function test_admin_can_generate_payroll_for_new_period_and_visible_to_user(): void
    {
        // 1. Create source payroll in SP 1
        Payroll::create([
            'employee_name' => 'Budi Santoso',
            'nik' => '1234567890123456',
            'company' => 'rbs',
            'period' => 'SP 1',
            'province' => 'DKI JAKARTA',
            'status' => 'active',
            'basic_salary' => 5000000,
            'bpjs_kes' => 192094,
            'allowance' => 500000,
            'deduction' => 0,
            'take_home_pay' => 5692094,
            'is_visible_to_user' => true,
        ]);

        Payroll::create([
            'employee_name' => 'Siti Rahma',
            'nik' => '9876543210987654',
            'company' => 'rbs',
            'period' => 'SP 1',
            'province' => 'JAWA BARAT',
            'status' => 'active',
            'basic_salary' => 4500000,
            'bpjs_kes' => 180000,
            'allowance' => 300000,
            'deduction' => 0,
            'take_home_pay' => 4980000,
            'is_visible_to_user' => true,
        ]);

        // 2. Admin calls generate-period endpoint for SP 2
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/payrolls/generate-period', [
                'target_period' => 'SP 2',
                'source_period' => 'SP 1',
                'company' => 'rbs',
                'sync_attendance' => false,
                'is_visible_to_user' => true,
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.target_period', 'SP 2')
            ->assertJsonPath('data.created_count', 2)
            ->assertJsonPath('data.is_visible_to_user', true);

        // Verify database has new SP 2 records
        $this->assertDatabaseHas('payrolls', [
            'employee_name' => 'Budi Santoso',
            'period' => 'SP 2',
            'is_visible_to_user' => true,
        ]);

        $this->assertDatabaseHas('payrolls', [
            'employee_name' => 'Siti Rahma',
            'period' => 'SP 2',
            'is_visible_to_user' => true,
        ]);

        // 3. Verify employee can immediately view this payroll in employee portal
        $employeeResponse = $this->actingAs($this->employee1, 'sanctum')
            ->getJson('/api/employee/payrolls?period=SP 2');

        $employeeResponse->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $data = $employeeResponse->json('data');
        $this->assertNotEmpty($data);
        $this->assertEquals('SP 2', $data[0]['period']);
    }

    public function test_admin_can_generate_payroll_with_attendance_sync(): void
    {
        // 1. Create source payroll in SP 1
        Payroll::create([
            'employee_name' => 'Budi Santoso',
            'nik' => '1234567890123456',
            'company' => 'rbs',
            'period' => 'SP 1',
            'province' => 'DKI JAKARTA',
            'status' => 'active',
            'basic_salary' => 5000000,
            'bpjs_kes' => 200000,
            'allowance' => 0,
            'deduction' => 0,
            'take_home_pay' => 5200000,
            'is_visible_to_user' => true,
        ]);

        // 2. Create attendances for employee in cut-off date range (2026-01-21 to 2026-02-20)
        Attendance::create([
            'user_id' => $this->employee1->id,
            'date' => '2026-01-22',
            'check_in_time' => '08:00:00',
            'check_out_time' => '17:00:00',
            'attendance_type' => 'hadir',
            'check_in_status' => 'on_time',
        ]);

        Attendance::create([
            'user_id' => $this->employee1->id,
            'date' => '2026-01-23',
            'check_in_time' => '08:00:00',
            'check_out_time' => '17:00:00',
            'attendance_type' => 'hadir',
            'check_in_status' => 'on_time',
        ]);

        Attendance::create([
            'user_id' => $this->employee1->id,
            'date' => '2026-01-25',
            'attendance_type' => 'libur',
        ]);

        // 3. Admin calls generate-period with attendance sync and cut-off range
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/payrolls/generate-period', [
                'target_period' => 'SP 2',
                'source_period' => 'SP 1',
                'company' => 'rbs',
                'sync_attendance' => true,
                'start_date' => '2026-01-21',
                'end_date' => '2026-02-20',
                'is_visible_to_user' => true,
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.created_count', 1);

        // Verify attended_days = 2, holiday_days = 1
        $this->assertDatabaseHas('payrolls', [
            'employee_name' => 'Budi Santoso',
            'period' => 'SP 2',
            'attended_days' => 2,
            'holiday_days' => 1,
            'is_visible_to_user' => true,
        ]);
    }

    public function test_admin_can_generate_payroll_without_source_period_takes_active_master(): void
    {
        Payroll::create([
            'employee_name' => 'Budi Santoso',
            'nik' => '1234567890123456',
            'company' => 'rbs',
            'period' => 'SP 1',
            'province' => 'DKI JAKARTA',
            'status' => 'active',
            'basic_salary' => 5000000,
            'bpjs_kes' => 200000,
            'allowance' => 0,
            'deduction' => 0,
            'take_home_pay' => 5200000,
            'is_visible_to_user' => true,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/payrolls/generate-period', [
                'target_period' => 'SP 3',
                // source_period is omitted!
                'company' => 'rbs',
                'sync_attendance' => false,
                'is_visible_to_user' => true,
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.target_period', 'SP 3')
            ->assertJsonPath('data.created_count', 1);

        $this->assertDatabaseHas('payrolls', [
            'employee_name' => 'Budi Santoso',
            'period' => 'SP 3',
            'is_visible_to_user' => true,
        ]);
    }
}

