<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Lembar Laporan Kerja Karyawan - {{ $report->user?->name }}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 11px;
            color: #1e293b;
            margin: 20px;
        }
        .header {
            border-bottom: 2px solid #004ac6;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        .company-title {
            font-size: 16px;
            font-weight: bold;
            color: #004ac6;
            text-transform: uppercase;
        }
        .doc-title {
            font-size: 13px;
            font-weight: bold;
            color: #334155;
            margin-top: 3px;
        }
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
        }
        .info-table td {
            padding: 6px 10px;
            font-size: 10.5px;
        }
        .info-label {
            width: 120px;
            color: #64748b;
            font-weight: bold;
        }
        .grid-container {
            width: 100%;
            margin-bottom: 15px;
        }
        .activity-card {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            margin-bottom: 12px;
            background-color: #ffffff;
            overflow: hidden;
        }
        .activity-header {
            background-color: #f1f5f9;
            padding: 6px 10px;
            font-weight: bold;
            font-size: 11px;
            color: #0f172a;
            border-bottom: 1px solid #e2e8f0;
        }
        .activity-body {
            padding: 10px;
        }
        .activity-desc {
            font-size: 10.5px;
            line-height: 1.5;
            color: #334155;
            margin-bottom: 8px;
        }
        .activity-photo {
            max-height: 160px;
            max-width: 240px;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
        }
        .review-box {
            border: 1px solid #fde68a;
            background-color: #fefce8;
            padding: 10px;
            border-radius: 6px;
            margin-top: 15px;
        }
        .review-title {
            font-weight: bold;
            color: #854d0e;
            font-size: 11px;
            margin-bottom: 4px;
        }
        .signature-table {
            width: 100%;
            margin-top: 30px;
            border-collapse: collapse;
        }
        .signature-table td {
            width: 50%;
            text-align: center;
            vertical-align: top;
            padding: 10px;
        }
        .signature-space {
            height: 60px;
        }
    </style>
</head>
<body>
    <div class="header">
        <table style="width: 100%;">
            <tr>
                <td>
                    <div class="company-title">
                        {{ $report->user?->company === 'rimamandiri' ? 'PT. RIAMA MANDIRI PRATAMA' : 'PT. RIMBUN BUANA SEJAHTERA' }}
                    </div>
                    <div class="doc-title">LEMBAR BUKTI LAPORAN KERJA HARIAN</div>
                </td>
                <td style="text-align: right; vertical-align: bottom;">
                    <div style="font-size: 10px; color: #64748b;">
                        Tanggal: <strong>{{ date('d F Y', strtotime($report->report_date)) }}</strong><br>
                        Status: <strong>{{ strtoupper($report->status) }}</strong>
                    </div>
                </td>
            </tr>
        </table>
    </div>

    <!-- Informasi Karyawan -->
    <table class="info-table">
        <tr>
            <td class="info-label">Nama Karyawan:</td>
            <td><strong>{{ $report->user?->name ?? 'Karyawan' }}</strong></td>
            <td class="info-label">Tanggal Laporan:</td>
            <td>{{ date('d/m/Y', strtotime($report->report_date)) }}</td>
        </tr>
        <tr>
            <td class="info-label">NIK:</td>
            <td>{{ $report->nik ?? '-' }}</td>
            <td class="info-label">Nomor WhatsApp:</td>
            <td>{{ $report->user?->phone ?? '-' }}</td>
        </tr>
        <tr>
            <td class="info-label">Perusahaan:</td>
            <td>{{ $report->user?->company === 'rimamandiri' ? 'Riama Mandiri' : 'RBS Global' }}</td>
            <td class="info-label">Status Evaluasi:</td>
            <td>
                @if($report->status === 'approved')
                    <span style="color: #166534; font-weight: bold;">Disetujui (Approved)</span>
                @elseif($report->status === 'rejected')
                    <span style="color: #991b1b; font-weight: bold;">Perlu Revisi (Rejected)</span>
                @else
                    <span style="color: #92400e; font-weight: bold;">Menunggu Review</span>
                @endif
            </td>
        </tr>
    </table>

    <!-- 4 Bagian Kegiatan -->
    <table style="width: 100%; border-collapse: collapse;">
        <!-- Baris 1: Absen & Kegiatan 1 -->
        <tr>
            <td style="width: 50%; vertical-align: top; padding-right: 6px; padding-bottom: 10px;">
                <div class="activity-card">
                    <div class="activity-header">1. ABSEN MASUK (FOTO MASUK BERTUGAS)</div>
                    <div class="activity-body">
                        <div class="activity-desc"><strong>Rincian:</strong><br>{{ $report->desc_absen ?: '-' }}</div>
                        @if(!empty($photos['absen']))
                            <img src="{{ $photos['absen'] }}" class="activity-photo" alt="Foto Absen Masuk">
                        @else
                            <div style="color: #94a3b8; font-style: italic; font-size: 10px;">Tidak ada lampiran foto</div>
                        @endif
                    </div>
                </div>
            </td>
            <td style="width: 50%; vertical-align: top; padding-left: 6px; padding-bottom: 10px;">
                <div class="activity-card">
                    <div class="activity-header">2. KEGIATAN 1 (AKTIVITAS UTAMA)</div>
                    <div class="activity-body">
                        <div class="activity-desc"><strong>Rincian:</strong><br>{{ $report->desc_kegiatan1 ?: ($report->description ?: '-') }}</div>
                        @if(!empty($photos['kegiatan1']))
                            <img src="{{ $photos['kegiatan1'] }}" class="activity-photo" alt="Foto Kegiatan 1">
                        @else
                            <div style="color: #94a3b8; font-style: italic; font-size: 10px;">Tidak ada lampiran foto</div>
                        @endif
                    </div>
                </div>
            </td>
        </tr>
        <!-- Baris 2: Kegiatan 2 & Kegiatan Lain -->
        <tr>
            <td style="width: 50%; vertical-align: top; padding-right: 6px;">
                <div class="activity-card">
                    <div class="activity-header">3. KEGIATAN 2 (AKTIVITAS KEDUA)</div>
                    <div class="activity-body">
                        <div class="activity-desc"><strong>Rincian:</strong><br>{{ $report->desc_kegiatan2 ?: '-' }}</div>
                        @if(!empty($photos['kegiatan2']))
                            <img src="{{ $photos['kegiatan2'] }}" class="activity-photo" alt="Foto Kegiatan 2">
                        @else
                            <div style="color: #94a3b8; font-style: italic; font-size: 10px;">Tidak ada lampiran foto</div>
                        @endif
                    </div>
                </div>
            </td>
            <td style="width: 50%; vertical-align: top; padding-left: 6px;">
                <div class="activity-card">
                    <div class="activity-header">4. KEGIATAN LAIN (OPSIONAL)</div>
                    <div class="activity-body">
                        <div class="activity-desc"><strong>Rincian:</strong><br>{{ $report->desc_kegiatan_lain ?: '-' }}</div>
                        @if(!empty($photos['kegiatan_lain']))
                            <img src="{{ $photos['kegiatan_lain'] }}" class="activity-photo" alt="Foto Kegiatan Lain">
                        @else
                            <div style="color: #94a3b8; font-style: italic; font-size: 10px;">Tidak ada lampiran foto</div>
                        @endif
                    </div>
                </div>
            </td>
        </tr>
    </table>

    <!-- Feedback Evaluasi -->
    @if($report->feedback)
    <div class="review-box">
        <div class="review-title">Catatan Evaluasi / Feedback dari HR ({{ $report->reviewer?->name ?? 'Admin' }}):</div>
        <div style="font-size: 10.5px; color: #713f12;">{{ $report->feedback }}</div>
    </div>
    @endif

    <!-- Tanda Tangan -->
    <table class="signature-table">
        <tr>
            <td>
                <div>Karyawan Pelapor,</div>
                <div class="signature-space"></div>
                <div><strong>({{ $report->user?->name ?? 'Karyawan' }})</strong></div>
            </td>
            <td>
                <div>Diverifikasi & Disetujui Oleh,</div>
                <div class="signature-space"></div>
                <div><strong>({{ $report->reviewer?->name ?? 'Tim HRD / Supervisor' }})</strong></div>
            </td>
        </tr>
    </table>
</body>
</html>
