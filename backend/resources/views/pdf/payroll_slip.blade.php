<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Slip Gaji - {{ $payroll->employee_name }}</title>
    @php
        $isRima = ($payroll->company ?? 'rbs') === 'rimamandiri';
        $companyName = $isRima ? 'PT Riama Mandiri Pratama' : 'PT Rimbun Buana Sejahtera';
        $companyAddress = 'Jl. Mayjen Sutoyo No. 37, Jakarta Timur';
        $directorName = $isRima ? 'Pimpinan Perusahaan' : 'Esron Marpaung';

        $basicSalary = (float) ($payroll->basic_salary ?? 0);
        $bpjsKes = (float) ($payroll->bpjs_kes ?? 0);
        $allowance = (float) ($payroll->allowance ?? 0);
        $totalEarnings = $basicSalary + $bpjsKes + $allowance;

        // BPJS TK breakdown (Bukan pengurang gaji)
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

        // Total Potongan murni potongan absensi, pph21, dan potongan kustom lainnya (BPJS TK BUKAN pengurang)
        $totalDeductions = $pph21 + $absenceDeduction + $otherDeduction;

        // Total Gaji Diterima
        $takeHomePay = $totalEarnings - $totalDeductions;
        if ($takeHomePay <= 0 && (float) ($payroll->take_home_pay ?? 0) > 0) {
            $takeHomePay = (float) $payroll->take_home_pay;
        }

        // Format Periode
        $periodStr = trim((string) ($payroll->period ?? ''));
        $months = [
            1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
            5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
            9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'
        ];
        if (preg_match('/(\d{4})-(\d{2})/', $periodStr, $m)) {
            $year = $m[1];
            $monthNum = (int)$m[2];
            $mName = $months[$monthNum] ?? "Bulan {$monthNum}";
            $periodDisplay = "{$mName} {$year}";
        } elseif (preg_match('/(?:SP|Surat\s+Pesanan)?\s*(\d+)/i', $periodStr, $m)) {
            $spNum = (int)$m[1];
            $mName = $months[$spNum] ?? "Bulan {$spNum}";
            $periodDisplay = "{$mName} 2026";
        } else {
            $periodDisplay = $periodStr ?: 'Juni 2026';
        }

        // Base64 Images for Bulletproof PDF Rendering
        $logoPath = public_path('images/logo_rbs.png');
        $logoBase64 = file_exists($logoPath) ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath)) : null;

        $ttdPath = public_path('images/ttd_stempel_esron.png');
        $ttdBase64 = file_exists($ttdPath) ? 'data:image/png;base64,' . base64_encode(file_get_contents($ttdPath)) : null;
    @endphp
    <style>
        @page {
            size: A4 portrait;
            margin: 20mm 20mm 20mm 20mm;
        }
        body {
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
            font-size: 11px;
            color: #000000;
            line-height: 1.35;
            margin: 0;
            padding: 0;
        }
        .header-company {
            text-align: center;
            margin-bottom: 6px;
        }
        .header-company h2 {
            font-size: 13.5px;
            font-weight: bold;
            margin: 0 0 3px 0;
        }
        .header-company p {
            font-size: 10px;
            margin: 0;
            color: #111111;
        }
        .header-divider {
            border: none;
            border-top: 1.5px solid #000000;
            margin: 6px 0 16px 0;
        }
        .slip-title {
            text-align: center;
            margin-bottom: 22px;
        }
        .slip-title h3 {
            font-size: 12.5px;
            font-weight: bold;
            margin: 0 0 3px 0;
        }
        .slip-title p {
            font-size: 10px;
            margin: 0;
            color: #222222;
        }

        /* Employee Info & Logo */
        .info-logo-table {
            width: 100%;
            margin-bottom: 8px;
            border-collapse: collapse;
        }
        .info-logo-table td {
            vertical-align: middle;
            padding: 0;
        }
        .emp-info-table {
            border-collapse: collapse;
        }
        .emp-info-table td {
            padding: 2px 0;
            font-size: 10.5px;
        }
        .emp-info-table .lbl {
            width: 65px;
            color: #111111;
        }
        .emp-info-table .sep {
            width: 12px;
            text-align: center;
        }
        .emp-info-table .val {
            font-weight: normal;
        }

        .logo-box {
            text-align: right;
            vertical-align: middle;
        }
        .company-logo-img {
            max-height: 58px;
            max-width: 190px;
        }

        /* Rincian Komponen Gaji Table */
        .salary-table {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #000000;
            margin-top: 4px;
            margin-bottom: 25px;
        }
        .salary-table th.table-main-title {
            text-align: center;
            font-size: 11px;
            font-weight: bold;
            padding: 6px 8px 3px 8px;
            border-bottom: 1.5px solid #000000;
        }
        .salary-table th.amount-header {
            text-align: right;
            font-size: 10.5px;
            font-weight: bold;
            padding: 6px 12px 6px 0;
            width: 170px;
        }
        .salary-table td {
            padding: 2.5px 12px;
            font-size: 10.5px;
        }
        .salary-table td.col-item {
            text-align: left;
        }
        .salary-table td.col-rp {
            width: 30px;
            text-align: left;
            white-space: nowrap;
        }
        .salary-table td.col-amount {
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

        /* Signature Section */
        .signature-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        .signature-table td {
            vertical-align: top;
            padding: 0;
        }
        .sign-box {
            width: 220px;
            text-align: center;
            float: right;
            font-size: 10.5px;
        }
        .sign-title {
            margin-bottom: 2px;
        }
        .sign-company {
            font-weight: bold;
            margin-bottom: 2px;
        }
        .sign-img-container {
            height: 75px;
            text-align: center;
            margin: 2px 0;
        }
        .sign-img {
            max-height: 72px;
            max-width: 190px;
        }
        .sign-role {
            margin-bottom: 2px;
        }
        .sign-name {
            font-weight: bold;
        }
    </style>
</head>
<body>
    <!-- 1. Header / Kop Perusahaan -->
    <div class="header-company">
        <h2>{{ $companyName }}</h2>
        <p>{{ $companyAddress }}</p>
    </div>
    <hr class="header-divider">

    <!-- 2. Judul Dokumen & Periode -->
    <div class="slip-title">
        <h3>Slip Gaji Karyawan</h3>
        <p>Periode Pembayaran: {{ $periodDisplay }}</p>
    </div>

    <!-- 3. Informasi Karyawan & Logo -->
    <table class="info-logo-table">
        <tr>
            <td style="width: 58%;">
                <div style="font-weight: bold; margin-bottom: 4px; font-size: 11px;">Data Karyawan</div>
                <table class="emp-info-table">
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
            <td style="width: 42%;" class="logo-box">
                @if($logoBase64)
                    <img src="{{ $logoBase64 }}" class="company-logo-img" alt="Logo Perusahaan">
                @else
                    <div style="font-weight: bold; font-size: 13px; color: #004AC6;">
                        {{ $companyName }}
                    </div>
                @endif
            </td>
        </tr>
    </table>

    <!-- 4. Rincian Komponen Gaji (Format Baru 2026) -->
    <table class="salary-table">
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
                <td class="col-amount bold-text">{{ $totalDeductions > 0 ? number_format($totalDeductions, 0, ',', '.') : '-' }}</td>
            </tr>

            <!-- GAP -->
            <tr><td colspan="3" class="section-gap"></td></tr>

            <!-- TOTAL GAJI DITERIMA (TAKE HOME PAY) -->
            <tr>
                <td class="col-item bold-text" style="font-size: 11px;">Total Gaji Diterima</td>
                <td class="col-rp bold-text" style="font-size: 11px;">Rp</td>
                <td class="col-amount bold-text" style="font-size: 11px;">{{ number_format($takeHomePay, 0, ',', '.') }}</td>
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
    <table class="signature-table">
        <tr>
            <td style="width: 55%;"></td>
            <td style="width: 45%;">
                <div class="sign-box">
                    <div class="sign-title">Mengetahui,</div>
                    <div class="sign-company">{{ $companyName }}</div>
                    <div class="sign-img-container">
                        @if($ttdBase64)
                            <img src="{{ $ttdBase64 }}" class="sign-img" alt="Tanda Tangan & Stempel">
                        @else
                            <div style="height: 60px;"></div>
                        @endif
                    </div>
                    <div class="sign-role">Direktur Utama</div>
                    <div class="sign-name">({{ $directorName }})</div>
                </div>
            </td>
        </tr>
    </table>
</body>
</html>
