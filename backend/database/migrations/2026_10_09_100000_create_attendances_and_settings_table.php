<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Table Pengaturan Lokasi & Radius Kantor
        Schema::create('attendance_settings', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id')->default('default')->index();
            $table->string('office_name')->default('Kantor Pusat');
            $table->decimal('latitude', 10, 7)->default(-6.2088000);
            $table->decimal('longitude', 10, 7)->default(106.8456000);
            $table->unsignedInteger('radius_meters')->default(100); // Batas radius dalam meter
            $table->string('work_start_time', 10)->default('08:00'); // Jam masuk baku
            $table->string('work_end_time', 10)->default('17:00');   // Jam pulang baku
            $table->unsignedInteger('late_tolerance_minutes')->default(15); // Toleransi terlambat (menit)
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 2. Table Data Absensi Kehadiran Karyawan (Tanpa foto muka, validasi radius GPS)
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('date')->index();
            $table->time('check_in_time')->nullable();
            $table->decimal('check_in_lat', 10, 7)->nullable();
            $table->decimal('check_in_lng', 10, 7)->nullable();
            $table->decimal('check_in_distance_meters', 8, 2)->nullable();
            $table->enum('check_in_status', ['on_time', 'late'])->default('on_time');
            $table->time('check_out_time')->nullable();
            $table->decimal('check_out_lat', 10, 7)->nullable();
            $table->decimal('check_out_lng', 10, 7)->nullable();
            $table->decimal('check_out_distance_meters', 8, 2)->nullable();
            $table->enum('status', ['present', 'late', 'absent', 'holiday', 'permit'])->default('present');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendances');
        Schema::dropIfExists('attendance_settings');
    }
};
