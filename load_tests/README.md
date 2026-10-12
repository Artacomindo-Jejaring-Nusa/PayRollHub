# 🚀 Panduan Pengujian Beban (Load Testing) k6 - PayrollHub Absensi

Suite pengujian performa dan konkurensi menggunakan **k6** untuk menguji ketahanan sistem absensi PayrollHub saat diakses oleh **4.000 karyawan** secara bersamaan.

---

## 📂 Struktur Direktori

```text
load_tests/
├── config.js                      # Konfigurasi URL, headers, dan SLA thresholds
├── fixtures/
│   └── users.json                 # Kredensial akun karyawan hasil generate dari database
├── generate_test_users.php        # Script export akun karyawan dari database ke JSON
├── scenarios/
│   ├── 01_attendance_rush_hour.js # Simulasi 4.000 karyawan absen di jam sibuk pagi (06:30 - 08:00)
│   ├── 02_portal_browsing.js      # Simulasi karyawan mengecek slip gaji & riwayat absensi
│   ├── 03_stress_concurrency.js   # Stress test bertahap (50 -> 500 VU) mencari batas maksimal VPS
│   └── 04_quick_smoke_test.js     # Uji coba cepat 10 detik memastikan endpoint sehat
├── run_load_test.ps1              # Runner PowerShell 1-klik untuk eksekusi mudah
└── README.md                      # Dokumentasi ini
```

---

## ⚡ Cara Menjalankan Pengujian

### 1. Persiapan Data Akun Karyawan
Untuk memastikan k6 menggunakan akun karyawan asli:
```powershell
php load_tests/generate_test_users.php
```
*(File `fixtures/users.json` akan otomatis terisi 170+ akun karyawan yang ada di database).*

---

### 2. Menjalankan Tes Melalui PowerShell Runner

Buka terminal PowerShell dan jalankan perintah berikut:

#### A. Uji Cepat (Smoke Test - 10 Detik)
Memastikan server dan endpoint login, absensi, serta profil berjalan normal:
```powershell
powershell -ExecutionPolicy Bypass -File load_tests\run_load_test.ps1 -Scenario smoke
```

#### B. Simulasi Jam Sibuk Absensi (Peak Rush Hour)
Simulasi lonjakan ribuan karyawan melakukan check-in di pagi hari:
```powershell
powershell -ExecutionPolicy Bypass -File load_tests\run_load_test.ps1 -Scenario rush
```

#### C. Simulasi Akses Slip Gaji & Dashboard
Simulasi karyawan mengecek riwayat absen, pengumuman, dan slip gaji:
```powershell
powershell -ExecutionPolicy Bypass -File load_tests\run_load_test.ps1 -Scenario portal
```

#### D. Stress Test Concurrency (Mencari Kapasitas Maksimal VPS)
Pengujian beban ekstrem bertahap (50 -> 150 -> 300 -> 500 Virtual Users) untuk mencari titik jenuh server:
```powershell
powershell -ExecutionPolicy Bypass -File load_tests\run_load_test.ps1 -Scenario stress
```

---

### 3. Menguji Terhadap Server VPS / Staging

Jika ingin menguji langsung ke VPS hosting/produksi:
```powershell
powershell -ExecutionPolicy Bypass -File load_tests\run_load_test.ps1 -TargetUrl "https://payroll.domain-anda.com/api" -Scenario rush
```

Atau langsung dengan perintah k6 bawaan:
```powershell
k6 run --env BASE_URL="https://payroll.domain-anda.com/api" load_tests/scenarios/01_attendance_rush_hour.js
```

---

## 📊 Cara Membaca Metrik Hasil Pengujian

Setelah k6 selesai, akan muncul ringkasan tabel di terminal:

| Metrik | Makna | Standar Bagus (SLA) |
|---|---|---|
| **`http_req_failed`** | Persentase request yang gagal / error 500 | **`< 1.00%`** (Hampir tidak ada error) |
| **`http_req_duration (p95)`** | Waktu respon yang dirasakan 95% karyawan | **`< 1.50s`** (Di bawah 1.5 detik) |
| **`http_req_duration (med/avg)`** | Rata-rata waktu respon server | **`< 500ms`** (Di bawah 0.5 detik) |
| **`http_reqs` (RPS)** | Requests per second (kapasitas request/detik) | **`> 50 - 150 RPS`** untuk 4.000 karyawan |

---

## 🎯 Panduan Evaluasi untuk PM & Tim Infra

Jika saat dijalankan pada target VPS Anda melihat:
1. **Error `http_req_failed` meningkat di atas 5% saat VU > 200**:
   - Menandakan batas worker PHP-FPM / database connection pool di server VPS penuh.
   - **Solusi Cepat:** Naikkan `pm.max_children` di PHP-FPM dan aktifkan Redis caching untuk session/auth.
2. **Respon time melonjak (> 3 detik)**:
   - Server kekurangan CPU/RAM saat melakukan hashing atau validasi foto selfie.
   - **Solusi Skalabilitas:**
     - Mengaktifkan **Laravel Octane (FrankenPHP / Swoole)** pada VPS (meningkatkan performa 5x-10x tanpa ganti bahasa), atau
     - Menjadwalkan migrasi microservice absensi ke **Golang** seperti pada rancangan arsitektur sistem.
