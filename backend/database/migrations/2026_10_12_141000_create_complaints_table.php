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
        Schema::create('complaints', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number', 50)->unique();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('company', 50)->default('rbs');
            $table->string('school_unit', 150)->nullable();
            $table->string('title', 200);
            $table->string('category', 50)->default('gaji'); // gaji, absensi, fasilitas, teknis, lainnya
            $table->text('description'); // Tulisan keluhan
            $table->string('photo_path', 255)->nullable(); // Foto keluhan / bukti pendukung
            $table->string('photo_name', 255)->nullable();
            $table->string('status', 30)->default('pending'); // pending, in_progress, resolved, rejected
            $table->text('admin_notes')->nullable(); // Tanggapan / solusi dari Admin
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['company', 'status']);
            $table->index(['user_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('complaints');
    }
};
