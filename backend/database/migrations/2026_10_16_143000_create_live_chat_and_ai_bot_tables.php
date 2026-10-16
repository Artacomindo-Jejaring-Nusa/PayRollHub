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
        // 1. Chat Sessions Table
        Schema::create('chat_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('session_code', 50)->unique();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('role', 30)->default('karyawan'); // karyawan, user, admin
            $table->string('company_name', 100)->default('riama'); // riama, rimbun
            $table->string('user_name', 191);
            $table->string('user_nik', 50)->nullable();
            $table->string('user_email', 191)->nullable();
            $table->string('user_phone', 50)->nullable();
            $table->enum('status', ['bot', 'waiting_agent', 'active_agent', 'closed'])->default('bot');
            $table->foreignId('assigned_agent_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('subject', 191)->nullable();
            $table->text('last_message_text')->nullable();
            $table->string('last_message_sender', 50)->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->unsignedInteger('unread_user_count')->default(0);
            $table->unsignedInteger('unread_agent_count')->default(0);
            $table->unsignedInteger('bot_tokens_used')->default(0);
            $table->timestamp('agent_joined_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('close_reason', 191)->nullable();
            $table->timestamps();

            $table->index(['status', 'company_name']);
            $table->index(['user_id', 'status']);
        });

        // 2. Chat Messages Table
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('chat_session_id')->constrained('chat_sessions')->cascadeOnDelete();
            $table->enum('sender_type', ['user', 'bot', 'agent', 'system']);
            $table->foreignId('sender_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('sender_name', 191);
            $table->text('message');
            $table->string('attachment_url', 255)->nullable();
            $table->string('attachment_type', 50)->nullable(); // image, file
            $table->json('suggested_actions')->nullable(); // Pill buttons [ { label: '...', action: '...' } ]
            $table->boolean('is_read_by_user')->default(false);
            $table->boolean('is_read_by_agent')->default(false);
            $table->timestamps();

            $table->index(['chat_session_id', 'created_at']);
        });

        // 3. AI Bot Knowledge Base Table
        Schema::create('ai_bot_knowledge', function (Blueprint $table) {
            $table->id();
            $table->string('category', 50); // gaji, absensi, laporan, akun, umum
            $table->string('intent_code', 50); // jadwal_gaji, kendala_gps, potongan_bpjs, etc.
            $table->string('title', 191);
            $table->text('keywords'); // Comma-separated or phrase patterns for ML matching
            $table->text('bot_answer');
            $table->json('quick_buttons')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('priority')->default(0);
            $table->timestamps();

            $table->index(['category', 'is_active']);
        });

        // 4. Token AI Live Chat Quota / Balance Table
        Schema::create('chat_ai_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('company_name', 50)->default('all');
            $table->string('package_name', 100)->default('Token AI Live Chat (Pro)');
            $table->decimal('total_package_price', 15, 2)->default(1500000.00); // Rp 1.500.000,00
            $table->unsignedBigInteger('total_quota_tokens')->default(150000);
            $table->unsignedBigInteger('used_tokens')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chat_ai_tokens');
        Schema::dropIfExists('ai_bot_knowledge');
        Schema::dropIfExists('chat_messages');
        Schema::dropIfExists('chat_sessions');
    }
};
