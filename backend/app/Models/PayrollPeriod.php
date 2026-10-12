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
    ];

    protected function casts(): array
    {
        return [
            'is_sp' => 'boolean',
            'is_visible_to_user' => 'boolean',
        ];
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
