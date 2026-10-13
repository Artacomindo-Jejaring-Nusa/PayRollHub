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
        // 1. Buat Tabel shifts
        if (!Schema::hasTable('shifts')) {
            Schema::create('shifts', function (Blueprint $table) {
                $table->id();
                $table->string('company', 50)->default('all')->comment('all, rbs, rimamandiri');
                $table->string('name', 150);
                $table->string('code', 50);
                $table->time('start_time')->default('08:00:00');
                $table->time('end_time')->default('17:00:00');
                $table->unsignedInteger('late_tolerance_minutes')->default(15);
                $table->decimal('work_hours', 4, 2)->default(8.00);
                $table->boolean('cross_day')->default(false)->comment('Melewati tengah malam (misal 23:00 - 07:00)');
                $table->text('description')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->index(['company', 'is_active']);
                $table->index('code');
            });
        }

        // 2. Tambahkan kolom shift_id pada tabel users jika belum ada
        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'shift_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->unsignedBigInteger('shift_id')->nullable()->after('attendance_location_id');
                $table->foreign('shift_id')->references('id')->on('shifts')->onDelete('set null');
                $table->index('shift_id');
            });
        }

        // 3. Tambahkan kolom shift_id pada tabel attendances jika belum ada
        if (Schema::hasTable('attendances') && !Schema::hasColumn('attendances', 'shift_id')) {
            Schema::table('attendances', function (Blueprint $table) {
                $table->unsignedBigInteger('shift_id')->nullable()->after('location_id');
                $table->foreign('shift_id')->references('id')->on('shifts')->onDelete('set null');
                $table->index('shift_id');
            });
        }

        // 4. Seed Data Shift Default Multi-Tenant (Riama & Rimbun)
        $defaultShifts = [
            [
                'company' => 'all',
                'name' => 'Shift Reguler / Kantor',
                'code' => 'REGULER',
                'start_time' => '08:00:00',
                'end_time' => '17:00:00',
                'late_tolerance_minutes' => 15,
                'work_hours' => 8.00,
                'cross_day' => false,
                'description' => 'Jam kerja operasional standar kantor / manajemen (08:00 - 17:00).',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'company' => 'all',
                'name' => 'Shift 1 / Pagi (Lapangan & Sekolah)',
                'code' => 'PAGI',
                'start_time' => '07:00:00',
                'end_time' => '15:00:00',
                'late_tolerance_minutes' => 15,
                'work_hours' => 8.00,
                'cross_day' => false,
                'description' => 'Shift pagi untuk unit sekolah dan staf kebersihan / pengajar pagi.',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'company' => 'all',
                'name' => 'Shift 2 / Siang (Operasional)',
                'code' => 'SIANG',
                'start_time' => '15:00:00',
                'end_time' => '23:00:00',
                'late_tolerance_minutes' => 15,
                'work_hours' => 8.00,
                'cross_day' => false,
                'description' => 'Shift siang untuk operasional lapangan sore s/d malam.',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'company' => 'all',
                'name' => 'Shift 3 / Malam (Security / Jaga)',
                'code' => 'MALAM',
                'start_time' => '23:00:00',
                'end_time' => '07:00:00',
                'late_tolerance_minutes' => 15,
                'work_hours' => 8.00,
                'cross_day' => true,
                'description' => 'Shift malam melintasi pergantian hari untuk satpam dan penjaga malam.',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'company' => 'rimamandiri',
                'name' => 'Shift Khusus Riama Mandiri',
                'code' => 'RIAMA-STD',
                'start_time' => '08:30:00',
                'end_time' => '17:30:00',
                'late_tolerance_minutes' => 20,
                'work_hours' => 8.00,
                'cross_day' => false,
                'description' => 'Shift khusus entitas PT Riama Mandiri Pratama.',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'company' => 'rbs',
                'name' => 'Shift Khusus Rimbun Buana',
                'code' => 'RBS-STD',
                'start_time' => '08:00:00',
                'end_time' => '17:00:00',
                'late_tolerance_minutes' => 15,
                'work_hours' => 8.00,
                'cross_day' => false,
                'description' => 'Shift khusus entitas PT Rimbun Buana Sejahtera.',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        foreach ($defaultShifts as $shift) {
            $exists = DB::table('shifts')->where('code', $shift['code'])->exists();
            if (!$exists) {
                DB::table('shifts')->insert($shift);
            }
        }

        // 5. Hubungkan seluruh karyawan aktif ke Shift Reguler sebagai default
        $regularShift = DB::table('shifts')->where('code', 'REGULER')->first();
        if ($regularShift) {
            DB::table('users')->whereNull('shift_id')->update(['shift_id' => $regularShift->id]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('attendances') && Schema::hasColumn('attendances', 'shift_id')) {
            Schema::table('attendances', function (Blueprint $table) {
                $table->dropForeign(['shift_id']);
                $table->dropColumn('shift_id');
            });
        }

        if (Schema::hasTable('users') && Schema::hasColumn('users', 'shift_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropForeign(['shift_id']);
                $table->dropColumn('shift_id');
            });
        }

        Schema::dropIfExists('shifts');
    }
};
