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
        Schema::table('users', function (Blueprint $table) {
            $table->string('nik', 50)->nullable()->unique()->after('email');
            $table->string('phone', 30)->nullable()->after('nik');
            $table->string('company', 50)->nullable()->default('rbs')->after('phone');
            $table->string('bank_name', 100)->nullable()->after('company');
            $table->string('bank_account', 100)->nullable()->after('bank_name');
            $table->text('address')->nullable()->after('bank_account');
            $table->string('avatar', 255)->nullable()->after('address');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'nik',
                'phone',
                'company',
                'bank_name',
                'bank_account',
                'address',
                'avatar',
            ]);
        });
    }
};
