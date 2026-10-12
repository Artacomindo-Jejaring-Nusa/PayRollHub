<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\AttendanceLocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttendanceLocationController extends Controller
{
    /**
     * Ambil daftar lokasi aktif untuk absensi karyawan/admin (Dropdown/Peta).
     */
    public function activeList(Request $request): JsonResponse
    {
        $user = $request->user();
        $targetCompany = $user->isSuperAdmin()
            ? ($request->query('company') ?: 'rbs')
            : ($user->company ?: 'rbs');

        $locations = AttendanceLocation::forTenant($targetCompany)
            ->where('is_active', true)
            ->orderBy('name', 'asc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $locations,
        ]);
    }

    /**
     * Tampilkan data 100+ lokasi untuk Admin dengan pencarian & filter.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $search = $request->query('search');
        $type = $request->query('type');
        $perPage = (int) $request->query('per_page', 50);

        $targetCompany = $user->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : null)
            : ($user->company ?: 'rbs');

        $query = AttendanceLocation::query()
            ->when($targetCompany, fn ($q) => $q->forTenant($targetCompany))
            ->when($type && $type !== 'all', fn ($q) => $q->where('type', $type))
            ->when($search, function ($q, $s) {
                $q->where(function ($sub) use ($s) {
                    $sub->where('name', 'like', "%{$s}%")
                        ->orWhere('code', 'like', "%{$s}%")
                        ->orWhere('address', 'like', "%{$s}%");
                });
            })
            ->orderBy('name', 'asc');

        $paginated = $query->paginate($perPage > 0 ? $perPage : 50);

        // Hitung karyawan terdaftar di setiap lokasi (baik matching school_unit maupun attendance_location_id)
        $locations = $paginated->getCollection();
        $locationIds = $locations->pluck('id')->all();
        $locationNames = $locations->pluck('name')->map(fn ($n) => trim($n))->all();

        $userCounts = \App\Models\User::query()
            ->when($targetCompany, fn ($q) => $q->where('company', $targetCompany))
            ->where(function ($q) use ($locationIds, $locationNames) {
                $q->whereIn('attendance_location_id', $locationIds)
                  ->orWhereIn('school_unit', $locationNames);
            })
            ->get(['id', 'school_unit', 'attendance_location_id']);

        $paginated->getCollection()->transform(function ($loc) use ($userCounts) {
            $count = $userCounts->filter(function ($u) use ($loc) {
                if ($u->attendance_location_id === $loc->id) {
                    return true;
                }
                $userSchool = trim($u->school_unit ?? '');
                return $userSchool !== '' && (
                    strcasecmp($userSchool, trim($loc->name)) === 0
                    || (!empty($loc->code) && strcasecmp($userSchool, trim($loc->code)) === 0)
                );
            })->count();
            $loc->employee_count = $count;
            return $loc;
        });

        return response()->json([
            'status' => 'success',
            'data' => $paginated->items(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'from' => $paginated->firstItem(),
                'to' => $paginated->lastItem(),
            ],
        ]);
    }

    /**
     * Tambah lokasi absensi manual & otomatis kaitkan karyawan di unit sekolah tersebut.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'radius_meters' => ['required', 'integer', 'min:10', 'max:50000'],
            'type' => ['nullable', 'string', 'in:headquarters,school,branch,other'],
            'tenant_id' => ['nullable', 'string', 'in:rbs,rimamandiri,all'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (!$user->isSuperAdmin()) {
            $validated['tenant_id'] = $user->company ?: 'rbs';
        } else {
            $validated['tenant_id'] = $validated['tenant_id'] ?? 'rbs';
        }

        $location = AttendanceLocation::create($validated);

        // Otomatis tautkan karyawan yang unit sekolahnya cocok
        $linkedCount = \App\Models\User::query()
            ->when($location->tenant_id !== 'all', fn ($q) => $q->where('company', $location->tenant_id))
            ->where(function ($q) use ($location) {
                $q->where('school_unit', $location->name)
                  ->when($location->code, fn ($sub) => $sub->orWhere('school_unit', $location->code));
            })
            ->whereNull('attendance_location_id')
            ->update(['attendance_location_id' => $location->id]);

        ActivityLog::record(
            action: 'CREATE_ATTENDANCE_LOCATION',
            module: 'attendance',
            description: "Menambahkan lokasi absensi baru: {$location->name} (Radius: {$location->radius_meters}m, {$linkedCount} karyawan otomatis terhubung)",
            details: $validated,
            company: $location->tenant_id
        );

        $location->employee_count = \App\Models\User::where('attendance_location_id', $location->id)->count();

        return response()->json([
            'status' => 'success',
            'message' => "Lokasi absensi berhasil ditambahkan ({$linkedCount} karyawan otomatis terhubung).",
            'data' => $location,
        ], 201);
    }

    /**
     * Detail lokasi absensi.
     */
    public function show(AttendanceLocation $attendanceLocation): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => $attendanceLocation,
        ]);
    }

    /**
     * Perbarui data lokasi absensi.
     */
    public function update(Request $request, AttendanceLocation $attendanceLocation): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && $attendanceLocation->tenant_id !== 'all' && $attendanceLocation->tenant_id !== ($user->company ?: 'rbs')) {
            abort(403, 'Akses ditolak. Anda tidak memiliki izin mengubah lokasi perusahaan lain.');
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'radius_meters' => ['required', 'integer', 'min:10', 'max:50000'],
            'type' => ['nullable', 'string', 'in:headquarters,school,branch,other'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $attendanceLocation->update($validated);

        ActivityLog::record(
            action: 'UPDATE_ATTENDANCE_LOCATION',
            module: 'attendance',
            description: "Memperbarui lokasi absensi: {$attendanceLocation->name} (Radius: {$attendanceLocation->radius_meters}m)",
            details: $validated,
            company: $attendanceLocation->tenant_id
        );

        // Auto-link karyawan jika unit sekolah mereka sama
        \App\Models\User::query()
            ->when($attendanceLocation->tenant_id !== 'all', fn ($q) => $q->where('company', $attendanceLocation->tenant_id))
            ->where(function ($q) use ($attendanceLocation) {
                $q->where('school_unit', $attendanceLocation->name)
                  ->when($attendanceLocation->code, fn ($sub) => $sub->orWhere('school_unit', $attendanceLocation->code));
            })
            ->whereNull('attendance_location_id')
            ->update(['attendance_location_id' => $attendanceLocation->id]);

        return response()->json([
            'status' => 'success',
            'message' => 'Lokasi absensi berhasil diperbarui.',
            'data' => $attendanceLocation->fresh(),
        ]);
    }

    /**
     * Hapus lokasi absensi satu per satu.
     */
    public function destroy(Request $request, AttendanceLocation $attendanceLocation): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && $attendanceLocation->tenant_id !== 'all' && $attendanceLocation->tenant_id !== ($user->company ?: 'rbs')) {
            abort(403, 'Akses ditolak. Anda tidak memiliki izin menghapus lokasi perusahaan lain.');
        }

        $name = $attendanceLocation->name;
        $tenantId = $attendanceLocation->tenant_id;
        $attendanceLocation->delete();

        ActivityLog::record(
            action: 'DELETE_ATTENDANCE_LOCATION',
            module: 'attendance',
            description: "Menghapus lokasi absensi: {$name}",
            details: ['name' => $name],
            company: $tenantId
        );

        return response()->json([
            'status' => 'success',
            'message' => "Lokasi '{$name}' berhasil dihapus.",
        ]);
    }

    /**
     * Bersihkan / Hapus Seluruh Lokasi untuk Perusahaan Aktif (Clear All).
     */
    public function clearAll(Request $request): JsonResponse
    {
        $user = $request->user();
        $targetCompany = $user->isSuperAdmin()
            ? ($request->input('company') ?: 'rbs')
            : ($user->company ?: 'rbs');

        $count = AttendanceLocation::forTenant($targetCompany)->count();
        AttendanceLocation::forTenant($targetCompany)->delete();

        ActivityLog::record(
            action: 'CLEAR_ATTENDANCE_LOCATIONS',
            module: 'attendance',
            description: "Mengosongkan seluruh master lokasi absensi ({$targetCompany}) - Jumlah dihapus: {$count} lokasi",
            details: ['deleted_count' => $count],
            company: $targetCompany
        );

        return response()->json([
            'status' => 'success',
            'message' => "Seluruh master lokasi ({$count} data) untuk {$targetCompany} berhasil dibersihkan.",
            'deleted_count' => $count,
        ]);
    }

    /**
     * Ambil daftar unit sekolah unik dari data impor penggajian & users,
     * lengkap dengan jumlah karyawan dan status apakah sudah terdaftar di master lokasi.
     */
    public function schoolUnits(Request $request): JsonResponse
    {
        $user = $request->user();
        $targetCompany = $user->isSuperAdmin()
            ? ($request->query('company') && $request->query('company') !== 'all' ? $request->query('company') : null)
            : ($user->company ?: 'rbs');

        $userUnits = \App\Models\User::query()
            ->when($targetCompany, fn ($q) => $q->where('company', $targetCompany))
            ->whereNotNull('school_unit')
            ->where('school_unit', '!=', '')
            ->selectRaw('school_unit, count(*) as employee_count')
            ->groupBy('school_unit')
            ->get();

        $payrollUnits = \App\Models\Payroll::query()
            ->when($targetCompany, fn ($q) => $q->where('company', $targetCompany))
            ->whereNotNull('school_unit')
            ->where('school_unit', '!=', '')
            ->distinct()
            ->pluck('school_unit');

        $existingLocations = AttendanceLocation::query()
            ->when($targetCompany, fn ($q) => $q->forTenant($targetCompany))
            ->get();

        $merged = collect();

        foreach ($userUnits as $u) {
            $name = trim($u->school_unit);
            $loc = $existingLocations->first(function ($l) use ($name) {
                return strcasecmp(trim($l->name), $name) === 0 || (!empty($l->code) && strcasecmp(trim($l->code), $name) === 0);
            });

            $merged->put($name, [
                'name' => $name,
                'employee_count' => (int) $u->employee_count,
                'is_configured' => $loc !== null,
                'location_id' => $loc?->id,
                'latitude' => $loc?->latitude,
                'longitude' => $loc?->longitude,
                'radius_meters' => $loc?->radius_meters,
            ]);
        }

        foreach ($payrollUnits as $pu) {
            $name = trim($pu);
            if (!$merged->has($name)) {
                $loc = $existingLocations->first(function ($l) use ($name) {
                    return strcasecmp(trim($l->name), $name) === 0 || (!empty($l->code) && strcasecmp(trim($l->code), $name) === 0);
                });

                $empCount = \App\Models\User::query()
                    ->when($targetCompany, fn ($q) => $q->where('company', $targetCompany))
                    ->where('school_unit', $name)
                    ->count();

                $merged->put($name, [
                    'name' => $name,
                    'employee_count' => $empCount,
                    'is_configured' => $loc !== null,
                    'location_id' => $loc?->id,
                    'latitude' => $loc?->latitude,
                    'longitude' => $loc?->longitude,
                    'radius_meters' => $loc?->radius_meters,
                ]);
            }
        }

        $result = $merged->values()->sortBy('name')->values()->all();

        return response()->json([
            'status' => 'success',
            'data' => $result,
            'total_schools' => count($result),
        ]);
    }

    /**
     * Otomatis sinkronkan seluruh unit sekolah dari data impor penggajian menjadi titik lokasi absensi
     * dan langsung hubungkan seluruh akun karyawan di bawah sekolah tersebut secara otomatis.
     */
    public function syncFromSchoolUnits(Request $request): JsonResponse
    {
        $user = $request->user();
        $targetCompany = $user->isSuperAdmin()
            ? ($request->input('company') ?: ($user->company ?: 'rbs'))
            : ($user->company ?: 'rbs');

        $setting = \App\Models\AttendanceSetting::getActiveSetting($targetCompany);
        $defaultLat = $setting->latitude ?: -6.2088;
        $defaultLng = $setting->longitude ?: 106.8456;
        $defaultRadius = $setting->radius_meters ?: 100;

        $payrollUnits = \App\Models\Payroll::query()
            ->when($targetCompany, fn ($q) => $q->where('company', $targetCompany))
            ->whereNotNull('school_unit')
            ->where('school_unit', '!=', '')
            ->distinct()
            ->pluck('school_unit');

        $userUnits = \App\Models\User::query()
            ->when($targetCompany, fn ($q) => $q->where('company', $targetCompany))
            ->whereNotNull('school_unit')
            ->where('school_unit', '!=', '')
            ->distinct()
            ->pluck('school_unit');

        $allUnits = $payrollUnits->merge($userUnits)->map(fn ($u) => trim($u))->filter()->unique();

        $createdCount = 0;
        $updatedCount = 0;
        $linkedEmployees = 0;

        foreach ($allUnits as $schoolName) {
            $existing = AttendanceLocation::where('tenant_id', $targetCompany)
                ->where(function ($q) use ($schoolName) {
                    $q->where('name', $schoolName)
                      ->orWhere('code', $schoolName);
                })
                ->first();

            if (!$existing) {
                $existing = AttendanceLocation::create([
                    'tenant_id' => $targetCompany,
                    'name' => $schoolName,
                    'code' => null,
                    'address' => 'Unit ' . $schoolName,
                    'latitude' => $defaultLat,
                    'longitude' => $defaultLng,
                    'radius_meters' => $defaultRadius,
                    'type' => 'school',
                    'is_active' => true,
                ]);
                $createdCount++;
            } else {
                $updatedCount++;
            }

            // Tautkan karyawan di sekolah tersebut ke titik lokasi ini
            $affected = \App\Models\User::where('company', $targetCompany)
                ->where('school_unit', $schoolName)
                ->update(['attendance_location_id' => $existing->id]);
            $linkedEmployees += $affected;
        }

        ActivityLog::record(
            action: 'SYNC_SCHOOL_LOCATIONS',
            module: 'attendance',
            description: "Sinkronisasi {$allUnits->count()} unit sekolah ke titik lokasi absensi ({$createdCount} baru, {$linkedEmployees} akun karyawan otomatis terhubung)",
            company: $targetCompany
        );

        return response()->json([
            'status' => 'success',
            'message' => "Berhasil mensinkronkan {$allUnits->count()} unit sekolah ({$createdCount} titik lokasi baru dibuat, {$linkedEmployees} akun karyawan otomatis terhubung ke lokasi sekolah masing-masing).",
            'data' => [
                'total_units' => $allUnits->count(),
                'created_locations' => $createdCount,
                'existing_locations' => $updatedCount,
                'linked_employees' => $linkedEmployees,
            ],
        ]);
    }

    /**
     * Ambil data karyawan terhubung ke lokasi ini & seluruh karyawan perusahaan untuk modal penugasan manual.
     */
    public function getEmployees(AttendanceLocation $attendanceLocation): JsonResponse
    {
        $tenantId = $attendanceLocation->tenant_id === 'all' ? null : $attendanceLocation->tenant_id;

        $allEmployees = \App\Models\User::query()
            ->when($tenantId, fn ($q) => $q->where('company', $tenantId))
            ->orderBy('name', 'asc')
            ->get(['id', 'name', 'nik', 'email', 'school_unit', 'attendance_location_id']);

        $locName = strtolower(trim($attendanceLocation->name));
        $locCode = strtolower(trim($attendanceLocation->code ?? ''));

        $assignedEmployees = $allEmployees->filter(function ($emp) use ($attendanceLocation, $locName, $locCode) {
            if ($emp->attendance_location_id === $attendanceLocation->id) {
                return true;
            }
            $empSchool = strtolower(trim($emp->school_unit ?? ''));
            return $empSchool !== '' && ($empSchool === $locName || ($locCode !== '' && $empSchool === $locCode));
        })->values();

        return response()->json([
            'status' => 'success',
            'data' => [
                'location' => $attendanceLocation,
                'assigned_employees' => $assignedEmployees,
                'all_employees' => $allEmployees,
            ],
        ]);
    }

    /**
     * Admin memilih manual karyawan yang ditugaskan ke lokasi ini.
     */
    public function assignEmployees(Request $request, AttendanceLocation $attendanceLocation): JsonResponse
    {
        $validated = $request->validate([
            'user_ids' => ['required', 'array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $userIds = $validated['user_ids'];

        // Lepas user lama yang sebelumnya ditugaskan ke lokasi ini namun tidak ada di user_ids baru
        \App\Models\User::where('attendance_location_id', $attendanceLocation->id)
            ->whereNotIn('id', $userIds)
            ->update(['attendance_location_id' => null]);

        // Pasang lokasi ke user_ids terpilih
        if (!empty($userIds)) {
            \App\Models\User::whereIn('id', $userIds)
                ->update(['attendance_location_id' => $attendanceLocation->id]);
        }

        ActivityLog::record(
            action: 'ASSIGN_LOCATION_EMPLOYEES',
            module: 'attendance',
            description: "Mengatur penugasan " . count($userIds) . " karyawan ke lokasi: {$attendanceLocation->name}",
            details: ['user_ids' => $userIds],
            company: $attendanceLocation->tenant_id
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Penugasan karyawan ke lokasi berhasil diperbarui.',
            'assigned_count' => count($userIds),
        ]);
    }

    /**
     * Download Template Excel (.xlsx) untuk Import Data Lokasi.
     * Terdiri dari 2 Sheet:
     * 1. DATA_LOKASI (Formulir pengisian data + dropdown pilihan tipe)
     * 2. PETUNJUK_PENGISIAN (Panduan lengkap kolom, format koordinat GPS, dan logika bisnis tipe lokasi)
     */
    public function downloadTemplate(Request $request): StreamedResponse
    {
        $spreadsheet = new Spreadsheet();

        // -------------------------------------------------------------
        // SHEET 1: DATA_LOKASI
        // -------------------------------------------------------------
        $sheetData = $spreadsheet->getActiveSheet();
        $sheetData->setTitle('DATA_LOKASI');

        // Header kolom formulir
        $headers = [
            'Nama Lokasi*',
            'Kode Unit',
            'Latitude*',
            'Longitude*',
            'Radius Meter*',
            'Alamat',
            'Tipe',
        ];

        $sheetData->fromArray([$headers], null, 'A1');

        // Contoh Data Realistis Sesuai Berbagai Tipe Logika Bisnis
        $sampleData = [
            [
                'Sekolah Rakyat Cibinong 01',
                'SRP-001',
                -6.4827110,
                106.8456120,
                100,
                'Jl. Pemuda No. 12, Cibinong, Kab. Bogor',
                'school',
            ],
            [
                'Sekolah Rakyat Bandung Barat 02',
                'SRP-002',
                -6.9174639,
                107.6191228,
                100,
                'Jl. Raya Cimahi No. 45, Bandung',
                'school',
            ],
            [
                'Kantor Pusat Operasional',
                'PUSAT',
                -6.1954000,
                106.8521000,
                150,
                'Gedung Salemba Raya No. 10, Jakarta Pusat',
                'headquarters',
            ],
            [
                'Kantor Cabang Wilayah Jawa Timur',
                'CBG-SBY',
                -7.2574719,
                112.7520883,
                120,
                'Jl. Pemuda No. 88, Surabaya, Jawa Timur',
                'branch',
            ],
            [
                'Pos Penugasan Lapangan Khusus',
                'POS-01',
                -6.2000000,
                106.8166660,
                80,
                'Kawasan Penugasan Mandiri Lapangan',
                'other',
            ],
        ];

        $sheetData->fromArray($sampleData, null, 'A2');

        // Styling Header Sheet 1
        $sheetData->getStyle('A1:G1')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF'], 'size' => 11],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '0284C7'], // Sky blue
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
        ]);
        $sheetData->getRowDimension(1)->setRowHeight(28);

        // Tambahkan DataValidation dropdown pada kolom Tipe (G2:G200)
        $validation = $sheetData->getCell('G2')->getDataValidation();
        $validation->setType(\PhpOffice\PhpSpreadsheet\Cell\DataValidation::TYPE_LIST);
        $validation->setErrorStyle(\PhpOffice\PhpSpreadsheet\Cell\DataValidation::STYLE_INFORMATION);
        $validation->setAllowBlank(true);
        $validation->setShowInputMessage(true);
        $validation->setShowErrorMessage(true);
        $validation->setShowDropDown(true);
        $validation->setErrorTitle('Pilihan Tipe Tidak Sesuai');
        $validation->setError('Pilih salah satu tipe: school, headquarters, branch, atau other.');
        $validation->setPromptTitle('Tipe Lokasi Absensi');
        $validation->setPrompt('Pilih: school (Sekolah), headquarters (Kantor Pusat), branch (Cabang), other (Lainnya).');
        $validation->setFormula1('"school,headquarters,branch,other"');

        // Copy validasi dropdown ke baris berikutnya
        for ($r = 3; $r <= 200; $r++) {
            $sheetData->getCell("G{$r}")->setDataValidation(clone $validation);
        }

        foreach (range('A', 'G') as $col) {
            $sheetData->getColumnDimension($col)->setAutoSize(true);
        }

        // -------------------------------------------------------------
        // SHEET 2: PETUNJUK_PENGISIAN
        // -------------------------------------------------------------
        $sheetGuide = $spreadsheet->createSheet();
        $sheetGuide->setTitle('PETUNJUK_PENGISIAN');

        // Title
        $sheetGuide->setCellValue('A1', 'PANDUAN & TATA CARA PENGISIAN MASTER LOKASI ABSENSI');
        $sheetGuide->getStyle('A1')->getFont()->setBold(true)->setSize(14)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('0F172A'));
        $sheetGuide->setCellValue('A2', 'Bacalah petunjuk di bawah ini sebelum mengisi data lokasi absensi agar sesuai dengan logika bisnis sistem.');
        $sheetGuide->getStyle('A2')->getFont()->setItalic(true)->setSize(10)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('475569'));

        // TABEL 1: DAFTAR KOLOM & FORMAT DATA
        $sheetGuide->setCellValue('A4', '1. DAFTAR KOLOM & ATURAN FORMAT DATA');
        $sheetGuide->getStyle('A4')->getFont()->setBold(true)->setSize(11);

        $guideHeaders = ['Nama Kolom', 'Wajib / Opsional', 'Tipe Data / Format', 'Contoh Nilai', 'Keterangan & Logika Bisnis'];
        $sheetGuide->fromArray([$guideHeaders], null, 'A5');
        $sheetGuide->getStyle('A5:E5')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '1E293B'], // Dark slate
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
        ]);
        $sheetGuide->getRowDimension(5)->setRowHeight(24);

        $colGuideData = [
            ['Nama Lokasi*', 'WAJIB', 'Teks (Maks 150)', 'Sekolah Rakyat Cibinong 01', 'Nama resmi unit sekolah, kantor, atau pos absensi. Nama ini akan tampil di aplikasi saat karyawan absensi.'],
            ['Kode Unit', 'OPSIONAL (Sangat Dianjurkan)', 'Teks Unik (Maks 100)', 'SRP-001 / PUSAT', 'Kode identifikasi unit sekolah/cabang. Mempermudah pencocokan otomatis unit kerja dan mencegah data ganda.'],
            ['Latitude*', 'WAJIB', 'Angka Desimal GPS (-90 s/d 90)', '-6.482711', 'Titik koordinat garis lintang GPS. Dapat disalin dari Google Maps. Sistem menerima tanda titik (.) maupun koma (,).'],
            ['Longitude*', 'WAJIB', 'Angka Desimal GPS (-180 s/d 180)', '106.845612', 'Titik koordinat garis bujur GPS. Dapat disalin dari Google Maps. Sistem menerima tanda titik (.) maupun koma (,).'],
            ['Radius Meter*', 'WAJIB', 'Angka Bulat (10 s/d 50.000 meter)', '100', 'Batas toleransi jarak absensi dari titik pusat lokasi. Standar rekomendasi: 100 meter.'],
            ['Alamat', 'OPSIONAL', 'Teks Bebas', 'Jl. Pemuda No. 12, Cibinong, Kab. Bogor', 'Alamat fisik lengkap lokasi untuk referensi dan verifikasi supervisor.'],
            ['Tipe', 'WAJIB (Default: school)', 'Pilihan (Dropdown)', 'school / headquarters / branch / other', 'Peran lokasi dalam logika bisnis. Pilihan wajib huruf kecil: school, headquarters, branch, atau other.'],
        ];
        $sheetGuide->fromArray($colGuideData, null, 'A6');

        // TABEL 2: LOGIKA BISNIS KOLOM "TIPE"
        $sheetGuide->setCellValue('A15', '2. PENJELASAN LOGIKA BISNIS KOLOM "TIPE"');
        $sheetGuide->getStyle('A15')->getFont()->setBold(true)->setSize(11);

        $typeHeaders = ['Nilai Tipe (Isian Excel)', 'Kategori Lokasi', 'Logika Bisnis & Peran Operasional'];
        $sheetGuide->fromArray([$typeHeaders], null, 'A16');
        $sheetGuide->getStyle('A16:C16')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '047857'], // Emerald green
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
        ]);
        $sheetGuide->getRowDimension(16)->setRowHeight(24);

        $typeGuideData = [
            ['school', 'Sekolah Rakyat (SRP)', 'Unit Sekolah Rakyat tempat guru, tenaga kependidikan, dan staf unit sekolah bertugas. Terhubung langsung dengan unit penugasan karyawan untuk validasi absensi harian.'],
            ['headquarters', 'Kantor Pusat', 'Kantor pusat operasional yayasan/manajemen utama, tempat manajemen pusat & tim operasional kantor bekerja.'],
            ['branch', 'Kantor Cabang / Perwakilan', 'Kantor perwakilan wilayah, cabang regional, atau kantor koordinasi distrik.'],
            ['other', 'Pos / Lokasi Tugas Lainnya', 'Fasilitas pendukung, lokasi penugasan kegiatan luar kantor, asrama, atau pos proyek khusus.'],
        ];
        $sheetGuide->fromArray($typeGuideData, null, 'A17');

        // TABEL 3: TIPS MENGAMBIL KOORDINAT GPS GOOGLE MAPS
        $sheetGuide->setCellValue('A23', '3. CARA MENGAMBIL KOORDINAT GPS DARI GOOGLE MAPS');
        $sheetGuide->getStyle('A23')->getFont()->setBold(true)->setSize(11);
        $tipsData = [
            ['Langkah 1', 'Buka Google Maps (https://maps.google.com) melalui browser di komputer atau smartphone.'],
            ['Langkah 2', 'Cari lokasi sekolah/gedung kantor yang diinginkan, perbesar peta (zoom in) sampai titik pintu gerbang/pintu masuk terlihat jelas.'],
            ['Langkah 3', 'Klik kanan tepat di atas titik lokasi tersebut pada peta.'],
            ['Langkah 4', 'Pilih angka koordinat yang muncul paling atas (contoh: -6.482711, 106.845612) untuk menyalin secara otomatis.'],
            ['Langkah 5', 'Angka pertama adalah Latitude (contoh: -6.482711), angka kedua adalah Longitude (contoh: 106.845612). Salin ke kolom yang sesuai.'],
        ];
        $sheetGuide->fromArray($tipsData, null, 'A24');

        // TABEL 4: LOGIKA UPDATE OTOMATIS DATA EKSISTING
        $sheetGuide->setCellValue('A31', '4. LOGIKA PENCEGAHAN DUPLIKASI DATA (SMART SYNC)');
        $sheetGuide->getStyle('A31')->getFont()->setBold(true)->setSize(11);
        $syncNotes = [
            ['Catatan 1', 'Jika Kode Unit atau Nama Lokasi sudah terdaftar di sistem, data akan DIPERBARUI (UPDATE), bukan dibuat ganda.'],
            ['Catatan 2', 'Jika Kode Unit dan Nama Lokasi belum terdaftar, sistem akan menambahkan sebagai LOKASI BARU.'],
            ['Catatan 3', 'Sistem secara cerdas mendukung tanda titik (.) maupun koma (,) untuk desimal koordinat (otomatis dinormalisasi).'],
        ];
        $sheetGuide->fromArray($syncNotes, null, 'A32');

        foreach (range('A', 'E') as $col) {
            $sheetGuide->getColumnDimension($col)->setAutoSize(true);
        }

        // Aktifkan kembali Sheet 1 sebagai sheet default yang terbuka
        $spreadsheet->setActiveSheetIndex(0);

        $filename = 'template_import_lokasi_absensi.xlsx';

        $responseHeaders = [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'max-age=0',
        ];

        return response()->stream(function () use ($spreadsheet) {
            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
        }, 200, $responseHeaders);
    }

    /**
     * Helper untuk normalisasi angka desimal koordinat GPS (mendukung titik dan koma).
     */
    protected function parseCoordinate(?string $val): ?float
    {
        if ($val === null || trim($val) === '') {
            return null;
        }
        $clean = trim(str_replace([' ', ','], ['', '.'], $val));
        if (!is_numeric($clean)) {
            return null;
        }
        return (float) $clean;
    }

    /**
     * Preview Data Lokasi sebelum disimpan ke Database.
     * Mengembalikan list data terdeteksi, status validasi per baris, dan aksi (create/update).
     */
    public function previewImport(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv,txt', 'max:10240'],
        ], [
            'file.required' => 'File Excel/CSV lokasi wajib diunggah.',
            'file.mimes' => 'Format file harus berupa Excel (.xlsx, .xls) atau CSV (.csv).',
            'file.max' => 'Ukuran file tidak boleh melebihi 10MB.',
        ]);

        $user = $request->user();
        $targetCompany = $user->isSuperAdmin()
            ? ($request->input('company') ?: 'rbs')
            : ($user->company ?: 'rbs');

        $file = $request->file('file');
        $realPath = $file->getRealPath();

        try {
            $reader = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($realPath);
            $reader->setReadDataOnly(true);
            $spreadsheet = $reader->load($realPath);
            // Utamakan sheet 'DATA_LOKASI' jika file template, jika tidak gunakan active sheet
            $sheet = $spreadsheet->getSheetByName('DATA_LOKASI') ?: $spreadsheet->getActiveSheet();
            $rows = $sheet->toArray(null, true, true, true);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal membaca file spreadsheet: ' . $e->getMessage(),
            ], 422);
        }

        if (count($rows) < 2) {
            return response()->json([
                'status' => 'error',
                'message' => 'File tidak memiliki baris data (hanya header atau kosong).',
            ], 422);
        }

        // Ambil data lokasi eksisting tenant untuk deteksi apakah akan create atau update
        $existingLocations = AttendanceLocation::where('tenant_id', $targetCompany)
            ->get(['id', 'code', 'name'])
            ->keyBy(fn ($loc) => $loc->code ? 'code:' . strtolower($loc->code) : 'name:' . strtolower($loc->name));

        $previewRows = [];
        $totalValid = 0;
        $totalInvalid = 0;
        $totalCreate = 0;
        $totalUpdate = 0;

        $isFirstRow = true;
        $rowIndex = 1;

        $typeLabels = [
            'school' => 'Sekolah Rakyat',
            'headquarters' => 'Kantor Pusat',
            'branch' => 'Kantor Cabang',
            'other' => 'Pos / Lainnya',
        ];

        foreach ($rows as $row) {
            if ($isFirstRow) {
                $isFirstRow = false;
                $rowIndex++;
                continue;
            }
            $rowIndex++;

            $name = trim($row['A'] ?? '');
            $code = trim($row['B'] ?? '');
            $latRaw = trim($row['C'] ?? '');
            $lngRaw = trim($row['D'] ?? '');
            $radiusRaw = trim($row['E'] ?? '');
            $address = trim($row['F'] ?? '');
            $type = strtolower(trim($row['G'] ?? 'school'));

            if (empty($name) && empty($code) && empty($latRaw) && empty($lngRaw)) {
                continue;
            }

            $rowErrors = [];

            if (empty($name)) {
                $rowErrors[] = 'Nama lokasi wajib diisi.';
            } elseif (mb_strlen($name) > 150) {
                $rowErrors[] = 'Nama lokasi maksimal 150 karakter.';
            }

            $lat = $this->parseCoordinate($latRaw);
            if ($lat === null) {
                $rowErrors[] = 'Latitude tidak valid (harus angka desimal GPS).';
            } elseif ($lat < -90 || $lat > 90) {
                $rowErrors[] = 'Latitude di luar rentang valid (-90 s/d 90).';
            }

            $lng = $this->parseCoordinate($lngRaw);
            if ($lng === null) {
                $rowErrors[] = 'Longitude tidak valid (harus angka desimal GPS).';
            } elseif ($lng < -180 || $lng > 180) {
                $rowErrors[] = 'Longitude di luar rentang valid (-180 s/d 180).';
            }

            $cleanRadius = str_replace([' ', ','], ['', '.'], $radiusRaw);
            $radius = is_numeric($cleanRadius) && (int) $cleanRadius > 0 ? (int) $cleanRadius : 100;
            if ($radius < 10 || $radius > 50000) {
                $rowErrors[] = 'Radius harus bernilai 10 s/d 50.000 meter.';
            }

            if (!in_array($type, ['school', 'headquarters', 'branch', 'other'])) {
                $type = 'school';
            }

            $isExisting = false;
            if (!empty($code) && $existingLocations->has('code:' . strtolower($code))) {
                $isExisting = true;
            } elseif (!empty($name) && $existingLocations->has('name:' . strtolower($name))) {
                $isExisting = true;
            }

            $action = $isExisting ? 'update' : 'create';
            $isValid = empty($rowErrors);

            if ($isValid) {
                $totalValid++;
                if ($action === 'update') {
                    $totalUpdate++;
                } else {
                    $totalCreate++;
                }
            } else {
                $totalInvalid++;
            }

            $previewRows[] = [
                'row_index' => $rowIndex,
                'name' => $name,
                'code' => $code ?: '-',
                'latitude' => $lat,
                'longitude' => $lng,
                'radius_meters' => $radius,
                'address' => $address ?: '-',
                'type' => $type,
                'type_label' => $typeLabels[$type] ?? $type,
                'action' => $action,
                'is_valid' => $isValid,
                'errors' => $rowErrors,
            ];
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Analisis pratinjau data lokasi berhasil.',
            'summary' => [
                'filename' => $file->getClientOriginalName(),
                'file_size' => $file->getSize(),
                'total_rows' => count($previewRows),
                'valid_rows' => $totalValid,
                'invalid_rows' => $totalInvalid,
                'create_count' => $totalCreate,
                'update_count' => $totalUpdate,
                'company' => $targetCompany,
            ],
            'preview_rows' => $previewRows,
        ]);
    }

    /**
     * Import Data Lokasi dari File Excel (.xlsx, .xls) atau CSV (.csv).
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv,txt', 'max:10240'],
        ], [
            'file.required' => 'File Excel/CSV lokasi wajib diunggah.',
            'file.mimes' => 'Format file harus berupa Excel (.xlsx, .xls) atau CSV (.csv).',
            'file.max' => 'Ukuran file tidak boleh melebihi 10MB.',
        ]);

        $user = $request->user();
        $targetCompany = $user->isSuperAdmin()
            ? ($request->input('company') ?: 'rbs')
            : ($user->company ?: 'rbs');

        $file = $request->file('file');
        $realPath = $file->getRealPath();

        try {
            $reader = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($realPath);
            $reader->setReadDataOnly(true);
            $spreadsheet = $reader->load($realPath);
            $sheet = $spreadsheet->getSheetByName('DATA_LOKASI') ?: $spreadsheet->getActiveSheet();
            $rows = $sheet->toArray(null, true, true, true);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal membaca file spreadsheet: ' . $e->getMessage(),
            ], 422);
        }

        if (count($rows) < 2) {
            return response()->json([
                'status' => 'error',
                'message' => 'File tidak memiliki baris data (hanya header atau kosong).',
            ], 422);
        }

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        $isFirstRow = true;
        $rowIndex = 1;

        foreach ($rows as $row) {
            if ($isFirstRow) {
                $isFirstRow = false;
                $rowIndex++;
                continue;
            }
            $rowIndex++;

            $name = trim($row['A'] ?? '');
            $code = trim($row['B'] ?? '');
            $latRaw = trim($row['C'] ?? '');
            $lngRaw = trim($row['D'] ?? '');
            $radiusRaw = trim($row['E'] ?? '');
            $address = trim($row['F'] ?? '');
            $type = strtolower(trim($row['G'] ?? 'school'));

            if (empty($name) && empty($latRaw) && empty($lngRaw)) {
                $skipped++;
                continue;
            }

            if (empty($name)) {
                $errors[] = "Baris {$rowIndex}: Nama lokasi tidak boleh kosong.";
                continue;
            }

            $lat = $this->parseCoordinate($latRaw);
            $lng = $this->parseCoordinate($lngRaw);

            if ($lat === null || $lng === null) {
                $errors[] = "Baris {$rowIndex} ({$name}): Nilai Latitude atau Longitude tidak valid (harus angka desimal).";
                continue;
            }

            if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
                $errors[] = "Baris {$rowIndex} ({$name}): Koordinat di luar batas valid (Lat: -90..90, Lng: -180..180).";
                continue;
            }

            $cleanRadius = str_replace([' ', ','], ['', '.'], $radiusRaw);
            $radius = is_numeric($cleanRadius) && (int) $cleanRadius > 0 ? (int) $cleanRadius : 100;

            if (!in_array($type, ['school', 'headquarters', 'branch', 'other'])) {
                $type = 'school';
            }

            // Cari berdasarkan code unik atau nama lokasi dalam tenant yang sama
            $matchCriteria = ['tenant_id' => $targetCompany];
            if (!empty($code)) {
                $matchCriteria['code'] = $code;
            } else {
                $matchCriteria['name'] = $name;
            }

            $loc = AttendanceLocation::where($matchCriteria)->first();

            if ($loc) {
                $loc->update([
                    'name' => $name,
                    'code' => $code ?: $loc->code,
                    'address' => $address ?: $loc->address,
                    'latitude' => $lat,
                    'longitude' => $lng,
                    'radius_meters' => $radius,
                    'type' => $type,
                    'is_active' => true,
                ]);
                $updated++;
            } else {
                AttendanceLocation::create([
                    'tenant_id' => $targetCompany,
                    'name' => $name,
                    'code' => $code ?: null,
                    'address' => $address ?: null,
                    'latitude' => $lat,
                    'longitude' => $lng,
                    'radius_meters' => $radius,
                    'type' => $type,
                    'is_active' => true,
                ]);
                $imported++;
            }
        }

        ActivityLog::record(
            action: 'IMPORT_ATTENDANCE_LOCATIONS',
            module: 'attendance',
            description: "Mengimpor master lokasi absensi dari Excel/CSV ({$targetCompany}) - Baru: {$imported}, Diperbarui: {$updated}",
            details: [
                'imported_count' => $imported,
                'updated_count' => $updated,
                'file_name' => $file->getClientOriginalName(),
            ],
            company: $targetCompany
        );

        return response()->json([
            'status' => 'success',
            'message' => "Import lokasi selesai: {$imported} lokasi baru ditambahkan, {$updated} lokasi diperbarui.",
            'data' => [
                'imported_count' => $imported,
                'updated_count' => $updated,
                'skipped_count' => $skipped,
                'errors' => $errors,
                'total_current' => AttendanceLocation::forTenant($targetCompany)->count(),
            ],
        ]);
    }

    /**
     * Export data seluruh lokasi aktif ke file CSV.
     */
    public function export(Request $request): StreamedResponse
    {
        $user = $request->user();
        $targetCompany = $user->isSuperAdmin()
            ? ($request->query('company') ?: 'rbs')
            : ($user->company ?: 'rbs');

        $locations = AttendanceLocation::forTenant($targetCompany)
            ->orderBy('name', 'asc')
            ->get();

        $filename = "master_lokasi_absensi_{$targetCompany}_" . date('Ymd_His') . ".csv";

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        return response()->stream(function () use ($locations) {
            $handle = fopen('php://output', 'w');
            fputs($handle, "\xEF\xBB\xBF"); // UTF-8 BOM for Excel

            fputcsv($handle, [
                'No',
                'Nama Lokasi',
                'Kode Unit',
                'Tipe',
                'Radius Meter',
                'Latitude',
                'Longitude',
                'Alamat',
                'Status',
            ]);

            $no = 1;
            foreach ($locations as $loc) {
                fputcsv($handle, [
                    $no++,
                    $loc->name,
                    $loc->code ?? '-',
                    $loc->type,
                    $loc->radius_meters,
                    $loc->latitude,
                    $loc->longitude,
                    $loc->address ?? '-',
                    $loc->is_active ? 'Aktif' : 'Nonaktif',
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }
}
