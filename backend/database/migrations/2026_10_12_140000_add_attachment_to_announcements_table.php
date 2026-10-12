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
        Schema::table('announcements', function (Blueprint $table) {
            $table->string('attachment_path', 255)->nullable()->after('content');
            $table->string('attachment_name', 255)->nullable()->after('attachment_path');
            $table->string('attachment_type', 50)->nullable()->after('attachment_name'); // 'image' or 'file'
            $table->string('attachment_mime', 100)->nullable()->after('attachment_type');
            $table->unsignedBigInteger('attachment_size')->nullable()->after('attachment_mime');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropColumn([
                'attachment_path',
                'attachment_name',
                'attachment_type',
                'attachment_mime',
                'attachment_size',
            ]);
        });
    }
};
