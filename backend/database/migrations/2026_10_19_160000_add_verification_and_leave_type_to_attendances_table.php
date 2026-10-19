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
        if (Schema::hasTable('attendances')) {
            Schema::table('attendances', function (Blueprint $table) {
                if (!Schema::hasColumn('attendances', 'approval_status')) {
                    $table->string('approval_status', 20)->default('approved')->after('status')->index(); // 'pending', 'approved', 'rejected'
                }
                if (!Schema::hasColumn('attendances', 'approved_by')) {
                    $table->unsignedBigInteger('approved_by')->nullable()->after('approval_status');
                }
                if (!Schema::hasColumn('attendances', 'approved_at')) {
                    $table->timestamp('approved_at')->nullable()->after('approved_by');
                }
                if (!Schema::hasColumn('attendances', 'rejection_reason')) {
                    $table->text('rejection_reason')->nullable()->after('approved_at');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('attendances')) {
            Schema::table('attendances', function (Blueprint $table) {
                if (Schema::hasColumn('attendances', 'rejection_reason')) {
                    $table->dropColumn('rejection_reason');
                }
                if (Schema::hasColumn('attendances', 'approved_at')) {
                    $table->dropColumn('approved_at');
                }
                if (Schema::hasColumn('attendances', 'approved_by')) {
                    $table->dropColumn('approved_by');
                }
                if (Schema::hasColumn('attendances', 'approval_status')) {
                    $table->dropColumn('approval_status');
                }
            });
        }
    }
};
