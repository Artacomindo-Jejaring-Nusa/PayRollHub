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

    public function test_formula_and_absence_deduction_calculation(): void
    {
        // Net Base Price: 3,462,919
        // BPJS Kes: 173,146
        // BPJS TK: 319,974
        // Formula Gaji Pokok = 3,462,919 - 173,146 - 319,974 = 2,969,799
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/payrolls', [
                'employee_name' => 'Septian Gaji Test',
                'province' => 'DKI Jakarta',
                'period' => '2026-09',
                'net_base_price' => 3462919,
                'bpjs_kes' => 173146,
                'bpjs_tk' => 319974,
                'absence_count' => 2,
                'absence_rate' => 50000,
                'status' => 'active',
            ]);

        $response->assertStatus(201);
        $data = $response->json('data');

        $this->assertEquals(2969799, $data['basic_salary']);
        $this->assertEquals(100000, $data['absence_deduction']);
        $this->assertEquals(2969799 - 100000, $data['take_home_pay']);
    }

    public function test_admin_can_toggle_employee_status_to_off_and_active(): void
    {
        $payroll = Payroll::factory()->create([
            'employee_name' => 'Karyawan Akan Off',
            'status' => 'active',
        ]);

        // Toggle to off with resign date
        $offResponse = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/payrolls/{$payroll->id}/status", [
                'status' => 'off',
                'resign_date' => '2026-09-30',
            ]);

        $offResponse->assertStatus(200);
        $this->assertEquals('off', $offResponse->json('data.status'));
        $this->assertEquals('2026-09-30', $offResponse->json('data.resign_date'));

        // Verify dashboard metrics reflect the off employee
        $metricsResponse = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/payrolls');

        $metricsResponse->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, $metricsResponse->json('metrics.total_off_employees'));

        // Toggle back to active
        $activeResponse = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/payrolls/{$payroll->id}/status", [
                'status' => 'active',
            ]);

        $activeResponse->assertStatus(200);
        $this->assertEquals('active', $activeResponse->json('data.status'));
    }

    public function test_user_can_download_payroll_template_xlsx_and_csv(): void
    {
        // Test XLSX download
        $responseXlsx = $this->actingAs($this->admin, 'sanctum')
            ->get('/api/payrolls/template?format=xlsx');

        $responseXlsx->assertStatus(200);
        $this->assertTrue(str_contains(
            $responseXlsx->headers->get('content-disposition') ?? '',
            'template_import_payrollhub.xlsx'
        ));

        // Test CSV download
        $responseCsv = $this->actingAs($this->admin, 'sanctum')
            ->get('/api/payrolls/template?format=csv');

        $responseCsv->assertStatus(200);
        $this->assertTrue(str_contains(
            $responseCsv->headers->get('content-disposition') ?? '',
            'template_import_payrollhub.csv'
        ));
        $content = $responseCsv->getContent();
        $this->assertStringContainsString('NAMA LENGKAP', $content);
        $this->assertStringContainsString('FEBRI HIDAYAT', $content);
    }

    public function test_admin_can_preview_import_without_saving_to_database(): void
    {
        $csvContent = "\xEF\xBB\xBF" .
            "NO,WILAYAH,SEKOLAH RAKYAT PERMANEN,NIK,NAMA LENGKAP,FUNGSI TENAGA KEPENDIDIKAN,TANGGAL MASUK,STATUS,TANGGAL KELUAR,PERUSAHAAN,HARGA DASAR (NET PPH & FEE),BPJS KES 5%,BPJS TK 9.24%,GAJI POKOK,POTONGAN ABSENSI,KETERANGAN ABSENSI,NO REKENING,BANK,PERIODE\n" .
            "# PETUNJUK: Baris petunjuk ini harus otomatis diabaikan,,,,,,,,,,,,,,,\n" .
            "1,DKI JAKARTA,Salemba Pusat,'3171012304910001,Karyawan Preview 1,Staff,01-08-2024,Aktif,,rbs,6000000,300000,554400,5145600,0,,2098199007,BNI,2026-09\n" .
            "2,SUMATERA UTARA,Unit 2,'1213131111910001,Karyawan Preview 2,Security,25-07-2024,Off,15-09-2026,rima,3500000,175000,323400,3001600,100000,Izin 1 hari,2097700845,BNI,2026-09\n";

        $file = \Illuminate\Http\UploadedFile::fake()->createWithContent('preview_test.csv', $csvContent);

        $initialCount = Payroll::count();

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/payrolls/import/preview', [
                'file' => $file,
                'period' => '2026-09',
            ]);

        $response->assertStatus(200);
        $data = $response->json('data');

        // Verify statistics
        $this->assertEquals(2, $data['total_rows']);
        $this->assertEquals(1, $data['active_count']);
        $this->assertEquals(1, $data['off_count']);
        $this->assertCount(2, $data['rows']);

        // Assert database is UNTOUCHED during preview
        $this->assertEquals($initialCount, Payroll::count());
    }

    public function test_instruction_sheet_is_not_imported_into_database(): void
    {
        // Generate real 2-sheet spreadsheet (Data + Petunjuk Pengisian)
        $spreadsheet = \App\Exports\PayrollTemplateExporter::createSpreadsheet();
        $tempPath = tempnam(sys_get_temp_dir(), 'test_import_') . '.xlsx';
        $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
        $writer->save($tempPath);

        $file = new \Illuminate\Http\UploadedFile(
            $tempPath,
            'template_with_guide.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true
        );

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/payrolls/import', [
                'file' => $file,
                'period' => '2026-08',
            ]);

        $response->assertStatus(200);

        // Verify only data from Sheet 1 is imported (3 sample employees)
        $this->assertDatabaseHas('payrolls', [
            'employee_name' => 'FEBRI HIDAYAT',
        ]);
        $this->assertDatabaseHas('payrolls', [
            'employee_name' => 'RUDI SAPUTRA',
            'status' => 'off',
        ]);

        // Verify NO instructions from Sheet 2 leaked into database
        $this->assertDatabaseMissing('payrolls', [
            'employee_name' => 'PETUNJUK LENGKAP PENGISIAN TEMPLATE DATA PENGGAJIAN (PAYROLLHUB)',
        ]);
        $this->assertDatabaseMissing('payrolls', [
            'employee_name' => 'NAMA KOLOM HEADER',
        ]);

        if (file_exists($tempPath)) {
            @unlink($tempPath);
        }
    }

    public function test_payroll_period_filter_supports_sp_contracts(): void
    {
        Payroll::factory()->create([
            'employee_name' => 'Karyawan SP 1',
            'period' => '2026-08', // Legacy SP 1 data
        ]);

        Payroll::factory()->create([
            'employee_name' => 'Karyawan SP 2',
            'period' => 'SP 2',
        ]);

        // Filter by SP 1 should find the 2026-08 record
        $responseSp1 = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/payrolls?period=SP 1');
        $responseSp1->assertStatus(200);
        $namesSp1 = collect($responseSp1->json('data'))->pluck('employee_name');
        $this->assertTrue($namesSp1->contains('Karyawan SP 1'));

        // Filter by SP 2 should find the SP 2 record
        $responseSp2 = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/payrolls?period=SP 2');
        $responseSp2->assertStatus(200);
        $namesSp2 = collect($responseSp2->json('data'))->pluck('employee_name');
        $this->assertTrue($namesSp2->contains('Karyawan SP 2'));
        $this->assertFalse($namesSp2->contains('Karyawan SP 1'));
    }
}

