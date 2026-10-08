<?php

namespace App\Services;

use App\Models\Payroll;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PayrollService
{
    /**
     * Get paginated payroll list with search, filter, and sorting.
     */
    public function paginate(Request $request, int $defaultPerPage = 10): LengthAwarePaginator
    {
        $perPage = (int) $request->input('per_page', $defaultPerPage);
        if ($perPage <= 0 || $perPage > 500) {
            $perPage = $defaultPerPage;
        }

        $query = Payroll::query()
            ->search($request->input('search'))
            ->byProvince($request->input('province'))
            ->byPosition($request->input('position'))
            ->byPeriod($request->input('period'));

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
            'period',
            'basic_salary',
            'allowance',
            'deduction',
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

        return $query->paginate($perPage)->withQueryString();
    }

    /**
     * Get summary metrics for current query filter.
     */
    public function getMetrics(Request $request): array
    {
        $query = Payroll::query()
            ->search($request->input('search'))
            ->byProvince($request->input('province'))
            ->byPosition($request->input('position'))
            ->byPeriod($request->input('period'));

        $metrics = $query->selectRaw('
            COUNT(id) as total_employees,
            COUNT(DISTINCT NULLIF(TRIM(province), "")) as total_provinces,
            COUNT(DISTINCT NULLIF(TRIM(school_unit), "")) as total_locations,
            COALESCE(SUM(basic_salary), 0) as total_basic_salary,
            COALESCE(SUM(allowance), 0) as total_allowance,
            COALESCE(SUM(deduction), 0) as total_deduction,
            COALESCE(SUM(take_home_pay), 0) as total_take_home_pay
        ')->first();

        return [
            'total_employees' => (int) ($metrics->total_employees ?? 0),
            'total_provinces' => (int) ($metrics->total_provinces ?? 0),
            'total_locations' => (int) ($metrics->total_locations ?? 0),
            'total_basic_salary' => (float) ($metrics->total_basic_salary ?? 0),
            'total_allowance' => (float) ($metrics->total_allowance ?? 0),
            'total_deduction' => (float) ($metrics->total_deduction ?? 0),
            'total_take_home_pay' => (float) ($metrics->total_take_home_pay ?? 0),
        ];
    }

    /**
     * Create a new payroll record.
     */
    public function create(array $data): Payroll
    {
        return DB::transaction(function () use ($data) {
            return Payroll::create($data);
        });
    }

    /**
     * Update an existing payroll record.
     */
    public function update(Payroll $payroll, array $data): Payroll
    {
        return DB::transaction(function () use ($payroll, $data) {
            $payroll->update($data);
            return $payroll->fresh();
        });
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
    public function getDistinctProvinces(): array
    {
        return Payroll::query()
            ->select('province')
            ->whereNotNull('province')
            ->distinct()
            ->orderBy('province')
            ->pluck('province')
            ->toArray();
    }

    /**
     * Get distinct list of positions from data.
     */
    public function getDistinctPositions(): array
    {
        return Payroll::query()
            ->select('position')
            ->whereNotNull('position')
            ->distinct()
            ->orderBy('position')
            ->pluck('position')
            ->toArray();
    }

    /**
     * Get distinct list of periods from data.
     */
    public function getDistinctPeriods(): array
    {
        return Payroll::query()
            ->select('period')
            ->whereNotNull('period')
            ->distinct()
            ->orderByDesc('period')
            ->pluck('period')
            ->toArray();
    }
}
