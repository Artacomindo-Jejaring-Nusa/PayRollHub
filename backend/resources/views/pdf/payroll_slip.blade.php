<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Slip Gaji - {{ $payroll->employee_name }} ({{ $payroll->period }})</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            color: #0f172a;
            margin: 25px;
        }
        .header {
            border-bottom: 2px solid #004ac6;
            padding-bottom: 12px;
            margin-bottom: 18px;
        }
        .company-name {
            font-size: 18px;
            font-weight: bold;
            color: #004ac6;
            margin: 0;
        }
        .doc-title {
            font-size: 13px;
            color: #475569;
            margin: 3px 0 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .grid-info {
            width: 100%;
            margin-bottom: 20px;
            border-collapse: collapse;
        }
        .grid-info td {
            padding: 5px 4px;
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
            margin-bottom: 20px;
        }
        .breakdown-table th {
            background-color: #004ac6;
            color: #ffffff;
            padding: 8px 10px;
            text-align: left;
            font-size: 11px;
            text-transform: uppercase;
        }
        .breakdown-table td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 11px;
        }
        .amount {
            text-align: right;
            font-family: Courier, monospace;
            font-size: 12px;
        }
        .total-box {
            background-color: #eff4ff;
            border: 2px solid #004ac6;
            border-radius: 6px;
            padding: 12px;
            margin-top: 10px;
        }
        .total-title {
            font-size: 13px;
            font-weight: bold;
            color: #004ac6;
        }
        .total-amount {
            font-size: 18px;
            font-weight: bold;
            color: #004ac6;
            text-align: right;
            font-family: Courier, monospace;
        }
        .signature-section {
            margin-top: 40px;
            width: 100%;
        }
        .signature-box {
            width: 45%;
            float: right;
            text-align: center;
            font-size: 11px;
        }
        .sign-line {
            margin-top: 50px;
            border-top: 1px solid #64748b;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="header">
        <table style="width: 100%;">
            <tr>
                <td>
                    <h1 class="company-name">HRD Mandiri</h1>
                    <div style="font-size: 11px; color: #475569; font-weight: 600; margin-top: 2px;">RBS Global (PT. Rimbun Buana Sejahtera)</div>
                    <div class="doc-title">SLIP GAJI TENAGA KEPENDIDIKAN (CONFIDENTIAL)</div>
                </td>
                <td style="text-align: right;">
                    <div style="font-size: 11px; color: #64748b;">Periode Pembayaran</div>
                    <div style="font-size: 15px; font-weight: bold; color: #004ac6;">{{ $payroll->period }}</div>
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
            <td class="label">Tanggal Cetak</td>
            <td class="value">: {{ now()->format('d/m/Y H:i') }} WIB</td>
        </tr>
    </table>

    <table class="breakdown-table">
        <thead>
            <tr>
                <th>Komponen Penghasilan</th>
                <th style="text-align: right;">Jumlah (IDR)</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Gaji Pokok / Hak Jasa</td>
                <td class="amount">Rp {{ number_format($payroll->basic_salary, 0, ',', '.') }}</td>
            </tr>
            @if($payroll->allowance > 0)
            <tr>
                <td>Tunjangan & Lembur</td>
                <td class="amount">+ Rp {{ number_format($payroll->allowance, 0, ',', '.') }}</td>
            </tr>
            @endif
            @if($payroll->deduction > 0)
            <tr>
                <td style="color: #dc2626;">Potongan (BPJS / Pajak / Absensi)</td>
                <td class="amount" style="color: #dc2626;">- Rp {{ number_format($payroll->deduction, 0, ',', '.') }}</td>
            </tr>
            @endif
        </tbody>
    </table>

    <div class="total-box">
        <table style="width: 100%;">
            <tr>
                <td class="total-title">TAKE HOME PAY (DITERIMA)</td>
                <td class="total-amount">Rp {{ number_format($payroll->take_home_pay, 0, ',', '.') }}</td>
            </tr>
        </table>
    </div>

    <div class="signature-section">
        <div class="signature-box">
            <div>Disahkan oleh HR & Finance,</div>
            <div class="sign-line">RBS Global (PT. Rimbun Buana Sejahtera)</div>
        </div>
    </div>
</body>
</html>
