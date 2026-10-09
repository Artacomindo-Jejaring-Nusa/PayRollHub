<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Rekap Laporan Kerja Karyawan</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 10px;
            color: #1e293b;
            margin: 15px;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #004ac6;
            padding-bottom: 8px;
            margin-bottom: 15px;
        }
        .header h1 {
            font-size: 16px;
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
            margin-bottom: 12px;
            font-size: 9.5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        th, td {
            border: 1px solid #cbd5e1;
            padding: 5px 6px;
            text-align: left;
            vertical-align: top;
        }
        th {
            background-color: #004ac6;
            color: #ffffff;
            font-weight: bold;
            font-size: 9px;
            text-transform: uppercase;
        }
        tr:nth-child(even) {
            background-color: #f8fafc;
        }
        .text-center {
            text-align: center;
        }
        .badge {
            display: inline-block;
            padding: 2px 5px;
            border-radius: 4px;
            font-size: 8.5px;
            font-weight: bold;
        }
        .badge-approved { background-color: #dcfce7; color: #166534; }
        .badge-rejected { background-color: #fee2e2; color: #991b1b; }
        .badge-pending { background-color: #fef3c7; color: #92400e; }
        .footer {
            font-size: 8.5px;
            color: #94a3b8;
            text-align: right;
            margin-top: 15px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>REKAPITULASI LAPORAN KERJA KARYAWAN</h1>
        <p>Portal Administrasi & Operasional HRD Mandiri</p>
    </div>

    <div class="meta-info">
        <strong>Tanggal Cetak:</strong> {{ date('d F Y H:i') }} WIB | 
        <strong>Total Laporan:</strong> {{ count($reports) }} Data
        @if(!empty($filterDate))
            | <strong>Filter Tanggal:</strong> {{ date('d/m/Y', strtotime($filterDate)) }}
        @endif
        @if(!empty($filterStatus) && $filterStatus !== 'all')
            | <strong>Filter Status:</strong> {{ strtoupper($filterStatus) }}
        @endif
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 25px;" class="text-center">No</th>
                <th style="width: 65px;">Tanggal</th>
                <th style="width: 70px;">NIK</th>
                <th style="width: 110px;">Nama Karyawan</th>
                <th>1. Absen Masuk</th>
                <th>2. Kegiatan 1</th>
                <th>3. Kegiatan 2</th>
                <th>4. Kegiatan Lain</th>
                <th style="width: 75px;" class="text-center">Status</th>
                <th style="width: 100px;">Catatan HR</th>
            </tr>
        </thead>
        <tbody>
            @forelse($reports as $index => $row)
            <tr>
                <td class="text-center">{{ $index + 1 }}</td>
                <td>{{ $row->report_date ? date('d/m/Y', strtotime($row->report_date)) : '-' }}</td>
                <td>{{ $row->nik ?? '-' }}</td>
                <td>
                    <strong>{{ $row->user?->name ?? 'Karyawan' }}</strong><br>
                    <span style="color: #64748b; font-size: 8.5px;">{{ $row->user?->company === 'rimamandiri' ? 'Riama Mandiri' : 'RBS Global' }}</span>
                </td>
                <td>
                    {{ $row->desc_absen ?: '-' }}
                    @if($row->photo_absen) <br><small style="color: #0284c7;">[Ada Foto]</small> @endif
                </td>
                <td>
                    {{ $row->desc_kegiatan1 ?: ($row->description ?: '-') }}
                    @if($row->photo_kegiatan1 || $row->attachment_path) <br><small style="color: #0284c7;">[Ada Foto]</small> @endif
                </td>
                <td>
                    {{ $row->desc_kegiatan2 ?: '-' }}
                    @if($row->photo_kegiatan2) <br><small style="color: #0284c7;">[Ada Foto]</small> @endif
                </td>
                <td>
                    {{ $row->desc_kegiatan_lain ?: '-' }}
                    @if($row->photo_kegiatan_lain) <br><small style="color: #0284c7;">[Ada Foto]</small> @endif
                </td>
                <td class="text-center">
                    @if($row->status === 'approved')
                        <span class="badge badge-approved">Disetujui</span>
                    @elseif($row->status === 'rejected')
                        <span class="badge badge-rejected">Perlu Revisi</span>
                    @else
                        <span class="badge badge-pending">Menunggu</span>
                    @endif
                </td>
                <td>{{ $row->feedback ?: '-' }}</td>
            </tr>
            @empty
            <tr>
                <td colspan="10" class="text-center" style="padding: 15px;">Tidak ada data laporan kerja yang ditemukan.</td>
            </tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">
        Dicetak secara otomatis oleh Sistem HRD Mandiri pada {{ date('d/m/Y H:i:s') }}
    </div>
</body>
</html>
