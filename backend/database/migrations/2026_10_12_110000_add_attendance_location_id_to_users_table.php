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
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'attendance_location_id')) {
                $table->unsignedBigInteger('attendance_location_id')->nullable()->after('school_unit')->index('idx_users_attendance_location_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'attendance_location_id')) {
                $table->dropIndex('idx_users_attendance_location_id');
                $table->dropColumn('attendance_location_id');
            }
        });
    }
};
