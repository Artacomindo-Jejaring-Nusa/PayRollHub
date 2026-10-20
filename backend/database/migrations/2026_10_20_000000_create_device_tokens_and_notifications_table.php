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
        // 1. Device tokens for Firebase Push Notifications
        Schema::create('fcm_device_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('token', 500);
            $table->string('platform', 20)->default('android'); // android, ios, web
            $table->string('device_name', 100)->nullable();
            $table->timestamp('last_active_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'token'], 'uniq_user_fcm_token');
            $table->index('token', 'idx_fcm_token');
        });

        // 2. In-app notifications history for Web Dashboard and Mobile
        Schema::create('app_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('cascade'); // null = broadcast/all
            $table->string('company', 20)->default('all'); // all, rbs, riama
            $table->string('title', 200);
            $table->text('body');
            $table->string('type', 50)->default('general'); // announcement, work_report_approved, work_report_rejected, general
            $table->json('data')->nullable(); // extra payload: { report_id, announcement_id, url, etc. }
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_read'], 'idx_user_read');
            $table->index(['company', 'type'], 'idx_company_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('app_notifications');
        Schema::dropIfExists('fcm_device_tokens');
    }
};
