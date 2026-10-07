<?php

namespace App\Imports;

use App\Models\Payroll;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class PayrollImport implements ToCollection, WithHeadingRow
{
    protected int $importedCount = 0;
    protected int $updatedCount = 0;
    protected array $errors = [];
    protected string $defaultPeriod;

    public function __construct(?string $defaultPeriod = null)
    {
        $this->defaultPeriod = $defaultPeriod ?: '2026-08';
    }

    public function collection(Collection $rows): void
    {
        $rowIndex = 1; // 1-based index after header
        foreach ($rows as $row) {
            $rowIndex++;

            // Support exact headers from contoh(1).xlsx as well as standard headers
            $rowNo = $row['no'] ?? null;
            $province = $row['wilayah'] ?? $row['provinsi'] ?? $row['province'] ?? null;
            $schoolUnit = $row['sekolah_rakyat_permanen'] ?? $row['sekolah'] ?? $row['school_unit'] ?? $row['unit'] ?? null;
            $nik = $row['nik'] ?? $row['nik_karyawan'] ?? null;
            $name = $row['nama_lengkap'] ?? $row['nama_karyawan'] ?? $row['nama'] ?? $row['employee_name'] ?? null;
            $position = $row['fungsi_tenaga_kependidikan'] ?? $row['jabatan'] ?? $row['position'] ?? null;
            $joinDate = $row['tanggal_masuk'] ?? $row['tgl_masuk'] ?? $row['join_date'] ?? null;
            $gaji = $row['gaji'] ?? $row['gaji_pokok'] ?? $row['basic_salary'] ?? $row['take_home_pay'] ?? 0;
            $bankAccount = $row['no_rekening'] ?? $row['nomor_rekening'] ?? $row['rekening'] ?? $row['bank_account'] ?? null;
            $bankName = $row['bank'] ?? $row['nama_bank'] ?? $row['bank_name'] ?? null;
            $period = $row['periode'] ?? $row['period'] ?? $this->defaultPeriod;

            // Optional allowances & deductions if provided in other formats
            $allowance = $row['tunjangan'] ?? $row['allowance'] ?? 0;
            $deduction = $row['potongan'] ?? $row['deduction'] ?? 0;

            if (empty($name) && empty($nik)) {
                continue; // Skip empty row
            }

            // Clean strings
            $name = trim((string) $name);
            $nik = !empty($nik) ? trim((string) $nik) : null;
            if ($nik !== null) {
                $nik = ltrim($nik, "'");
                // If it became empty after trimming
                if ($nik === '') {
                    $nik = null;
                }
            }

            $province = !empty($province) ? trim((string) $province) : 'Lainnya';
            $schoolUnit = !empty($schoolUnit) ? trim((string) $schoolUnit) : null;
            $position = !empty($position) ? trim((string) $position) : null;
            $joinDate = !empty($joinDate) ? trim((string) $joinDate) : null;
            if ($joinDate && is_numeric($joinDate) && (int) $joinDate > 20000 && (int) $joinDate < 80000) {
                try {
                    $dt = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((int) $joinDate);
                    $months = [
                        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
                        5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
                        9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
                    ];
                    $d = $dt->format('j');
                    $m = (int) $dt->format('n');
                    $y = $dt->format('Y');
                    $joinDate = "{$d} {$months[$m]} {$y}";
                } catch (\Throwable) {
                }
            }
            if ($joinDate) {
                $joinDate = preg_replace('/\s+/', ' ', $joinDate);
            }
            $bankAccount = !empty($bankAccount) ? trim((string) $bankAccount) : null;
            $bankName = !empty($bankName) ? trim((string) $bankName) : null;
            if ($bankName === '-') {
                $bankName = null;
            }

            $rowNo = !empty($rowNo) ? trim((string) $rowNo) : null;
            $period = trim((string) $period);

            if (empty($name)) {
                $this->errors[] = "Baris {$rowIndex}: Nama karyawan wajib diisi.";
                continue;
            }

            // Normalize salary: handles "Rp 5,721,000", "5721000", etc.
            $cleanGaji = (string) $gaji;
            $cleanGaji = preg_replace('/[^\d.]/', '', str_replace(',', '', $cleanGaji));
            $basicSalary = (float) $cleanGaji;

            $allowance = (float) str_replace(['Rp', '.', ' ', ','], ['', '', '', '.'], (string) $allowance);
            $deduction = (float) str_replace(['Rp', '.', ' ', ','], ['', '', '', '.'], (string) $deduction);

            if ($basicSalary < 0) {
                $this->errors[] = "Baris {$rowIndex} ({$name}): Nilai gaji tidak boleh negatif.";
                continue;
            }

            // Match existing record
            $existing = null;
            if (!empty($nik)) {
                $existing = Payroll::where('nik', $nik)->where('period', $period)->first();
            }
            if (!$existing && !empty($schoolUnit)) {
                $existing = Payroll::where('employee_name', $name)
                    ->where('school_unit', $schoolUnit)
                    ->where('period', $period)
                    ->first();
            }
            if (!$existing) {
                $existing = Payroll::where('employee_name', $name)
                    ->where('province', $province)
                    ->where('period', $period)
                    ->first();
            }

            $payrollData = [
                'row_no' => $rowNo,
                'employee_name' => $name,
                'nik' => $nik,
                'province' => $province,
                'school_unit' => $schoolUnit,
                'position' => $position,
                'join_date' => $joinDate,
                'period' => $period,
                'basic_salary' => $basicSalary,
                'allowance' => $allowance,
                'deduction' => $deduction,
                'take_home_pay' => $basicSalary + $allowance - $deduction,
                'bank_account' => $bankAccount,
                'bank_name' => $bankName,
            ];

            if ($existing) {
                $existing->update($payrollData);
                $this->updatedCount++;
            } else {
                Payroll::create($payrollData);
                $this->importedCount++;
            }
        }
    }

    public function getImportedCount(): int
    {
        return $this->importedCount;
    }

    public function getUpdatedCount(): int
    {
        return $this->updatedCount;
    }

    public function getErrors(): array
    {
        return $this->errors;
    }
}
