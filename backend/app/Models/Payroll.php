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
        'absence_note',
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
            'net_base_price' => 'decimal:2',
            'bpjs_kes' => 'decimal:2',
            'bpjs_tk' => 'decimal:2',
            'basic_salary' => 'decimal:2',
            'allowance' => 'decimal:2',
            'deduction' => 'decimal:2',
            'absence_count' => 'integer',
            'absence_rate' => 'decimal:2',
            'absence_deduction' => 'decimal:2',
            'take_home_pay' => 'decimal:2',
        ];
    }

    /**
     * Bootstrap the model and its traits.
     */
    protected static function booted(): void
    {
        static::saving(function (Payroll $payroll) {
            // Auto compute salary from net_base_price if provided
            if ((float) $payroll->net_base_price > 0) {
                if ((float) $payroll->bpjs_kes <= 0) {
                    $payroll->bpjs_kes = round((float) $payroll->net_base_price * 0.05, 2);
                }
                if ((float) $payroll->bpjs_tk <= 0) {
                    $payroll->bpjs_tk = round((float) $payroll->net_base_price * 0.0924, 2);
                }
                // Gaji Pokok = Harga Dasar dipotong PPh & Fee - BPJS KES 5% - BPJS TK 9.24%
                $payroll->basic_salary = (float) $payroll->net_base_price - (float) $payroll->bpjs_kes - (float) $payroll->bpjs_tk;
            }

            // Auto calculate absence deduction if rate and count are specified
            if ((int) $payroll->absence_count > 0 && (float) $payroll->absence_rate > 0 && (float) $payroll->absence_deduction <= 0) {
                $payroll->absence_deduction = (int) $payroll->absence_count * (float) $payroll->absence_rate;
            }

            // Sync status with resign_date
            if (!empty($payroll->resign_date) && empty($payroll->status)) {
                $payroll->status = 'off';
            } elseif (empty($payroll->status)) {
                $payroll->status = 'active';
            }

            // Take Home Pay = Basic Salary + Allowance - General Deduction - Absence Deduction
            $thp = (float) $payroll->basic_salary + (float) $payroll->allowance - (float) $payroll->deduction - (float) $payroll->absence_deduction;
            $payroll->take_home_pay = max(0, $thp);
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
     * Scope a query to filter by period or Surat Pesanan (SP 1 - SP 10).
     */
    public function scopeByPeriod(Builder $query, ?string $period): Builder
    {
        if (blank($period) || $period === 'all') {
            return $query;
        }

        $trimmed = trim($period);
        $candidates = [$trimmed];

        // Handle SP format e.g. "SP 1", "SP 2", ... "SP 10" or "SP1"
        if (preg_match('/^SP\s*(\d+)$/i', $trimmed, $m)) {
            $num = (int) $m[1];
            $candidates[] = "SP {$num}";
            $candidates[] = "SP{$num}";
            $candidates[] = "Surat Pesanan {$num}";
            $candidates[] = "Surat Pesanan $num";

            // Backward compatibility with initial data imported under SP 1
            if ($num === 1) {
                $candidates[] = '2026-08';
                $candidates[] = '2026-03';
                $candidates[] = '2026-09';
                $candidates[] = '2026-01';
            } else {
                $month = str_pad((string) $num, 2, '0', STR_PAD_LEFT);
                $candidates[] = "2026-{$month}";
            }
        } elseif (preg_match('/^2026-(\d{2})$/', $trimmed, $m)) {
            $num = (int) $m[1];
            $candidates[] = "SP {$num}";
            $candidates[] = "SP{$num}";
            if (in_array($trimmed, ['2026-08', '2026-03', '2026-09'])) {
                $candidates[] = 'SP 1';
            }
        }

        $candidates = array_unique($candidates);

        return $query->where(function (Builder $q) use ($candidates) {
            foreach ($candidates as $cand) {
                $q->orWhere('period', $cand)
                  ->orWhere('period', 'like', "%{$cand}%");
            }
        });
    }

    /**
     * Scope a query to filter by employment status ('active', 'off', or 'all').
     */
    public function scopeByStatus(Builder $query, ?string $status): Builder
    {
        if (blank($status) || $status === 'all') {
            return $query;
        }

        return $query->where('status', $status);
    }

    /**
     * Scope a query to filter by company entity ('rbs', 'rimamandiri', or 'all').
     */
    public function scopeByCompany(Builder $query, ?string $company): Builder
    {
        if (blank($company) || $company === 'all') {
            return $query;
        }

        return $query->where('company', $company);
    }
}

