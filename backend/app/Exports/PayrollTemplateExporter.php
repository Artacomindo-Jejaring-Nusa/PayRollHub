<?php

namespace App\Exports;

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;

class PayrollTemplateExporter
{
    /**
     * Create the official 2-sheet spreadsheet template:
     * Sheet 1: DATA_PENGGAJIAN (Actual data to be imported)
     * Sheet 2: PETUNJUK_PENGISIAN (Instructions & guidelines, strictly ignored during import)
     */
    public static function createSpreadsheet(): Spreadsheet
    {
        $spreadsheet = new Spreadsheet();

        // -------------------------------------------------------------
        // SHEET 1: DATA_PENGGAJIAN
        // -------------------------------------------------------------
        $sheet1 = $spreadsheet->getActiveSheet();
        $sheet1->setTitle('DATA_PENGGAJIAN');

        // Column Headings
        $headings = [
            'NO',
            'WILAYAH',
            'SEKOLAH RAKYAT PERMANEN',
            'NIK',
            'NAMA LENGKAP',
            'FUNGSI TENAGA KEPENDIDIKAN',
            'TANGGAL MASUK',
            'STATUS',
            'TANGGAL KELUAR',
            'PERUSAHAAN',
            'HARGA DASAR (NET PPH & FEE)',
            'BPJS KES 5%',
            'BPJS TK 9.24%',
            'GAJI POKOK',
            'POTONGAN ABSENSI',
            'KETERANGAN ABSENSI',
            'TUNJANGAN',
            'POTONGAN LAIN',
            'TOTAL DITERIMA (TAKE HOME PAY)',
            'NO REKENING',
            'BANK',
            'PERIODE',
        ];

        $sheet1->fromArray([$headings], null, 'A1');

        // Sample Data Rows (3 typical scenarios)
        $sampleRows = [
            // Row 2: Standard Active Employee
            [
                1,
                'DKI JAKARTA',
                'Salemba (Pusat)',
                "'3171012304910001",
                'FEBRI HIDAYAT',
                'Koordinator Administrasi',
                '01-08-2024',
                'Aktif',
                '',
                'rbs',
                6671000,
                333550,
                616400,
                5721050,
                0,
                '',
                0,
                0,
                5721050,
                "'2098199007",
                'BNI',
                '2026-08',
            ],
            // Row 3: Active Employee with Absence Deduction
            [
                2,
                'DKI JAKARTA',
                'Sekolah Rakyat Menengah Atas 10 Jakarta Selatan',
                "'3174051206950002",
                'MUHAMAD FERIANSAH',
                'Cleaning Service',
                '18-08-2025',
                'Aktif',
                '',
                'rbs',
                6671000,
                333550,
                616400,
                5721050,
                200000,
                'Izin 2 hari x Rp 100.000',
                0,
                0,
                5521050,
                "'2098393515",
                'BNI',
                '2026-08',
            ],
            // Row 4: OFF / Resigned Employee
            [
                3,
                'SUMATERA UTARA',
                'Sekolah Rakyat Menengah Atas 30 Padang Sidempuan',
                "'1213131111910001",
                'RUDI SAPUTRA',
                'Security',
                '25-07-2024',
                'Off',
                '15-08-2026',
                'rima',
                3683000,
                184150,
                340309,
                3158541,
                0,
                'Karyawan off / resign per 15 Ags 2026',
                0,
                0,
                3158541,
                "'2097700845",
                'BNI',
                '2026-08',
            ],
        ];

        $sheet1->fromArray($sampleRows, null, 'A2');

        // Style Header Sheet 1
        $sheet1->getStyle('A1:V1')->applyFromArray([
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 10,
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '004AC6'],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
        ]);
        $sheet1->getRowDimension(1)->setRowHeight(28);

        // Style Sample Rows
        $sheet1->getStyle('A2:V4')->applyFromArray([
            'alignment' => [
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => 'CBD5E1'],
                ],
            ],
        ]);

        // Auto-fit column widths for Sheet 1
        foreach (range('A', 'V') as $col) {
            $sheet1->getColumnDimension($col)->setAutoSize(true);
        }

        // Freeze pane so header stays fixed
        $sheet1->freezePane('A2');

        // -------------------------------------------------------------
        // SHEET 2: PETUNJUK_PENGISIAN
        // -------------------------------------------------------------
        $sheet2 = $spreadsheet->createSheet();
        $sheet2->setTitle('PETUNJUK_PENGISIAN');

        // Title Block
        $sheet2->setCellValue('A1', 'PETUNJUK LENGKAP PENGISIAN TEMPLATE DATA PENGGAJIAN (PAYROLLHUB)');
        $sheet2->mergeCells('A1:F1');
        $sheet2->getStyle('A1')->applyFromArray([
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 13,
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '0F172A'], // Slate 900
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_LEFT,
                'vertical' => Alignment::VERTICAL_CENTER,
                'indent' => 1,
            ],
        ]);
        $sheet2->getRowDimension(1)->setRowHeight(32);

        // Subtitle / Notice Block
        $sheet2->setCellValue('A2', 'PENTING: Sheet "PETUNJUK_PENGISIAN" ini HANYA sebagai pedoman dan TIDAK AKAN diimpor ke dalam database sistem.');
        $sheet2->mergeCells('A2:F2');
        $sheet2->getStyle('A2')->applyFromArray([
            'font' => [
                'bold' => true,
                'color' => ['rgb' => '92400E'], // Amber 800
                'size' => 10,
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'FEF3C7'], // Amber 100
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_LEFT,
                'vertical' => Alignment::VERTICAL_CENTER,
                'indent' => 1,
            ],
        ]);
        $sheet2->getRowDimension(2)->setRowHeight(24);

        // Guide Table Headers
        $guideHeaders = [
            'NO',
            'NAMA KOLOM HEADER',
            'SIFAT',
            'TIPE DATA / FORMAT',
            'CONTOH ISI',
            'PENJELASAN ATURAN & KETENTUAN PENGISIAN',
        ];
        $sheet2->fromArray([$guideHeaders], null, 'A4');
        $sheet2->getStyle('A4:F4')->applyFromArray([
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 10,
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '1E293B'],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
        ]);
        $sheet2->getRowDimension(4)->setRowHeight(26);

        // 22 Detailed Column Guidelines
        $guideData = [
            [1, 'NO', 'Opsional', 'Angka / Teks', '1, 2, 3...', 'Nomor urut baris spreadsheet (bebas atau sesuai data internal Anda).'],
            [2, 'WILAYAH', 'Wajib', 'Teks', 'DKI JAKARTA', 'Nama provinsi atau wilayah penempatan sekolah rakyat / unit kerja.'],
            [3, 'SEKOLAH RAKYAT PERMANEN', 'Opsional', 'Teks', 'Salemba (Pusat)', 'Nama unit cabang / sekolah rakyat tempat karyawan bertugas.'],
            [4, 'NIK', 'Wajib / Disarankan', 'Teks (16 digit)', "'3171012304910001", "Nomor Induk Kependudukan 16 digit. Berikan tanda petik satu (') di depan angka agar format Excel tidak berubah menjadi ilmiah (scientific notation)."],
            [5, 'NAMA LENGKAP', 'Wajib', 'Teks', 'FEBRI HIDAYAT', 'Nama lengkap pegawai. Kolom ini mutlak wajib diisi.'],
            [6, 'FUNGSI TENAGA KEPENDIDIKAN', 'Opsional', 'Teks', 'Cleaning Service, Security', 'Posisi atau jabatan pegawai di instansi/unit.'],
            [7, 'TANGGAL MASUK', 'Opsional', 'Tanggal / Teks', '01-08-2024 atau 1 Agustus 2024', 'Tanggal mulai bergabung/bertugas. Format didukung: DD-MM-YYYY atau teks tanggal Indonesia.'],
            [8, 'STATUS', 'Wajib', 'Pilihan: Aktif / Off', 'Aktif atau Off', 'Status keaktifan pegawai. Jika diisi "Off", pegawai tercatat tidak aktif dan otomatis masuk laporan Off pada dashboard admin.'],
            [9, 'TANGGAL KELUAR', 'Opsional (Wajib jika Off)', 'Tanggal / Teks', '15-08-2026', 'Tanggal berhenti bekerja jika status pegawai diisi "Off".'],
            [10, 'PERUSAHAAN', 'Opsional', 'Kode: rbs / rima', 'rbs atau rima', 'Entitas legal: "rbs" untuk PT. Rimbun Buana Sejahtera, "rima" untuk PT. Riama Mandiri Pratama. Default: "rbs".'],
            [11, 'HARGA DASAR (NET PPH & FEE)', 'Wajib', 'Angka murni', '6671000', 'Harga dasar bersih setelah potongan PPh dan Fee Manajemen. Masukkan angka bulat tanpa titik, koma, atau simbol Rp.'],
            [12, 'BPJS KES 5%', 'Opsional (Otomatis)', 'Angka murni', '333550', 'Nominal BPJS Kesehatan (5%). Jika dikosongkan/0, sistem saat import otomatis menghitung: 5% x Harga Dasar.'],
            [13, 'BPJS TK 9.24%', 'Opsional (Otomatis)', 'Angka murni', '616400', 'Nominal BPJS Ketenagakerjaan (9.24%). Jika dikosongkan/0, sistem saat import otomatis menghitung: 9.24% x Harga Dasar.'],
            [14, 'GAJI POKOK', 'Opsional (Otomatis)', 'Angka murni', '5721050', 'Gaji Pokok. Formula: Harga Dasar - BPJS KES - BPJS TK. Jika dikosongkan, dihitung otomatis oleh sistem.'],
            [15, 'POTONGAN ABSENSI', 'Opsional', 'Angka murni', '200000', 'Nominal potongan ketidakhadiran/mangkir. Dapat diisi kelipatan hari x tarif harian (misal: 2 hari x Rp 100.000).'],
            [16, 'KETERANGAN ABSENSI', 'Opsional', 'Teks', 'Izin 2 hari x Rp 100.000', 'Rincian atau alasan potongan absensi (misal: "Sakit 1 hari", "Mangkir 2x", dsb).'],
            [17, 'TUNJANGAN', 'Opsional', 'Angka murni', '0', 'Nominal tunjangan tambahan jika ada.'],
            [18, 'POTONGAN LAIN', 'Opsional', 'Angka murni', '0', 'Nominal potongan lainnya di luar absensi jika ada.'],
            [19, 'TOTAL DITERIMA (TAKE HOME PAY)', 'Opsional (Otomatis)', 'Angka murni', '5521050', 'Total THP yang diterima. Formula: Gaji Pokok + Tunjangan - Potongan Lain - Potongan Absensi.'],
            [20, 'NO REKENING', 'Opsional', 'Teks / Angka', "'2098199007", "Nomor rekening bank penerima. Berikan tanda petik satu (') di depan jika berawalan angka nol."],
            [21, 'BANK', 'Opsional', 'Teks', 'BNI, BCA, Mandiri, BRI', 'Nama institusi bank untuk pencairan gaji.'],
            [22, 'PERIODE', 'Opsional', 'Format: YYYY-MM', '2026-08', 'Periode bulan penggajian. Jika dikosongkan, otomatis menggunakan periode yang dipilih pada sistem saat upload.'],
        ];

        $sheet2->fromArray($guideData, null, 'A5');

        // Style Guide Table
        $sheet2->getStyle('A5:F26')->applyFromArray([
            'alignment' => [
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => 'E2E8F0'],
                ],
            ],
        ]);

        // Highlight Important Rules Box below table
        $sheet2->setCellValue('A28', 'RINGKASAN ATURAN BISNIS & FORMULA OTOMATIS:');
        $sheet2->mergeCells('A28:F28');
        $sheet2->getStyle('A28')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => '0F172A'], 'size' => 11],
        ]);

        $rules = [
            '1. RUMUS GAJI POKOK: Gaji Pokok = Harga Dasar (Net PPh & Fee) - BPJS KES (5%) - BPJS TK (9.24%).',
            '2. PERHITUNGAN OTOMATIS: Jika kolom BPJS KES atau BPJS TK dikosongkan di Excel, sistem akan otomatis menghitung 5% dan 9.24% dari Harga Dasar.',
            '3. STATUS OFF & TANGGAL KELUAR: Jika karyawan berhenti bekerja, tulis STATUS "Off" dan isi TANGGAL KELUAR. Karyawan ini otomatis masuk ke metrik Laporan Off di Dashboard Admin.',
            '4. POTONGAN ABSENSI KELIPATAN: Admin dapat memasukkan nominal potongan absensi (misal 1x, 2x, 3x tarif harian) dan mencatat rinciannya di kolom KETERANGAN ABSENSI.',
            '5. PENCEGAHAN FORMAT RUSAK: NIK (16 digit) dan No Rekening wajib diberi awalan petik satu (\') agar tidak terpotong atau berubah format di Excel.',
            '6. MULTI-SHEET SAFETY: Sheet "PETUNJUK_PENGISIAN" ini secara otomatis diabaikan oleh sistem saat import dan dijamin TIDAK PERNAH masuk ke database.',
        ];

        $startRow = 29;
        foreach ($rules as $idx => $rule) {
            $rowNum = $startRow + $idx;
            $sheet2->setCellValue("A{$rowNum}", $rule);
            $sheet2->mergeCells("A{$rowNum}:F{$rowNum}");
            $sheet2->getStyle("A{$rowNum}")->applyFromArray([
                'font' => ['color' => ['rgb' => '334155'], 'size' => 9.5],
            ]);
        }

        // Set dimensions for Sheet 2
        $sheet2->getColumnDimension('A')->setWidth(6);
        $sheet2->getColumnDimension('B')->setWidth(30);
        $sheet2->getColumnDimension('C')->setWidth(20);
        $sheet2->getColumnDimension('D')->setWidth(24);
        $sheet2->getColumnDimension('E')->setWidth(32);
        $sheet2->getColumnDimension('F')->setWidth(75);

        // Active sheet defaults to Sheet 1
        $spreadsheet->setActiveSheetIndex(0);

        return $spreadsheet;
    }

    /**
     * Generate standard CSV template content
     */
    public static function createCsvContent(): string
    {
        $headers = [
            'NO',
            'WILAYAH',
            'SEKOLAH RAKYAT PERMANEN',
            'NIK',
            'NAMA LENGKAP',
            'FUNGSI TENAGA KEPENDIDIKAN',
            'TANGGAL MASUK',
            'STATUS',
            'TANGGAL KELUAR',
            'PERUSAHAAN',
            'HARGA DASAR (NET PPH & FEE)',
            'BPJS KES 5%',
            'BPJS TK 9.24%',
            'GAJI POKOK',
            'POTONGAN ABSENSI',
            'KETERANGAN ABSENSI',
            'TUNJANGAN',
            'POTONGAN LAIN',
            'TOTAL DITERIMA (TAKE HOME PAY)',
            'NO REKENING',
            'BANK',
            'PERIODE',
        ];

        $rows = [
            [
                '1',
                'DKI JAKARTA',
                'Salemba (Pusat)',
                "'3171012304910001",
                'FEBRI HIDAYAT',
                'Koordinator Administrasi',
                '01-08-2024',
                'Aktif',
                '',
                'rbs',
                '6671000',
                '333550',
                '616400',
                '5721050',
                '0',
                '',
                '0',
                '0',
                '5721050',
                "'2098199007",
                'BNI',
                '2026-08',
            ],
            [
                '2',
                'DKI JAKARTA',
                'Sekolah Rakyat Menengah Atas 10 Jakarta Selatan',
                "'3174051206950002",
                'MUHAMAD FERIANSAH',
                'Cleaning Service',
                '18-08-2025',
                'Aktif',
                '',
                'rbs',
                '6671000',
                '333550',
                '616400',
                '5721050',
                '200000',
                'Izin 2 hari x Rp 100.000',
                '0',
                '0',
                '5521050',
                "'2098393515",
                'BNI',
                '2026-08',
            ],
            [
                '3',
                'SUMATERA UTARA',
                'Sekolah Rakyat Menengah Atas 30 Padang Sidempuan',
                "'1213131111910001",
                'RUDI SAPUTRA',
                'Security',
                '25-07-2024',
                'Off',
                '15-08-2026',
                'rima',
                '3683000',
                '184150',
                '340309',
                '3158541',
                '0',
                'Karyawan off / resign per 15 Ags 2026',
                '0',
                '0',
                '3158541',
                "'2097700845",
                'BNI',
                '2026-08',
            ],
        ];

        $output = fopen('php://temp', 'r+');
        // UTF-8 BOM
        fputs($output, "\xEF\xBB\xBF");
        fputcsv($output, $headers);
        foreach ($rows as $row) {
            fputcsv($output, $row);
        }
        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        return $csv;
    }
}
