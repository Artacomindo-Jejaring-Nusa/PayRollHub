<?php

namespace Tests\Feature;

use App\Models\Payroll;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PayrollHubApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $viewer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create([
            'email' => 'admin@test.com',
            'password' => bcrypt('password123'),
        ]);

        $this->viewer = User::factory()->viewer()->create([
            'email' => 'viewer@test.com',
            'password' => bcrypt('password123'),
        ]);
    }

    public function test_user_can_login_with_valid_credentials(): void
    {
        $response = $this->postJson('/api/login', [
            'identifier' => 'admin@test.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'message',
                'data' => [
                    'user' => ['id', 'name', 'email', 'role'],
                    'token',
                    'role',
                ],
            ]);

        $this->assertEquals('admin', $response->json('data.role'));
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        $response = $this->postJson('/api/login', [
            'identifier' => 'admin@test.com',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(422)
            ->assertJson(['status' => 'error']);
    }

    public function test_authenticated_user_can_get_profile(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/me');

        $response->assertStatus(200)
            ->assertJsonPath('data.email', 'admin@test.com');
    }

    public function test_viewer_can_read_payrolls(): void
    {
        Payroll::factory()->create([
            'employee_name' => 'John Doe',
            'nik' => '3171000000000001',
            'province' => 'DKI Jakarta',
            'period' => '2026-03',
        ]);

        $response = $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/payrolls');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'data',
                'meta',
                'metrics',
                'filters',
            ]);
    }

    public function test_admin_can_create_payroll(): void
    {
        $payrollData = [
            'employee_name' => 'Jane Smith',
            'nik' => '3171999999999999',
            'province' => 'Jawa Barat',
            'period' => '2026-03',
            'basic_salary' => 7000000,
            'allowance' => 1500000,
            'deduction' => 500000,
        ];

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/payrolls', $payrollData);

        $response->assertStatus(201)
            ->assertJsonPath('data.employee_name', 'Jane Smith');

        $this->assertDatabaseHas('payrolls', [
            'nik' => '3171999999999999',
            'take_home_pay' => 8000000, // 7000000 + 1500000 - 500000
        ]);
    }

    public function test_viewer_cannot_create_payroll(): void
    {
        $payrollData = [
            'employee_name' => 'Hacker Test',
            'nik' => '3171888888888888',
            'province' => 'Banten',
            'period' => '2026-03',
            'basic_salary' => 5000000,
            'allowance' => 1000000,
            'deduction' => 200000,
        ];

        $response = $this->actingAs($this->viewer, 'sanctum')
            ->postJson('/api/payrolls', $payrollData);

        $response->assertStatus(403);
    }

    public function test_admin_can_update_payroll(): void
    {
        $payroll = Payroll::factory()->create([
            'basic_salary' => 5000000,
            'allowance' => 500000,
            'deduction' => 100000,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/payrolls/{$payroll->id}", [
                'employee_name' => $payroll->employee_name,
                'nik' => $payroll->nik,
                'province' => $payroll->province,
                'period' => $payroll->period,
                'basic_salary' => 6000000,
                'allowance' => 1000000,
                'deduction' => 500000,
            ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('payrolls', [
            'id' => $payroll->id,
            'basic_salary' => 6000000,
            'take_home_pay' => 6500000,
        ]);
    }

    public function test_viewer_cannot_update_payroll(): void
    {
        $payroll = Payroll::factory()->create();

        $response = $this->actingAs($this->viewer, 'sanctum')
            ->putJson("/api/payrolls/{$payroll->id}", [
                'employee_name' => 'Modified Name',
                'nik' => $payroll->nik,
                'province' => $payroll->province,
                'period' => $payroll->period,
                'basic_salary' => 6000000,
                'allowance' => 1000000,
                'deduction' => 500000,
            ]);

        $response->assertStatus(403);
    }

    public function test_admin_can_delete_payroll(): void
    {
        $payroll = Payroll::factory()->create();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/payrolls/{$payroll->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('payrolls', ['id' => $payroll->id]);
    }

    public function test_viewer_cannot_delete_payroll(): void
    {
        $payroll = Payroll::factory()->create();

        $response = $this->actingAs($this->viewer, 'sanctum')
            ->deleteJson("/api/payrolls/{$payroll->id}");

        $response->assertStatus(403);
        $this->assertDatabaseHas('payrolls', ['id' => $payroll->id]);
    }

    public function test_admin_can_manage_users(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/users', [
                'name' => 'New Staff',
                'email' => 'staff@test.com',
                'password' => 'secret123',
                'role' => 'viewer',
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('users', ['email' => 'staff@test.com']);
    }

    public function test_viewer_cannot_access_user_management(): void
    {
        $response = $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/users');

        $response->assertStatus(403);
    }

    public function test_user_role_can_read_and_search_payrolls(): void
    {
        $user = User::factory()->create([
            'email' => 'user_test@test.com',
            'role' => 'user',
        ]);

        Payroll::factory()->create([
            'employee_name' => 'Budi Santoso',
            'nik' => '3201000000000002',
            'province' => 'Jawa Barat',
            'period' => '2026-03',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/payrolls?search=Budi');

        $response->assertStatus(200)
            ->assertJsonPath('meta.total', 1);
    }

    public function test_user_role_cannot_modify_payrolls_or_users(): void
    {
        $user = User::factory()->create(['role' => 'user']);
        $payroll = Payroll::factory()->create();

        // Attempt CREATE
        $this->actingAs($user, 'sanctum')
            ->postJson('/api/payrolls', [
                'employee_name' => 'Forbidden Create',
                'province' => 'DKI Jakarta',
                'period' => '2026-03',
                'basic_salary' => 5000000,
            ])
            ->assertStatus(403);

        // Attempt UPDATE
        $this->actingAs($user, 'sanctum')
            ->putJson("/api/payrolls/{$payroll->id}", [
                'employee_name' => 'Forbidden Update',
                'province' => 'DKI Jakarta',
                'period' => '2026-03',
                'basic_salary' => 6000000,
            ])
            ->assertStatus(403);

        // Attempt DELETE
        $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/payrolls/{$payroll->id}")
            ->assertStatus(403);

        // Attempt USERS list
        $this->actingAs($user, 'sanctum')
            ->getJson('/api/users')
            ->assertStatus(403);
    }

    public function test_rate_limiter_blocks_brute_force_login(): void
    {
        $email = 'bruteforce@test.com';

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', [
                'identifier' => $email,
                'password' => 'wrongpass',
            ])->assertStatus(422);
        }

        // 6th attempt should trigger 429 Too Many Requests
        $this->postJson('/api/login', [
            'identifier' => $email,
            'password' => 'wrongpass',
        ])->assertStatus(429);
    }

    public function test_user_cannot_view_salary_and_bank_account_in_payroll_list_and_detail(): void
    {
        $user = User::factory()->create(['role' => 'user']);
        $payroll = Payroll::factory()->create([
            'employee_name' => 'Karyawan Rahasia',
            'basic_salary' => 8000000,
            'allowance' => 1000000,
            'deduction' => 500000,
            'take_home_pay' => 8500000,
            'bank_account' => '1234567890',
            'bank_name' => 'BCA',
        ]);

        // In list
        $response = $this->actingAs($user, 'sanctum')->getJson('/api/payrolls');
        $response->assertStatus(200);
        $item = $response->json('data.0');

        $this->assertEquals(0, $item['basic_salary']);
        $this->assertEquals(0, $item['take_home_pay']);
        $this->assertNull($item['bank_account']);
        $this->assertNull($item['bank_name']);
        $this->assertEquals('-', $item['formatted_take_home_pay']);

        // Check metrics: financial values are 0 for non-admin
        $this->assertEquals(0, $response->json('metrics.total_basic_salary'));
        $this->assertEquals(0, $response->json('metrics.total_take_home_pay'));
        $this->assertEquals(1, $response->json('metrics.total_employees'));
        $this->assertArrayHasKey('total_provinces', $response->json('metrics'));
        $this->assertArrayHasKey('total_locations', $response->json('metrics'));

        // In detail (show)
        $detailResponse = $this->actingAs($user, 'sanctum')->getJson("/api/payrolls/{$payroll->id}");
        $detailResponse->assertStatus(200);
        $detailItem = $detailResponse->json('data');
        $this->assertEquals(0, $detailItem['basic_salary']);
        $this->assertEquals(0, $detailItem['take_home_pay']);
        $this->assertNull($detailItem['bank_account']);
        $this->assertNull($detailItem['bank_name']);

        // Cannot download slip PDF
        $slipResponse = $this->actingAs($user, 'sanctum')->getJson("/api/payrolls/{$payroll->id}/slip-pdf");
        $slipResponse->assertStatus(403);

        // Cannot export reports
        $exportResponse = $this->actingAs($user, 'sanctum')->get('/api/payrolls/export?format=xlsx');
        $exportResponse->assertStatus(403);
    }

    public function test_admin_can_view_salary_and_bank_account(): void
    {
        $payroll = Payroll::factory()->create([
            'employee_name' => 'Admin Test Karyawan',
            'basic_salary' => 5000000,
            'allowance' => 0,
            'deduction' => 0,
            'take_home_pay' => 5000000,
            'bank_account' => '9876543210',
            'bank_name' => 'BNI',
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')->getJson("/api/payrolls?search={$payroll->employee_name}");
        $response->assertStatus(200);
        $item = $response->json('data.0');

        $this->assertEquals(5000000, $item['basic_salary']);
        $this->assertEquals(5000000, $item['take_home_pay']);
        $this->assertEquals('9876543210', $item['bank_account']);
        $this->assertEquals('BNI', $item['bank_name']);
        $this->assertStringContainsString('5.000.000', $item['formatted_take_home_pay']);
        $this->assertGreaterThan(0, $response->json('metrics.total_take_home_pay'));
    }

    public function test_security_headers_are_present(): void
    {
        $response = $this->getJson('/up');

        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
        $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
}
