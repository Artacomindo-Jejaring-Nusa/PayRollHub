<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('shifts')) {
            $shifts = [
                [
                    'company' => 'rimamandiri',
                    'name' => 'Shift 1 3 Shift',
                    'code' => 'SHIFT_1_3_SHIFT',
                    'start_time' => '07:00:00',
                    'end_time' => '15:00:00',
                    'late_tolerance_minutes' => 15,
                    'work_hours' => 8.00,
                    'cross_day' => false,
                    'description' => 'Pola 3 Shift: Shift 1 (Pagi) - Jam operasional dapat diatur oleh Admin',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'company' => 'rimamandiri',
                    'name' => 'Shift 2 3 Shift',
                    'code' => 'SHIFT_2_3_SHIFT',
                    'start_time' => '15:00:00',
                    'end_time' => '23:00:00',
                    'late_tolerance_minutes' => 15,
                    'work_hours' => 8.00,
                    'cross_day' => false,
                    'description' => 'Pola 3 Shift: Shift 2 (Siang/Sore) - Jam operasional dapat diatur oleh Admin',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'company' => 'rimamandiri',
                    'name' => 'Shift 3 3 Shift',
                    'code' => 'SHIFT_3_3_SHIFT',
                    'start_time' => '23:00:00',
                    'end_time' => '07:00:00',
                    'late_tolerance_minutes' => 15,
                    'work_hours' => 8.00,
                    'cross_day' => true,
                    'description' => 'Pola 3 Shift: Shift 3 (Malam/Jaga) - Jam operasional dapat diatur oleh Admin',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'company' => 'rimamandiri',
                    'name' => 'Shift 1 2 Shift',
                    'code' => 'SHIFT_1_2_SHIFT',
                    'start_time' => '07:00:00',
                    'end_time' => '19:00:00',
                    'late_tolerance_minutes' => 15,
                    'work_hours' => 12.00,
                    'cross_day' => false,
                    'description' => 'Pola 2 Shift: Shift 1 (Pagi/Siang) - Jam operasional dapat diatur oleh Admin',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'company' => 'rimamandiri',
                    'name' => 'Shift 2 2 Shift',
                    'code' => 'SHIFT_2_2_SHIFT',
                    'start_time' => '19:00:00',
                    'end_time' => '07:00:00',
                    'late_tolerance_minutes' => 15,
                    'work_hours' => 12.00,
                    'cross_day' => true,
                    'description' => 'Pola 2 Shift: Shift 2 (Malam) - Jam operasional dapat diatur oleh Admin',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            ];

            foreach ($shifts as $shift) {
                $exists = DB::table('shifts')->where('code', $shift['code'])->exists();
                if (!$exists) {
                    DB::table('shifts')->insert($shift);
                } else {
                    DB::table('shifts')->where('code', $shift['code'])->update([
                        'name' => $shift['name'],
                        'company' => $shift['company'],
                        'description' => $shift['description'],
                        'is_active' => true,
                        'updated_at' => now(),
                    ]);
                }
            }

            // Hapus shift test
            DB::table('shifts')->where('code', 'TES')->delete();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('shifts')) {
            DB::table('shifts')->whereIn('code', [
                'SHIFT_1_3_SHIFT',
                'SHIFT_2_3_SHIFT',
                'SHIFT_3_3_SHIFT',
                'SHIFT_1_2_SHIFT',
                'SHIFT_2_2_SHIFT',
            ])->delete();
        }
    }
};
