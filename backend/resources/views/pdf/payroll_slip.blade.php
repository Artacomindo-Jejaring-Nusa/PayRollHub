<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Slip Gaji - {{ $payroll->employee_name }}</title>
    @php
        $companyRaw = strtolower(trim($payroll->company ?: ''));
        $isRima = in_array($companyRaw, ['rimamandiri', 'rima', 'riamamandiripratama', 'riama']);
        $companyName = $isRima ? 'PT Riama Mandiri Pratama' : 'PT Rimbun Buana Sejahtera';
        $companyAddress = 'Jl. Mayjen Sutoyo No. 37, Jakarta Timur';
        $directorName = $isRima ? 'Pimpinan Perusahaan' : 'Esron Marpaung';

        $basicSalary = (float) ($payroll->basic_salary ?? 0);
        $bpjsKes = (float) ($payroll->bpjs_kes ?? 0);
        $allowance = (float) ($payroll->allowance ?? 0);
        $totalEarnings = $basicSalary + $bpjsKes + $allowance;

        // BPJS TK breakdown
        $bpjsTk = (float) ($payroll->bpjs_tk ?? 0);
        $jht = (float) ($payroll->bpjs_tk_jht ?? 0);
        $jp = (float) ($payroll->bpjs_tk_jp ?? 0);

        if ($jht <= 0 && $jp <= 0 && $bpjsTk > 0) {
            $jht = round($bpjsTk * (2 / 3));
            $jp = round($bpjsTk - $jht);
        }

        $pph21 = (float) ($payroll->pph21 ?? 0);
        $absenceDeduction = (float) ($payroll->absence_deduction ?? 0);
        $otherDeduction = (float) ($payroll->deduction ?? 0);
        $customDeductions = is_array($payroll->custom_deductions) ? $payroll->custom_deductions : (is_string($payroll->custom_deductions) ? json_decode($payroll->custom_deductions, true) : []);

        // Total Potongan standard RBS (BPJS TK bukan pengurang)
        $totalDeductionsRbs = $pph21 + $absenceDeduction + $otherDeduction;
        $takeHomePayRbs = $totalEarnings - $totalDeductionsRbs;
        if ($takeHomePayRbs <= 0 && (float) ($payroll->take_home_pay ?? 0) > 0) {
            $takeHomePayRbs = (float) $payroll->take_home_pay;
        }

        // Riama Template Potongan: Total (B) = BPJS TK JHT + BPJS TK JP + Absensi + PPh21 + Potongan Lainnya
        $riamaTotalPotongan = $jht + $jp + $absenceDeduction + $pph21 + $otherDeduction;
        $dbThp = (float) ($payroll->take_home_pay ?? 0);
        $diffThp = $totalEarnings - $riamaTotalPotongan;
        $riamaTakeHomePay = ($dbThp > 0) ? $dbThp : $diffThp;

        $posLower = strtolower(trim($payroll->position ?: ''));
        if (empty($posLower) || in_array($posLower, ['security', 'satpam', 'pegawai - anggota', 'anggota', 'pegawai anggota'])) {
            $slipTitlePosition = 'SECURITY';
        } else {
            $slipTitlePosition = strtoupper($payroll->position);
        }

        // Format Periode
        $periodStr = trim((string) ($payroll->period ?? ''));
        $months = [
            1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
            5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
            9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'
        ];
        $monthNameOnly = 'Agustus';
        if (preg_match('/(\d{4})-(\d{2})/', $periodStr, $m)) {
            $year = $m[1];
            $monthNum = (int)$m[2];
            $monthNameOnly = $months[$monthNum] ?? "Bulan {$monthNum}";
            $periodDisplay = "{$monthNameOnly} {$year}";
        } elseif (preg_match('/^(?:SP|Surat\s+Pesanan)\s*(\d+)$/i', $periodStr, $m)) {
            $spNum = (int)$m[1];
            $monthNameOnly = "SP {$spNum}";
            $periodDisplay = "SP {$spNum}";
        } else {
            $monthNameOnly = $periodStr ?: 'Agustus';
            $periodDisplay = $periodStr ?: 'Agustus 2026';
        }

        // Base64 Images for Bulletproof PDF Rendering
        $logoRbsPath = public_path('images/logo_rbs.png');
        $logoRbsBase64 = file_exists($logoRbsPath) ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoRbsPath)) : null;

        $kopRiamaPath = public_path('images/kop_riama.jpg');
        $kopRiamaBase64 = file_exists($kopRiamaPath) ? 'data:image/jpeg;base64,' . base64_encode(file_get_contents($kopRiamaPath)) : null;

        $ttdPath = public_path('images/ttd_stempel_esron.png');
        $ttdBase64 = file_exists($ttdPath) ? 'data:image/png;base64,' . base64_encode(file_get_contents($ttdPath)) : null;

        if (!function_exists('terbilang')) {
            function terbilang($angka) {
                $angka = abs((float) $angka);
                $baca = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
                $hasil = '';

                if ($angka < 12) {
                    $hasil = ' ' . $baca[(int)$angka];
                } elseif ($angka < 20) {
                    $hasil = terbilang($angka - 10) . ' Belas';
                } elseif ($angka < 100) {
                    $hasil = terbilang(intdiv((int)$angka, 10)) . ' Puluh ' . terbilang($angka % 10);
                } elseif ($angka < 200) {
                    $hasil = ' Seratus ' . terbilang($angka - 100);
                } elseif ($angka < 1000) {
                    $hasil = terbilang(intdiv((int)$angka, 100)) . ' Ratus ' . terbilang($angka % 100);
                } elseif ($angka < 2000) {
                    $hasil = ' Seribu ' . terbilang($angka - 1000);
                } elseif ($angka < 1000000) {
                    $hasil = terbilang(intdiv((int)$angka, 1000)) . ' Ribu ' . terbilang($angka % 1000);
                } elseif ($angka < 1000000000) {
                    $hasil = terbilang(intdiv((int)$angka, 1000000)) . ' Juta ' . terbilang($angka % 1000000);
                } elseif ($angka < 1000000000000) {
                    $hasil = terbilang(intdiv((int)$angka, 1000000000)) . ' Miliar ' . terbilang(fmod($angka, 1000000000));
                }

                return trim(preg_replace('/\s+/', ' ', $hasil));
            }
        }
    @endphp

    <style>
        @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
        }
        body {
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
            font-size: 11px;
            color: #000000;
            line-height: 1.35;
            margin: 0;
            padding: 0;
        }

        /* RIAMA TEMPLATE SPECIFIC STYLES */
        .riama-container {
            border: 1.5px solid #000000;
            padding: 0;
            margin: 0 auto;
            width: 100%;
        }
        .riama-kop-img {
            width: 100%;
            height: auto;
            display: block;
        }
        .riama-divider-single {
            border-bottom: 1.5px solid #000000;
        }
        .riama-title-box {
            text-align: center;
            padding: 12px 10px 10px 10px;
        }
        .riama-title-box h2 {
            font-family: "Times New Roman", Times, serif;
            font-size: 15pt;
            font-weight: bold;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .riama-title-box h3 {
            font-family: "Times New Roman", Times, serif;
            font-size: 14pt;
            font-weight: bold;
            margin: 6px 0 0 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .riama-divider-double {
            border-bottom: 3.5px double #000000;
        }
        .riama-body {
            padding: 12px 20px 24px 20px;
            font-family: "Times New Roman", Times, serif;
        }
        .riama-emp-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11.5pt;
            margin-bottom: 18px;
        }
        .riama-emp-table td {
            padding: 2.5px 0;
            vertical-align: top;
        }
        .riama-fin-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11pt;
        }
        .riama-fin-table td {
            vertical-align: top;
        }
        .riama-col-inner {
            width: 100%;
            border-collapse: collapse;
        }
        .riama-col-inner td {
            padding: 3.5px 0;
        }
        .riama-col-inner .num-col {
            text-align: right;
            padding-right: 5px;
        }
        .riama-header-underlined {
            font-weight: bold;
            font-size: 11.5pt;
            text-decoration: underline;
        }
        .riama-total-row td {
            padding-top: 14px;
            font-weight: bold;
            font-size: 11.5pt;
        }
        .riama-net-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11.5pt;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        .riama-net-table td {
            padding: 3px 0;
            vertical-align: top;
        }
        .riama-sign-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11pt;
            margin-top: 30px;
        }
        .riama-sign-table td {
            text-align: center;
        }

        /* RBS TEMPLATE SPECIFIC STYLES */
        .rbs-header-company {
            text-align: center;
            margin-bottom: 6px;
        }
        .rbs-header-company h2 {
            font-size: 13.5px;
            font-weight: bold;
            margin: 0 0 3px 0;
        }
        .rbs-header-company p {
            font-size: 10px;
            margin: 0;
            color: #111111;
        }
        .rbs-header-divider {
            border: none;
            border-top: 1.5px solid #000000;
            margin: 6px 0 16px 0;
        }
        .rbs-slip-title {
            text-align: center;
            margin-bottom: 22px;
        }
        .rbs-slip-title h3 {
            font-size: 12.5px;
            font-weight: bold;
            margin: 0 0 3px 0;
        }
        .rbs-slip-title p {
            font-size: 10px;
            margin: 0;
            color: #222222;
        }
        .rbs-info-logo-table {
            width: 100%;
            margin-bottom: 8px;
            border-collapse: collapse;
        }
        .rbs-info-logo-table td {
            vertical-align: middle;
            padding: 0;
        }
        .rbs-emp-info-table {
            border-collapse: collapse;
        }
        .rbs-emp-info-table td {
            padding: 2px 0;
            font-size: 10.5px;
        }
        .rbs-emp-info-table .lbl {
            width: 65px;
            color: #111111;
        }
        .rbs-emp-info-table .sep {
            width: 12px;
            text-align: center;
        }
        .rbs-emp-info-table .val {
            font-weight: normal;
        }
        .rbs-logo-box {
            text-align: right;
            vertical-align: middle;
        }
        .rbs-company-logo-img {
            max-height: 58px;
            max-width: 190px;
        }
        .rbs-salary-table {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #000000;
            margin-top: 4px;
            margin-bottom: 25px;
        }
        .rbs-salary-table th.table-main-title {
            text-align: center;
            font-size: 11px;
            font-weight: bold;
            padding: 6px 8px 3px 8px;
            border-bottom: 1.5px solid #000000;
        }
        .rbs-salary-table th.amount-header {
            text-align: right;
            font-size: 10.5px;
            font-weight: bold;
            padding: 6px 12px 6px 0;
            width: 170px;
        }
        .rbs-salary-table td {
            padding: 2.5px 12px;
            font-size: 10.5px;
        }
        .rbs-salary-table td.col-item {
            text-align: left;
        }
        .rbs-salary-table td.col-rp {
            width: 30px;
            text-align: left;
            white-space: nowrap;
        }
        .rbs-salary-table td.col-amount {
            text-align: right;
            white-space: nowrap;
            width: 110px;
            padding-right: 12px;
        }
        .bold-text {
            font-weight: bold;
        }
        .section-gap {
            height: 10px;
        }
        .rbs-signature-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        .rbs-signature-table td {
            vertical-align: top;
            padding: 0;
        }
        .rbs-sign-box {
            width: 220px;
            text-align: center;
            float: right;
            font-size: 10.5px;
        }
        .rbs-sign-title {
            margin-bottom: 2px;
        }
        .rbs-sign-company {
            font-weight: bold;
            margin-bottom: 2px;
        }
        .rbs-sign-img-container {
            height: 75px;
            text-align: center;
            margin: 2px 0;
        }
        .rbs-sign-img {
            max-height: 72px;
            max-width: 190px;
        }
        .rbs-sign-role {
            margin-bottom: 2px;
        }
        .rbs-sign-name {
            font-weight: bold;
        }
    </style>
</head>
<body>

@if($isRima)
    <!-- =============================================================== -->
    <!-- TEMPLATE SLIP GAJI RESMI PT RIAMA MANDIRI PRATAMA (SESUAI PDF)  -->
    <!-- =============================================================== -->
    <div class="riama-container">
        <!-- 1. KOP SURAT (DENGAN LOGO RESMI RIAMA MANDIRI PRATAMA & RMP) -->
        @if($kopRiamaBase64)
            <img src="{{ $kopRiamaBase64 }}" class="riama-kop-img" alt="Kop Surat PT Riama Mandiri Pratama">
        @else
            <div style="text-align: center; padding: 10px 0;">
                <h2 style="font-family: 'Times New Roman', Times, serif; font-size: 14pt; margin: 0; color: #002060;">PT RIAMA MANDIRI PRATAMA</h2>
                <div style="font-size: 9pt; font-weight: bold;">BADAN USAHA JASA PENGAMANAN (BUJP)</div>
                <div style="font-size: 8pt;">Jl. Cileungsi – Jonggol KM 01, No. 01, Cileungsi Kidul, Kec. Cileungsi, Kab. Jawa Barat.</div>
                <div style="font-size: 8pt;">089636055269, riamamandiripratama@gmail.com</div>
            </div>
        @endif
        <div class="riama-divider-single"></div>

        <!-- 2. JUDUL SLIP GAJI & PERIODE -->
        <div class="riama-title-box">
            <h2>SLIP GAJI {{ $slipTitlePosition }} PT RIAMA</h2>
            <h3>PERIODE {{ strtoupper($monthNameOnly) }}</h3>
        </div>
        <div class="riama-divider-double"></div>

        <!-- 3. DATA KARYAWAN -->
        <div class="riama-body">
            <table class="riama-emp-table">
                <tr>
                    <td style="width: 75px;">Nama</td>
                    <td style="width: 15px; text-align: center;">:</td>
                    <td>{{ $payroll->employee_name }}</td>
                </tr>
                <tr>
                    <td>Jabatan</td>
                    <td style="text-align: center;">:</td>
                    <td>{{ $payroll->position ? $payroll->position . (in_array(strtolower($payroll->position), ['security', 'satpam']) ? ' - Anggota' : '') : 'Pegawai - Anggota' }}</td>
                </tr>
                <tr>
                    <td>Status</td>
                    <td style="text-align: center;">:</td>
                    <td>{{ $payroll->status === 'off' ? 'Off' : ($payroll->school_unit ?: '') }}</td>
                </tr>
            </table>

            <!-- 4. RINCIAN KEUANGAN 2 KOLOM (A. PENGHASILAN & B. POTONGAN) -->
            <table class="riama-fin-table">
                <tr>
                    <!-- KOLOM KIRI: A. PENGHASILAN -->
                    <td style="width: 50%; padding-right: 25px;">
                        <table class="riama-col-inner">
                            <tr>
                                <td colspan="2" style="padding-bottom: 8px;">
                                    <span class="riama-header-underlined">A. Penghasilan</span>
                                </td>
                            </tr>
                            <tr>
                                <td>Gaji Pokok</td>
                                <td class="num-col">{{ number_format($basicSalary, 0, ',', '.') }}</td>
                            </tr>
                            <tr>
                                <td>Tunjangan Jabatan</td>
                                <td class="num-col">{{ $allowance > 0 ? number_format($allowance, 0, ',', '.') : '-' }}</td>
                            </tr>
                            <tr>
                                <td>Tunjangan Konsums</td>
                                <td class="num-col">-</td>
                            </tr>
                            <tr>
                                <td>Tunjangan Hari Raya</td>
                                <td class="num-col">-</td>
                            </tr>
                            <tr>
                                <td>BPJS Kesehatan</td>
                                <td class="num-col">{{ $bpjsKes > 0 ? 'Rp' . number_format($bpjsKes, 0, ',', '.') : '-' }}</td>
                            </tr>
                            <tr class="riama-total-row">
                                <td>Total (A)</td>
                                <td class="num-col">{{ number_format($totalEarnings, 0, ',', '.') }}</td>
                            </tr>
                        </table>
                    </td>

                    <!-- KOLOM KANAN: B. POTONGAN -->
                    <td style="width: 50%; padding-left: 25px;">
                        <table class="riama-col-inner">
                            <tr>
                                <td colspan="2" style="padding-bottom: 8px;">
                                    <span class="riama-header-underlined">B. Potongan</span>
                                </td>
                            </tr>
                            <tr>
                                <td>BPJS TK JHT 2%</td>
                                <td class="num-col">{{ $jht > 0 ? number_format($jht, 0, ',', '.') : '-' }}</td>
                            </tr>
                            <tr>
                                <td>BPJS TK JP 1%</td>
                                <td class="num-col">{{ $jp > 0 ? number_format($jp, 0, ',', '.') : '-' }}</td>
                            </tr>
                            <tr>
                                <td>Absen Kehadiran</td>
                                <td class="num-col">{{ $absenceDeduction > 0 ? number_format($absenceDeduction, 0, ',', '.') : '-' }}</td>
                            </tr>
                            <tr>
                                <td>PPH 21</td>
                                <td class="num-col">{{ $pph21 > 0 ? number_format($pph21, 0, ',', '.') : '-' }}</td>
                            </tr>
                            @if($otherDeduction > 0)
                            <tr>
                                <td>Potongan Lainnya</td>
                                <td class="num-col">{{ number_format($otherDeduction, 0, ',', '.') }}</td>
                            </tr>
                            @else
                            <tr>
                                <td>&nbsp;</td>
                                <td class="num-col">&nbsp;</td>
                            </tr>
                            @endif
                            <tr class="riama-total-row">
                                <td>Total (B)</td>
                                <td class="num-col">{{ number_format($riamaTotalPotongan, 0, ',', '.') }}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- 5. PENERIMAAN BERSIH (A - B) & TERBILANG -->
            <table class="riama-net-table">
                <tr>
                    <td style="width: 220px; font-weight: bold;">Penerimaan Bersih( A-B)</td>
                    <td style="font-weight: bold;">Rp{{ number_format($riamaTakeHomePay, 0, ',', '.') }}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold;">Terbilang</td>
                    <td style="font-style: italic;">"{{ terbilang($riamaTakeHomePay) }} Rupiah"</td>
                </tr>
            </table>

            <!-- 6. TANDA TANGAN & PENGESAHAN STAFF KEUANGAN BOGOR -->
            <table class="riama-sign-table">
                <tr>
                    <td style="width: 52%;"></td>
                    <td style="width: 48%;">
                        <div>Bogor, 10 {{ $monthNameOnly }} 2026</div>
                        <div style="height: 65px;"></div>
                        <div style="font-weight: 500;">Annisaintanmaulidiaa</div>
                        <div style="margin-top: 2px;">Staff Keuangan</div>
                    </td>
                </tr>
            </table>
        </div>
    </div>

@else
    <!-- =============================================================== -->
    <!-- TEMPLATE SLIP GAJI PT RIMBUN BUANA SEJAHTERA (RBS)              -->
    <!-- =============================================================== -->
    <!-- 1. Header / Kop Perusahaan -->
    <div class="rbs-header-company">
        <h2>{{ $companyName }}</h2>
        <p>{{ $companyAddress }}</p>
    </div>
    <hr class="rbs-header-divider">

    <!-- 2. Judul Dokumen & Periode -->
    <div class="rbs-slip-title">
        <h3>Slip Gaji Karyawan</h3>
        <p>Periode Pembayaran: {{ $periodDisplay }}</p>
    </div>

    <!-- 3. Informasi Karyawan & Logo -->
    <table class="rbs-info-logo-table">
        <tr>
            <td style="width: 58%;">
                <div style="font-weight: bold; margin-bottom: 4px; font-size: 11px;">Data Karyawan</div>
                <table class="rbs-emp-info-table">
                    <tr>
                        <td class="lbl">Nama</td>
                        <td class="sep">:</td>
                        <td class="val">{{ $payroll->employee_name }}</td>
                    </tr>
                    <tr>
                        <td class="lbl">Jabatan</td>
                        <td class="sep">:</td>
                        <td class="val">{{ $payroll->position ?: '-' }}</td>
                    </tr>
                    <tr>
                        <td class="lbl">Status</td>
                        <td class="sep">:</td>
                        <td class="val">
                            @if(!empty($payroll->school_unit))
                                {{ $payroll->school_unit }}
                            @else
                                {{ $payroll->status === 'off' ? 'Pegawai Non-Aktif' : 'Pegawai Kontrak - TK/0' }}
                            @endif
                        </td>
                    </tr>
                </table>
            </td>
            <td style="width: 42%;" class="rbs-logo-box">
                @if($logoRbsBase64)
                    <img src="{{ $logoRbsBase64 }}" class="rbs-company-logo-img" alt="Logo Perusahaan">
                @else
                    <div style="font-weight: bold; font-size: 13px; color: #004AC6;">
                        {{ $companyName }}
                    </div>
                @endif
            </td>
        </tr>
    </table>

    <!-- 4. Rincian Komponen Gaji (Format Baru 2026) -->
    <table class="rbs-salary-table">
        <thead>
            <tr>
                <th colspan="3" class="table-main-title">Rincian Komponen Gaji</th>
            </tr>
            <tr>
                <th class="col-item"></th>
                <th colspan="2" class="amount-header">Jumlah (Rp)</th>
            </tr>
        </thead>
        <tbody>
            <!-- PENGHASILAN -->
            <tr>
                <td class="col-item bold-text">Gaji Pokok</td>
                <td class="col-rp">Rp</td>
                <td class="col-amount">{{ number_format($basicSalary, 0, ',', '.') }}</td>
            </tr>
            <tr>
                <td class="col-item">Tunjangan BPJS Kesehatan</td>
                <td class="col-rp">Rp</td>
                <td class="col-amount">{{ $bpjsKes > 0 ? number_format($bpjsKes, 0, ',', '.') : '-' }}</td>
            </tr>
            <tr>
                <td class="col-item">Tunjangan Jabatan</td>
                <td class="col-rp">Rp</td>
                <td class="col-amount">{{ $allowance > 0 ? number_format($allowance, 0, ',', '.') : '-' }}</td>
            </tr>
            <tr>
                <td class="col-item">Tunjangan Hari Raya</td>
                <td class="col-rp">Rp</td>
                <td class="col-amount">-</td>
            </tr>
            <tr>
                <td class="col-item bold-text">Total Gaji sebelum potongan</td>
                <td class="col-rp bold-text">Rp</td>
                <td class="col-amount bold-text">{{ number_format($totalEarnings, 0, ',', '.') }}</td>
            </tr>

            <!-- GAP -->
            <tr><td colspan="3" class="section-gap"></td></tr>

            <!-- POTONGAN -->
            <tr>
                <td colspan="3" class="col-item bold-text" style="padding-top: 4px;">Potongan</td>
            </tr>
            <tr>
                <td class="col-item">Pph 21</td>
                <td class="col-rp">Rp</td>
                <td class="col-amount">{{ $pph21 > 0 ? number_format($pph21, 0, ',', '.') : '-' }}</td>
            </tr>
            <tr>
                <td class="col-item">
                    Absensi
                    @if((int)($payroll->absence_count ?? 0) > 0)
                        ({{ $payroll->absence_count }}x)
                    @endif
                    @if(!empty($payroll->attended_days) || !empty($payroll->holiday_days))
                        <div style="font-size: 8.5px; color: #555555; margin-top: 1px;">
                            (Hadir: {{ $payroll->attended_days ?? 0 }} hari, Libur: {{ $payroll->holiday_days ?? 0 }} hari)
                        </div>
                    @endif
                </td>
                <td class="col-rp">Rp</td>
                <td class="col-amount">{{ $absenceDeduction > 0 ? number_format($absenceDeduction, 0, ',', '.') : '-' }}</td>
            </tr>
            @if(!empty($customDeductions) && count($customDeductions) > 0)
                @foreach($customDeductions as $cd)
                    @if((float)($cd['amount'] ?? 0) > 0)
                    <tr>
                        <td class="col-item">{{ $cd['name'] ?? 'Potongan Kustom' }}</td>
                        <td class="col-rp">Rp</td>
                        <td class="col-amount">{{ number_format((float)$cd['amount'], 0, ',', '.') }}</td>
                    </tr>
                    @endif
                @endforeach
            @elseif($otherDeduction > 0)
                <tr>
                    <td class="col-item">Potongan Lainnya</td>
                    <td class="col-rp">Rp</td>
                    <td class="col-amount">{{ number_format($otherDeduction, 0, ',', '.') }}</td>
                </tr>
            @endif
            <tr>
                <td class="col-item bold-text">Total Potongan</td>
                <td class="col-rp bold-text">Rp</td>
                <td class="col-amount bold-text">{{ $totalDeductionsRbs > 0 ? number_format($totalDeductionsRbs, 0, ',', '.') : '-' }}</td>
            </tr>

            <!-- GAP -->
            <tr><td colspan="3" class="section-gap"></td></tr>

            <!-- TOTAL GAJI DITERIMA (TAKE HOME PAY) -->
            <tr>
                <td class="col-item bold-text" style="font-size: 11px;">Total Gaji Diterima</td>
                <td class="col-rp bold-text" style="font-size: 11px;">Rp</td>
                <td class="col-amount bold-text" style="font-size: 11px;">{{ number_format($takeHomePayRbs, 0, ',', '.') }}</td>
            </tr>

            <!-- GAP -->
            <tr><td colspan="3" class="section-gap"></td></tr>

            <!-- BPJS YANG BISA DICAIRKAN (BUKAN PENGURANG) -->
            <tr>
                <td colspan="3" class="col-item bold-text" style="padding-top: 4px;">BPJS yang bisa dicairkan</td>
            </tr>
            <tr>
                <td class="col-item" style="padding-left: 12px;">BPJS TK JHT</td>
                <td class="col-rp">Rp</td>
                <td class="col-amount">{{ $jht > 0 ? number_format($jht, 0, ',', '.') : '-' }}</td>
            </tr>
            <tr>
                <td class="col-item" style="padding-left: 12px; padding-bottom: 8px;">BPJS TK JP</td>
                <td class="col-rp" style="padding-bottom: 8px;">Rp</td>
                <td class="col-amount" style="padding-bottom: 8px;">{{ $jp > 0 ? number_format($jp, 0, ',', '.') : '-' }}</td>
            </tr>
        </tbody>
    </table>

    <!-- 5. Tanda Tangan Resmi & Stempel Direktur Utama -->
    <table class="rbs-signature-table">
        <tr>
            <td style="width: 55%;"></td>
            <td style="width: 45%;">
                <div class="rbs-sign-box">
                    <div class="rbs-sign-title">Mengetahui,</div>
                    <div class="rbs-sign-company">{{ $companyName }}</div>
                    <div class="rbs-sign-img-container">
                        @if($ttdBase64)
                            <img src="{{ $ttdBase64 }}" class="rbs-sign-img" alt="Tanda Tangan & Stempel">
                        @else
                            <div style="height: 60px;"></div>
                        @endif
                    </div>
                    <div class="rbs-sign-role">Direktur Utama</div>
                    <div class="rbs-sign-name">({{ $directorName }})</div>
                </div>
            </td>
        </tr>
    </table>
@endif

</body>
</html>
