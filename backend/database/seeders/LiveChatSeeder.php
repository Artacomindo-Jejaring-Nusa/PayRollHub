<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\AiBotKnowledge;
use App\Models\ChatAiToken;

class LiveChatSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Initialise Token AI Live Chat Package
        ChatAiToken::updateOrCreate(
            ['company_name' => 'all'],
            [
                'package_name' => 'Token AI Live Chat (Pro Enterprise)',
                'total_package_price' => 1500000.00, // Rp 1.500.000,00
                'total_quota_tokens' => 150000,
                'used_tokens' => 18450, // default realistic usage
                'is_active' => true,
            ]
        );

        // 2. Pre-seed Knowledge Base for AI Bot
        $knowledges = [
            [
                'category' => 'greeting',
                'intent_code' => 'greeting',
                'title' => 'Sapaan & Pengenalan Bot',
                'keywords' => 'halo, hai, hi, hello, selamat pagi, selamat siang, selamat sore, selamat malam, assalamualaikum, test, tes, bantuan, help',
                'bot_answer' => "Halo! 👋 Saya adalah **AI Virtual Assistant HRD**.\n\nSaya siap membantu menjawab pertanyaan seputar:\n• 💰 **Jadwal & Komponen Slip Gaji**\n• 📍 **Presensi GPS & Geofencing**\n• 📋 **Pengiriman Laporan Kerja**\n• 📑 **Pusat Pengajuan Keluhan**\n\nJika butuh bantuan khusus, Anda juga dapat meminta saya untuk menyambungkan langsung ke **Tim CS / Agent HRD**.",
                'quick_buttons' => [
                    ['label' => '💰 Jadwal Penggajian', 'action' => 'ask_payroll_schedule'],
                    ['label' => '📍 Panduan Absensi GPS', 'action' => 'ask_attendance_guide'],
                    ['label' => '👤 Hubungkan ke CS Live', 'action' => 'request_agent'],
                ],
                'priority' => 10,
            ],
            [
                'category' => 'gaji',
                'intent_code' => 'jadwal_gaji',
                'title' => 'Jadwal & Tanggal Pembayaran Gaji',
                'keywords' => 'jadwal gaji, tanggal gajian, kapan gaji, tanggal berapa gaji cair, gajian kapan, info gajian, pembayaran gaji, cut off',
                'bot_answer' => "💰 **Informasi Jadwal Penggajian:**\n\n1. Pembayaran gaji rutin diproses pada akhir periode bulan berjalan (biasanya antara tanggal **25 hingga tanggal 1** bulan berikutnya).\n2. Periode cut-off absensi dan laporan kerja ditutup sesuai ketentuan SP/jadwal masing-masing sekolah/unit penempatan.\n3. Anda dapat memantau status rincian gaji pada menu **Slip Gaji** di aplikasi mobile atau portal web.",
                'quick_buttons' => [
                    ['label' => '📄 Cara Cek Slip Gaji', 'action' => 'ask_slip_guide'],
                    ['label' => '👤 Tanya CS tentang Gaji', 'action' => 'request_agent'],
                ],
                'priority' => 9,
            ],
            [
                'category' => 'gaji',
                'intent_code' => 'potongan_bpjs',
                'title' => 'Potongan BPJS & Komponen Slip',
                'keywords' => 'potongan bpjs, bpjs kesehatan, bpjs ketenagakerjaan, pph21, pajak, potongan kehadiran, thp berkurang, rincian potongan',
                'bot_answer' => "📋 **Informasi Potongan Slip Gaji:**\n\nPotongan yang tertera pada slip gaji terdiri dari:\n• **BPJS Ketenagakerjaan & Kesehatan**: Iuran resmi sesuai tarif regulasi pemerintah.\n• **Potongan Kehadiran / Terlambat**: Dihitung otomatis dari rekap presensi masuk/pulang.\n• **Potongan Lainnya / PPh**: Penyesuaian khusus atau pinjaman/kasbon jika ada.\n\nUntuk melihat rincian kalkulasi per item, buka menu **Slip Gaji** lalu unduh file PDF resmi.",
                'quick_buttons' => [
                    ['label' => '📄 Ajukan Keluhan Selisih Gaji', 'action' => 'open_complaints'],
                    ['label' => '👤 Hubungkan ke CS', 'action' => 'request_agent'],
                ],
                'priority' => 8,
            ],
            [
                'category' => 'absensi',
                'intent_code' => 'kendala_gps',
                'title' => 'Kendala Presensi GPS & Diluar Radius',
                'keywords' => 'absen ditolak, diluar radius, radius geofencing, gps tidak akurat, tidak bisa absen masuk, titik gps jauh, lokasi salah, gagal presensi',
                'bot_answer' => "📍 **Solusi Kendala Presensi Geofencing (GPS):**\n\n1. Pastikan fitur **Lokasi (GPS) Berakurasi Tinggi** aktif di ponsel Anda.\n2. Berikan izin lokasi *'Izinkan sepanjang waktu'* atau *'Saat aplikasi digunakan'* pada aplikasi HC Attendance.\n3. Jika titik lokasi meleset, coba buka aplikasi Google Maps sebentar agar sinyal GPS terkunci akurat.\n4. Jika lokasi sekolah/unit Anda memang berpindah atau berada di luar batas radius resmi, silakan hubungi tim HRD untuk pembaruan titik koordinat unit.",
                'quick_buttons' => [
                    ['label' => '👤 Minta Admin Update Lokasi', 'action' => 'request_agent'],
                    ['label' => '📑 Buat Keluhan Absensi', 'action' => 'open_complaints'],
                ],
                'priority' => 9,
            ],
            [
                'category' => 'absensi',
                'intent_code' => 'lupa_absen',
                'title' => 'Lupa Absen Masuk atau Pulang',
                'keywords' => 'lupa checkout, lupa absen pulang, lupa checkin, lupa absen masuk, lupa rekam, ketinggalan absen, kemarin tidak absen',
                'bot_answer' => "⏰ **Ketentuan Lupa Presensi:**\n\nJika Anda lupa melakukan Check-In atau Check-Out:\n1. Segera informasikan kepada atasan langsung / koordinator unit Anda.\n2. Buat pengaduan resmi melalui menu **Keluhan Saya** dengan melampirkan bukti surat keterangan hadir atau dokumentasi tugas.\n3. Tim HRD akan memvalidasi data kehadiran manual Anda sebelum cut-off penggajian.",
                'quick_buttons' => [
                    ['label' => '📑 Buka Formulir Keluhan', 'action' => 'open_complaints'],
                    ['label' => '👤 Hubungkan ke CS', 'action' => 'request_agent'],
                ],
                'priority' => 8,
            ],
            [
                'category' => 'laporan',
                'intent_code' => 'panduan_laporan',
                'title' => 'Pengiriman & Validasi Laporan Kerja',
                'keywords' => 'laporan kerja, cara kirim laporan, laporan ditolak, laporan pending, format laporan, upload foto laporan, bukti kerja',
                'bot_answer' => "📋 **Panduan Laporan Kerja Harian:**\n\n1. Masuk ke menu **Laporan Kerja** di aplikasi atau web.\n2. Tekan tombol **Kirim Laporan Baru**.\n3. Isi judul kegiatan, deskripsi pekerjaan harian, dan lampirkan foto dokumentasi kegiatan fisik di lapangan.\n4. Laporan yang dikirim akan diverifikasi oleh Admin/Supervisor dalam waktu 1x24 jam kerja.",
                'quick_buttons' => [
                    ['label' => '👤 Tanya CS tentang Laporan', 'action' => 'request_agent'],
                ],
                'priority' => 7,
            ],
            [
                'category' => 'akun',
                'intent_code' => 'lupa_password',
                'title' => 'Reset Password & Update Profil',
                'keywords' => 'lupa password, ganti sandi, reset password, ubah profil, salah nik, ubah nomor rekening, ganti rekening bank',
                'bot_answer' => "🔒 **Bantuan Akun & Data Pribadi:**\n\n• **Ganti Sandi**: Buka menu Profil / Pengaturan > Keamanan Akun > Ubah Password.\n• **Perubahan NIK / Rekening Bank**: Demi keamanan verifikasi penggajian, perubahan rekening atau NIK wajib divalidasi oleh Tim HRD dengan melampirkan foto buku tabungan/KTP.\n\nSilakan tekan tombol di bawah untuk langsung terhubung dengan CS HRD.",
                'quick_buttons' => [
                    ['label' => '👤 Hubungkan ke CS HRD', 'action' => 'request_agent'],
                ],
                'priority' => 8,
            ],
            [
                'category' => 'agent_request',
                'intent_code' => 'hubungi_cs',
                'title' => 'Permintaan Terhubung ke Agent / CS Human',
                'keywords' => 'hubungi cs, mau bicara sama cs, bicara sama orang, panggil admin, minta nomor cs, sambungkan ke agen, hubungi agent, customer service, human agent',
                'bot_answer' => "Siap! Saya akan segera mengalihkan percakapan Anda ke **Tim Customer Service / Agent HRD** yang sedang bertugas.\n\nSilakan klik tombol **Hubungkan ke CS Live** di bawah ini untuk masuk ke antrean agen.",
                'quick_buttons' => [
                    ['label' => '👤 Hubungkan ke CS Live Sekarang', 'action' => 'request_agent'],
                ],
                'priority' => 10,
            ],
        ];

        foreach ($knowledges as $k) {
            AiBotKnowledge::updateOrCreate(
                ['intent_code' => $k['intent_code']],
                $k
            );
        }
    }
}
