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

    protected int $duplicateAccountCount = 0;
    protected int $duplicateNikCount = 0;
    protected array $updatedRows = [];
    protected array $duplicateAccountRows = [];
    protected array $duplicateNikRows = [];

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
        @set_time_limit(300);
        @ini_set('max_execution_time', '300');

        $targetCompany = in_array(strtolower($this->defaultCompany ?: ''), ['rimamandiri', 'rima', 'riamamandiripratama']) ? 'rimamandiri' : 'rbs';

        // Preload existing payrolls for the target company & default period into fast in-memory hash maps
        // This eliminates 300-900 sequential database queries and prevents execution timeout (max 30s)
        $existingRecords = Payroll::where('company', $targetCompany)
            ->where('period', $this->defaultPeriod)
            ->get();

        $cacheByNik = [];
        $cacheByNameSchool = [];
        $cacheByBankAccount = [];

        foreach ($existingRecords as $rec) {
            $pPeriod = (string) $rec->period;
            if (!empty($rec->nik)) {
                $cacheByNik[$pPeriod . '|' . trim((string) $rec->nik)][] = $rec;
            }
            if (!empty($rec->employee_name) && !empty($rec->school_unit)) {
                $k = $pPeriod . '|' . mb_strtolower(trim($rec->employee_name)) . '|' . mb_strtolower(trim($rec->school_unit));
                $cacheByNameSchool[$k] = $rec;
            }
            if (!empty($rec->bank_account)) {
                $cleanAcc = trim((string) $rec->bank_account);
                if ($cleanAcc !== '-' && $cleanAcc !== '0' && strlen($cleanAcc) >= 3) {
                    $cacheByBankAccount[$cleanAcc][] = $rec;
                }
            }
        }

        // Pass 1: Pre-scan $rows to detect occurrences in the file (duplicate NIK / bank accounts)
        $fileNikOccurrences = [];
        $fileAccountOccurrences = [];

        $scanIndex = 1;
        foreach ($rows as $r) {
            $scanIndex++;
            $rNo = strtolower(trim((string) ($r['no'] ?? $r['no_'] ?? '')));
            $rName = trim((string) ($r['nama_lengkap'] ?? $r['nama_pekerja'] ?? $r['nama_pekerja_'] ?? $r['nama_karyawan'] ?? $r['nama'] ?? $r['employee_name'] ?? ''));
            $rRawName = strtolower($rName);

            if (
                str_starts_with($rNo, '#') ||
                str_contains($rNo, 'petunjuk') ||
                str_contains($rNo, 'panduan') ||
                str_contains($rNo, 'catatan') ||
                str_contains($rRawName, 'petunjuk pengisian') ||
                str_contains($rRawName, 'panduan') ||
                str_contains($rRawName, 'catatan penting')
            ) {
                continue;
            }

            $rNik = $r['nik'] ?? $r['nik_'] ?? $r['nik_karyawan'] ?? $r[2] ?? $r['2'] ?? null;
            $rNik = !empty($rNik) ? trim((string) $rNik) : null;
            if ($rNik !== null) {
                $rNik = ltrim($rNik, "'");
                if ($rNik === '' || $rNik === '-' || $rNik === '0') {
                    $rNik = null;
                }
            }

            $rBank = $r['no_rekening'] ?? $r['nomor_rekening'] ?? $r['no_rekening_'] ?? $r['rekening'] ?? $r['bank_account'] ?? null;
            $rBank = !empty($rBank) ? trim((string) $rBank) : null;
            if ($rBank !== null) {
                $rBank = ltrim($rBank, "'");
                if ($rBank === '' || $rBank === '-' || $rBank === '0') {
                    $rBank = null;
                }
            }

            $rSchool = $r['sekolah_rakyat_permanen'] ?? $r['nama_sekolah'] ?? $r['sekolah'] ?? $r['sekolah_rakyat'] ?? $r['asal_sekolah'] ?? $r['school_unit'] ?? $r['unit'] ?? null;
            $rSchool = !empty($rSchool) ? trim((string) $rSchool) : null;

            if (empty($rName) && empty($rNik)) {
                continue;
            }

            if (!empty($rNik)) {
                $fileNikOccurrences[$rNik][] = [
                    'row' => $scanIndex,
                    'name' => $rName,
                    'school' => $rSchool,
                ];
            }

            if (!empty($rBank)) {
                $fileAccountOccurrences[$rBank][] = [
                    'row' => $scanIndex,
                    'name' => $rName,
                    'school' => $rSchool,
                ];
            }
        }

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

            // Filter out Excel formulas, totals, and placeholder rows
            if (
                str_starts_with($name, '=') ||
                preg_match('/^(total|jumlah|kuota|subtotal|grand\s*total)/i', $name)
            ) {
                continue;
            }
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
            if (empty($period) || strtolower($period) === 'periode' || $period === '-') {
                $period = $this->defaultPeriod;
            }
            $period = self::normalizePeriod($period);

            if (empty($name)) {
                $this->errors[] = "Baris {$rowIndex}: Nama karyawan wajib diisi.";
                continue;
            }

            $cleanNumber = function ($val) use ($rowIndex, $name) {
                if ($val === null || $val === '' || $val === '-') {
                    return 0.0;
                }

                // If already numeric (float, int, or pure numeric string)
                if (is_numeric($val)) {
                    $num = (float) $val;
                    // Protect against out-of-range numbers (MySQL decimal(15,2) limit is 9,999,999,999,999.99)
                    if ($num > 999999999999.0 || $num < -999999999999.0) {
                        $strVal = sprintf('%.0f', $num);
                        // If cell contains duplicated digits e.g. 3433000343300000 from 3.433.000
                        if (preg_match('/^([1-9]\d{6})(?:0{2,}|[1-9]\d{3,})?/', $strVal, $matches)) {
                            return (float) $matches[1];
                        }
                        if (preg_match('/^([1-9]\d{5,7})/', $strVal, $matches)) {
                            return (float) $matches[1];
                        }
                        return 0.0;
                    }
                    return round($num, 2);
                }

                $str = trim((string) $val);

                // Ignore Excel formula errors
                if (str_starts_with($str, '#')) {
                    return 0.0;
                }

                // Remove currency prefixes
                $str = preg_replace('/^(rp|idr|\$)\s*/i', '', $str);
                $str = trim($str);

                // Check for scientific notation string (e.g. "3.4330003433E+15")
                if (preg_match('/[eE]\+?\d+/', $str)) {
                    $num = (float) $str;
                    $strVal = sprintf('%.0f', $num);
                    if (preg_match('/^([1-9]\d{6})/', $strVal, $matches)) {
                        return (float) $matches[1];
                    }
                    if (preg_match('/^([1-9]\d{5,7})/', $strVal, $matches)) {
                        return (float) $matches[1];
                    }
                    return 0.0;
                }

                // Handle Indonesian thousand separator dots vs commas:
                if (substr_count($str, '.') > 1) {
                    // e.g. "3.433.000" or "3.433.000,00"
                    $str = str_replace('.', '', $str);
                    $str = str_replace(',', '.', $str);
                } elseif (preg_match('/\.\d{3},\d{2}$/', $str)) {
                    $str = str_replace('.', '', $str);
                    $str = str_replace(',', '.', $str);
                } elseif (preg_match('/,\d{3}\.\d{2}$/', $str)) {
                    $str = str_replace(',', '', $str);
                } elseif (substr_count($str, ',') > 1) {
                    $str = str_replace(',', '', $str);
                } elseif (preg_match('/\.\d{3}$/', $str)) {
                    $str = str_replace('.', '', $str);
                } else {
                    $str = str_replace(',', '.', $str);
                }

                $str = preg_replace('/[^\d.]/', '', $str);
                if ($str === '' || $str === '.') {
                    return 0.0;
                }

                $num = (float) $str;
                // Double check range constraint
                if ($num > 999999999999.0 || $num < -999999999999.0) {
                    $strVal = sprintf('%.0f', $num);
                    if (preg_match('/^([1-9]\d{6})/', $strVal, $matches)) {
                        return (float) $matches[1];
                    }
                    return 0.0;
                }

                return round($num, 2);
            };

            $netBase = $cleanNumber($netBase);
            $bpjsKes = $cleanNumber($bpjsKes);
            $bpjsTk = $cleanNumber($bpjsTk);
            $basicSalary = $gaji !== null ? $cleanNumber($gaji) : 0;
            $allowance = $cleanNumber($allowance);
            $deduction = $cleanNumber($deduction);
            $absenceDeduction = $cleanNumber($absenceDeduction);
            $pph21 = $cleanNumber($pph21);

            // BPJS TK breakdown (JHT & JP)
            $bpjsTkJht = $row['bpjs_tk_jht'] ?? $row['jht'] ?? null;
            $bpjsTkJp = $row['bpjs_tk_jp'] ?? $row['jp'] ?? null;
            $bpjsTkJht = $bpjsTkJht !== null ? $cleanNumber($bpjsTkJht) : null;
            $bpjsTkJp = $bpjsTkJp !== null ? $cleanNumber($bpjsTkJp) : null;
            if (($bpjsTkJht === null || $bpjsTkJht <= 0) && $bpjsTk > 0) {
                $bpjsTkJht = round($bpjsTk * (2 / 3), 2);
                $bpjsTkJp = round($bpjsTk - $bpjsTkJht, 2);
            }

            // Calculate according to Excel rule: Gaji Pokok = netBase - bpjsKes - bpjsTk (jika netBase ada)
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

            // Match existing record strictly:
            // 1. If NIK is present: match employee with the same NIK AND compatible name.
            //    If name is completely different (different person with duplicate placeholder NIK),
            //    do NOT overwrite! Treat as separate new employee!
            // 2. If NIK is empty: match by Name + School Unit.
            $existing = null;
            $isUpdate = false;
            $matchReason = 'Data baru (belum ada di database)';
            $isDuplicateNik = false;
            $duplicateNikInfo = null;

            if (!empty($nik)) {
                // Cek apakah NIK muncul ganda di file Excel ini
                if (isset($fileNikOccurrences[$nik]) && count($fileNikOccurrences[$nik]) > 1) {
                    $isDuplicateNik = true;
                    $otherRows = [];
                    foreach ($fileNikOccurrences[$nik] as $occ) {
                        if ($occ['row'] !== $rowIndex) {
                            $otherRows[] = "Baris {$occ['row']} ({$occ['name']})";
                        }
                    }
                    $duplicateNikInfo = "NIK '{$nik}' muncul lebih dari 1x di file Excel ini: " . implode(', ', $otherRows);
                }

                $candidates = $cacheByNik[$period . '|' . $nik] ?? [];
                if (!is_array($candidates)) {
                    $candidates = [$candidates];
                }
                if (empty($candidates) && $period !== $this->defaultPeriod) {
                    $candidates = Payroll::where('company', $targetCompany)->where('nik', $nik)->where('period', $period)->get()->all();
                }

                $currName = mb_strtolower(trim($name));
                foreach ($candidates as $cand) {
                    $candName = mb_strtolower(trim($cand->employee_name ?? ''));
                    // 1. Exact match
                    if ($candName === $currName) {
                        $existing = $cand;
                        break;
                    }
                    // 2. High similarity or substring match (e.g. abbreviations)
                    similar_text($candName, $currName, $simPercent);
                    if ($simPercent >= 50 || str_contains($candName, $currName) || str_contains($currName, $candName)) {
                        $existing = $cand;
                        break;
                    }
                }

                if ($existing) {
                    $isUpdate = true;
                    $isExistingInDb = ($existing instanceof Payroll);
                    if ($isExistingInDb) {
                        $matchReason = "Memperbarui data {$existing->employee_name} (NIK: {$nik}) yang sudah terdaftar di database {$period}.";
                    } else {
                        $matchReason = "Menimpa data pada baris sebelumnya dengan NIK sama ({$nik}) di file Excel ini.";
                    }
                } elseif (!empty($candidates)) {
                    $isDuplicateNik = true;
                    $firstCandName = $candidates[0]->employee_name ?? 'karyawan lain';
                    $duplicateNikInfo = "NIK '{$nik}' sama dengan {$firstCandName} di database, namun nama berbeda (Tetap disimpan terpisah agar tidak tertimpa).";
                    $this->warnings[] = "Baris {$rowIndex} ({$name}): {$duplicateNikInfo}";
                }
            } elseif (!empty($schoolUnit)) {
                $k = $period . '|' . mb_strtolower($name) . '|' . mb_strtolower($schoolUnit);
                $existing = $cacheByNameSchool[$k] ?? null;
                if (!$existing && $period !== $this->defaultPeriod) {
                    $existing = Payroll::where('company', $targetCompany)
                        ->where('employee_name', $name)
                        ->where('school_unit', $schoolUnit)
                        ->where('period', $period)
                        ->first();
                }
                if ($existing) {
                    $isUpdate = true;
                    $isExistingInDb = ($existing instanceof Payroll);
                    if ($isExistingInDb) {
                        $matchReason = "Memperbarui data {$existing->employee_name} ({$schoolUnit}) yang cocok di database (tanpa NIK).";
                    } else {
                        $matchReason = "Menimpa data pada baris sebelumnya dengan Nama & Sekolah sama di file Excel ini.";
                    }
                }
            }

            // Cek duplikasi Nomor Rekening Bank
            $isDuplicateAccount = false;
            $duplicateAccountInfo = null;
            if (!empty($bankAccount) && $bankAccount !== '-' && $bankAccount !== '0' && strlen($bankAccount) >= 3) {
                $fileClashes = [];
                if (!empty($fileAccountOccurrences[$bankAccount])) {
                    foreach ($fileAccountOccurrences[$bankAccount] as $occ) {
                        if ($occ['row'] !== $rowIndex && mb_strtolower(trim($occ['name'])) !== mb_strtolower(trim($name))) {
                            $fileClashes[] = "{$occ['name']}" . ($occ['school'] ? " [{$occ['school']}]" : '') . " (Baris {$occ['row']})";
                        }
                    }
                }

                $dbClashes = [];
                if (!empty($cacheByBankAccount[$bankAccount])) {
                    foreach ($cacheByBankAccount[$bankAccount] as $dbRec) {
                        if (mb_strtolower(trim($dbRec->employee_name)) !== mb_strtolower(trim($name))) {
                            $dbClashes[] = "{$dbRec->employee_name} (" . ($dbRec->school_unit ?: $dbRec->period) . ")";
                        }
                    }
                }

                if (!empty($fileClashes) || !empty($dbClashes)) {
                    $isDuplicateAccount = true;
                    $allClashes = array_values(array_unique(array_merge($fileClashes, $dbClashes)));
                    $duplicateAccountInfo = "No. Rekening ({$bankAccount}) kembar dengan: " . implode(', ', array_slice($allClashes, 0, 3));
                    if (count($allClashes) > 3) {
                        $duplicateAccountInfo .= " dan " . (count($allClashes) - 3) . " lainnya";
                    }
                }
            }

            // Formula Resmi 2026: (Gaji Pokok + BPJS Kesehatan + Tunjangan) - (Potongan Absensi + Potongan Lain + PPh21)
            // PERHATIAN: BPJS TK BUKAN pengurang gaji (hanya ditampilkan di bawah sebagai BPJS yang bisa dicairkan)
            $parsedThp = $rawThp !== null ? $cleanNumber($rawThp) : 0;
            $takeHomePay = $parsedThp > 0 ? $parsedThp : max(0, ($basicSalary + $bpjsKes + $allowance) - ($absenceDeduction + $deduction + $pph21));

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
                'bpjs_tk_jht' => $bpjsTkJht,
                'bpjs_tk_jp' => $bpjsTkJp,
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

            if ($isDuplicateAccount) {
                $this->duplicateAccountCount++;
                $this->duplicateAccountRows[] = [
                    'row_no' => $rowNo ?: $rowIndex,
                    'employee_name' => $name,
                    'school_unit' => $schoolUnit,
                    'bank_account' => $bankAccount,
                    'bank_name' => $bankName,
                    'info' => $duplicateAccountInfo,
                ];
            }

            if ($isDuplicateNik) {
                $this->duplicateNikCount++;
                $this->duplicateNikRows[] = [
                    'row_no' => $rowNo ?: $rowIndex,
                    'employee_name' => $name,
                    'school_unit' => $schoolUnit,
                    'nik' => $nik,
                    'info' => $duplicateNikInfo,
                ];
            }

            if ($isUpdate) {
                $this->updatedRows[] = [
                    'row_no' => $rowNo ?: $rowIndex,
                    'employee_name' => $name,
                    'school_unit' => $schoolUnit,
                    'nik' => $nik,
                    'bank_account' => $bankAccount,
                    'reason' => $matchReason,
                ];
            }

            $isExistingInDb = ($existing instanceof Payroll);
            $existingId = $isExistingInDb ? $existing->id : (is_object($existing) && isset($existing->id) ? $existing->id : null);

            if ($this->isPreview) {
                if ($isUpdate) {
                    $this->updatedCount++;
                } else {
                    $this->importedCount++;
                }

                $this->previewRows[] = array_merge($payrollData, [
                    'is_existing' => (bool) $isExistingInDb,
                    'existing_id' => $existingId,
                    'is_update' => (bool) $isUpdate,
                    'match_reason' => $matchReason,
                    'is_duplicate_nik' => (bool) $isDuplicateNik,
                    'duplicate_nik_info' => $duplicateNikInfo,
                    'is_duplicate_bank_account' => (bool) $isDuplicateAccount,
                    'duplicate_bank_account_info' => $duplicateAccountInfo,
                ]);

                if (!$existing) {
                    $previewCacheItem = (object) array_merge($payrollData, ['id' => null]);
                    if (!empty($nik)) {
                        $cacheByNik[$period . '|' . $nik][] = $previewCacheItem;
                    }
                    if (!empty($schoolUnit)) {
                        $k = $period . '|' . mb_strtolower($name) . '|' . mb_strtolower($schoolUnit);
                        $cacheByNameSchool[$k] = $previewCacheItem;
                    }
                }
            } else {
                try {
                    if ($isExistingInDb) {
                        $existing->update($payrollData);
                        PayrollService::syncEmployeeAccount($existing);
                        $this->updatedCount++;
                    } else {
                        $newRecord = Payroll::create($payrollData);
                        PayrollService::syncEmployeeAccount($newRecord);
                        if (!empty($newRecord->nik)) {
                            $cacheByNik[$period . '|' . $newRecord->nik][] = $newRecord;
                        }
                        if (!empty($newRecord->school_unit)) {
                            $k = $period . '|' . mb_strtolower(trim($newRecord->employee_name)) . '|' . mb_strtolower(trim($newRecord->school_unit));
                            $cacheByNameSchool[$k] = $newRecord;
                        }
                        $this->importedCount++;
                    }
                } catch (\Throwable $e) {
                    $this->errors[] = "Baris {$rowIndex} ({$name}): Gagal menyimpan ke database - " . $e->getMessage();
                    try {
                        \Illuminate\Support\Facades\Log::error("Import payroll error baris {$rowIndex} ({$name}): " . $e->getMessage(), [
                            'row' => $rowIndex,
                            'name' => $name,
                            'payrollData' => $payrollData,
                        ]);
                    } catch (\Throwable $logEx) {
                        // Suppress log file write error
                    }
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

    public function getDuplicateAccountCount(): int
    {
        return $this->duplicateAccountCount;
    }

    public function getDuplicateNikCount(): int
    {
        return $this->duplicateNikCount;
    }

    public function getUpdatedRows(): array
    {
        return $this->updatedRows;
    }

    public function getDuplicateAccountRows(): array
    {
        return $this->duplicateAccountRows;
    }

    public function getDuplicateNikRows(): array
    {
        return $this->duplicateNikRows;
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

    public static function normalizePeriod(?string $period): string
    {
        if (empty($period)) {
            return 'SP 1';
        }
        $clean = trim((string) $period);

        if (preg_match('/^SP\s*(\d+)$/i', $clean, $m)) {
            return 'SP ' . (int) $m[1];
        }
        if (preg_match('/^\d{4}-(\d{2})$/', $clean, $m)) {
            return 'SP ' . (int) $m[1];
        }
        if (preg_match('/^surat\s+pesanan\s+(\d+)$/i', $clean, $m)) {
            return 'SP ' . (int) $m[1];
        }
        return $clean;
    }
}
