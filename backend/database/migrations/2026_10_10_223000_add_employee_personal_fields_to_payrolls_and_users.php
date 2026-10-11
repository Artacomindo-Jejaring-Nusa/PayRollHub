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
        // 1. Tambah kolom ke tabel payrolls
        Schema::table('payrolls', function (Blueprint $table) {
            if (!Schema::hasColumn('payrolls', 'birth_date')) {
                $table->string('birth_date', 50)->nullable()->after('position');
            }
            if (!Schema::hasColumn('payrolls', 'gender')) {
                $table->string('gender', 30)->nullable()->after('birth_date');
            }
            if (!Schema::hasColumn('payrolls', 'whatsapp')) {
                $table->string('whatsapp', 50)->nullable()->after('gender');
            }
            if (!Schema::hasColumn('payrolls', 'email')) {
                $table->string('email', 100)->nullable()->after('whatsapp');
            }
            if (!Schema::hasColumn('payrolls', 'pph21')) {
                $table->decimal('pph21', 15, 2)->default(0)->after('absence_deduction');
            }
        });

        // 2. Tambah kolom ke tabel users
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'birth_date')) {
                $table->string('birth_date', 50)->nullable()->after('phone');
            }
            if (!Schema::hasColumn('users', 'gender')) {
                $table->string('gender', 30)->nullable()->after('birth_date');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            $table->dropColumn(['birth_date', 'gender', 'whatsapp', 'email', 'pph21']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['birth_date', 'gender']);
        });
    }
};
