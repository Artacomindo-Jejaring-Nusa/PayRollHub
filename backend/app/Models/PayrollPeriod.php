<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PayrollPeriod extends Model
{
    use HasFactory;

    protected $table = 'payroll_periods';

    protected $fillable = [
        'code',
        'name',
        'company',
        'is_sp',
        'is_visible_to_user',
        'description',
        'start_date',
        'end_date',
    ];

    protected function casts(): array
    {
        return [
            'is_sp' => 'boolean',
            'is_visible_to_user' => 'boolean',
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
        ];
    }

    /**
     * Resolve date range [start, end] from a period code (e.g. "SP 1", "SP 10").
     * Returns null if code not found or no dates configured.
     */
    public static function resolveDateRange(?string $code): ?array
    {
        if (blank($code) || strtolower(trim($code)) === 'all') {
            return null;
        }

        $period = static::where('code', trim($code))->first();

        if ($period && $period->start_date && $period->end_date) {
            return [
                $period->start_date->toDateString(),
                $period->end_date->toDateString(),
            ];
        }

        return null;
    }

    /**
     * Scope for company filtering.
     */
    public function scopeForCompany(Builder $query, ?string $company): Builder
    {
        if (blank($company) || $company === 'all') {
            return $query;
        }

        return $query->where(function (Builder $q) use ($company) {
            $q->where('company', 'all')
              ->orWhere('company', $company);
        });
    }

    /**
     * Scope for user visibility (portal karyawan).
     */
    public function scopeVisibleToUser(Builder $query): Builder
    {
        return $query->where('is_visible_to_user', true);
    }
}
