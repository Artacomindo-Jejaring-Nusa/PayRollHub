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
        Schema::create('payrolls', function (Blueprint $table) {
            $table->id();
            $table->string('employee_name', 150);
            $table->string('nik', 50);
            $table->string('province', 100);
            $table->char('period', 7); // format YYYY-MM
            $table->decimal('basic_salary', 15, 2)->default(0);
            $table->decimal('allowance', 15, 2)->default(0);
            $table->decimal('deduction', 15, 2)->default(0);
            $table->decimal('take_home_pay', 15, 2)->default(0);
            $table->timestamps();

            $table->unique(['nik', 'period'], 'uq_payrolls_nik_period');
            $table->index('employee_name', 'idx_payrolls_employee_name');
            $table->index('province', 'idx_payrolls_province');
            $table->index('period', 'idx_payrolls_period');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payrolls');
    }
};
