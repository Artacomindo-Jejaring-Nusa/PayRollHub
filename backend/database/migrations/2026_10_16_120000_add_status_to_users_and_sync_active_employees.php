<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'status')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('status', 20)->default('active')->after('role')->index('idx_users_status');
            });
        }

        // 1. Bersihkan akun user sampah / formula Excel / catatan impor lama yang tidak valid
        // Hanya menghapus akun yang tidak memiliki riwayat absensi sama sekali
        DB::table('users')
            ->whereNotIn('role', ['admin', 'super_admin'])
            ->where(function ($q) {
                $q->where('name', 'like', '=%')
                  ->orWhere('name', 'like', 'KUOTA%')
                  ->orWhere('name', 'like', '%tidak pernah bekerja%')
                  ->orWhere('name', 'like', '%mengundurkan diri%')
                  ->orWhere('name', 'like', '%blm mulai bertugas%')
                  ->orWhere('name', 'like', '%(typo)%');
            })
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('attendances')
                    ->whereColumn('attendances.user_id', 'users.id');
            })
            ->delete();

        // 2. Sinkronkan status 'off' bagi karyawan yang di seluruh data payroll-nya berstatus 'off'
        // dan tidak memiliki payroll aktif sama sekali
        $offEmployeeNames = DB::table('payrolls')
            ->where('status', 'off')
            ->whereNotIn('employee_name', function ($q) {
                $q->select('employee_name')
                    ->from('payrolls')
                    ->where(function ($sq) {
                        $sq->where('status', '!=', 'off')->orWhereNull('status');
                    });
            })
            ->pluck('employee_name')
            ->filter()
            ->unique();

        if ($offEmployeeNames->isNotEmpty()) {
            foreach ($offEmployeeNames->chunk(200) as $chunk) {
                DB::table('users')
                    ->whereIn('name', $chunk)
                    ->whereNotIn('role', ['admin', 'super_admin'])
                    ->update(['status' => 'off']);
            }
        }

        // Sinkronkan juga berdasarkan NIK jika NIK tersedia
        $offEmployeeNiks = DB::table('payrolls')
            ->where('status', 'off')
            ->whereNotNull('nik')
            ->where('nik', '!=', '')
            ->whereNotIn('nik', function ($q) {
                $q->select('nik')
                    ->from('payrolls')
                    ->whereNotNull('nik')
                    ->where('nik', '!=', '')
                    ->where(function ($sq) {
                        $sq->where('status', '!=', 'off')->orWhereNull('status');
                    });
            })
            ->pluck('nik')
            ->filter()
            ->unique();

        if ($offEmployeeNiks->isNotEmpty()) {
            foreach ($offEmployeeNiks->chunk(200) as $chunk) {
                DB::table('users')
                    ->whereIn('nik', $chunk)
                    ->whereNotIn('role', ['admin', 'super_admin'])
                    ->update(['status' => 'off']);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('users', 'status')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropIndex('idx_users_status');
                $table->dropColumn('status');
            });
        }
    }
};
