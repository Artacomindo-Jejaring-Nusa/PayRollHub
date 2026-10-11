<?php

namespace App\Imports;

use App\Models\Payroll;
use App\Services\PayrollService;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithReadFilter;
use PhpOffice\PhpSpreadsheet\Reader\IReadFilter;

class PayrollImport implements ToCollection, WithHeadingRow, WithMultipleSheets, WithReadFilter
{
    protected int $importedCount = 0;
    protected int $updatedCount = 0;
    protected int $activeCount = 0;
    protected int $offCount = 0;
    protected float $totalEstimatedThp = 0;
    protected array $errors = [];
    protected array $warnings = [];
    protected array $previewRows = [];
    protected string $defaultPeriod;
    protected string $defaultCompany = 'rbs';
    protected bool $isPreview = false;
    protected int|string $targetSheet = 0;

    public function __construct(?string $defaultPeriod = null, bool $isPreview = false, int|string|null $targetSheet = null, ?string $defaultCompany = 'rbs')
    {
        $this->defaultPeriod = $defaultPeriod ?: date('Y-m');
        $this->isPreview = $isPreview;
        $this->targetSheet = $targetSheet ?? 0;
        $this->defaultCompany = $defaultCompany ?: 'rbs';
    }

    /**
     * Read filter to protect memory from sheets with thousands of empty trailing columns (e.g. SP-9).
     */
    public function readFilter(): IReadFilter
    {
        return new class implements IReadFilter {
            public function readCell(string $columnAddress, int $row, string $worksheetName = ''): bool {
                return strlen($columnAddress) === 1; // Only load columns A-Z
            }
        };
    }

    /**
     * Only process the targeted data worksheet (e.g. DATA_PENGGAJIAN or active month sheet).
     * Sheet 2 (PETUNJUK_PENGISIAN) or any other guide sheets will be strictly ignored.
     */
    public function sheets(): array
    {
        return [
            $this->targetSheet => $this,
        ];
    }

    public function collection(Collection $rows): void
    {
        $rowIndex = 1; // 1-based index after header
        foreach ($rows as $row) {
            $rowIndex++;

            // Support exact headers from standard templates and existing variants
            $rowNo = $row['no'] ?? $row['no_'] ?? null;
            $province = $row['wilayah'] ?? $row['provinsi'] ?? $row['provinsi_'] ?? $row['province'] ?? null;
            $schoolUnit = $row['sekolah_rakyat_permanen'] ?? $row['nama_sekolah'] ?? $row['sekolah'] ?? $row['sekolah_rakyat'] ?? $row['asal_sekolah'] ?? $row['school_unit'] ?? $row['unit'] ?? null;
            $nik = $row['nik'] ?? $row['nik_'] ?? $row['nik_karyawan'] ?? $row[2] ?? $row['2'] ?? null;
            $name = $row['nama_lengkap'] ?? $row['nama_pekerja'] ?? $row['nama_pekerja_'] ?? $row['nama_karyawan'] ?? $row['nama'] ?? $row['employee_name'] ?? null;
            $position = $row['fungsi_tenaga_kependidikan'] ?? $row['jabatan'] ?? $row['jabatan_'] ?? $row['position'] ?? null;
            $birthDate = $row['tanggal_lahir'] ?? $row['tgl_lahir'] ?? $row['birth_date'] ?? null;
            $gender = $row['jenis_kelamin'] ?? $row['gender'] ?? $row['jk'] ?? null;
            $whatsapp = $row['whatsapp'] ?? $row['wa'] ?? $row['no_wa'] ?? $row['phone'] ?? $row['no_hp'] ?? null;
            $email = $row['email'] ?? $row['email_pribadi'] ?? null;
            $joinDate = $row['tanggal_masuk'] ?? $row['tanggal_bekerja'] ?? $row['tgl_masuk'] ?? $row['tgl_bekerja'] ?? $row['join_date'] ?? null;
            $resignDate = $row['tanggal_keluar'] ?? $row['tgl_keluar'] ?? $row['resign_date'] ?? null;
            $status = $row['status'] ?? null;
            $company = $row['company'] ?? $row['perusahaan'] ?? $row['entitas'] ?? $this->defaultCompany;

            $gaji = $row['gaji'] ?? $row['gaji_pokok'] ?? $row['basic_salary'] ?? null;
            $netBase = $row['harga_dasar_di_potong_pph_fee_manajemen'] ?? $row['harga_dasar_net_pph_fee'] ?? $row['harga_dasar_net'] ?? $row['net_base_price'] ?? 0;
            $bpjsKes = $row['bpjs_kes_5'] ?? $row['bpjs_kes'] ?? 0;
            $bpjsTk = $row['bpjs_tk_924'] ?? $row['bpjs_tk_9_24'] ?? $row['bpjs_tk'] ?? 0;
            $absenceDeduction = $row['potongan_absensi'] ?? $row['absence_deduction'] ?? 0;
            $absenceNote = $row['keterangan_absensi'] ?? $row['keterangan'] ?? null;
            $pph21 = $row['pph21'] ?? $row['pph_21'] ?? $row['pph'] ?? 0;
            $rawThp = $row['total_diterima_take_home_pay'] ?? $row['total_diterima'] ?? $row['take_home_pay'] ?? $row['thp'] ?? null;

            $bankAccount = $row['no_rekening'] ?? $row['nomor_rekening'] ?? $row['no_rekening_'] ?? $row['rekening'] ?? $row['bank_account'] ?? null;
            $bankName = $row['bank'] ?? $row['bank_'] ?? $row['nama_bank'] ?? $row['jenis_bank'] ?? $row['bank_name'] ?? null;
            $period = $row['periode'] ?? $row['period'] ?? $this->defaultPeriod;

            // Optional allowances & deductions if provided in other formats
            $allowance = $row['tunjangan'] ?? $row['allowance'] ?? 0;
            $deduction = $row['potongan_lain'] ?? $row['potongan'] ?? $row['deduction'] ?? 0;

            // Check if instruction row or guide banner was mistakenly included in data sheet
            $rawNo = strtolower(trim((string) ($rowNo ?? '')));
            $rawName = strtolower(trim((string) ($name ?? '')));
            if (
                str_starts_with($rawNo, '#') ||
                str_contains($rawNo, 'petunjuk') ||
                str_contains($rawNo, 'panduan') ||
                str_contains($rawNo, 'catatan') ||
                str_contains($rawName, 'petunjuk pengisian') ||
                str_contains($rawName, 'panduan') ||
                str_contains($rawName, 'catatan penting')
            ) {
                continue; // Ignore guide rows completely
            }

            if (empty($name) && empty($nik)) {
                continue; // Skip empty row
            }

            // Clean strings
            $name = trim((string) $name);
            $nik = !empty($nik) ? trim((string) $nik) : null;
            if ($nik !== null) {
                $nik = ltrim($nik, "'");
                if ($nik === '') {
                    $nik = null;
                }
            }

            $province = !empty($province) ? trim((string) $province) : 'Lainnya';
            $schoolUnit = !empty($schoolUnit) ? trim((string) $schoolUnit) : null;
            $position = !empty($position) ? trim((string) $position) : null;
            $joinDate = !empty($joinDate) ? trim((string) $joinDate) : null;
            $resignDate = !empty($resignDate) ? trim((string) $resignDate) : null;

            $cleanDate = function ($dateVal) {
                if ($dateVal && is_numeric($dateVal) && (int) $dateVal > 20000 && (int) $dateVal < 80000) {
                    try {
                        $dt = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((int) $dateVal);
                        $months = [
                            1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
                            5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
                            9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
                        ];
                        $d = $dt->format('j');
                        $m = (int) $dt->format('n');
                        $y = $dt->format('Y');
                        return "{$d} {$months[$m]} {$y}";
                    } catch (\Throwable) {
                    }
                }
                return $dateVal ? preg_replace('/\s+/', ' ', (string) $dateVal) : null;
            };

            $joinDate = $cleanDate($joinDate);
            $resignDate = $cleanDate($resignDate);
            $birthDate = $cleanDate($birthDate);
            $whatsapp = !empty($whatsapp) ? trim((string) $whatsapp) : null;
            if ($whatsapp !== null) {
                $whatsapp = ltrim($whatsapp, "'");
                if ($whatsapp === '') $whatsapp = null;
            }
            $email = !empty($email) ? trim((string) $email) : null;
            $gender = !empty($gender) ? trim((string) $gender) : null;

            // Determine status
            if ($status) {
                $status = strtolower(trim((string) $status)) === 'off' ? 'off' : 'active';
            } else {
                $status = !empty($resignDate) ? 'off' : 'active';
            }

            $bankAccount = !empty($bankAccount) ? trim((string) $bankAccount) : null;
            if ($bankAccount !== null) {
                $bankAccount = ltrim($bankAccount, "'");
                if ($bankAccount === '') {
                    $bankAccount = null;
                }
            }
            $bankName = !empty($bankName) ? trim((string) $bankName) : null;
            if ($bankName === '-') {
                $bankName = null;
            }

            $rowNo = !empty($rowNo) ? trim((string) $rowNo) : null;
            $period = trim((string) $period);
            if (empty($period)) {
                $period = $this->defaultPeriod;
            }

            if (empty($name)) {
                $this->errors[] = "Baris {$rowIndex}: Nama karyawan wajib diisi.";
                continue;
            }

            $cleanNumber = function ($val) {
                if (is_numeric($val)) return (float) $val;
                $str = (string) $val;
                $str = preg_replace('/[^\d.]/', '', str_replace(',', '', $str));
                return (float) $str;
            };

            $netBase = $cleanNumber($netBase);
            $bpjsKes = $cleanNumber($bpjsKes);
            $bpjsTk = $cleanNumber($bpjsTk);
            $basicSalary = $gaji !== null ? $cleanNumber($gaji) : 0;
            $allowance = $cleanNumber($allowance);
            $deduction = $cleanNumber($deduction);
            $absenceDeduction = $cleanNumber($absenceDeduction);
            $pph21 = $cleanNumber($pph21);

            // Calculate according to Excel rule: Gaji Pokok = netBase - bpjsKes - bpjsTk
            if ($netBase > 0) {
                if ($bpjsKes <= 0) {
                    $bpjsKes = round($netBase * 0.05, 2);
                }
                if ($bpjsTk <= 0) {
                    $bpjsTk = round($netBase * 0.0924, 2);
                }
                if ($basicSalary <= 0) {
                    $basicSalary = max(0, $netBase - $bpjsKes - $bpjsTk);
                }
            }

            if ($basicSalary < 0) {
                $this->errors[] = "Baris {$rowIndex} ({$name}): Nilai gaji tidak boleh negatif.";
                continue;
            }

            // Match existing record strictly within target company
            $targetCompany = in_array(strtolower($this->defaultCompany ?: ''), ['rimamandiri', 'rima', 'riamamandiripratama']) ? 'rimamandiri' : 'rbs';

            $existing = null;
            if (!empty($nik)) {
                $existing = Payroll::where('company', $targetCompany)->where('nik', $nik)->where('period', $period)->first();
            }
            if (!$existing && !empty($schoolUnit)) {
                $existing = Payroll::where('company', $targetCompany)
                    ->where('employee_name', $name)
                    ->where('school_unit', $schoolUnit)
                    ->where('period', $period)
                    ->first();
            }
            if (!$existing) {
                $existing = Payroll::where('company', $targetCompany)
                    ->where('employee_name', $name)
                    ->where('province', $province)
                    ->where('period', $period)
                    ->first();
            }

            // If Excel provided calculated Take Home Pay, use it; otherwise compute
            $parsedThp = $rawThp !== null ? $cleanNumber($rawThp) : 0;
            $takeHomePay = $parsedThp > 0 ? $parsedThp : max(0, $basicSalary + $allowance - $deduction - $absenceDeduction - $pph21);

            $payrollData = [
                'row_no' => $rowNo,
                'employee_name' => $name,
                'nik' => $nik,
                'province' => $province,
                'school_unit' => $schoolUnit,
                'position' => $position,
                'birth_date' => $birthDate,
                'gender' => $gender,
                'whatsapp' => $whatsapp,
                'email' => $email,
                'join_date' => $joinDate,
                'resign_date' => $resignDate,
                'status' => $status,
                'company' => $targetCompany,
                'period' => $period,
                'net_base_price' => $netBase,
                'bpjs_kes' => $bpjsKes,
                'bpjs_tk' => $bpjsTk,
                'basic_salary' => $basicSalary,
                'allowance' => $allowance,
                'deduction' => $deduction,
                'absence_deduction' => $absenceDeduction,
                'absence_note' => !empty($absenceNote) ? trim((string) $absenceNote) : null,
                'pph21' => $pph21,
                'take_home_pay' => $takeHomePay,
                'bank_account' => $bankAccount,
                'bank_name' => $bankName,
            ];

            // Warning checks
            if (empty($nik)) {
                $this->warnings[] = "Baris {$rowIndex} ({$name}): NIK kosong.";
            }
            if ($status === 'off' && empty($resignDate)) {
                $this->warnings[] = "Baris {$rowIndex} ({$name}): Status 'Off' namun Tanggal Keluar belum tercantum.";
            }

            // Update stats
            if ($status === 'off') {
                $this->offCount++;
            } else {
                $this->activeCount++;
            }
            $this->totalEstimatedThp += $takeHomePay;

            if ($this->isPreview) {
                $this->previewRows[] = array_merge($payrollData, [
                    'is_existing' => (bool) $existing,
                    'existing_id' => $existing ? $existing->id : null,
                ]);
            } else {
                if ($existing) {
                    $existing->update($payrollData);
                    PayrollService::syncEmployeeAccount($existing);
                    $this->updatedCount++;
                } else {
                    $newRecord = Payroll::create($payrollData);
                    PayrollService::syncEmployeeAccount($newRecord);
                    $this->importedCount++;
                }
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

    public function getActiveCount(): int
    {
        return $this->activeCount;
    }

    public function getOffCount(): int
    {
        return $this->offCount;
    }

    public function getTotalEstimatedThp(): float
    {
        return $this->totalEstimatedThp;
    }

    public function getErrors(): array
    {
        return $this->errors;
    }

    public function getWarnings(): array
    {
        return $this->warnings;
    }

    public function getPreviewRows(): array
    {
        return $this->previewRows;
    }
}
