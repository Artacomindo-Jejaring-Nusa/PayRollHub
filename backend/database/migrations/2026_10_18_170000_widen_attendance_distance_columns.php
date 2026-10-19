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
        Schema::table('attendances', function (Blueprint $table) {
            $table->decimal('check_in_distance_meters', 12, 2)->nullable()->change();
            $table->decimal('check_out_distance_meters', 12, 2)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->decimal('check_in_distance_meters', 8, 2)->nullable()->change();
            $table->decimal('check_out_distance_meters', 8, 2)->nullable()->change();
        });
    }
};
