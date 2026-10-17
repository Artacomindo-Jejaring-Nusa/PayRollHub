<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class ActivityLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'user_name',
        'user_email',
        'user_role',
        'company',
        'action',
        'module',
        'description',
        'details',
        'ip_address',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'details' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Record an activity log safely.
     */
    public static function record(
        string $action,
        string $module,
        string $description,
        mixed $details = null,
        ?string $company = null,
        ?User $user = null
    ): ?self {
        try {
            $currentUser = $user ?: Auth::user();
            $request = request();

            $formattedDetails = null;
            if ($details instanceof \Illuminate\Http\Request) {
                $formattedDetails = $details->except(['password', 'password_confirmation', 'token']);
            } elseif (is_object($details) && method_exists($details, 'toArray')) {
                $formattedDetails = $details->toArray();
            } elseif (is_array($details)) {
                $formattedDetails = $details;
            } elseif (!is_null($details)) {
                $formattedDetails = ['value' => (string) $details];
            }

            return self::create([
                'user_id' => $currentUser?->id,
                'user_name' => $currentUser?->name ?? 'Sistem / Anonim',
                'user_email' => $currentUser?->email ?? '-',
                'user_role' => $currentUser?->role ?? 'admin',
                'company' => $company ?: ($currentUser?->company ?? 'rbs'),
                'action' => $action,
                'module' => $module,
                'description' => $description,
                'details' => $formattedDetails,
                'ip_address' => $request?->ip(),
                'user_agent' => $request ? substr((string) $request->userAgent(), 0, 500) : null,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Gagal mencatat log aktivitas: ' . $e->getMessage());
            return null;
        }
    }
}
