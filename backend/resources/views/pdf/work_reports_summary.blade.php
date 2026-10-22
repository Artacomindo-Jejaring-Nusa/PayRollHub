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
        .photo-thumb {
            max-height: 48px;
            max-width: 80px;
            border-radius: 3px;
            border: 1px solid #cbd5e1;
            display: block;
            margin-top: 3px;
        }
        .photo-link {
            text-decoration: none;
            display: inline-block;
        }
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
                <th style="width: 105px;">Nama Karyawan</th>
                <th style="width: 140px;">1. Absen Masuk</th>
                <th style="width: 140px;">2. Kegiatan 1</th>
                <th style="width: 140px;">3. Kegiatan 2</th>
                <th style="width: 140px;">4. Kegiatan Lain</th>
                <th style="width: 70px;" class="text-center">Status</th>
                <th style="width: 95px;">Catatan HR</th>
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
                    <div style="font-size: 8.5px; line-height: 1.25; margin-bottom: 3px;">{{ $row->desc_absen ?: '-' }}</div>
                    @if(!empty($row->photo_absen_thumb))
                        <a href="{{ $row->photo_absen_url }}" target="_blank" class="photo-link">
                            <img src="{{ $row->photo_absen_thumb }}" class="photo-thumb" alt="Foto Absen" />
                        </a>
                    @elseif($row->photo_absen)
                        <small style="color: #94a3b8; font-style: italic;">[Foto tidak tersedia]</small>
                    @endif
                </td>
                <td>
                    <div style="font-size: 8.5px; line-height: 1.25; margin-bottom: 3px;">{{ $row->desc_kegiatan1 ?: ($row->description ?: '-') }}</div>
                    @if(!empty($row->photo_kegiatan1_thumb))
                        <a href="{{ $row->photo_kegiatan1_url }}" target="_blank" class="photo-link">
                            <img src="{{ $row->photo_kegiatan1_thumb }}" class="photo-thumb" alt="Foto Kegiatan 1" />
                        </a>
                    @elseif($row->photo_kegiatan1 || $row->attachment_path)
                        <small style="color: #94a3b8; font-style: italic;">[Foto tidak tersedia]</small>
                    @endif
                </td>
                <td>
                    <div style="font-size: 8.5px; line-height: 1.25; margin-bottom: 3px;">{{ $row->desc_kegiatan2 ?: '-' }}</div>
                    @if(!empty($row->photo_kegiatan2_thumb))
                        <a href="{{ $row->photo_kegiatan2_url }}" target="_blank" class="photo-link">
                            <img src="{{ $row->photo_kegiatan2_thumb }}" class="photo-thumb" alt="Foto Kegiatan 2" />
                        </a>
                    @elseif($row->photo_kegiatan2)
                        <small style="color: #94a3b8; font-style: italic;">[Foto tidak tersedia]</small>
                    @endif
                </td>
                <td>
                    <div style="font-size: 8.5px; line-height: 1.25; margin-bottom: 3px;">{{ $row->desc_kegiatan_lain ?: '-' }}</div>
                    @if(!empty($row->photo_kegiatan_lain_thumb))
                        <a href="{{ $row->photo_kegiatan_lain_url }}" target="_blank" class="photo-link">
                            <img src="{{ $row->photo_kegiatan_lain_thumb }}" class="photo-thumb" alt="Foto Kegiatan Lain" />
                        </a>
                    @elseif($row->photo_kegiatan_lain)
                        <small style="color: #94a3b8; font-style: italic;">[Foto tidak tersedia]</small>
                    @endif
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
