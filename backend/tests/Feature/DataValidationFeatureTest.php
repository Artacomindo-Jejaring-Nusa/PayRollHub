<?php

namespace Tests\Feature;

use App\Models\Payroll;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class DataValidationFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::factory()->create([
            'name' => 'Admin RBS',
            'email' => 'admin@rbs.com',
            'role' => 'admin',
            'company' => 'rbs',
        ]);
    }

    public function test_admin_can_perform_quick_check_for_new_and_existing_employee(): void
    {
        // Seed an existing employee in SP 8
        Payroll::create([
            'employee_name' => 'Ahmad Fauzi',
            'nik' => '7371010101900001',
            'province' => 'SULAWESI SELATAN',
            'school_unit' => 'SDN 1 MAKASSAR',
            'company' => 'rbs',
            'period' => 'SP 8',
            'status' => 'active',
            'basic_salary' => 3500000,
            'take_home_pay' => 3500000,
        ]);

        // 1. Quick check for existing employee with same name & school
        $resExisting = $this->actingAs($this->adminUser)->postJson('/api/admin/validation/quick-check', [
            'name' => 'Ahmad Fauzi',
            'province' => 'SULAWESI SELATAN',
            'school_unit' => 'SDN 1 MAKASSAR',
            'company' => 'rbs',
        ]);

        $resExisting->assertOk();
        $this->assertEquals('PERPANJANGAN_SP', $resExisting->json('data.classification'));
        $this->assertEquals('7371010101900001', $resExisting->json('data.recovered_nik'));

        // 2. Quick check for totally new person
        $resNew = $this->actingAs($this->adminUser)->postJson('/api/admin/validation/quick-check', [
            'name' => 'Zulfa Maharani Baru',
            'province' => 'SULAWESI SELATAN',
            'school_unit' => 'SDN 1 MAKASSAR',
            'company' => 'rbs',
        ]);

        $resNew->assertOk();
        $this->assertEquals('BARU', $resNew->json('data.classification'));

        // 3. Kasus Bang Maun: Nama SAMA (Ahmad Fauzi), TETAPI NIK Berbeda & Lokasi Berbeda (Beda Orang / Homonim)
        $resHomonim = $this->actingAs($this->adminUser)->postJson('/api/admin/validation/quick-check', [
            'name' => 'Ahmad Fauzi',
            'nik' => '3201019999990005', // NIK berbeda dari 7371010101900001
            'province' => 'JAWA BARAT', // Lokasi berbeda
            'school_unit' => 'SDN 5 BANDUNG', // Sekolah berbeda
            'company' => 'rbs',
        ]);

        $resHomonim->assertOk();
        $this->assertEquals('BARU', $resHomonim->json('data.classification'));
        $this->assertStringContainsString('individu berbeda', $resHomonim->json('data.recommendation'));

        // 4. Kasus Nama SAMA, NIK Berbeda, tetapi Sekolah SAMA -> Peringatan NIK Berbeda (REVIEW_MIRIP)
        $resMismatchSameSchool = $this->actingAs($this->adminUser)->postJson('/api/admin/validation/quick-check', [
            'name' => 'Ahmad Fauzi',
            'nik' => '3201019999990005', // NIK beda
            'province' => 'SULAWESI SELATAN',
            'school_unit' => 'SDN 1 MAKASSAR', // Sekolah sama persis
            'company' => 'rbs',
        ]);

        $resMismatchSameSchool->assertOk();
        $this->assertEquals('REVIEW_MIRIP', $resMismatchSameSchool->json('data.classification'));
        $this->assertStringContainsString('PERINGATAN NIK BERBEDA', $resMismatchSameSchool->json('data.recommendation'));
    }

    public function test_admin_can_commit_validated_rows_safely_without_overwriting(): void
    {
        $existing = Payroll::create([
            'employee_name' => 'Budi Santoso',
            'nik' => '7371010101900002',
            'province' => 'SULAWESI SELATAN',
            'school_unit' => 'SDN 2 MAKASSAR',
            'company' => 'rbs',
            'period' => 'SP 8',
            'status' => 'active',
            'basic_salary' => 3500000,
            'take_home_pay' => 3500000,
        ]);

        // Commit as SP 9
        $res = $this->actingAs($this->adminUser)->postJson('/api/admin/validation/commit', [
            'target_period' => 'SP 9',
            'company' => 'rbs',
            'rows' => [
                [
                    'name' => 'Budi Santoso',
                    'effective_nik' => '7371010101900002',
                    'province' => 'SULAWESI SELATAN',
                    'school_unit' => 'SDN 2 MAKASSAR',
                    'position' => 'Guru',
                    'basic_salary' => 3600000,
                ],
                [
                    'name' => 'Karyawan Baru Satu',
                    'effective_nik' => '7371010101900099',
                    'province' => 'SULAWESI SELATAN',
                    'school_unit' => 'SDN 2 MAKASSAR',
                    'position' => 'Staf TU',
                    'basic_salary' => 3200000,
                ],
            ],
        ]);

        $res->assertOk();
        $this->assertEquals(2, $res->json('data.inserted_count'));

        // Verify existing SP 8 is untouched
        $this->assertDatabaseHas('payrolls', [
            'id' => $existing->id,
            'employee_name' => 'Budi Santoso',
            'period' => 'SP 8',
        ]);

        // Verify new SP 9 rows exist
        $this->assertDatabaseHas('payrolls', [
            'employee_name' => 'Budi Santoso',
            'period' => 'SP 9',
            'basic_salary' => 3600000,
        ]);
        $this->assertDatabaseHas('payrolls', [
            'employee_name' => 'Karyawan Baru Satu',
            'period' => 'SP 9',
        ]);
    }
}
