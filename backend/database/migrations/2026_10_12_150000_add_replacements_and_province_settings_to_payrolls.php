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
        // 1. Tambah kolom pergantian karyawan & BPJS TK breakdown ke tabel payrolls
        Schema::table('payrolls', function (Blueprint $table) {
            if (!Schema::hasColumn('payrolls', 'replaced_payroll_id')) {
                $table->unsignedBigInteger('replaced_payroll_id')->nullable()->after('status');
            }
            if (!Schema::hasColumn('payrolls', 'replaced_employee_name')) {
                $table->string('replaced_employee_name', 150)->nullable()->after('replaced_payroll_id');
            }
            if (!Schema::hasColumn('payrolls', 'replacement_note')) {
                $table->text('replacement_note')->nullable()->after('replaced_employee_name');
            }
            if (!Schema::hasColumn('payrolls', 'replacement_date')) {
                $table->date('replacement_date')->nullable()->after('replacement_note');
            }
            if (!Schema::hasColumn('payrolls', 'bpjs_tk_jht')) {
                $table->decimal('bpjs_tk_jht', 15, 2)->nullable()->after('bpjs_tk');
            }
            if (!Schema::hasColumn('payrolls', 'bpjs_tk_jp')) {
                $table->decimal('bpjs_tk_jp', 15, 2)->nullable()->after('bpjs_tk_jht');
            }
        });

        // 2. Tabel konfigurasi perhitungan gaji per provinsi (UMP & BPJS TK/Kes)
        if (!Schema::hasTable('province_payroll_settings')) {
            Schema::create('province_payroll_settings', function (Blueprint $table) {
                $table->id();
                $table->string('company', 50)->default('all');
                $table->string('province', 100);
                $table->decimal('ump', 15, 2)->default(0);
                $table->decimal('bpjs_kes', 15, 2)->default(192094); // default BPJS Kes
                $table->decimal('bpjs_tk_jht', 15, 2)->default(0);
                $table->decimal('bpjs_tk_jp', 15, 2)->default(0);
                $table->decimal('bpjs_tk', 15, 2)->default(0);
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->unique(['company', 'province'], 'idx_company_province_unique');
            });
        }

        // 3. Tabel rekam jejak riwayat pergantian karyawan (karyawan baru menggantikan karyawan off)
        if (!Schema::hasTable('employee_replacements')) {
            Schema::create('employee_replacements', function (Blueprint $table) {
                $table->id();
                $table->string('company', 50)->default('rbs');
                $table->unsignedBigInteger('new_payroll_id');
                $table->string('new_employee_name', 150);
                $table->string('new_nik', 50)->nullable();
                $table->unsignedBigInteger('old_payroll_id')->nullable();
                $table->string('old_employee_name', 150);
                $table->string('old_nik', 50)->nullable();
                $table->string('school_unit', 200)->nullable();
                $table->string('position', 100)->nullable();
                $table->date('replacement_date')->nullable();
                $table->text('reason')->nullable();
                $table->text('notes')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->index('company');
                $table->index('new_payroll_id');
                $table->index('old_payroll_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_replacements');
        Schema::dropIfExists('province_payroll_settings');
        Schema::table('payrolls', function (Blueprint $table) {
            $table->dropColumn([
                'replaced_payroll_id',
                'replaced_employee_name',
                'replacement_note',
                'replacement_date',
                'bpjs_tk_jht',
                'bpjs_tk_jp',
            ]);
        });
    }
};
