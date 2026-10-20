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

        // Employee cannot export reports
        $employee = User::factory()->create(['role' => 'karyawan']);
        $exportResponse = $this->actingAs($employee, 'sanctum')->get('/api/payrolls/export?format=xlsx');
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
        // Take Home Pay Resmi 2026 = (Gaji Pokok + BPJS Kesehatan) - Potongan Absensi (BPJS TK tidak dipotong dari THP)
        $expectedThp = (2969799 + 173146) - 100000;
        $this->assertEquals($expectedThp, $data['take_home_pay']);
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

    public function test_admin_can_clear_all_payrolls(): void
    {
        Payroll::factory()->count(5)->create(['company' => 'rimamandiri']);
        Payroll::factory()->count(3)->create(['company' => 'rbs']);

        $riamaAdmin = User::factory()->admin()->create(['company' => 'rimamandiri']);

        $response = $this->actingAs($riamaAdmin, 'sanctum')
            ->deleteJson('/api/payrolls/clear/all');

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'deleted_count' => 5,
                ],
            ]);

        $this->assertEquals(0, Payroll::where('company', 'rimamandiri')->count());
        $this->assertEquals(3, Payroll::where('company', 'rbs')->count());
    }

    public function test_employee_can_update_profile_without_altering_hrd_fields(): void
    {
        $employeeUser = User::factory()->create([
            'role' => 'user',
            'company' => 'rimamandiri',
            'school_unit' => 'Salemba (Pusat)',
            'nik' => '3171012304910001',
            'name' => 'Febri Hidayat',
        ]);

        $response = $this->actingAs($employeeUser, 'sanctum')
            ->putJson('/api/employee/profile', [
                'name' => 'Hacker Name', // Should be ignored or rejected for HRD
                'nik' => '9999999999999999', // Should be ignored or rejected for HRD
                'position' => 'Direktur Utama', // Should be ignored
                'school_unit' => 'Pusat Mars', // Should be ignored
                'phone' => '081234567890',
                'birth_date' => '1995-08-01',
                'gender' => 'Laki-laki',
                'bank_name' => 'BCA',
                'bank_account' => '1234567890',
                'address' => 'Jl. Salemba Raya No. 10',
            ]);

        $response->assertStatus(200);

        $employeeUser->refresh();
        // Personal data updated:
        $this->assertEquals('081234567890', $employeeUser->phone);
        $this->assertEquals('1995-08-01', $employeeUser->birth_date);
        $this->assertEquals('Laki-laki', $employeeUser->gender);
        $this->assertEquals('BCA', $employeeUser->bank_name);
        $this->assertEquals('1234567890', $employeeUser->bank_account);
        $this->assertEquals('Jl. Salemba Raya No. 10', $employeeUser->address);

        // HRD locked fields UNCHANGED:
        $this->assertEquals('Febri Hidayat', $employeeUser->name);
        $this->assertEquals('3171012304910001', $employeeUser->nik);
        $this->assertEquals('Salemba (Pusat)', $employeeUser->school_unit);
    }

    public function test_cross_company_login_is_blocked_for_normal_users_but_allowed_for_super_admin(): void
    {
        $riamaUser = User::factory()->create([
            'email' => 'riama.staff@test.com',
            'company' => 'rimamandiri',
            'role' => 'admin',
            'password' => bcrypt('secret123'),
        ]);

        $superAdmin = User::factory()->create([
            'email' => 'superadmin@test.com',
            'company' => 'rbs',
            'role' => 'super_admin',
            'password' => bcrypt('secret123'),
        ]);

        // 1. Riama staff tries to login to RBS portal -> Rejected 403
        $blockedResponse = $this->postJson('/api/login', [
            'identifier' => 'riama.staff@test.com',
            'password' => 'secret123',
            'company' => 'rbs',
        ]);
        $blockedResponse->assertStatus(403)
            ->assertJson([
                'status' => 'error',
            ]);
        $this->assertStringContainsString('Akun Anda terdaftar di PT. Riama Mandiri Pratama', $blockedResponse->json('message'));

        // 2. Riama staff logs into Riama portal -> Success 200
        $successResponse = $this->postJson('/api/login', [
            'identifier' => 'riama.staff@test.com',
            'password' => 'secret123',
            'company' => 'rimamandiri',
        ]);
        $successResponse->assertStatus(200);

        // 3. Super Admin logs into Riama portal -> Success 200
        $superAdminRiama = $this->postJson('/api/login', [
            'identifier' => 'superadmin@test.com',
            'password' => 'secret123',
            'company' => 'rimamandiri',
        ]);
        $superAdminRiama->assertStatus(200);

        // 4. Super Admin logs into RBS portal -> Success 200
        $superAdminRbs = $this->postJson('/api/login', [
            'identifier' => 'superadmin@test.com',
            'password' => 'secret123',
            'company' => 'rbs',
        ]);
        $superAdminRbs->assertStatus(200);
    }

    public function test_ordinary_admin_cannot_access_or_modify_other_company_payrolls(): void
    {
        $riamaPayroll = Payroll::factory()->create([
            'employee_name' => 'Karyawan Riama',
            'company' => 'rimamandiri',
        ]);

        $rbsAdmin = $this->admin; // company = 'rbs'

        // 1. RBS Admin tries to view Riama payroll detail -> 403 Forbidden
        $responseShow = $this->actingAs($rbsAdmin, 'sanctum')->getJson("/api/payrolls/{$riamaPayroll->id}");
        $responseShow->assertStatus(403);

        // 2. RBS Admin tries to update Riama payroll -> 403 Forbidden
        $responseUpdate = $this->actingAs($rbsAdmin, 'sanctum')->putJson("/api/payrolls/{$riamaPayroll->id}", [
            'employee_name' => 'Hacked Name',
            'nik' => $riamaPayroll->nik,
            'province' => $riamaPayroll->province,
            'period' => $riamaPayroll->period,
            'basic_salary' => 5000000,
        ]);
        $responseUpdate->assertStatus(403);

        // 3. RBS Admin tries to delete Riama payroll -> 403 Forbidden
        $responseDelete = $this->actingAs($rbsAdmin, 'sanctum')->deleteJson("/api/payrolls/{$riamaPayroll->id}");
        $responseDelete->assertStatus(403);

        // 4. Riama Admin can view and delete their own payroll -> 200 OK
        $riamaAdmin = User::factory()->admin()->create(['company' => 'rimamandiri']);
        $responseRiamaShow = $this->actingAs($riamaAdmin, 'sanctum')->getJson("/api/payrolls/{$riamaPayroll->id}");
        $responseRiamaShow->assertStatus(200);

        $responseRiamaDelete = $this->actingAs($riamaAdmin, 'sanctum')->deleteJson("/api/payrolls/{$riamaPayroll->id}");
        $responseRiamaDelete->assertStatus(200);
    }

    public function test_admin_can_access_work_reports_and_role_user_is_forbidden(): void
    {
        // 1. Role 'user' accesses admin work reports -> 403 Forbidden
        $userRole = User::factory()->create([
            'role' => 'user',
            'company' => 'rbs',
        ]);

        $responseUser = $this->actingAs($userRole, 'sanctum')->getJson('/api/admin/work-reports');
        $responseUser->assertStatus(403)
            ->assertJsonPath('status', 'error');

        // 2. Role 'admin' accesses admin work reports -> 200 OK
        $admin = User::factory()->admin()->create([
            'company' => 'rbs',
        ]);

        $responseAdmin = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/work-reports?per_page=10');
        $responseAdmin->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('meta.per_page', 10)
            ->assertJsonStructure([
                'status',
                'data',
                'meta' => [
                    'current_page',
                    'last_page',
                    'per_page',
                    'total',
                    'from',
                    'to',
                ],
            ]);
    }

    public function test_role_user_can_submit_feedback_and_admin_can_review_it(): void
    {
        $user = User::factory()->create([
            'name' => 'Staf Pengguna',
            'role' => 'user',
            'company' => 'rbs',
        ]);

        // 1. Role User submits feedback
        $submitRes = $this->actingAs($user, 'sanctum')->postJson('/api/user/feedback', [
            'title' => 'Saran Tombol Ekspor Cepat',
            'category' => 'saran',
            'description' => 'Mohon ditambahkan shortcut tombol untuk ekspor data bulanan.',
        ]);

        $submitRes->assertStatus(201)
            ->assertJsonPath('status', 'success');

        $ticket = $submitRes->json('data.ticket_number');
        $this->assertStringStartsWith('FDB-', $ticket);

        // 2. Admin retrieves complaints/feedback list
        $admin = User::factory()->admin()->create(['company' => 'rbs']);
        $adminListRes = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/complaints');

        $adminListRes->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $feedbackData = collect($adminListRes->json('data'))->firstWhere('ticket_number', $ticket);
        $this->assertNotNull($feedbackData);
        $this->assertEquals('Staf Pengguna', $feedbackData['user']['name']);
        $this->assertEquals('user', $feedbackData['user']['role']);

        // 3. Admin responds to feedback
        $feedbackId = $submitRes->json('data.id');
        $updateRes = $this->actingAs($admin, 'sanctum')->putJson("/api/admin/complaints/{$feedbackId}", [
            'status' => 'resolved',
            'admin_notes' => 'Terima kasih atas sarannya, fitur sudah ditambahkan.',
        ]);

        $updateRes->assertStatus(200)
            ->assertJsonPath('status', 'success');

        // 4. User views updated feedback with admin notes
        $userListRes = $this->actingAs($user, 'sanctum')->getJson('/api/user/feedback');
        $userListRes->assertStatus(200);

        $userFeedbackItem = collect($userListRes->json('data'))->firstWhere('id', $feedbackId);
        $this->assertEquals('resolved', $userFeedbackItem['status']);
        $this->assertEquals('Terima kasih atas sarannya, fitur sudah ditambahkan.', $userFeedbackItem['admin_notes']);
    }

    public function test_admin_can_manage_payroll_period_date_ranges_and_resolve_attendance_window(): void
    {
        $admin = User::factory()->admin()->create(['company' => 'rbs']);

        // 1. Find or create SP 2 period
        $sp2 = \App\Models\PayrollPeriod::firstOrCreate(
            ['code' => 'SP 2'],
            ['name' => 'Surat Pesanan 2', 'company' => 'all', 'is_sp' => true, 'is_visible_to_user' => true]
        );

        // 2. Admin updates SP 2 with custom cut-off window (26 Jan s/d 25 Feb)
        $updateRes = $this->actingAs($admin, 'sanctum')->putJson("/api/admin/payroll-periods/{$sp2->id}", [
            'start_date' => '2026-01-26',
            'end_date' => '2026-02-25',
        ]);

        $updateRes->assertStatus(200)
            ->assertJsonPath('status', 'success');

        // 3. Verify DB and resolveDateRange
        $this->assertEquals(['2026-01-26', '2026-02-25'], \App\Models\PayrollPeriod::resolveDateRange('SP 2'));

        // 4. Verify AdminAttendanceController dynamically uses the custom cut-off
        $range = \App\Http\Controllers\Api\AdminAttendanceController::getSpDateRange('SP 2');
        $this->assertEquals(['2026-01-26', '2026-02-25'], $range);

        // 5. Admin creates custom period with cut-off dates
        $createRes = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/payroll-periods', [
            'code' => 'Kustom-Ambon',
            'name' => 'Karyawan Ambon Periode 1',
            'company' => 'rbs',
            'start_date' => '2026-02-01',
            'end_date' => '2026-02-28',
        ]);

        $createRes->assertStatus(201)
            ->assertJsonPath('status', 'success');

        $this->assertEquals(['2026-02-01', '2026-02-28'], \App\Models\PayrollPeriod::resolveDateRange('Kustom-Ambon'));
        $this->assertEquals(['2026-02-01', '2026-02-28'], \App\Http\Controllers\Api\AdminAttendanceController::getSpDateRange('Kustom-Ambon'));

        // 6. Validation: end_date cannot be earlier than start_date
        $invalidRes = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/payroll-periods', [
            'code' => 'Invalid-Dates',
            'name' => 'Periode Salah Tanggal',
            'company' => 'rbs',
            'start_date' => '2026-05-20',
            'end_date' => '2026-05-10',
        ]);

        $invalidRes->assertStatus(422);
    }
}

