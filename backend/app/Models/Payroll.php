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
        'birth_date',
        'gender',
        'whatsapp',
        'email',
        'join_date',
        'resign_date',
        'status',
        'replaced_payroll_id',
        'replaced_employee_name',
        'replacement_note',
        'replacement_date',
        'company',
        'period',
        'net_base_price',
        'bpjs_kes',
        'bpjs_tk',
        'bpjs_tk_jht',
        'bpjs_tk_jp',
        'basic_salary',
        'allowance',
        'deduction',
        'absence_count',
        'absence_rate',
        'absence_deduction',
        'absence_note',
        'custom_deductions',
        'pph21',
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
            'bpjs_tk_jht' => 'decimal:2',
            'bpjs_tk_jp' => 'decimal:2',
            'basic_salary' => 'decimal:2',
            'allowance' => 'decimal:2',
            'deduction' => 'decimal:2',
            'custom_deductions' => 'array',
            'absence_count' => 'integer',
            'absence_rate' => 'decimal:2',
            'absence_deduction' => 'decimal:2',
            'pph21' => 'decimal:2',
            'take_home_pay' => 'decimal:2',
            'replacement_date' => 'date',
        ];
    }

    /**
     * Bootstrap the model and its traits.
     */
    protected static function booted(): void
    {
        static::saving(function (Payroll $payroll) {
            // Auto calculate absence deduction if rate and count are specified
            if ((int) $payroll->absence_count > 0 && (float) $payroll->absence_rate > 0 && (float) $payroll->absence_deduction <= 0) {
                $payroll->absence_deduction = (int) $payroll->absence_count * (float) $payroll->absence_rate;
            }

            // Sync custom deductions sum into deduction if custom_deductions is present
            if (!empty($payroll->custom_deductions) && is_array($payroll->custom_deductions)) {
                $customSum = 0;
                foreach ($payroll->custom_deductions as $cd) {
                    $customSum += (float) ($cd['amount'] ?? 0);
                }
                $payroll->deduction = $customSum;
            }

            // Sync status with resign_date
            if (!empty($payroll->resign_date) && empty($payroll->status)) {
                $payroll->status = 'off';
            } elseif (empty($payroll->status)) {
                $payroll->status = 'active';
            }

            // Break down BPJS TK to JHT (2%) and JP (1%) jika belum terisi
            if ((float) $payroll->bpjs_tk > 0 && empty($payroll->bpjs_tk_jht) && empty($payroll->bpjs_tk_jp)) {
                $jht = round((float) $payroll->bpjs_tk * (2 / 3), 2);
                $payroll->bpjs_tk_jht = $jht;
                $payroll->bpjs_tk_jp = round((float) $payroll->bpjs_tk - $jht, 2);
            }

            // Formula Resmi THP Sesuai Format Baru 2026:
            // (Gaji Pokok + BPJS Kesehatan + Tunjangan) - (Potongan Absensi + Potongan Lainnya + PPh21)
            // PERHATIAN ATURAN KLIEN: BPJS TK BUKAN pengurang, melainkan ditampilkan di bawah sebagai "BPJS yang bisa dicairkan"
            if (! $payroll->isDirty('take_home_pay') || (float) $payroll->take_home_pay <= 0) {
                $totalEarnings = (float) $payroll->basic_salary + (float) $payroll->bpjs_kes + (float) $payroll->allowance;
                $totalDeductions = (float) $payroll->absence_deduction + (float) $payroll->deduction + (float) $payroll->pph21;
                $thp = $totalEarnings - $totalDeductions;
                $payroll->take_home_pay = max(0, $thp);
            }
        });
    }

    public function replacedEmployee(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Payroll::class, 'replaced_payroll_id');
    }

    public function replacedBy(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Payroll::class, 'replaced_payroll_id');
    }

    public function replacementRecord(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(EmployeeReplacement::class, 'new_payroll_id');
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
     * Extract month / index number (1 - 12) from various period strings.
     */
    public static function extractPeriodIndex(?string $period): ?int
    {
        if (blank($period) || $period === 'all') {
            return null;
        }

        $clean = trim($period);
        if (preg_match('/^SP\s*(\d+)$/i', $clean, $m)) {
            return (int) $m[1];
        }
        if (preg_match('/^\d{4}-(\d{2})$/', $clean, $m)) {
            return (int) $m[1];
        }
        if (preg_match('/^Surat\s+Pesanan\s*(\d+)/i', $clean, $m)) {
            return (int) $m[1];
        }
        if (is_numeric($clean)) {
            return (int) $clean;
        }

        return null;
    }

    /**
     * Scope a query to filter by period range (e.g. from SP 1 to SP 10 or month range).
     */
    public function scopeByPeriodRange(Builder $query, ?string $startPeriod, ?string $endPeriod): Builder
    {
        $startIndex = self::extractPeriodIndex($startPeriod);
        $endIndex = self::extractPeriodIndex($endPeriod);

        if ($startIndex === null && $endIndex === null) {
            return $query;
        }

        $min = $startIndex ?? 1;
        $max = $endIndex ?? 12;
        if ($min > $max) {
            [$min, $max] = [$max, $min];
        }

        $candidates = [];
        for ($i = $min; $i <= $max; $i++) {
            $candidates[] = "SP {$i}";
            $candidates[] = "SP{$i}";
            $candidates[] = "Surat Pesanan {$i}";
            $month = str_pad((string) $i, 2, '0', STR_PAD_LEFT);
            $candidates[] = "2026-{$month}";
            if ($i === 1) {
                $candidates[] = '2026-08';
                $candidates[] = '2026-03';
                $candidates[] = '2026-09';
                $candidates[] = '2026-01';
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

    /**
     * Get linked user account if exists.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'nik', 'nik');
    }
}

