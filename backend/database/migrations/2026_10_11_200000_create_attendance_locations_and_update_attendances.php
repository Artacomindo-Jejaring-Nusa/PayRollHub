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
        // 1. Table 100+ Lokasi Radius Absensi (Sekolah Rakyat, Kantor Cabang & Pusat)
        if (!Schema::hasTable('attendance_locations')) {
            Schema::create('attendance_locations', function (Blueprint $table) {
                $table->id();
                $table->string('tenant_id', 50)->default('rbs')->index(); // 'rbs' atau 'rimamandiri'
                $table->string('name', 150)->index(); // Nama Lokasi / Sekolah
                $table->string('code', 100)->nullable()->index(); // Kode Unit / Sekolah (misal: SRP-01)
                $table->text('address')->nullable();
                $table->decimal('latitude', 10, 7);
                $table->decimal('longitude', 10, 7);
                $table->unsignedInteger('radius_meters')->default(100);
                $table->string('type', 30)->default('school'); // 'headquarters', 'school', 'branch', 'other'
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        // 2. Tambahan kolom tipe absensi (masuk / libur) & referensi lokasi di tabel attendances
        if (Schema::hasTable('attendances')) {
            Schema::table('attendances', function (Blueprint $table) {
                if (!Schema::hasColumn('attendances', 'attendance_type')) {
                    $table->string('attendance_type', 30)->default('masuk')->after('user_id'); // 'masuk', 'libur', 'dinas'
                }
                if (!Schema::hasColumn('attendances', 'location_id')) {
                    $table->unsignedBigInteger('location_id')->nullable()->after('check_in_lng');
                }
                if (!Schema::hasColumn('attendances', 'location_name')) {
                    $table->string('location_name', 150)->nullable()->after('location_id');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('attendances')) {
            Schema::table('attendances', function (Blueprint $table) {
                $columns = [];
                if (Schema::hasColumn('attendances', 'location_name')) {
                    $columns[] = 'location_name';
                }
                if (Schema::hasColumn('attendances', 'location_id')) {
                    $columns[] = 'location_id';
                }
                if (Schema::hasColumn('attendances', 'attendance_type')) {
                    $columns[] = 'attendance_type';
                }
                if (!empty($columns)) {
                    $table->dropColumn($columns);
                }
            });
        }

        Schema::dropIfExists('attendance_locations');
    }
};
