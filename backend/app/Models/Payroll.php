<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payroll extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'payrolls';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
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
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'basic_salary' => 'decimal:2',
            'allowance' => 'decimal:2',
            'deduction' => 'decimal:2',
            'take_home_pay' => 'decimal:2',
        ];
    }

    /**
     * Bootstrap the model and its traits.
     */
    protected static function booted(): void
    {
        static::saving(function (Payroll $payroll) {
            $payroll->take_home_pay = (float) $payroll->basic_salary + (float) $payroll->allowance - (float) $payroll->deduction;
        });
    }

    /**
     * Scope a query to search by employee name, NIK, school unit, or position.
     */
    public function scopeSearch(Builder $query, ?string $search): Builder
    {
        if (blank($search)) {
            return $query;
        }

        $term = trim($search);
        return $query->where(function (Builder $q) use ($term) {
            $q->where('employee_name', 'like', "%{$term}%")
              ->orWhere('nik', 'like', "%{$term}%")
              ->orWhere('school_unit', 'like', "%{$term}%")
              ->orWhere('position', 'like', "%{$term}%")
              ->orWhere('bank_account', 'like', "%{$term}%")
              ->orWhere('bank_name', 'like', "%{$term}%");
        });
    }

    /**
     * Scope a query to filter by province.
     */
    public function scopeByProvince(Builder $query, ?string $province): Builder
    {
        if (blank($province) || $province === 'all') {
            return $query;
        }

        return $query->where('province', $province);
    }

    /**
     * Scope a query to filter by position / job role.
     */
    public function scopeByPosition(Builder $query, ?string $position): Builder
    {
        if (blank($position) || $position === 'all') {
            return $query;
        }

        return $query->where('position', $position);
    }

    /**
     * Scope a query to filter by period (YYYY-MM).
     */
    public function scopeByPeriod(Builder $query, ?string $period): Builder
    {
        if (blank($period)) {
            return $query;
        }

        return $query->where('period', $period);
    }
}
