<?php

namespace Database\Seeders;

use App\Imports\PayrollImport;
use Illuminate\Database\Seeder;
use Maatwebsite\Excel\Facades\Excel;

class ImportContohExcelSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $filePath = dirname(__DIR__, 3) . '/contoh(1).xlsx';
        if (!file_exists($filePath)) {
            $this->command->error("File not found: {$filePath}");
            return;
        }

        $import = new PayrollImport('2026-08');
        Excel::import($import, $filePath);

        $this->command->info("Imported: " . $import->getImportedCount() . " records.");
        $this->command->info("Updated: " . $import->getUpdatedCount() . " records.");
        if (!empty($import->getErrors())) {
            $this->command->warn("Errors: " . count($import->getErrors()));
        }
    }
}
