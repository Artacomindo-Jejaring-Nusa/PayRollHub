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
        Schema::table('payrolls', function (Blueprint $table) {
            if (!Schema::hasColumn('payrolls', 'attended_days')) {
                $table->integer('attended_days')->nullable()->default(0)->after('deduction')->comment('Jumlah hari absen masuk');
            }
            if (!Schema::hasColumn('payrolls', 'holiday_days')) {
                $table->integer('holiday_days')->nullable()->default(0)->after('attended_days')->comment('Jumlah hari libur');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            if (Schema::hasColumn('payrolls', 'holiday_days')) {
                $table->dropColumn('holiday_days');
            }
            if (Schema::hasColumn('payrolls', 'attended_days')) {
                $table->dropColumn('attended_days');
            }
        });
    }
};
