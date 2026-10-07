<?php

namespace Database\Factories;

use App\Models\Payroll;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Payroll>
 */
class PayrollFactory extends Factory
{
    protected $model = Payroll::class;

    protected static array $provinces = [
        'DKI Jakarta',
        'Jawa Barat',
        'Jawa Tengah',
        'Jawa Timur',
        'Banten',
        'DI Yogyakarta',
        'Bali',
        'Sumatera Utara',
        'Sumatera Barat',
        'Riau',
        'Kalimantan Timur',
        'Sulawesi Selatan',
    ];

    public function definition(): array
    {
        $basicSalary = fake()->randomFloat(2, 4500000, 15000000);
        $allowance = fake()->randomFloat(2, 500000, 4000000);
        $deduction = fake()->randomFloat(2, 100000, 1500000);
        $takeHomePay = $basicSalary + $allowance - $deduction;

        return [
            'employee_name' => fake()->name(),
            'nik' => fake()->unique()->numerify('3171############'),
            'province' => fake()->randomElement(self::$provinces),
            'period' => '2026-03',
            'basic_salary' => $basicSalary,
            'allowance' => $allowance,
            'deduction' => $deduction,
            'take_home_pay' => $takeHomePay,
        ];
    }
}
