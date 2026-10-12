# PayRollHub — HRD Mandiri (RBS Global)

Sistem Rekapitulasi & Manajemen Penggajian Karyawan modern, cepat, dan aman berbasis **Laravel 12 REST API** dan **React 18 + Vite (SPA)** dengan Tailwind CSS.

---

## 🚀 Fitur Utama

- **Dashboard Analytics**: Sebaran penggajian per wilayah provinsi, ringkasan beban gaji pokok, tunjangan, potongan, dan Take Home Pay (THP).
- **Format Resmi Penggajian 2026 (Poin 15 & 16)**:
  - **Kalkulasi Live Take Home Pay**:
    $$\text{THP} = (\text{Gaji Pokok} + \text{BPJS Kes} + \text{Tunjangan}) - (\text{Potongan Absensi} + \text{Potongan Kustom} + \text{PPh 21})$$
  - **Presensi di Penggajian**: Input **Jumlah Absen Masuk** dan **Jumlah Libur**, dilengkapi tombol cepat **"Tarik dari Rekap Absensi"** yang otomatis menghitung riwayat kehadiran karyawan.
  - **Potongan Absensi Fleksibel**: Pilihan kelipatan hari alpa/mangkir $\times$ tarif potongan per hari (default Rp 50.000) = otomatis menghitung nominal potongan.
  - **Keterangan Absensi**: Input catatan alasan mangkir/izin untuk transparansi data.
  - **Potongan Kustom / Dinamis**: Admin dapat menambahkan baris potongan tak terbatas (Kasbon, Seragam, Koperasi, Denda, dll).
  - **BPJS Ketenagakerjaan Non-Potongan**: BPJS TK JHT (2%) & JP (1%) dicairkan terpisah dan tidak memotong gaji diterima (THP).

- **Manajemen & Rekapitulasi Absensi (Poin 6, 7, & 13)**:
  - **Rekapitulasi per SP 1 s/d SP 9 (Poin 6)**: Rekap otomatis kehadiran per periode SP untuk seluruh karyawan (Total Masuk, Libur, Terlambat, Izin, Alpa).
  - **Koreksi & Edit Presensi oleh Admin (Poin 7)**: Admin dapat mengubah riwayat absensi karyawan (jam check-in/out, tipe absensi: masuk/dinas luar/libur, status kehadiran, dan catatan revisi).
  - **Laporan Karyawan Pilihan (Poin 13)**: Fitur centang (checkbox) pada tabel rekap absensi. Admin dapat memilih karyawan tertentu saja untuk di-generate ke laporan Excel/PDF.

- **Import Excel Cerdas & Auto-Normalisasi Periode**:
  - Bulk import data penggajian dari file Excel (.xlsx, .xls) dan CSV.
  - **Auto-Normalisasi Format Periode**: Sistem otomatis menormalkan periode seperti `2026-01`, `Januari 2026`, atau `SP1` menjadi format bersih standar `SP 1` untuk mencegah data terpecah di database.
  - Export rekapitulasi data ke format Excel (.xlsx), CSV, dan PDF Landscape.
  - Cetak & unduh Slip Gaji individual resmi format PDF (Confidential).

- **Role-Based Access Control (RBAC)**:
  - **Super Admin**: Akses penuh lintas entitas perusahaan (RBS & Riama Mandiri) serta pengawasan Activity Log.
  - **Admin**: Akses penuh ke seluruh fitur entitas perusahaan terkait.
  - **User / Karyawan**: Portal Karyawan mandiri untuk absensi selfie geolokasi radius 100+ titik, cek slip gaji, laporan kerja harian, dan tiket keluhan.

---

# 📋 PANDUAN PENGGUNAAN FITUR BARU & SOP (PM / HRD GUIDE)

Semua fitur ini dirancang saling terhubung otomatis dari hulu ke hilir:  
**Rekap Absensi SP $\rightarrow$ Koreksi Data Presensi $\rightarrow$ Hitungan Gaji & Potongan $\rightarrow$ Terbit Slip Gaji Resmi**.

---

## 🔹 BAGIAN 1: Rekap Absensi SP 1 - 9 & Export Karyawan Tertentu (Poin 6 & 13)

Fitur ini digunakan saat Admin/HRD ingin merekap kehadiran karyawan per periode SP dan mencetak laporan **hanya untuk karyawan tertentu** (tidak harus semua).

### Langkah-langkah:
1. Buka menu **Kelola Absensi** di sidebar kiri.
2. Di bagian atas, pilih tab **Rekapitulasi Karyawan** (atau **Rekap SP**).
3. **Pilih Periode SP:** Pada dropdown filter periode, pilih SP yang ingin dilihat (contoh: **SP 1**, **SP 2**, s/d **SP 9**).
   * Sistem akan langsung menampilkan daftar seluruh karyawan di SP tersebut beserta rekap: **Total Hadir Masuk**, **Total Libur**, **Terlambat**, **Izin**, dan **Alpa**.
4. **Pilih Karyawan yang Ingin Dicetak (Poin 13):**
   * Di sebelah kiri setiap nama karyawan, terdapat **kotak centang (checkbox)**.
   * Cukup centang karyawan yang ingin dimasukkan ke laporan (misal Anda hanya ingin 5 orang dari 68 orang).
   * *Tips:* Tersedia tombol **Pilih Semua (Select All)** di baris header jika ingin memilih seluruhnya sekaligus.
5. **Download Laporan:**
   * Di pojok kanan atas (atau pada floating bar), klik tombol:
     👉 **`Export Excel (X Terpilih)`** atau **`Export PDF`**.
   * File Excel/PDF yang terunduh **hanya akan berisi nama-nama karyawan yang tadi Anda centang saja**.

---

## 🔹 BAGIAN 2: Cara Admin Mengedit Absensi Karyawan (Poin 7)

Fitur ini digunakan jika ada karyawan yang lupa absen, salah klik, atau ada izin/dispensasi tugas dinas luar dari atasan.

### Langkah-langkah:
1. Di menu **Kelola Absensi**, buka tab **Riwayat Presensi** (Log Harian Presensi).
2. Cari nama karyawan atau tanggal yang ingin dikoreksi menggunakan kolom pencarian / filter.
3. Pada baris karyawan tersebut, di kolom paling kanan (**Aksi**), klik tombol **Ikon Pensil (Edit Presensi)**.
4. **Modal Edit Presensi akan terbuka:**
   * **Ubah Tipe Absensi:** Bisa diganti antara `Masuk Kerja`, `Dinas Luar`, atau `Hari Libur/Off`.
   * **Ubah Jam Check-In & Check-Out:** Bisa dikoreksi jam masuk/pulangnya (contoh: dari `08.15` diubah jadi `07.55`).
   * **Ubah Status Kehadiran:** Bisa dipilih `Hadir Tepat Waktu`, `Terlambat`, `Izin`, `Sakit`, atau `Alpa/Mangkir`.
   * **Catatan Admin:** Masukkan keterangan alasan perubahan (contoh: *"Revisi jam masuk karena kendala GPS / tugas luar kota"*).
5. Klik **Simpan Perubahan Presensi**.
   * Data absensi karyawan langsung ter-update seketika di sistem dan otomatis tercermin pada rekap SP.

---

## 🔹 BAGIAN 3: Penggajian, Potongan Absensi, & Take Home Pay (Poin 15 & 16)

Fitur ini adalah inti dari penggajian bulanan agar potongan dan gaji yang diterima terhitung otomatis secara transparan dan akurat.

### Langkah-langkah:
1. Buka menu **Data Penggajian** $\rightarrow$ klik tombol **Edit** (ikon pensil) pada karyawan yang ingin diatur gajinya (atau klik **+ Tambah Data** jika input baru).
2. Scroll ke bawah sampai menemukan bagian:
   > ### **4. Potongan Absensi & Take Home Pay**

3. **Isi Hari Masuk & Libur (Poin 15):**
   * Di form tersedia 2 field:
     * **Jumlah Absen Masuk (Hari)**: Total hari karyawan masuk bekerja.
     * **Jumlah Libur (Hari)**: Total hari libur resmi/off karyawan.
   * 🌟 **FITUR OTOMATIS (Tombol Pintas):**
     Cukup klik tombol hijau **`Tarik dari Rekap Absensi`**!  
     Sistem akan otomatis menghitung riwayat kehadiran karyawan tersebut pada SP berjalan, lalu mengisi angka Hari Masuk dan Libur secara instan tanpa perlu Anda hitung manual.

4. **Tentukan Potongan Absensi / Alpa (Poin 16):**
   * **Kelipatan Absensi (Hari Tidak Masuk):** Pilih berapa hari karyawan mangkir (misal: `2x`).
   * **Potongan Tarif per Hari (Rp):** Ketik tarif dendanya (default Rp 50.000).
   * **Total Potongan Absensi:** Sistem langsung menghitung otomatis:
     $$\text{Total Potongan} = \text{Hari Mangkir} \times \text{Tarif per Hari} \quad (\text{contoh: } 2 \times \text{Rp } 50.000 = \mathbf{\text{Rp } 100.000})$$
   * **Keterangan Absensi:** Ketik catatan jika diperlukan (misal: *"Izin 2 hari tanpa surat keterangan dokter"*).

5. **Tambah Potongan Lain / Kustom Fleksibel (Poin 16):**
   * Jika karyawan memiliki potongan kasbon, seragam, denda, atau koperasi:
     * Klik tombol **`+ Tambah Potongan`**.
     * Ketik nama potongan (misal: *"Kasbon Pinjaman"*).
     * Masukkan nominalnya (misal: `200000`).
     * Anda dapat menambahkan baris potongan kustom sebanyak yang dibutuhkan.

6. **Lihat Hasil Live Take Home Pay (THP):**
   * Perhatikan kotak hijau besar **TOTAL TAKE HOME PAY (BERSIH)** di bagian bawah formulir:
     $$\text{THP} = (\text{Gaji Pokok} + \text{BPJS Kes} + \text{Tunjangan}) - (\text{Potongan Absensi} + \text{Potongan Kustom} + \text{PPh 21})$$
   * Nilai gaji bersih ini akan **langsung berubah secara live** setiap kali ada input angka yang Anda ubah.

7. Klik tombol biru di kanan bawah: **Simpan Perubahan**.

---

## 🔹 BAGIAN 4: Hasil Akhir di Halaman Detail & Slip Gaji

Setelah disimpan:
1. Buka halaman **Detail Gaji** karyawan tersebut (`/payrolls/{id}`).
2. Anda akan melihat:
   * **Kartu Identitas Karyawan:** Menampilkan *"Rekap Kehadiran: Hadir Masuk: 22 hari • Libur: 4 hari"*.
   * **Tabel Rincian Potongan:** Menampilkan potongan absensi beserta keterangannya, serta rincian seluruh potongan kustom.
   * **Kotak Hijau TOTAL GAJI DITERIMA:** Menampilkan nominal Take Home Pay yang sudah bersih setelah dipotong absensi dan potongan kustom.
   * **BPJS Ketenagakerjaan Non-Potongan:** JHT & JP ditampilkan rapi di bagian bawah sebagai klaim yang dapat dicairkan terpisah.

---

## 💡 Rekomendasi Alur Kerja Bulanan HRD / Payroll Officer:
1. **Akhir Bulan / Tutup Periode SP:** Buka menu *Kelola Absensi* $\rightarrow$ Koreksi jika ada data presensi yang belum lengkap atau salah (fitur edit presensi).
2. **Download Laporan Kehadiran:** Centang karyawan yang dibutuhkan $\rightarrow$ Download file Excel rekap kehadiran SP (fitur export terpilih).
3. **Proses Penggajian:** Buka menu *Data Penggajian* $\rightarrow$ Edit karyawan $\rightarrow$ Klik *Tarik dari Rekap Absensi* $\rightarrow$ Masukkan potongan mangkir/kasbon $\rightarrow$ Simpan.
4. **Cetak & Distribusi Slip Gaji:** Slip gaji resmi format PDF siap dicetak atau diunduh langsung oleh karyawan di portal mandiri.

---

## 🛠️ Tech Stack & Arsitektur

- **Backend**: Laravel 12.x, Laravel Sanctum, Laravel Excel (Maatwebsite), DomPDF (Barryvdh).
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Zustand, Axios.
- **Database**: MySQL.

---

## ⚙️ Panduan Menjalankan (Local Development)

### Backend (Laravel)
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

---

## 📦 Deployment ke cPanel Production
Untuk memaketkan perubahan terbaru ke cPanel:
```bash
cd frontend && npm run build && cd ..
python deploy_cpanel/build_zips.py
```
Akan menghasilkan file terkompresi di folder `deploy_cpanel/`:
- `frontend_update.zip` $\rightarrow$ Upload & ekstrak ke folder `public_html/`.
- `backend_update.zip` $\rightarrow$ Upload & ekstrak ke root backend server.

---
Dikelola oleh Tim Pengembang Artacomindo Jejaring Nusa.
