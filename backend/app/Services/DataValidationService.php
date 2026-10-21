<?php

namespace App\Services;

use App\Models\Payroll;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DataValidationService
{
    /**
     * Normalize a name for clean comparison:
     * - Lowercase
     * - Remove common academic titles (S.Pd, S.Kom, Gr., dr., etc.)
     * - Remove punctuation and extra whitespace
     */
    public function normalizeName(?string $name): string
    {
        if (empty($name)) {
            return '';
        }

        $clean = mb_strtolower(trim($name), 'UTF-8');
        // Remove academic degrees / titles
        $titles = [
            's.pd.i', 's.pd', 's.kom', 's.si', 's.sos', 's.e', 's.h', 's.ag',
            'm.pd', 'm.kom', 'm.si', 'm.m', 'm.sc', 'm.sos',
            'spd', 'skom', 'ssi', 'mpd', 'mkom', 'gr.', 'gr',
            'a.md', 'amd', 'dra.', 'drs.', 'dr.', 'prof.',
        ];
        foreach ($titles as $t) {
            $clean = preg_replace('/\b' . preg_quote($t, '/') . '\b/i', '', $clean);
        }

        // Remove punctuation, dots, commas, parenthesis
        $clean = preg_replace('/[.,\-_()\[\]\/\'"]+/', ' ', $clean);
        // Collapse multiple spaces
        $clean = preg_replace('/\s+/', ' ', $clean);

        return trim($clean);
    }

    /**
     * Calculate similarity ratio between two names (0 to 100)
     */
    public function nameSimilarity(string $name1, string $name2): float
    {
        $n1 = $this->normalizeName($name1);
        $n2 = $this->normalizeName($name2);

        if ($n1 === $n2 && !empty($n1)) {
            return 100.0;
        }
        if (empty($n1) || empty($n2)) {
            return 0.0;
        }

        similar_text($n1, $n2, $percent);
        return (float) $percent;
    }

    /**
     * Quick search/check single candidate against existing database.
     */
    public function checkSingle(string $company, string $name, ?string $province = null, ?string $schoolUnit = null, ?string $nik = null): array
    {
        $targetCompany = in_array(strtolower($company ?: ''), ['rimamandiri', 'rima', 'riamamandiripratama']) ? 'rimamandiri' : 'rbs';

        // 1. Fetch all payroll and user records for company
        $query = Payroll::where('company', $targetCompany);
        $allPayrolls = $query->get(['id', 'employee_name', 'nik', 'province', 'school_unit', 'position', 'period', 'status', 'basic_salary', 'take_home_pay']);

        $normSearch = $this->normalizeName($name);
        $cleanNik = !empty($nik) ? trim(ltrim($nik, "'")) : null;

        $exactMatches = [];
        $similarMatches = [];
        $nikMatches = [];

        foreach ($allPayrolls as $p) {
            $normP = $this->normalizeName($p->employee_name);
            $pNik = !empty($p->nik) ? trim(ltrim($p->nik, "'")) : null;

            if ($cleanNik && $pNik && $cleanNik === $pNik) {
                $nikMatches[] = $p;
            }

            if ($normP === $normSearch) {
                $exactMatches[] = $p;
            } else {
                $sim = $this->nameSimilarity($normSearch, $normP);
                if ($sim >= 82.0) {
                    $similarMatches[] = [
                        'payroll' => $p,
                        'similarity' => round($sim, 1),
                    ];
                }
            }
        }

        // Also check Users table
        $userMatches = User::where('company', $targetCompany)
            ->where(function ($q) use ($name, $cleanNik) {
                $q->where('name', 'LIKE', '%' . trim($name) . '%');
                if ($cleanNik) {
                    $q->orWhere('nik', $cleanNik);
                }
            })
            ->get(['id', 'name', 'nik', 'role', 'school_unit', 'status']);

        // Determine AI Recommendation and classification
        $isFound = !empty($exactMatches) || !empty($nikMatches);
        $status = 'BARU';
        $recommendation = '';
        $recoveredNik = null;

        if ($isFound) {
            $periodsFound = array_unique(array_filter(array_map(fn($p) => $p->period, $exactMatches)));
            $schoolsFound = array_unique(array_filter(array_map(fn($p) => $p->school_unit, $exactMatches)));
            
            // Check if any old record had NIK
            foreach ($exactMatches as $em) {
                if (!empty($em->nik) && $em->nik !== '-' && $em->nik !== '0') {
                    $recoveredNik = $em->nik;
                    break;
                }
            }

            $sameSchool = false;
            if (!empty($schoolUnit)) {
                $normSchool = mb_strtolower(trim($schoolUnit));
                foreach ($schoolsFound as $sf) {
                    if (str_contains(mb_strtolower($sf), $normSchool) || str_contains($normSchool, mb_strtolower($sf))) {
                        $sameSchool = true;
                        break;
                    }
                }
            }

            // KASUS: NAMA SAMA, TETAPI NIK BERBEDA & LOKASI BERBEDA (HOMONIM / 2 INDIVIDU BERBEDA)
            $isDifferentPersonByNik = false;
            $isNikMismatchSameSchool = false;
            if (!empty($cleanNik) && !empty($recoveredNik) && $cleanNik !== $recoveredNik) {
                if (!$sameSchool) {
                    $isDifferentPersonByNik = true;
                } else {
                    $isNikMismatchSameSchool = true;
                }
            }

            if ($isDifferentPersonByNik) {
                $status = 'BARU';
                $recommendation = "Nama sama dengan karyawan existing ('{$name}' di " . implode(', ', $schoolsFound) . "), TETAPI NIK berbeda (Input: {$cleanNik} vs DB: {$recoveredNik}) dan lokasi berbeda. Terverifikasi sebagai 2 individu berbeda (homonim). Bersih & Aman diinput sebagai Karyawan Baru.";
                $recoveredNik = null;
            } elseif ($isNikMismatchSameSchool) {
                $status = 'REVIEW_MIRIP';
                $recommendation = "PERINGATAN NIK BERBEDA: Nama & Unit Sekolah sama (" . implode(', ', $schoolsFound) . "), namun NIK yang diinput ({$cleanNik}) berbeda dengan NIK terdaftar di sistem ({$recoveredNik}). Harap verifikasi dokumen KTP.";
            } elseif ($sameSchool || empty($schoolUnit)) {
                $status = 'PERPANJANGAN_SP';
                $recommendation = "Karyawan Eksisting (Perpanjangan SP). Ditemukan riwayat di: " . implode(', ', $periodsFound) . " pada unit sekolah " . implode(', ', $schoolsFound) . ".";
            } else {
                $status = 'MUTASI_SEKOLAH';
                $recommendation = "Potensi Mutasi. Sebelumnya bertugas di: " . implode(', ', $schoolsFound) . ", diajukan di: " . $schoolUnit . ".";
            }
        } elseif (!empty($similarMatches)) {
            $status = 'REVIEW_MIRIP';
            $topSimilar = $similarMatches[0];
            $recommendation = "Ditemukan nama dengan kemiripan {$topSimilar['similarity']}%: '{$topSimilar['payroll']->employee_name}' ({$topSimilar['payroll']->school_unit}). Mohon verifikasi apakah orang yang sama.";
        } else {
            $status = 'BARU';
            $recommendation = "Data Baru. Belum pernah terdaftar di database {$targetCompany}. Aman untuk diinput sebagai SP baru.";
        }

        return [
            'status' => 'success',
            'data' => [
                'input' => [
                    'name' => $name,
                    'province' => $province,
                    'school_unit' => $schoolUnit,
                    'nik' => $nik,
                    'company' => $targetCompany,
                ],
                'classification' => $status,
                'recommendation' => $recommendation,
                'recovered_nik' => $recoveredNik,
                'exact_matches_count' => count($exactMatches),
                'similar_matches_count' => count($similarMatches),
                'exact_payrolls' => $exactMatches,
                'similar_payrolls' => array_slice($similarMatches, 0, 5),
                'user_accounts' => $userMatches,
            ],
        ];
    }

    /**
     * Validate an uploaded spreadsheet file (Excel/CSV) against existing company database.
     */
    public function validateSpreadsheet(UploadedFile $file, string $company, ?string $targetPeriod = null, ?string $targetSheet = null): array
    {
        @set_time_limit(300);
        @ini_set('max_execution_time', '300');
        @ini_set('memory_limit', '512M');

        $targetCompany = in_array(strtolower($company ?: ''), ['rimamandiri', 'rima', 'riamamandiripratama']) ? 'rimamandiri' : 'rbs';

        // Load spreadsheet
        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($file->getRealPath());

        // Determine active sheet
        $sheet = null;
        if (!empty($targetSheet) && $spreadsheet->sheetNameExists($targetSheet)) {
            $sheet = $spreadsheet->getSheetByName($targetSheet);
        } else {
            // Find first sheet that is not guidance/petunjuk
            foreach ($spreadsheet->getAllSheets() as $candidateSheet) {
                $sName = strtoupper($candidateSheet->getTitle());
                if (!str_contains($sName, 'PETUNJUK') && !str_contains($sName, 'GUIDE') && !str_contains($sName, 'INSTRUKSI')) {
                    $sheet = $candidateSheet;
                    break;
                }
            }
            if (!$sheet) {
                $sheet = $spreadsheet->getActiveSheet();
            }
        }

        $highestRow = $sheet->getHighestRow();
        $highestColumn = $sheet->getHighestColumn();

        // Detect header row (usually row 1 or 2)
        $headerRowIndex = 1;
        $headers = [];
        for ($r = 1; $r <= min(5, $highestRow); $r++) {
            $rowValues = $sheet->rangeToArray("A{$r}:{$highestColumn}{$r}", null, true, true, false)[0];
            $normalizedRow = array_map(fn($v) => mb_strtolower(trim((string)$v)), $rowValues);
            $hasName = false;
            foreach ($normalizedRow as $val) {
                if (str_contains($val, 'nama') || str_contains($val, 'pekerja') || str_contains($val, 'karyawan') || str_contains($val, 'employee')) {
                    $hasName = true;
                    break;
                }
            }
            if ($hasName) {
                $headerRowIndex = $r;
                $headers = $rowValues;
                break;
            }
        }

        // Map column indices
        $colMap = [
            'row_no' => null,
            'province' => null,
            'school_unit' => null,
            'nik' => null,
            'name' => null,
            'position' => null,
            'basic_salary' => null,
            'take_home_pay' => null,
            'period' => null,
        ];

        foreach ($headers as $idx => $hdr) {
            $cleanHdr = mb_strtolower(trim((string)$hdr));
            if (empty($cleanHdr)) continue;

            if ($colMap['name'] === null && (str_contains($cleanHdr, 'nama') || str_contains($cleanHdr, 'pekerja') || str_contains($cleanHdr, 'karyawan'))) {
                $colMap['name'] = $idx;
            } elseif ($colMap['nik'] === null && str_contains($cleanHdr, 'nik')) {
                $colMap['nik'] = $idx;
            } elseif ($colMap['school_unit'] === null && (str_contains($cleanHdr, 'sekolah') || str_contains($cleanHdr, 'unit') || str_contains($cleanHdr, 'lokasi'))) {
                $colMap['school_unit'] = $idx;
            } elseif ($colMap['province'] === null && (str_contains($cleanHdr, 'wilayah') || str_contains($cleanHdr, 'provinsi') || str_contains($cleanHdr, 'province'))) {
                $colMap['province'] = $idx;
            } elseif ($colMap['position'] === null && (str_contains($cleanHdr, 'fungsi') || str_contains($cleanHdr, 'jabatan') || str_contains($cleanHdr, 'posisi'))) {
                $colMap['position'] = $idx;
            } elseif ($colMap['basic_salary'] === null && (str_contains($cleanHdr, 'gaji pokok') || str_contains($cleanHdr, 'basic'))) {
                $colMap['basic_salary'] = $idx;
            } elseif ($colMap['take_home_pay'] === null && (str_contains($cleanHdr, 'take home') || str_contains($cleanHdr, 'total diterima') || str_contains($cleanHdr, 'thp'))) {
                $colMap['take_home_pay'] = $idx;
            } elseif ($colMap['row_no'] === null && (str_contains($cleanHdr, 'no') && !str_contains($cleanHdr, 'rekening'))) {
                $colMap['row_no'] = $idx;
            } elseif ($colMap['period'] === null && str_contains($cleanHdr, 'periode')) {
                $colMap['period'] = $idx;
            }
        }

        // Fallback default column positions if header mapping missed some
        if ($colMap['name'] === null) $colMap['name'] = 5; // Column F in standard RBS
        if ($colMap['nik'] === null) $colMap['nik'] = 4;
        if ($colMap['school_unit'] === null) $colMap['school_unit'] = 3;
        if ($colMap['province'] === null) $colMap['province'] = 2;

        // 2. Preload existing database records into memory hash maps for O(1) lookups
        $existingPayrolls = Payroll::where('company', $targetCompany)
            ->get(['id', 'employee_name', 'nik', 'province', 'school_unit', 'position', 'period', 'status', 'basic_salary', 'take_home_pay']);

        $existingUsers = User::where('company', $targetCompany)
            ->get(['id', 'name', 'nik', 'role', 'school_unit', 'status']);

        $cacheByName = [];
        $cacheByNik = [];
        $allKnownNames = [];

        foreach ($existingPayrolls as $ep) {
            $norm = $this->normalizeName($ep->employee_name);
            if (!empty($norm)) {
                $cacheByName[$norm][] = $ep;
                $allKnownNames[$norm] = $ep->employee_name;
            }
            $cleanNik = !empty($ep->nik) ? trim(ltrim($ep->nik, "'")) : null;
            if (!empty($cleanNik) && $cleanNik !== '-' && $cleanNik !== '0') {
                $cacheByNik[$cleanNik][] = $ep;
            }
        }

        $userCacheByNik = [];
        $userCacheByName = [];
        foreach ($existingUsers as $eu) {
            $normU = $this->normalizeName($eu->name);
            if (!empty($normU)) {
                $userCacheByName[$normU][] = $eu;
            }
            $uNik = !empty($eu->nik) ? trim(ltrim($eu->nik, "'")) : null;
            if (!empty($uNik)) {
                $userCacheByNik[$uNik][] = $eu;
            }
        }

        // Track internal duplicates within the uploaded file itself
        $fileSeenNames = [];
        $fileSeenNiks = [];
        $matchedDbKeys = [];

        $analyzedRows = [];
        $summary = [
            'total_rows' => 0,
            'new_count' => 0,
            'renewal_count' => 0,
            'transfer_count' => 0,
            'duplicate_count' => 0,
            'review_count' => 0,
            'recovered_nik_count' => 0,
            'missing_from_file_count' => 0,
        ];

        $targetPeriodNorm = !empty($targetPeriod) ? strtoupper(trim($targetPeriod)) : null;

        for ($rowNum = $headerRowIndex + 1; $rowNum <= $highestRow; $rowNum++) {
            $rowValues = $sheet->rangeToArray("A{$rowNum}:{$highestColumn}{$rowNum}", null, true, true, false)[0];

            $rawName = isset($colMap['name']) && isset($rowValues[$colMap['name']]) ? trim((string)$rowValues[$colMap['name']]) : '';
            $rawNik = isset($colMap['nik']) && isset($rowValues[$colMap['nik']]) ? trim((string)$rowValues[$colMap['nik']]) : '';
            $rawNik = ltrim($rawNik, "'");
            if ($rawNik === '-' || $rawNik === '0' || $rawNik === '') $rawNik = null;

            $rawProvince = isset($colMap['province']) && isset($rowValues[$colMap['province']]) ? trim((string)$rowValues[$colMap['province']]) : '';
            $rawSchool = isset($colMap['school_unit']) && isset($rowValues[$colMap['school_unit']]) ? trim((string)$rowValues[$colMap['school_unit']]) : '';
            $rawPosition = isset($colMap['position']) && isset($rowValues[$colMap['position']]) ? trim((string)$rowValues[$colMap['position']]) : '';
            $rawSalary = isset($colMap['basic_salary']) && isset($rowValues[$colMap['basic_salary']]) ? (float)$rowValues[$colMap['basic_salary']] : 0;
            $rawRowNo = isset($colMap['row_no']) && isset($rowValues[$colMap['row_no']]) ? trim((string)$rowValues[$colMap['row_no']]) : (string)($rowNum - $headerRowIndex);

            // Skip empty rows
            if (empty($rawName) && empty($rawNik)) {
                continue;
            }

            $summary['total_rows']++;
            $normName = $this->normalizeName($rawName);

            // 1. Cross-check internal duplicate in uploaded file
            $isDuplicateInFile = false;
            $duplicateDetails = [];
            if (!empty($normName)) {
                if (isset($fileSeenNames[$normName])) {
                    $isDuplicateInFile = true;
                    $firstRow = $fileSeenNames[$normName];
                    $duplicateDetails[] = "Nama '{$rawName}' ganda (sama dengan Baris Excel {$firstRow})";
                } else {
                    $fileSeenNames[$normName] = $rowNum;
                }
            }
            if (!empty($rawNik)) {
                if (isset($fileSeenNiks[$rawNik])) {
                    $isDuplicateInFile = true;
                    $firstRow = $fileSeenNiks[$rawNik];
                    $duplicateDetails[] = "NIK '{$rawNik}' ganda (sama dengan Baris Excel {$firstRow})";
                } else {
                    $fileSeenNiks[$rawNik] = $rowNum;
                }
            }

            // 2. Cross-check against database
            $matchedPayrolls = [];
            $matchedBy = 'none';
            $recoveredNik = null;

            // Check by exact NIK
            if (!empty($rawNik) && isset($cacheByNik[$rawNik])) {
                $matchedPayrolls = $cacheByNik[$rawNik];
                $matchedBy = 'nik';
            }

            // Check by exact normalized Name
            if (empty($matchedPayrolls) && !empty($normName) && isset($cacheByName[$normName])) {
                $matchedPayrolls = $cacheByName[$normName];
                $matchedBy = 'name';
            }

            // Fuzzy check if still not found
            $fuzzyCandidate = null;
            $fuzzySim = 0;
            if (empty($matchedPayrolls) && !empty($normName) && strlen($normName) >= 4) {
                foreach ($allKnownNames as $kNorm => $kOriginal) {
                    $sim = $this->nameSimilarity($normName, $kNorm);
                    if ($sim >= 82.0 && $sim > $fuzzySim) {
                        $fuzzySim = round($sim, 1);
                        $fuzzyCandidate = $kOriginal;
                        $matchedPayrolls = $cacheByName[$kNorm] ?? [];
                        $matchedBy = 'fuzzy';
                    }
                }
            }

            // Check for recovered NIK
            if (empty($rawNik) && !empty($matchedPayrolls)) {
                foreach ($matchedPayrolls as $mp) {
                    $oldNik = !empty($mp->nik) ? trim(ltrim($mp->nik, "'")) : null;
                    if (!empty($oldNik) && $oldNik !== '-' && $oldNik !== '0') {
                        $recoveredNik = $oldNik;
                        break;
                    }
                }
                if (!$recoveredNik && !empty($normName) && isset($userCacheByName[$normName])) {
                    foreach ($userCacheByName[$normName] as $uu) {
                        if (!empty($uu->nik) && $uu->nik !== '-' && $uu->nik !== '0') {
                            $recoveredNik = $uu->nik;
                            break;
                        }
                    }
                }
                if ($recoveredNik) {
                    $summary['recovered_nik_count']++;
                }
            }

            // 3. Classify row status and formulate AI recommendation
            $status = 'BARU';
            $recommendation = '';
            $badgeColor = 'green';
            $historyPeriods = [];
            $historySchools = [];

            if (!empty($matchedPayrolls)) {
                foreach ($matchedPayrolls as $mp) {
                    if (!empty($mp->period)) $historyPeriods[] = $mp->period;
                    if (!empty($mp->school_unit)) $historySchools[] = $mp->school_unit;

                    $mpNorm = $this->normalizeName($mp->employee_name);
                    $mpCleanNik = !empty($mp->nik) ? trim(ltrim($mp->nik, "'")) : null;
                    if (!empty($mpCleanNik) && $mpCleanNik !== '-' && $mpCleanNik !== '0') {
                        $matchedDbKeys['nik:' . $mpCleanNik] = true;
                    }
                    if (!empty($mpNorm)) {
                        $matchedDbKeys['name:' . $mpNorm] = true;
                    }
                }
                $historyPeriods = array_values(array_unique($historyPeriods));
                $historySchools = array_values(array_unique($historySchools));

                // Check if already in target period
                $alreadyInTarget = false;
                if (!empty($targetPeriodNorm)) {
                    foreach ($historyPeriods as $hp) {
                        if (strtoupper(trim($hp)) === $targetPeriodNorm) {
                            $alreadyInTarget = true;
                            break;
                        }
                    }
                }

                if ($isDuplicateInFile) {
                    $status = 'DUPLIKAT_FILE';
                    $badgeColor = 'red';
                    $reasonStr = !empty($duplicateDetails) ? implode(' dan ', $duplicateDetails) : "Data ganda di file";
                    $recommendation = "Duplikasi Ganda di File: {$reasonStr}. Baris Excel {$rowNum} terdeteksi sebagai data duplikat.";
                    $summary['duplicate_count']++;
                } elseif ($alreadyInTarget) {
                    $status = 'DUPLIKAT_PERIODE';
                    $badgeColor = 'red';
                    $recommendation = "Sudah Terdaftar Aktif di {$targetPeriod}. Nama ini sudah memiliki catatan gaji pada periode target.";
                    $summary['duplicate_count']++;
                } elseif ($matchedBy === 'fuzzy') {
                    $status = 'REVIEW_MIRIP';
                    $badgeColor = 'amber';
                    $recommendation = "Nama mirip ({$fuzzySim}%) dengan karyawan existing '{$fuzzyCandidate}' di " . implode(', ', $historySchools) . ". Mohon verifikasi apakah orang yang sama.";
                    $summary['review_count']++;
                } else {
                    // Check school similarity
                    $sameSchool = false;
                    if (!empty($rawSchool)) {
                        $normRawSchool = mb_strtolower(trim($rawSchool));
                        foreach ($historySchools as $hs) {
                            $normHs = mb_strtolower(trim($hs));
                            if (str_contains($normRawSchool, $normHs) || str_contains($normHs, $normRawSchool)) {
                                $sameSchool = true;
                                break;
                            }
                        }
                    }

                    // KASUS: NAMA SAMA, TETAPI NIK BERBEDA & LOKASI BERBEDA (HOMONIM / 2 INDIVIDU BERBEDA)
                    $isDifferentPersonByNik = false;
                    $isNikMismatchSameSchool = false;
                    if (!empty($rawNik) && !empty($recoveredNik) && $rawNik !== $recoveredNik) {
                        if (!$sameSchool) {
                            $isDifferentPersonByNik = true;
                        } else {
                            $isNikMismatchSameSchool = true;
                        }
                    }

                    if ($isDifferentPersonByNik) {
                        $status = 'BARU';
                        $badgeColor = 'emerald';
                        $recommendation = "Nama sama dengan arsip lama, TETAPI NIK berbeda (File: {$rawNik} vs DB: {$recoveredNik}) dan sekolah berbeda. Terverifikasi sebagai individu berbeda (homonim). Bersih & Aman diinput sebagai Karyawan Baru.";
                        $recoveredNik = null;
                        $summary['new_count']++;
                    } elseif ($isNikMismatchSameSchool) {
                        $status = 'REVIEW_MIRIP';
                        $badgeColor = 'amber';
                        $recommendation = "PERINGATAN NIK BERBEDA: Nama & Unit Sekolah sama, tetapi NIK di file ({$rawNik}) berbeda dengan NIK terdaftar di sistem ({$recoveredNik}). Harap verifikasi dokumen KTP.";
                        $summary['review_count']++;
                    } elseif ($sameSchool || empty($rawSchool)) {
                        $status = 'PERPANJANGAN_SP';
                        $badgeColor = 'blue';
                        $recommendation = "Karyawan Eksisting (Perpanjangan SP). Ditemukan riwayat di: " . implode(', ', $historyPeriods) . " (" . implode(', ', $historySchools) . ")." . ($recoveredNik ? " NIK berhasil dipulihkan: {$recoveredNik}" : "");
                        $summary['renewal_count']++;
                    } else {
                        $status = 'MUTASI_SEKOLAH';
                        $badgeColor = 'purple';
                        $recommendation = "Potensi Mutasi. Riwayat sebelumnya di: " . implode(', ', $historySchools) . ", diajukan di: " . $rawSchool . "." . ($recoveredNik ? " NIK dipulihkan: {$recoveredNik}" : "");
                        $summary['transfer_count']++;
                    }
                }
            } else {
                if ($isDuplicateInFile) {
                    $status = 'DUPLIKAT_FILE';
                    $badgeColor = 'red';
                    $reasonStr = !empty($duplicateDetails) ? implode(' dan ', $duplicateDetails) : "Data ganda di file";
                    $recommendation = "Duplikasi di File: {$reasonStr}. Baris Excel {$rowNum} terdeteksi sebagai data duplikat.";
                    $summary['duplicate_count']++;
                } else {
                    $status = 'BARU';
                    $badgeColor = 'emerald';
                    $recommendation = "Data Baru. Belum pernah terdaftar di database {$targetCompany}. Bersih dan aman untuk diinput sebagai SP baru.";
                    $summary['new_count']++;
                }
            }

            $analyzedRows[] = [
                'row_no' => $rawRowNo,
                'excel_row' => $rowNum,
                'name' => $rawName,
                'nik' => $rawNik,
                'recovered_nik' => $recoveredNik,
                'effective_nik' => $rawNik ?: $recoveredNik,
                'province' => $rawProvince,
                'school_unit' => $rawSchool,
                'position' => $rawPosition,
                'basic_salary' => $rawSalary,
                'status' => $status,
                'badge_color' => $badgeColor,
                'matched_by' => $matchedBy,
                'recommendation' => $recommendation,
                'history_periods' => $historyPeriods,
                'history_schools' => $historySchools,
            ];
        }

        // 4. Identify Employees in System Database who are MISSING from the uploaded SK file
        // (e.g. from previous periods / active in DB, but not present in the new Excel SK)
        $distinctDbEmployees = [];
        foreach ($existingPayrolls as $ep) {
            $epNorm = $this->normalizeName($ep->employee_name);
            $epCleanNik = !empty($ep->nik) ? trim(ltrim($ep->nik, "'")) : null;
            if ($epCleanNik === '-' || $epCleanNik === '0') $epCleanNik = null;

            if (empty($epNorm) && empty($epCleanNik)) continue;

            $empKey = $epCleanNik ? "nik:{$epCleanNik}" : "name:{$epNorm}";

            if (!isset($distinctDbEmployees[$empKey])) {
                $distinctDbEmployees[$empKey] = [
                    'name' => $ep->employee_name,
                    'norm_name' => $epNorm,
                    'nik' => $epCleanNik,
                    'province' => $ep->province,
                    'school_unit' => $ep->school_unit,
                    'position' => $ep->position,
                    'basic_salary' => $ep->basic_salary,
                    'periods' => [],
                    'schools' => [],
                    'last_period' => $ep->period,
                ];
            }

            if (!empty($ep->period)) {
                $distinctDbEmployees[$empKey]['periods'][] = $ep->period;
            }
            if (!empty($ep->school_unit)) {
                $distinctDbEmployees[$empKey]['schools'][] = $ep->school_unit;
            }
            if (!empty($ep->position) && empty($distinctDbEmployees[$empKey]['position'])) {
                $distinctDbEmployees[$empKey]['position'] = $ep->position;
            }
            if (!empty($ep->province) && empty($distinctDbEmployees[$empKey]['province'])) {
                $distinctDbEmployees[$empKey]['province'] = $ep->province;
            }
        }

        $missingRows = [];
        foreach ($distinctDbEmployees as $empKey => $emp) {
            $isFoundInFile = false;
            if (!empty($emp['norm_name']) && isset($fileSeenNames[$emp['norm_name']])) {
                $isFoundInFile = true;
            }
            if (!empty($emp['nik']) && isset($fileSeenNiks[$emp['nik']])) {
                $isFoundInFile = true;
            }
            if (isset($matchedDbKeys[$empKey])) {
                $isFoundInFile = true;
            }
            if (!empty($emp['norm_name']) && isset($matchedDbKeys['name:' . $emp['norm_name']])) {
                $isFoundInFile = true;
            }
            if (!empty($emp['nik']) && isset($matchedDbKeys['nik:' . $emp['nik']])) {
                $isFoundInFile = true;
            }

            if (!$isFoundInFile) {
                $historyPeriods = array_values(array_unique($emp['periods']));
                $historySchools = array_values(array_unique($emp['schools']));
                $lastPeriod = end($historyPeriods) ?: $emp['last_period'] ?: 'Arsip Lama';
                $lastSchool = end($historySchools) ?: $emp['school_unit'] ?: '-';

                $missingRows[] = [
                    'row_no' => 'DB-' . (count($missingRows) + 1),
                    'excel_row' => null,
                    'name' => $emp['name'],
                    'nik' => $emp['nik'],
                    'recovered_nik' => null,
                    'effective_nik' => $emp['nik'],
                    'province' => $emp['province'],
                    'school_unit' => $lastSchool,
                    'position' => $emp['position'],
                    'basic_salary' => (float)$emp['basic_salary'],
                    'status' => 'TIDAK_ADA_DI_SK',
                    'badge_color' => 'rose',
                    'matched_by' => 'system_only',
                    'recommendation' => "Ada di database sistem (Terakhir di {$lastPeriod} - {$lastSchool}), tetapi TIDAK tercantum di file SK baru" . (!empty($targetPeriod) ? " ({$targetPeriod})" : "") . ". Verifikasi apakah karyawan Habis Kontrak / Resign (Out) atau terlewat saat pembuatan SK.",
                    'history_periods' => $historyPeriods,
                    'history_schools' => $historySchools,
                    'is_missing_from_sk' => true,
                ];
            }
        }

        $summary['missing_from_file_count'] = count($missingRows);
        $analyzedRows = array_merge($analyzedRows, $missingRows);

        // Calculate data health score (0-100%)
        $validReadyCount = $summary['new_count'] + $summary['renewal_count'] + $summary['transfer_count'];
        $healthScore = $summary['total_rows'] > 0
            ? round(($validReadyCount / $summary['total_rows']) * 100, 1)
            : 100;

        $summary['health_score'] = $healthScore;
        $summary['company'] = $targetCompany;
        $summary['target_period'] = $targetPeriod;

        return [
            'status' => 'success',
            'summary' => $summary,
            'rows' => $analyzedRows,
        ];
    }

    /**
     * Export the analyzed validation results into a formatted Excel file.
     */
    public function exportValidationReport(array $rows, array $summary): StreamedResponse
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Hasil Validasi Data');

        // Headers
        $headers = [
            'No',
            'STATUS VALIDASI',
            'REKOMENDASI AI / ANALISA',
            'WILAYAH',
            'SEKOLAH RAKYAT PERMANEN',
            'NIK EXCEL',
            'NIK HASIL PEMULIHAN (AUTO-FILL)',
            'NAMA LENGKAP',
            'FUNGSI TENAGA KEPENDIDIKAN',
            'GAJI POKOK',
            'RIWAYAT SP SEBELUMNYA',
            'UNIT SEKOLAH TERDAHULU',
        ];

        $sheet->fromArray([$headers], null, 'A1');

        $dataRows = [];
        foreach ($rows as $idx => $r) {
            $dataRows[] = [
                $r['row_no'] ?: ($idx + 1),
                $r['status'],
                $r['recommendation'],
                $r['province'] ?? '-',
                $r['school_unit'] ?? '-',
                $r['nik'] ? "'" . $r['nik'] : '-',
                $r['recovered_nik'] ? "'" . $r['recovered_nik'] : ($r['nik'] ? "'" . $r['nik'] : '-'),
                $r['name'],
                $r['position'] ?? '-',
                (float) ($r['basic_salary'] ?? 0),
                !empty($r['history_periods']) ? implode(', ', $r['history_periods']) : '-',
                !empty($r['history_schools']) ? implode(', ', $r['history_schools']) : '-',
            ];
        }

        if (!empty($dataRows)) {
            $sheet->fromArray($dataRows, null, 'A2');
        }

        // Header Styling
        $sheet->getStyle('A1:L1')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '1E3A8A'],
            ],
            'alignment' => [
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
        ]);

        // Auto size columns
        foreach (range('A', 'L') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $filename = 'hasil_validasi_data_' . date('Ymd_His') . '.xlsx';
        $responseHeaders = [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'max-age=0',
        ];

        return response()->stream(function () use ($spreadsheet) {
            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
        }, 200, $responseHeaders);
    }

    /**
     * Commit validated rows directly into Payrolls table as a new SP.
     * Guaranteed NOT to overwrite or delete existing data ("ga nabrak yg existing").
     */
    public function commitToPayroll(array $rows, string $targetPeriod, string $company, ?int $createdByUserId = null): array
    {
        $targetCompany = in_array(strtolower($company ?: ''), ['rimamandiri', 'rima', 'riamamandiripratama']) ? 'rimamandiri' : 'rbs';

        $insertedCount = 0;
        $skippedCount = 0;

        foreach ($rows as $r) {
            // Never commit records that were missing from the uploaded SK file
            if (($r['status'] ?? '') === 'TIDAK_ADA_DI_SK' || !empty($r['is_missing_from_sk'])) {
                continue;
            }

            $name = trim($r['name'] ?? '');
            if (empty($name)) continue;

            $effectiveNik = !empty($r['effective_nik']) ? trim(ltrim($r['effective_nik'], "'")) : null;
            if ($effectiveNik === '-' || $effectiveNik === '0') $effectiveNik = null;

            // Check if this person already exists in this exact period to avoid double commit
            $exists = Payroll::where('company', $targetCompany)
                ->where('period', $targetPeriod)
                ->where(function ($q) use ($name, $effectiveNik) {
                    $q->where('employee_name', $name);
                    if ($effectiveNik) {
                        $q->orWhere('nik', $effectiveNik);
                    }
                })
                ->exists();

            if ($exists) {
                $skippedCount++;
                continue;
            }

            Payroll::create([
                'row_no' => $r['row_no'] ?? null,
                'employee_name' => $name,
                'nik' => $effectiveNik,
                'province' => $r['province'] ?? null,
                'school_unit' => $r['school_unit'] ?? null,
                'position' => $r['position'] ?? null,
                'basic_salary' => (float)($r['basic_salary'] ?? 0),
                'take_home_pay' => (float)($r['take_home_pay'] ?? $r['basic_salary'] ?? 0),
                'company' => $targetCompany,
                'period' => $targetPeriod,
                'status' => 'active',
                'is_visible_to_user' => false,
            ]);

            $insertedCount++;
        }

        \App\Models\ActivityLog::record(
            action: 'COMMIT_VALIDATED_PAYROLL',
            module: 'payroll',
            description: "Memasukkan {$insertedCount} data karyawan hasil validasi ke periode {$targetPeriod} ({$targetCompany})",
            details: [
                'inserted_count' => $insertedCount,
                'skipped_count' => $skippedCount,
                'period' => $targetPeriod,
                'company' => $targetCompany,
            ],
            company: $targetCompany
        );

        return [
            'inserted_count' => $insertedCount,
            'skipped_count' => $skippedCount,
            'period' => $targetPeriod,
            'company' => $targetCompany,
        ];
    }
}
