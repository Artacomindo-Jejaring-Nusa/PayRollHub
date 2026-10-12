<?php

/**
 * Script untuk mengekspor kredensial user karyawan ke fixture load test k6.
 * Jalankan via: php load_tests/generate_test_users.php
 */

require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;

$users = User::where('role', 'karyawan')
    ->select('id', 'name', 'email', 'nik', 'company', 'school_unit', 'attendance_location_id')
    ->limit(500)
    ->get();

$fixtures = [];
foreach ($users as $user) {
    $identifier = $user->nik ?: $user->email;
    $fixtures[] = [
        'id' => $user->id,
        'identifier' => $identifier,
        'email' => $user->email,
        'nik' => $user->nik,
        'password' => $user->nik ?: 'password123',
        'company' => $user->company ?: 'rimamandiri',
        'attendance_location_id' => $user->attendance_location_id,
    ];
}

// Tambahkan juga admin user sebagai cadangan
$fixtures[] = [
    'id' => 1,
    'identifier' => 'admin@payrollhub.com',
    'email' => 'admin@payrollhub.com',
    'nik' => null,
    'password' => 'password123',
    'company' => 'rbs',
    'role' => 'admin',
];

$outputDir = __DIR__ . '/fixtures';
if (!is_dir($outputDir)) {
    mkdir($outputDir, 0777, true);
}

file_put_contents($outputDir . '/users.json', json_encode($fixtures, JSON_PRETTY_PRINT));

echo "Berhasil mengekspor " . count($fixtures) . " user akun ke load_tests/fixtures/users.json\n";
