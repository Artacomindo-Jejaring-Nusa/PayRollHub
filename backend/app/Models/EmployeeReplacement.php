<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeReplacement extends Model
{
    use HasFactory;

    protected $table = 'employee_replacements';

    protected $fillable = [
        'company',
        'new_payroll_id',
        'new_employee_name',
        'new_nik',
        'old_payroll_id',
        'old_employee_name',
        'old_nik',
        'school_unit',
        'position',
        'replacement_date',
        'reason',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'replacement_date' => 'date',
    ];

    public function newPayroll(): BelongsTo
    {
        return $this->belongsTo(Payroll::class, 'new_payroll_id');
    }

    public function oldPayroll(): BelongsTo
    {
        return $this->belongsTo(Payroll::class, 'old_payroll_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
