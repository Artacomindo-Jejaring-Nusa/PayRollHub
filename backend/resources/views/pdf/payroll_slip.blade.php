<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Slip Gaji - {{ $payroll->employee_name }} ({{ $payroll->period }})</title>
    @php
        $isRima = ($payroll->company ?? 'rbs') === 'rimamandiri';
        $brandColor = $isRima ? '#065f46' : '#004ac6';
        $brandBg = $isRima ? '#ecfdf5' : '#eff4ff';
        $companyName = $isRima ? 'PT. Riama Mandiri Pratama' : 'RBS Global (PT. Rimbun Buana Sejahtera)';
        $domainName = $isRima ? 'riamamandiripratama.com' : 'rimbunbuanasejahtera.com';
    @endphp
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 11.5px;
            color: #0f172a;
            margin: 24px;
        }
        .header {
            border-bottom: 2px solid {{ $brandColor }};
            padding-bottom: 12px;
            margin-bottom: 16px;
        }
        .company-name {
            font-size: 18px;
            font-weight: bold;
            color: {{ $brandColor }};
            margin: 0;
        }
        .doc-title {
            font-size: 12px;
            color: #475569;
            margin: 3px 0 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .status-badge {
            display: inline-block;
            padding: 3px 8px;
            font-size: 10px;
            font-weight: bold;
            border-radius: 4px;
            text-transform: uppercase;
        }
        .status-active {
            background-color: #ecfdf5;
            color: #047857;
            border: 1px solid #a7f3d0;
        }
        .status-off {
            background-color: #fef2f2;
            color: #b91c1c;
            border: 1px solid #fecaca;
        }
        .grid-info {
            width: 100%;
            margin-bottom: 16px;
            border-collapse: collapse;
        }
        .grid-info td {
            padding: 4px 4px;
            vertical-align: top;
            font-size: 11px;
        }
        .label {
            color: #64748b;
            width: 140px;
        }
        .value {
            font-weight: 600;
        }
        .breakdown-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
        }
        .breakdown-table th {
            background-color: {{ $brandColor }};
            color: #ffffff;
            padding: 7px 10px;
            text-align: left;
            font-size: 10.5px;
            text-transform: uppercase;
        }
        .breakdown-table td {
            padding: 6.5px 10px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 11px;
        }
        .amount {
            text-align: right;
            font-family: Courier, monospace;
            font-size: 11.5px;
        }
        .total-box {
            background-color: {{ $brandBg }};
            border: 2px solid {{ $brandColor }};
            border-radius: 6px;
            padding: 10px 14px;
            margin-top: 10px;
        }
        .total-title {
            font-size: 12px;
            font-weight: bold;
            color: {{ $brandColor }};
        }
        .total-amount {
            font-size: 17px;
            font-weight: bold;
            color: {{ $brandColor }};
            text-align: right;
            font-family: Courier, monospace;
        }
        .signature-section {
            margin-top: 36px;
            width: 100%;
        }
        .signature-box {
            width: 45%;
            float: right;
            text-align: center;
            font-size: 11px;
        }
        .sign-line {
            margin-top: 48px;
            border-top: 1px solid #64748b;
            font-weight: bold;
            padding-top: 4px;
        }
    </style>
</head>
<body>
    <div class="header">
        <table style="width: 100%;">
            <tr>
                <td>
                    <h1 class="company-name">HRD Mandiri</h1>
                    <div style="font-size: 11px; color: #475569; font-weight: 600; margin-top: 2px;">{{ $companyName }}</div>
                    <div class="doc-title">SLIP GAJI TENAGA KEPENDIDIKAN (CONFIDENTIAL)</div>
                </td>
                <td style="text-align: right;">
                    <div style="font-size: 11px; color: #64748b;">Periode Pembayaran</div>
                    <div style="font-size: 14px; font-weight: bold; color: {{ $brandColor }}; margin-bottom: 4px;">{{ $payroll->period }}</div>
                    @if($payroll->status === 'off')
                        <span class="status-badge status-off">Non-Aktif / Off</span>
                    @else
                        <span class="status-badge status-active">Aktif</span>
                    @endif
                </td>
            </tr>
        </table>
    </div>

    <table class="grid-info">
        <tr>
            <td class="label">Nama Lengkap</td>
            <td class="value">: {{ $payroll->employee_name }}</td>
            <td class="label">Wilayah (Provinsi)</td>
            <td class="value">: {{ $payroll->province }}</td>
        </tr>
        <tr>
            <td class="label">Nomor Induk (NIK)</td>
            <td class="value">: {{ $payroll->nik ?: '-' }}</td>
            <td class="label">Unit / Sekolah Rakyat</td>
            <td class="value">: {{ $payroll->school_unit ?: '-' }}</td>
        </tr>
        <tr>
            <td class="label">Jabatan / Fungsi</td>
            <td class="value">: {{ $payroll->position ?: '-' }}</td>
            <td class="label">Tanggal Masuk</td>
            <td class="value">: {{ $payroll->join_date ?: '-' }}</td>
        </tr>
        <tr>
            <td class="label">Rekening Bank</td>
            <td class="value">: {{ $payroll->bank_name ?: '-' }} - {{ $payroll->bank_account ?: '-' }}</td>
            <td class="label">Status & Tgl Keluar</td>
            <td class="value">: {{ $payroll->status === 'off' ? 'OFF' . ($payroll->resign_date ? ' (' . $payroll->resign_date . ')' : '') : 'Aktif Bekerja' }}</td>
        </tr>
    </table>

    <table class="breakdown-table">
        <thead>
            <tr>
                <th>Komponen Penghasilan & Potongan</th>
                <th style="text-align: right;">Jumlah (IDR)</th>
            </tr>
        </thead>
        <tbody>
            @if($payroll->net_base_price > 0)
            <tr style="background-color: #f8fafc;">
                <td><strong>Harga Dasar (setelah potong PPh & Fee manajemen)</strong></td>
                <td class="amount"><strong>Rp {{ number_format($payroll->net_base_price, 0, ',', '.') }}</strong></td>
            </tr>
            <tr>
                <td style="padding-left: 20px; color: #475569;">• Potongan BPJS KES 5%</td>
                <td class="amount" style="color: #475569;">- Rp {{ number_format($payroll->bpjs_kes, 0, ',', '.') }}</td>
            </tr>
            <tr>
                <td style="padding-left: 20px; color: #475569;">• Potongan BPJS TK 9,24%</td>
                <td class="amount" style="color: #475569;">- Rp {{ number_format($payroll->bpjs_tk, 0, ',', '.') }}</td>
            </tr>
            <tr>
                <td><strong>Gaji Pokok Bersih (Net)</strong></td>
                <td class="amount" style="font-weight: bold; color: {{ $brandColor }};">Rp {{ number_format($payroll->basic_salary, 0, ',', '.') }}</td>
            </tr>
            @else
            <tr>
                <td>Gaji Pokok / Hak Jasa Kependidikan</td>
                <td class="amount">Rp {{ number_format($payroll->basic_salary, 0, ',', '.') }}</td>
            </tr>
            @endif

            @if($payroll->allowance > 0)
            <tr>
                <td>Tunjangan & Lembur</td>
                <td class="amount" style="color: #047857;">+ Rp {{ number_format($payroll->allowance, 0, ',', '.') }}</td>
            </tr>
            @endif

            @if($payroll->deduction > 0)
            <tr>
                <td style="color: #dc2626;">Potongan Lainnya</td>
                <td class="amount" style="color: #dc2626;">- Rp {{ number_format($payroll->deduction, 0, ',', '.') }}</td>
            </tr>
            @endif

            @if($payroll->absence_deduction > 0)
            <tr>
                <td style="color: #dc2626;">
                    Potongan Absensi
                    @if($payroll->absence_count > 0) ({{ $payroll->absence_count }}x) @endif
                    @if($payroll->absence_note) - <em>{{ $payroll->absence_note }}</em> @endif
                </td>
                <td class="amount" style="color: #dc2626;">- Rp {{ number_format($payroll->absence_deduction, 0, ',', '.') }}</td>
            </tr>
            @endif
        </tbody>
    </table>

    <div class="total-box">
        <table style="width: 100%;">
            <tr>
                <td class="total-title">TOTAL GAJI DITERIMA (TAKE HOME PAY)</td>
                <td class="total-amount">Rp {{ number_format($payroll->take_home_pay, 0, ',', '.') }}</td>
            </tr>
        </table>
    </div>

    <div class="signature-section">
        <div class="signature-box">
            <div>Disahkan oleh HR & Finance,</div>
            <div class="sign-line">{{ $companyName }}</div>
        </div>
    </div>
</body>
</html>
