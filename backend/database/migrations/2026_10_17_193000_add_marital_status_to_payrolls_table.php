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
            if (!Schema::hasColumn('payrolls', 'marital_status')) {
                $table->string('marital_status', 50)->nullable()->after('gender')->index('idx_payrolls_marital_status');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            if (Schema::hasColumn('payrolls', 'marital_status')) {
                $table->dropIndex('idx_payrolls_marital_status');
                $table->dropColumn('marital_status');
            }
        });
    }
};
