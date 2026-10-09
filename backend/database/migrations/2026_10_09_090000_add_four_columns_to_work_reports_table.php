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
        Schema::table('work_reports', function (Blueprint $table) {
            $table->string('title', 200)->nullable()->change();
            $table->text('description')->nullable()->change();

            // 1. Absen Masuk
            $table->string('photo_absen', 255)->nullable()->after('attachment_path');
            $table->text('desc_absen')->nullable()->after('photo_absen');

            // 2. Kegiatan 1
            $table->string('photo_kegiatan1', 255)->nullable()->after('desc_absen');
            $table->text('desc_kegiatan1')->nullable()->after('photo_kegiatan1');

            // 3. Kegiatan 2
            $table->string('photo_kegiatan2', 255)->nullable()->after('desc_kegiatan1');
            $table->text('desc_kegiatan2')->nullable()->after('photo_kegiatan2');

            // 4. Kegiatan Lain (Opsional)
            $table->string('photo_kegiatan_lain', 255)->nullable()->after('desc_kegiatan2');
            $table->text('desc_kegiatan_lain')->nullable()->after('photo_kegiatan_lain');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('work_reports', function (Blueprint $table) {
            $table->dropColumn([
                'photo_absen',
                'desc_absen',
                'photo_kegiatan1',
                'desc_kegiatan1',
                'photo_kegiatan2',
                'desc_kegiatan2',
                'photo_kegiatan_lain',
                'desc_kegiatan_lain',
            ]);
        });
    }
};
