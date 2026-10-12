<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProvincePayrollSetting extends Model
{
    use HasFactory;

    protected $table = 'province_payroll_settings';

    protected $fillable = [
        'company',
        'province',
        'ump',
        'bpjs_kes',
        'bpjs_tk_jht',
        'bpjs_tk_jp',
        'bpjs_tk',
        'notes',
    ];

    protected $casts = [
        'ump' => 'decimal:2',
        'bpjs_kes' => 'decimal:2',
        'bpjs_tk_jht' => 'decimal:2',
        'bpjs_tk_jp' => 'decimal:2',
        'bpjs_tk' => 'decimal:2',
    ];

    /**
     * Hitung otomatis total bpjs_tk jika jht dan jp terisi
     */
    protected static function booted(): void
    {
        static::saving(function (ProvincePayrollSetting $setting) {
            if ((float) $setting->bpjs_tk_jht > 0 || (float) $setting->bpjs_tk_jp > 0) {
                $setting->bpjs_tk = (float) $setting->bpjs_tk_jht + (float) $setting->bpjs_tk_jp;
            }
        });
    }
}
