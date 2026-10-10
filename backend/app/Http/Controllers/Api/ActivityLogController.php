<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    /**
     * Display paginated activity logs (Super Admin Only).
     */
    public function index(Request $request): JsonResponse
    {
        $search = $request->input('search');
        $module = $request->input('module');
        $action = $request->input('action');
        $company = $request->input('company');
        $userId = $request->input('user_id');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
        $perPage = (int) $request->input('per_page', 20);

        if ($perPage <= 0 || $perPage > 100) {
            $perPage = 20;
        }

        $query = ActivityLog::query()
            ->when($search, function ($q, $s) {
                $q->where(function ($sub) use ($s) {
                    $sub->where('user_name', 'like', "%{$s}%")
                        ->orWhere('user_email', 'like', "%{$s}%")
                        ->orWhere('description', 'like', "%{$s}%")
                        ->orWhere('action', 'like', "%{$s}%")
                        ->orWhere('ip_address', 'like', "%{$s}%");
                });
            })
            ->when($module && $module !== 'all', fn ($q) => $q->where('module', $module))
            ->when($action && $action !== 'all', fn ($q) => $q->where('action', $action))
            ->when($company && $company !== 'all', fn ($q) => $q->where('company', $company))
            ->when($userId, fn ($q) => $q->where('user_id', $userId))
            ->when($startDate, fn ($q) => $q->whereDate('created_at', '>=', $startDate))
            ->when($endDate, fn ($q) => $q->whereDate('created_at', '<=', $endDate))
            ->latest('id');

        $logs = $query->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'data' => $logs->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    /**
     * Get summary statistics of activity logs for Super Admin dashboard.
     */
    public function stats(Request $request): JsonResponse
    {
        $company = $request->input('company');
        $baseQuery = ActivityLog::query()
            ->when($company && $company !== 'all', fn ($q) => $q->where('company', $company));

        $today = (clone $baseQuery)->whereDate('created_at', today())->count();
        $thisWeek = (clone $baseQuery)->where('created_at', '>=', now()->startOfWeek())->count();
        $totalLogs = (clone $baseQuery)->count();

        // Breakdown per action
        $topActions = (clone $baseQuery)
            ->selectRaw('action, COUNT(*) as count')
            ->groupBy('action')
            ->orderByDesc('count')
            ->limit(5)
            ->get();

        // Admin paling aktif
        $mostActiveAdmins = (clone $baseQuery)
            ->selectRaw('user_name, user_email, user_role, COUNT(*) as count')
            ->groupBy('user_name', 'user_email', 'user_role')
            ->orderByDesc('count')
            ->limit(5)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'today_count' => $today,
                'this_week_count' => $thisWeek,
                'total_count' => $totalLogs,
                'top_actions' => $topActions,
                'active_admins' => $mostActiveAdmins,
            ],
        ]);
    }
}
