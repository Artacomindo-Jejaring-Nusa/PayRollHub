<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Slip Gaji - {{ $payroll->employee_name }} ({{ $payroll->period }})</title>
    @php
        $isRima = ($payroll->company ?? 'rbs') === 'rimamandiri';
        $companyName = $isRima ? 'PT Riama Mandiri Pratama' : 'PT Rimbun Buana Sejahtera';
        $companyAddress = 'Jl. Mayjen Sutoyo No. 37, Jakarta Timur';
        $directorName = $isRima ? 'Pimpinan Perusahaan' : 'Esron Marpaung';

        $basicSalary = (float) ($payroll->basic_salary ?? 0);
        $bpjsKes = (float) ($payroll->bpjs_kes ?? 0);
        $allowance = (float) ($payroll->allowance ?? 0);
        $totalEarnings = $basicSalary + $bpjsKes + $allowance;

        $bpjsTk = (float) ($payroll->bpjs_tk ?? 0);
        // Break down BPJS TK to JHT (2%) and JP (1%)
        if ($bpjsTk > 0) {
            if ($basicSalary > 0) {
                $jht = round($basicSalary * 0.02, 2);
                $jp = round($bpjsTk - $jht, 2);
                if ($jp < 0) {
                    $jht = round($bpjsTk * (2 / 3), 2);
                    $jp = $bpjsTk - $jht;
                }
            } else {
                $jht = round($bpjsTk * (2 / 3), 2);
                $jp = $bpjsTk - $jht;
            }
        } else {
            $jht = 0;
            $jp = 0;
        }

        $pph21 = (float) ($payroll->pph21 ?? 0);
        $absenceDeduction = (float) ($payroll->absence_deduction ?? 0);
        $otherDeduction = (float) ($payroll->deduction ?? 0);
        $customDeductions = is_array($payroll->custom_deductions) ? $payroll->custom_deductions : (is_string($payroll->custom_deductions) ? json_decode($payroll->custom_deductions, true) : []);
        $totalDeductions = $bpjsTk + $pph21 + $absenceDeduction + $otherDeduction;

        $takeHomePay = $totalEarnings - $totalDeductions;
        if ($takeHomePay <= 0 && (float) ($payroll->take_home_pay ?? 0) > 0) {
            $takeHomePay = (float) $payroll->take_home_pay;
        }
    @endphp
    <style>
        @page {
            size: A4 portrait;
            margin: 25mm 20mm 20mm 20mm;
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
            margin-bottom: 8px;
        }
        .header-company h2 {
            font-size: 14px;
            font-weight: bold;
            margin: 0 0 4px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .header-company p {
            font-size: 10.5px;
            margin: 0;
            color: #222222;
        }
        .header-divider {
            border: none;
            border-top: 2px solid #000000;
            margin: 8px 0 16px 0;
        }
        .slip-title {
            text-align: center;
            margin-bottom: 20px;
        }
        .slip-title h3 {
            font-size: 13px;
            font-weight: bold;
            margin: 0 0 4px 0;
            letter-spacing: 0.3px;
        }
        .slip-title p {
            font-size: 11px;
            margin: 0;
            color: #333333;
        }

        /* Employee Info & Logo Table */
        .info-logo-table {
            width: 100%;
            margin-bottom: 14px;
            border-collapse: collapse;
        }
        .info-logo-table td {
            vertical-align: top;
            padding: 0;
        }
        .emp-info-table {
            border-collapse: collapse;
        }
        .emp-info-table td {
            padding: 2.5px 0;
            font-size: 11px;
        }
        .emp-info-table .lbl {
            width: 70px;
            font-weight: 500;
        }
        .emp-info-table .sep {
            width: 15px;
            text-align: center;
        }
        .emp-info-table .val {
            font-weight: normal;
        }

        .logo-box {
            text-align: right;
        }
        .company-logo-text {
            display: inline-block;
            text-align: center;
            font-weight: bold;
            font-size: 11px;
            letter-spacing: 0.5px;
            color: #1e3a8a;
            border: 2px solid #1e3a8a;
            padding: 6px 12px;
            border-radius: 4px;
        }

        /* Salary Breakdown Table */
        .salary-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5px solid #000000;
            margin-bottom: 30px;
        }
        .salary-table th {
            border-bottom: 1.5px solid #000000;
            padding: 6px 10px;
            font-size: 11px;
            font-weight: bold;
            text-align: left;
        }
        .salary-table th.amount-col {
            text-align: right;
            width: 150px;
        }
        .salary-table td {
            padding: 4px 10px;
            font-size: 11px;
        }
        .salary-table td.amount-col {
            text-align: right;
            white-space: nowrap;
        }
        .salary-table .subtotal-row td {
            font-weight: bold;
            padding-top: 6px;
            padding-bottom: 6px;
        }
        .salary-table .total-row td {
            border-top: 1.5px solid #000000;
            border-bottom: 1.5px solid #000000;
            font-size: 11.5px;
            font-weight: bold;
            padding-top: 8px;
            padding-bottom: 8px;
        }
        .section-header td {
            font-weight: bold;
            padding-top: 8px;
            padding-bottom: 2px;
        }

        /* Signature Section */
        .signature-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .signature-table td {
            vertical-align: top;
            padding: 0;
        }
        .sign-box {
            width: 240px;
            text-align: center;
            float: right;
            font-size: 11px;
        }
        .sign-space {
            height: 65px;
        }
        .sign-title {
            margin-bottom: 2px;
        }
        .sign-name {
            font-weight: bold;
        }
    </style>
</head>
<body>
    <!-- 1. Header / Kop Surat Resmi -->
    <div class="header-company">
        <h2>{{ $companyName }}</h2>
        <p>{{ $companyAddress }}</p>
    </div>
    <hr class="header-divider">

    <!-- 2. Judul Dokumen -->
    <div class="slip-title">
        <h3>Slip Gaji Karyawan</h3>
        <p>Periode Pembayaran: {{ $payroll->period }}</p>
    </div>

    <!-- 3. Informasi Karyawan & Logo Perusahaan -->
    <table class="info-logo-table">
        <tr>
            <td style="width: 60%;">
                <div style="font-weight: bold; margin-bottom: 4px;">Data Karyawan</div>
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
                                {{ $payroll->status === 'off' ? 'Non-Aktif' : 'Pegawai Kontrak - TK/0' }}
                            @endif
                        </td>
                    </tr>
                    @if(!empty($payroll->nik))
                    <tr>
                        <td class="lbl">NIK</td>
                        <td class="sep">:</td>
                        <td class="val">{{ $payroll->nik }}</td>
                    </tr>
                    @endif
                </table>
            </td>
            <td style="width: 40%; vertical-align: middle;" class="logo-box">
                <div class="company-logo-text">
                    <span style="font-size: 16px; display: block; font-weight: 900; letter-spacing: 1px;">
                        {{ $isRima ? 'RIMA' : 'RS' }}
                    </span>
                    {{ $companyName }}
                </div>
            </td>
        </tr>
    </table>

    <!-- 4. Rincian Komponen Gaji Sesuai Format Resmi Perusahaan -->
    <table class="salary-table">
        <thead>
            <tr>
                <th>Rincian Komponen Gaji</th>
                <th class="amount-col">Jumlah (Rp)</th>
            </tr>
        </thead>
        <tbody>
            <!-- A. Komponen Penghasilan -->
            <tr>
                <td style="font-weight: bold;">Gaji Pokok</td>
                <td class="amount-col">Rp {{ number_format($basicSalary, 2, ',', '.') }}</td>
            </tr>
            <tr>
                <td>Tunjangan BPJS Kesehatan</td>
                <td class="amount-col">
                    @if($bpjsKes > 0)
                        Rp {{ number_format($bpjsKes, 2, ',', '.') }}
                    @else
                        Rp -
                    @endif
                </td>
            </tr>
            <tr>
                <td>Tunjangan Jabatan</td>
                <td class="amount-col">
                    @if($allowance > 0)
                        Rp {{ number_format($allowance, 2, ',', '.') }}
                    @else
                        Rp -
                    @endif
                </td>
            </tr>
            <tr>
                <td>Tunjangan Hari Raya</td>
                <td class="amount-col">Rp -</td>
            </tr>
            <tr class="subtotal-row">
                <td>Total Gaji sebelum potongan</td>
                <td class="amount-col">Rp {{ number_format($totalEarnings, 2, ',', '.') }}</td>
            </tr>

            <!-- B. Komponen Potongan -->
            <tr class="section-header">
                <td colspan="2">Potongan</td>
            </tr>
            <tr>
                <td style="padding-left: 15px;">BPJS TK JHT (2%)</td>
                <td class="amount-col">
                    @if($jht > 0)
                        Rp {{ number_format($jht, 2, ',', '.') }}
                    @else
                        Rp -
                    @endif
                </td>
            </tr>
            <tr>
                <td style="padding-left: 15px;">BPJS TK JP (1%)</td>
                <td class="amount-col">
                    @if($jp > 0)
                        Rp {{ number_format($jp, 2, ',', '.') }}
                    @else
                        Rp -
                    @endif
                </td>
            </tr>
            <tr>
                <td style="padding-left: 15px;">Pph 21</td>
                <td class="amount-col">
                    @if($pph21 > 0)
                        Rp {{ number_format($pph21, 2, ',', '.') }}
                    @else
                        Rp -
                    @endif
                </td>
            </tr>
            <tr>
                <td style="padding-left: 15px;">
                    Absensi
                    @if((int)($payroll->absence_count ?? 0) > 0)
                        ({{ $payroll->absence_count }}x)
                    @endif
                </td>
                <td class="amount-col">
                    @if($absenceDeduction > 0)
                        Rp {{ number_format($absenceDeduction, 2, ',', '.') }}
                    @else
                        Rp -
                    @endif
                </td>
            </tr>
            @if(!empty($customDeductions) && count($customDeductions) > 0)
                @foreach($customDeductions as $cd)
                    @if((float)($cd['amount'] ?? 0) > 0)
                    <tr>
                        <td style="padding-left: 15px;">{{ $cd['name'] ?? 'Potongan Kustom' }}</td>
                        <td class="amount-col">Rp {{ number_format((float)$cd['amount'], 2, ',', '.') }}</td>
                    </tr>
                    @endif
                @endforeach
            @elseif($otherDeduction > 0)
            <tr>
                <td style="padding-left: 15px;">Potongan Lainnya</td>
                <td class="amount-col">Rp {{ number_format($otherDeduction, 2, ',', '.') }}</td>
            </tr>
            @endif
            <tr class="subtotal-row">
                <td>Total Potongan</td>
                <td class="amount-col">Rp {{ number_format($totalDeductions, 2, ',', '.') }}</td>
            </tr>

            <!-- C. Total Gaji Bersih / Take Home Pay -->
            <tr class="total-row">
                <td>Total Gaji Bersih</td>
                <td class="amount-col">Rp {{ number_format($takeHomePay, 2, ',', '.') }}</td>
            </tr>
        </tbody>
    </table>

    <!-- 5. Tanda Tangan / Pengesahan Resmi -->
    <table class="signature-table">
        <tr>
            <td style="width: 50%;"></td>
            <td style="width: 50%;">
                <div class="sign-box">
                    <div class="sign-title">Mengetahui,</div>
                    <div style="font-weight: bold; margin-bottom: 2px;">{{ $companyName }}</div>
                    <div class="sign-space"></div>
                    <div class="sign-title">Direktur Utama</div>
                    <div class="sign-name">({{ $directorName }})</div>
                </div>
            </td>
        </tr>
    </table>
</body>
</html>
