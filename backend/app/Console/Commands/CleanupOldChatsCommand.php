<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\ChatSession;
use Illuminate\Support\Facades\Storage;

class CleanupOldChatsCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'chat:cleanup 
                            {--days=90 : Batas usia sesi chat yang sudah selesai (hari)} 
                            {--dry-run : Menampilkan jumlah yang akan dihapus tanpa benar-benar menghapus}';

    /**
     * The console command description.
     */
    protected $description = 'Membersihkan percakapan lama yang sudah ditutup dan menghapus lampiran foto untuk menghemat kapasitas storage server';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $days = (int) $this->option('days');
        $isDryRun = $this->option('dry-run');

        $cutoffDate = now()->subDays($days);
        $this->info("🔍 Mencari sesi percakapan yang selesai sebelum: {$cutoffDate->format('Y-m-d H:i:s')} (Batas: {$days} hari)...");

        $query = ChatSession::where('status', 'closed')
            ->where('closed_at', '<=', $cutoffDate);

        $totalCount = $query->count();

        if ($totalCount === 0) {
            $this->info("✅ Tidak ada sesi chat lama yang memenuhi syarat pembersihan.");
            return 0;
        }

        if ($isDryRun) {
            $this->warn("⚠️ [DRY RUN] Ditemukan {$totalCount} sesi chat lama yang akan dihapus.");
            return 0;
        }

        $deletedSessions = 0;
        $deletedFiles = 0;

        $query->chunk(50, function ($sessions) use (&$deletedSessions, &$deletedFiles) {
            foreach ($sessions as $session) {
                // Hapus lampiran file foto
                foreach ($session->messages as $msg) {
                    if ($msg->attachment_url) {
                        $filePath = str_replace('/api/storage/', '', $msg->attachment_url);
                        if (Storage::disk('public')->exists($filePath)) {
                            Storage::disk('public')->delete($filePath);
                            $deletedFiles++;
                        }
                    }
                }

                $session->delete();
                $deletedSessions++;
            }
        });

        $this->info("🎉 Berhasil membersihkan {$deletedSessions} sesi chat lama dan {$deletedFiles} file lampiran dari storage disk.");
        return 0;
    }
}
