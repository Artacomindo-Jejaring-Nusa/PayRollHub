<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'date',
        'check_in_time',
        'check_in_lat',
        'check_in_lng',
        'check_in_distance_meters',
        'check_in_status',
        'check_out_time',
        'check_out_lat',
        'check_out_lng',
        'check_out_distance_meters',
        'status',
        'notes',
    ];

    protected $casts = [
        'date' => 'date:Y-m-d',
        'check_in_lat' => 'float',
        'check_in_lng' => 'float',
        'check_in_distance_meters' => 'float',
        'check_out_lat' => 'float',
        'check_out_lng' => 'float',
        'check_out_distance_meters' => 'float',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
