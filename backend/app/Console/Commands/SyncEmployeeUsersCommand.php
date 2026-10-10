<?php

namespace App\Console\Commands;

use App\Models\Payroll;
use App\Services\PayrollService;
use Illuminate\Console\Command;

class SyncEmployeeUsersCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'payroll:sync-users';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sinkronisasi seluruh karyawan dari data payroll ke akun user login dan menghubungkan unit sekolah';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Memulai sinkronisasi akun karyawan dan lokasi unit sekolah...');

        $payrolls = Payroll::whereNotNull('nik')
            ->where('nik', '!=', '')
            ->orderBy('id', 'desc')
            ->get();

        $processedNiks = [];
        $syncedCount = 0;

        foreach ($payrolls as $payroll) {
            $nik = trim($payroll->nik);
            if (isset($processedNiks[$nik])) {
                continue;
            }
            $processedNiks[$nik] = true;

            $user = PayrollService::syncEmployeeAccount($payroll);
            if ($user) {
                $syncedCount++;
            }
        }

        $this->info("Berhasil menyinkronkan {$syncedCount} akun karyawan beserta lokasi sekolah.");

        return Command::SUCCESS;
    }
}
