# PayRollHub — HRD Mandiri (RBS Global)

Sistem Rekapitulasi & Manajemen Penggajian Karyawan modern, cepat, dan aman berbasis **Laravel 12 REST API** dan **React 18 + Vite (SPA)** dengan Tailwind CSS.

## 🚀 Fitur Utama

- **Dashboard Analytics**: Sebaran penggajian per wilayah provinsi, ringkasan beban gaji pokok, tunjangan, potongan, dan Take Home Pay (THP).
- **Manajemen Penggajian (Payroll)**: Pencarian cepat, filter wilayah/periode/jabatan, paginasi dinamis, dan kalkulasi otomatis Take Home Pay di sisi server.
- **Import & Export Fleksibel**:
  - Bulk import data penggajian dari file Excel (.xlsx, .xls) dan CSV.
  - Export rekapitulasi data ke format Excel (.xlsx), CSV, dan PDF Landscape.
  - Cetak & unduh Slip Gaji individual resmi format PDF (Confidential).
- **Role-Based Access Control (RBAC)**:
  - **Admin**: Akses penuh ke seluruh fitur (CRUD payroll, bulk import, export, manajemen akun pengguna).
  - **User**: Hak akses baca & cari (*View & Search only*), proteksi server-side 403 untuk seluruh operasi mutasi data.
- **Keamanan Teruji**:
  - Rate Limiting autentikasi untuk memblokir serangan brute force.
  - Perlindungan Mass Assignment, Prepared SQL Queries, dan Sanitasi Nama File.
  - Defensive Security HTTP Headers & CORS terisolasi.

## 🛠️ Tech Stack

- **Backend**: Laravel 12.x, Laravel Sanctum, Laravel Excel (Maatwebsite), DomPDF (Barryvdh).
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Zustand, Axios.
- **Database**: MySQL.

## ⚙️ Panduan Menjalankan

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
Dikelola oleh Tim Pengembang Artacomindo Jejaring Nusa.
