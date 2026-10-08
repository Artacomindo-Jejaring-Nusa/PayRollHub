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
            $table->decimal('net_base_price', 15, 2)->default(0)->after('period')->comment('Harga Dasar di potong PPh & Fee manajemen');
            $table->decimal('bpjs_kes', 15, 2)->default(0)->after('net_base_price')->comment('BPJS KES 5%');
            $table->decimal('bpjs_tk', 15, 2)->default(0)->after('bpjs_kes')->comment('BPJS TK 9,24%');
            
            $table->integer('absence_count')->default(0)->after('deduction')->comment('Jumlah absensi (1x, 2x, 3x...)');
            $table->decimal('absence_rate', 15, 2)->default(0)->after('absence_count')->comment('Tarif per absensi');
            $table->decimal('absence_deduction', 15, 2)->default(0)->after('absence_rate')->comment('Potongan Absensi');
            $table->string('absence_note', 255)->nullable()->after('absence_deduction')->comment('Keterangan absensi');
            
            $table->string('resign_date', 50)->nullable()->after('join_date')->comment('Tanggal keluar');
            $table->string('status', 20)->default('active')->after('resign_date')->comment('Status: active atau off');
            $table->string('company', 50)->nullable()->default('rbs')->after('status')->comment('Entitas: rbs atau rimamandiri');

            $table->index('status', 'idx_payrolls_status');
            $table->index('company', 'idx_payrolls_company');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            $table->dropIndex('idx_payrolls_status');
            $table->dropIndex('idx_payrolls_company');
            $table->dropColumn([
                'net_base_price',
                'bpjs_kes',
                'bpjs_tk',
                'absence_count',
                'absence_rate',
                'absence_deduction',
                'absence_note',
                'resign_date',
                'status',
                'company',
            ]);
        });
    }
};
