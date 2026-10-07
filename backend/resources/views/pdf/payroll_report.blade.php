<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Laporan Penggajian Karyawan - HRD Mandiri</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 11px;
            color: #1e293b;
            margin: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #004ac6;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .header h1 {
            font-size: 18px;
            margin: 0;
            color: #004ac6;
            text-transform: uppercase;
        }
        .header p {
            margin: 3px 0;
            font-size: 10px;
            color: #64748b;
        }
        .meta-info {
            margin-bottom: 15px;
            font-size: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th, td {
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            text-align: left;
        }
        th {
            background-color: #004ac6;
            color: #ffffff;
            font-weight: bold;
            font-size: 10px;
            text-transform: uppercase;
        }
        tr:nth-child(even) {
            background-color: #f8f9ff;
        }
        .text-right {
            text-align: right;
        }
        .text-center {
            text-align: center;
        }
        .total-row {
            font-weight: bold;
            background-color: #e2e8f0;
        }
        .footer {
            margin-top: 30px;
            font-size: 9px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>HRD Mandiri</h1>
        <p>RBS Global (PT. Rimbun Buana Sejahtera) — Rekapitulasi & Manajemen Penggajian Karyawan</p>
        <p>Laporan Data Gaji Karyawan {{ $period ? 'Periode: ' . $period : '' }} {{ $province ? '| Provinsi: ' . $province : '' }}</p>
    </div>

    <div class="meta-info">
        <strong>Dicetak pada:</strong> {{ now()->format('d F Y, H:i') }} WIB | 
        <strong>Total Karyawan:</strong> {{ count($payrolls) }} orang
    </div>

    <table>
        <thead>
            <tr>
                <th class="text-center" style="width: 25px;">No</th>
                <th>Nama Karyawan</th>
                <th>NIK</th>
                <th>Provinsi</th>
                <th class="text-center">Periode</th>
                <th class="text-right">Gaji Pokok</th>
                <th class="text-right">Tunjangan</th>
                <th class="text-right">Potongan</th>
                <th class="text-right">Take Home Pay</th>
            </tr>
        </thead>
        <tbody>
            @php
                $totalBasic = 0;
                $totalAllowance = 0;
                $totalDeduction = 0;
                $totalThp = 0;
            @endphp
            @forelse($payrolls as $index => $item)
                @php
                    $totalBasic += $item->basic_salary;
                    $totalAllowance += $item->allowance;
                    $totalDeduction += $item->deduction;
                    $totalThp += $item->take_home_pay;
                @endphp
                <tr>
                    <td class="text-center">{{ $index + 1 }}</td>
                    <td><strong>{{ $item->employee_name }}</strong></td>
                    <td>{{ $item->nik }}</td>
                    <td>{{ $item->province }}</td>
                    <td class="text-center">{{ $item->period }}</td>
                    <td class="text-right">Rp {{ number_format($item->basic_salary, 0, ',', '.') }}</td>
                    <td class="text-right">Rp {{ number_format($item->allowance, 0, ',', '.') }}</td>
                    <td class="text-right">Rp {{ number_format($item->deduction, 0, ',', '.') }}</td>
                    <td class="text-right" style="color: #004ac6; font-weight: bold;">Rp {{ number_format($item->take_home_pay, 0, ',', '.') }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="9" class="text-center">Tidak ada data penggajian.</td>
                </tr>
            @endforelse
            @if(count($payrolls) > 0)
                <tr class="total-row">
                    <td colspan="5" class="text-center">TOTAL KESELURUHAN</td>
                    <td class="text-right">Rp {{ number_format($totalBasic, 0, ',', '.') }}</td>
                    <td class="text-right">Rp {{ number_format($totalAllowance, 0, ',', '.') }}</td>
                    <td class="text-right">Rp {{ number_format($totalDeduction, 0, ',', '.') }}</td>
                    <td class="text-right">Rp {{ number_format($totalThp, 0, ',', '.') }}</td>
                </tr>
            @endif
        </tbody>
    </table>

    <div class="footer">
        <span>HRD Mandiri (RBS Global) — Dokumen resmi yang dihasilkan oleh sistem otomatis.</span>
    </div>
</body>
</html>
