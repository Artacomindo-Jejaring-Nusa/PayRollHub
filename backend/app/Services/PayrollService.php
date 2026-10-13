<?php

namespace App\Services;

use App\Models\Payroll;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class PayrollService
{
    /**
     * Resolve company filter strictly based on request, header, or domain origin.
     */
    public function resolveCompany(Request $request): ?string
    {
        $user = $request->user();

        // 1. Super Admin: Bebas berpindah dan mengakses kedua Dashboard
        if ($user && $user->isSuperAdmin()) {
            $company = $request->input('company') ?: $request->header('X-Tenant-ID');
            if (!empty($company) && in_array(strtolower($company), ['rbs', 'rimamandiri', 'all'])) {
                return $company === 'all' ? null : strtolower($company);
            }
            // Fallback ke domain origin yang sedang dibuka
            $origin = $request->header('Origin') ?: $request->header('Referer') ?: $request->getHost();
            if ($origin) {
                $originLower = strtolower($origin);
                if (str_contains($originLower, 'riama') || str_contains($originLower, 'rimamandiri')) {
                    return 'rimamandiri';
                } elseif (str_contains($originLower, 'rimbun')) {
                    return 'rbs';
                }
            }
            return null;
        }

        // 2. Admin biasa & User: Terkunci ketat ke perusahaannya masing-masing
        if ($user) {
            $userCompany = $user->company ? strtolower($user->company) : 'rbs';
            return in_array($userCompany, ['rimamandiri', 'rima', 'riamamandiripratama']) ? 'rimamandiri' : 'rbs';
        }

        // 3. Fallback untuk request publik / guest
        $company = $request->input('company') ?: $request->header('X-Tenant-ID');
        if (empty($company)) {
            $origin = $request->header('Origin') ?: $request->header('Referer') ?: $request->getHost();
            if ($origin) {
                $originLower = strtolower($origin);
                if (str_contains($originLower, 'riama') || str_contains($originLower, 'rimamandiri')) {
                    $company = 'rimamandiri';
                } elseif (str_contains($originLower, 'rimbun')) {
                    $company = 'rbs';
                }
            }
        }

        return $company ?: null;
    }

    /**
     * Get paginated payroll list with search, filter, and sorting.
     */
    public function paginate(Request $request, int $defaultPerPage = 10): LengthAwarePaginator
    {
        $perPage = (int) $request->input('per_page', $defaultPerPage);
        if ($perPage <= 0 || $perPage > 500) {
            $perPage = $defaultPerPage;
        }

        $company = $this->resolveCompany($request);

        $query = Payroll::query()
            ->search($request->input('search'))
            ->byProvince($request->input('province'))
            ->byPosition($request->input('position'))
            ->byPeriod($request->input('period'))
            ->byPeriodRange($request->input('start_period'), $request->input('end_period'))
            ->byStatus($request->input('status'))
            ->byCompany($company);

        // Filter duplikat rekening bank jika diminta
        if ($request->boolean('duplicate_account') || $request->input('duplicate_account') === '1' || $request->input('duplicate_account') === 'true') {
            $duplicateAccList = DB::table('payrolls')
                ->whereNotNull('bank_account')
                ->where('bank_account', '!=', '')
                ->where('bank_account', '!=', '-')
                ->when($company, fn ($q) => $q->where('company', $company))
                ->groupBy('bank_account')
                ->havingRaw('COUNT(id) > 1')
                ->pluck('bank_account')
                ->toArray();

            $query->whereIn('bank_account', $duplicateAccList);
        }

        // Filter visibilitas user view (Poin 17)
        if ($request->input('visibility') === 'visible') {
            $query->where('is_visible_to_user', true);
        } elseif ($request->input('visibility') === 'hidden') {
            $query->where('is_visible_to_user', false);
        }

        $sortBy = $request->input('sort_by', 'id');
        $sortOrder = strtolower($request->input('sort_order', 'asc')) === 'desc' ? 'desc' : 'asc';

        $allowedSorts = [
            'id',
            'row_no',
            'employee_name',
            'nik',
            'province',
            'school_unit',
            'position',
            'join_date',
            'resign_date',
            'status',
            'company',
            'period',
            'net_base_price',
            'bpjs_kes',
            'bpjs_tk',
            'basic_salary',
            'allowance',
            'deduction',
            'absence_count',
            'absence_rate',
            'absence_deduction',
            'take_home_pay',
            'bank_account',
            'bank_name',
            'created_at',
        ];

        if (in_array($sortBy, $allowedSorts, true)) {
            $query->orderBy($sortBy, $sortOrder);
        } else {
            $query->orderBy('id', 'asc');
        }

        $paginator = $query->paginate($perPage)->withQueryString();

        // Detect duplicate accounts for records in current page
        $accountsOnPage = $paginator->getCollection()->pluck('bank_account')
            ->filter(fn ($a) => !empty($a) && $a !== '-')
            ->unique()
            ->toArray();

        if (!empty($accountsOnPage)) {
            $duplicateCounts = DB::table('payrolls')
                ->whereIn('bank_account', $accountsOnPage)
                ->when($company, fn ($q) => $q->where('company', $company))
                ->groupBy('bank_account')
                ->select('bank_account', DB::raw('COUNT(id) as count'))
                ->pluck('count', 'bank_account')
                ->toArray();

            foreach ($paginator->getCollection() as $item) {
                $acc = $item->bank_account;
                $count = $duplicateCounts[$acc] ?? 0;
                $item->is_duplicate_bank_account = $count > 1;
                $item->duplicate_account_count = $count;
            }
        }

        return $paginator;
    }

    /**
     * Get summary metrics for current query filter.
     */
    public function getMetrics(Request $request): array
    {
        $company = $this->resolveCompany($request);

        $query = Payroll::query()
            ->search($request->input('search'))
            ->byProvince($request->input('province'))
            ->byPosition($request->input('position'))
            ->byPeriod($request->input('period'))
            ->byPeriodRange($request->input('start_period'), $request->input('end_period'))
            ->byStatus($request->input('status'))
            ->byCompany($company);

        $metrics = $query->selectRaw('
            COUNT(id) as total_employees,
            COUNT(CASE WHEN status != "off" OR status IS NULL THEN 1 END) as total_active_employees,
            COUNT(CASE WHEN status = "off" THEN 1 END) as total_off_employees,
            COUNT(DISTINCT NULLIF(TRIM(province), "")) as total_provinces,
            COUNT(DISTINCT NULLIF(TRIM(school_unit), "")) as total_locations,
            COALESCE(SUM(net_base_price), 0) as total_net_base_price,
            COALESCE(SUM(bpjs_kes), 0) as total_bpjs_kes,
            COALESCE(SUM(bpjs_tk), 0) as total_bpjs_tk,
            COALESCE(SUM(absence_deduction), 0) as total_absence_deduction,
            COALESCE(SUM(basic_salary), 0) as total_basic_salary,
            COALESCE(SUM(allowance), 0) as total_allowance,
            COALESCE(SUM(deduction), 0) as total_deduction,
            COALESCE(SUM(take_home_pay), 0) as total_take_home_pay
        ')->first();

        // Hitung rekening yang terduplikasi
        $duplicateAccountsCount = DB::table('payrolls')
            ->select('bank_account')
            ->whereNotNull('bank_account')
            ->where('bank_account', '!=', '')
            ->where('bank_account', '!=', '-')
            ->when($company, fn ($q) => $q->where('company', $company))
            ->groupBy('bank_account')
            ->havingRaw('COUNT(id) > 1')
            ->pluck('bank_account')
            ->count();

        return [
            'total_employees' => (int) ($metrics->total_employees ?? 0),
            'total_active_employees' => (int) ($metrics->total_active_employees ?? 0),
            'total_off_employees' => (int) ($metrics->total_off_employees ?? 0),
            'total_provinces' => (int) ($metrics->total_provinces ?? 0),
            'total_locations' => (int) ($metrics->total_locations ?? 0),
            'total_duplicate_accounts' => $duplicateAccountsCount,
            'total_net_base_price' => (float) ($metrics->total_net_base_price ?? 0),
            'total_bpjs_kes' => (float) ($metrics->total_bpjs_kes ?? 0),
            'total_bpjs_tk' => (float) ($metrics->total_bpjs_tk ?? 0),
            'total_absence_deduction' => (float) ($metrics->total_absence_deduction ?? 0),
            'total_basic_salary' => (float) ($metrics->total_basic_salary ?? 0),
            'total_allowance' => (float) ($metrics->total_allowance ?? 0),
            'total_deduction' => (float) ($metrics->total_deduction ?? 0),
            'total_take_home_pay' => (float) ($metrics->total_take_home_pay ?? 0),
        ];
    }

    /**
     * Create a new payroll record and auto-provision employee login.
     */
    public function create(array $data): Payroll
    {
        return DB::transaction(function () use ($data) {
            $payroll = Payroll::create($data);
            self::syncEmployeeAccount($payroll);
            return $payroll;
        });
    }

    /**
     * Update an existing payroll record and keep employee account in sync.
     */
    public function update(Payroll $payroll, array $data): Payroll
    {
        return DB::transaction(function () use ($payroll, $data) {
            $payroll->update($data);
            $fresh = $payroll->fresh();
            self::syncEmployeeAccount($fresh);
            return $fresh;
        });
    }

    /**
     * Automatically ensure employee has a user login and is connected to their school unit.
     */
    public static function syncEmployeeAccount(Payroll $payroll): ?User
    {
        try {
            $name = trim($payroll->employee_name ?? '');
            $nik = trim($payroll->nik ?? '');
            $schoolUnit = trim($payroll->school_unit ?? '');
            $company = in_array(strtolower($payroll->company ?: ''), ['rimamandiri', 'rima', 'riamamandiripratama']) ? 'rimamandiri' : 'rbs';

            if (empty($name) && empty($nik)) {
                return null;
            }

            // 1. Cari user yang sudah ada berdasarkan NIK di perusahaan yang sama
            $user = null;
            if (!empty($nik)) {
                $user = User::where('nik', $nik)->where('company', $company)->first();
            }

            // 2. Jika belum ada NIK, buat email unik dengan prefix slug + company
            $defaultDomain = $company === 'rimamandiri' ? 'riamamandiripratama.com' : 'rimbunbuanasejahtera.com';
            if (!empty($nik)) {
                $defaultEmail = "{$nik}@{$defaultDomain}";
            } else {
                $baseSlug = Str::slug($name) ?: 'karyawan';
                $defaultEmail = "{$baseSlug}-{$company}@karyawan.local";
            }

            if (!$user) {
                $user = User::where('email', $defaultEmail)->where('company', $company)->first();
            }

            if ($user) {
                // Update unit sekolah dan informasi pendukung agar selalu sinkron dan terkoneksi
                $updates = [];
                if (!empty($schoolUnit) && $user->school_unit !== $schoolUnit) {
                    $updates['school_unit'] = $schoolUnit;
                }
                if (!empty($company) && $user->company !== $company) {
                    $updates['company'] = $company;
                }
                if (!empty($payroll->bank_name) && empty($user->bank_name)) {
                    $updates['bank_name'] = $payroll->bank_name;
                }
                if (!empty($payroll->bank_account) && empty($user->bank_account)) {
                    $updates['bank_account'] = $payroll->bank_account;
                }
                if (!empty($payroll->birth_date) && empty($user->birth_date)) {
                    $updates['birth_date'] = $payroll->birth_date;
                }
                if (!empty($payroll->gender) && empty($user->gender)) {
                    $updates['gender'] = $payroll->gender;
                }
                if (!empty($payroll->whatsapp) && empty($user->phone)) {
                    $updates['phone'] = $payroll->whatsapp;
                }
                if (!empty($updates)) {
                    $user->update($updates);
                }
                return $user;
            }

            // 3. Jika belum ada akun sama sekali: pastikan email 100% unik di tabel users (bebas collision)
            $finalEmail = $defaultEmail;
            $counter = 1;
            while (User::where('email', $finalEmail)->exists()) {
                $counter++;
                $finalEmail = str_replace('@', "-{$counter}@", $defaultEmail);
            }

            // Default password: NIK (atau 'password123' jika NIK kosong)
            $defaultPassword = !empty($nik) ? $nik : 'password123';

            return User::create([
                'name' => $name,
                'email' => $finalEmail,
                'nik' => !empty($nik) ? $nik : null,
                'school_unit' => !empty($schoolUnit) ? $schoolUnit : null,
                'company' => $company,
                'role' => 'karyawan',
                'birth_date' => $payroll->birth_date ?: null,
                'gender' => $payroll->gender ?: null,
                'phone' => $payroll->whatsapp ?: null,
                'bank_name' => $payroll->bank_name,
                'bank_account' => $payroll->bank_account,
                'password' => Hash::make($defaultPassword),
            ]);
        } catch (\Throwable $e) {
            try {
                \Illuminate\Support\Facades\Log::warning("Gagal auto-provision user untuk karyawan {$payroll->employee_name}: " . $e->getMessage());
            } catch (\Throwable $logEx) {
                // Ignore log write failure
            }
            return null;
        }
    }

    /**
     * Delete a payroll record.
     */
    public function delete(Payroll $payroll): bool
    {
        return DB::transaction(function () use ($payroll) {
            return $payroll->delete();
        });
    }

    /**
     * Get distinct list of provinces from data.
     */
    public function getDistinctProvinces(?string $company = null): array
    {
        $query = Payroll::query()->select('province')->whereNotNull('province');
        if ($company) {
            $query->where('company', $company);
        }
        return $query->distinct()->orderBy('province')->pluck('province')->toArray();
    }

    /**
     * Get distinct list of positions from data.
     */
    public function getDistinctPositions(?string $company = null): array
    {
        $query = Payroll::query()->select('position')->whereNotNull('position');
        if ($company) {
            $query->where('company', $company);
        }
        return $query->distinct()->orderBy('position')->pluck('position')->toArray();
    }

    /**
     * Get distinct list of periods from data and master payroll periods.
     */
    public function getDistinctPeriods(?string $company = null): array
    {
        $masterPeriods = \App\Models\PayrollPeriod::forCompany($company)->pluck('code')->toArray();

        $query = Payroll::query()->select('period')->whereNotNull('period');
        if ($company) {
            $query->where('company', $company);
        }
        $existingPeriods = $query->distinct()->orderByDesc('period')->pluck('period')->toArray();

        $allPeriods = array_unique(array_merge($masterPeriods, $existingPeriods));
        return array_values($allPeriods);
    }

    /**
     * Toggle or update employee status ('active' or 'off') with optional resign date.
     */
    public function toggleStatus(Payroll $payroll, string $status, ?string $resignDate = null): Payroll
    {
        return DB::transaction(function () use ($payroll, $status, $resignDate) {
            $updateData = ['status' => $status];
            if ($status === 'off') {
                $updateData['resign_date'] = $resignDate ?: date('Y-m-d');
            } else {
                $updateData['resign_date'] = null;
            }
            $payroll->update($updateData);
            return $payroll->fresh();
        });
    }
}

