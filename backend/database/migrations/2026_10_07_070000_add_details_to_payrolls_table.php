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
            $table->string('row_no', 50)->nullable()->after('id');
            $table->string('school_unit', 200)->nullable()->after('province');
            $table->string('position', 100)->nullable()->after('employee_name');
            $table->string('join_date', 50)->nullable()->after('position');
            $table->string('bank_account', 50)->nullable()->after('take_home_pay');
            $table->string('bank_name', 50)->nullable()->after('bank_account');
            
            // Make nik nullable to support employees without NIK yet
            $table->string('nik', 50)->nullable()->change();
            
            // Add indexes for quick querying and filtering
            $table->index('school_unit', 'idx_payrolls_school_unit');
            $table->index('position', 'idx_payrolls_position');
            $table->index('bank_name', 'idx_payrolls_bank_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            $table->dropIndex('idx_payrolls_school_unit');
            $table->dropIndex('idx_payrolls_position');
            $table->dropIndex('idx_payrolls_bank_name');

            $table->dropColumn([
                'row_no',
                'school_unit',
                'position',
                'join_date',
                'bank_account',
                'bank_name',
            ]);
            $table->string('nik', 50)->nullable(false)->change();
        });
    }
};
