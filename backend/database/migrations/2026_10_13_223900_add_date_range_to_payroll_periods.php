<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tambah kolom start_date & end_date ke payroll_periods agar periode gaji
     * bisa dikonfigurasi berdasarkan tanggal tutup absen (bukan hardcode bulan).
     * Default diisi mapping bulan kalender 2026 untuk backward compatibility.
     */
    public function up(): void
    {
        if (!Schema::hasTable('payroll_periods')) {
            return;
        }

        // Add date columns if not exist
        Schema::table('payroll_periods', function (Blueprint $table) {
            if (!Schema::hasColumn('payroll_periods', 'start_date')) {
                $table->date('start_date')->nullable()->after('description');
            }
            if (!Schema::hasColumn('payroll_periods', 'end_date')) {
                $table->date('end_date')->nullable()->after('start_date');
            }
        });

        // Backfill: set default dates for SP 1-12 = bulan kalender 2026
        for ($i = 1; $i <= 12; $i++) {
            $start = sprintf('2026-%02d-01', $i);
            $end = date('Y-m-t', strtotime($start)); // last day of month

            DB::table('payroll_periods')
                ->where('code', "SP {$i}")
                ->whereNull('start_date')
                ->update([
                    'start_date' => $start,
                    'end_date' => $end,
                    'updated_at' => now(),
                ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('payroll_periods')) {
            Schema::table('payroll_periods', function (Blueprint $table) {
                if (Schema::hasColumn('payroll_periods', 'end_date')) {
                    $table->dropColumn('end_date');
                }
                if (Schema::hasColumn('payroll_periods', 'start_date')) {
                    $table->dropColumn('start_date');
                }
            });
        }
    }
};
