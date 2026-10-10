<?php

namespace Database\Seeders;

use App\Models\Payroll;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 0. Super Admin (Akses Kedua Dashboard & Melihat Log Aktivitas)
        User::updateOrCreate(
            ['email' => 'superadmin@payrollhub.com'],
            [
                'name' => 'Super Administrator',
                'password' => 'password123',
                'role' => 'super_admin',
                'company' => null,
            ]
        );

        // 1. Admin User (Full Access Satu Entitas)
        User::updateOrCreate(
            ['email' => 'admin@payrollhub.com'],
            [
                'name' => 'Administrator HR',
                'password' => 'password123',
                'role' => 'admin',
                'company' => 'rbs',
            ]
        );

        // 2. User Staff (View & Search only)
        User::updateOrCreate(
            ['email' => 'user@payrollhub.com'],
            [
                'name' => 'Staf HR & Manajemen',
                'password' => 'password123',
                'role' => 'user',
            ]
        );

        // 3. Viewer Account (Alias to User)
        User::updateOrCreate(
            ['email' => 'viewer@payrollhub.com'],
            [
                'name' => 'Viewer Penggajian',
                'password' => 'password123',
                'role' => 'user',
            ]
        );

        // 3. Sample Payroll Records
        $samplePayrolls = [
            [
                'employee_name' => 'Budi Santoso',
                'nik' => '3171011508890001',
                'province' => 'DKI Jakarta',
                'period' => '2026-03',
                'basic_salary' => 8500000.00,
                'allowance' => 2000000.00,
                'deduction' => 450000.00,
            ],
            [
                'employee_name' => 'Siti Rahmawati',
                'nik' => '3273022204920003',
                'province' => 'Jawa Barat',
                'period' => '2026-03',
                'basic_salary' => 6200000.00,
                'allowance' => 1200000.00,
                'deduction' => 300000.00,
            ],
            [
                'employee_name' => 'Agus Setiawan',
                'nik' => '3374031901850002',
                'province' => 'Jawa Tengah',
                'period' => '2026-03',
                'basic_salary' => 5400000.00,
                'allowance' => 950000.00,
                'deduction' => 220000.00,
            ],
            [
                'employee_name' => 'Dewi Lestari',
                'nik' => '3578041112950004',
                'province' => 'Jawa Timur',
                'period' => '2026-03',
                'basic_salary' => 7100000.00,
                'allowance' => 1600000.00,
                'deduction' => 380000.00,
            ],
            [
                'employee_name' => 'Fajar Pratama',
                'nik' => '3671052309900005',
                'province' => 'Banten',
                'period' => '2026-03',
                'basic_salary' => 6800000.00,
                'allowance' => 1400000.00,
                'deduction' => 320000.00,
            ],
            [
                'employee_name' => 'Anisa Kusuma',
                'nik' => '3471060407940006',
                'province' => 'DI Yogyakarta',
                'period' => '2026-03',
                'basic_salary' => 5200000.00,
                'allowance' => 800000.00,
                'deduction' => 200000.00,
            ],
            [
                'employee_name' => 'I Made Wijaya',
                'nik' => '5171071803880007',
                'province' => 'Bali',
                'period' => '2026-03',
                'basic_salary' => 7500000.00,
                'allowance' => 1750000.00,
                'deduction' => 410000.00,
            ],
            [
                'employee_name' => 'Rahmat Hidayat',
                'nik' => '1271082905910008',
                'province' => 'Sumatera Utara',
                'period' => '2026-03',
                'basic_salary' => 6400000.00,
                'allowance' => 1100000.00,
                'deduction' => 280000.00,
            ],
            [
                'employee_name' => 'Putri Ayu Handayani',
                'nik' => '6471091408930009',
                'province' => 'Kalimantan Timur',
                'period' => '2026-03',
                'basic_salary' => 9000000.00,
                'allowance' => 2500000.00,
                'deduction' => 550000.00,
            ],
            [
                'employee_name' => 'Muhammad Iqbal',
                'nik' => '7371100511870010',
                'province' => 'Sulawesi Selatan',
                'period' => '2026-03',
                'basic_salary' => 6900000.00,
                'allowance' => 1350000.00,
                'deduction' => 310000.00,
            ],
            [
                'employee_name' => 'Eka Saputra',
                'nik' => '3172010802900011',
                'province' => 'DKI Jakarta',
                'period' => '2026-03',
                'basic_salary' => 11000000.00,
                'allowance' => 3000000.00,
                'deduction' => 750000.00,
            ],
            [
                'employee_name' => 'Nurmala Sari',
                'nik' => '3271021406930012',
                'province' => 'Jawa Barat',
                'period' => '2026-03',
                'basic_salary' => 5800000.00,
                'allowance' => 900000.00,
                'deduction' => 250000.00,
            ],
        ];

        $excelPath = dirname(__DIR__, 2) . '/contoh(1).xlsx';
        if (file_exists($excelPath)) {
            $import = new \App\Imports\PayrollImport('2026-08');
            \Maatwebsite\Excel\Facades\Excel::import($import, $excelPath);
        } else {
            foreach ($samplePayrolls as $data) {
                Payroll::updateOrCreate(
                    ['nik' => $data['nik'], 'period' => $data['period']],
                    $data
                );
            }
        }
    }
}
