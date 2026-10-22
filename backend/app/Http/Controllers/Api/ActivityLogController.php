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

    /**
     * Get user & admin login tracking and inactivity monitoring (Point 18).
     */
    public function userLogins(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        $company = $request->input('company');
        if ($currentUser && !$currentUser->isSuperAdmin() && $currentUser->company) {
            $company = $currentUser->company;
        }

        $roleFilter = $request->input('role', 'all_admin'); // 'all_admin', 'admin', 'super_admin', 'karyawan', 'all'
        $statusFilter = $request->input('status', 'all'); // 'never', 'inactive_7', 'inactive_30', 'active', 'all'
        $search = trim($request->input('search', ''));
        $perPage = (int) $request->input('per_page', 25);

        $baseQuery = \App\Models\User::query()
            ->when($company && $company !== 'all', fn ($q) => $q->where('company', $company));

        // Global metrics before pagination
        $metricQuery = clone $baseQuery;
        if ($roleFilter === 'all_admin') {
            $metricQuery->whereIn('role', ['admin', 'super_admin', 'lord_admin']);
        } elseif ($roleFilter && $roleFilter !== 'all') {
            $metricQuery->where('role', $roleFilter);
        }

        $totalUsers = (clone $metricQuery)->count();
        $neverLoggedIn = (clone $metricQuery)->whereNull('last_login_at')->count();
        $inactive7 = (clone $metricQuery)->where(function ($q) {
            $q->where('last_login_at', '<', now()->subDays(7))
              ->orWhereNull('last_login_at');
        })->count();
        $activeRecently = (clone $metricQuery)->where('last_login_at', '>=', now()->subDays(7))->count();

        // Apply filters
        $query = clone $baseQuery;

        if ($roleFilter === 'all_admin') {
            $query->whereIn('role', ['admin', 'super_admin', 'lord_admin']);
        } elseif ($roleFilter && $roleFilter !== 'all') {
            $query->where('role', $roleFilter);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('nik', 'like', "%{$search}%");
            });
        }

        if ($statusFilter === 'never') {
            $query->whereNull('last_login_at');
        } elseif ($statusFilter === 'inactive_7') {
            $query->where(function ($q) {
                $q->where('last_login_at', '<', now()->subDays(7))
                  ->orWhereNull('last_login_at');
            });
        } elseif ($statusFilter === 'inactive_30') {
            $query->where(function ($q) {
                $q->where('last_login_at', '<', now()->subDays(30))
                  ->orWhereNull('last_login_at');
            });
        } elseif ($statusFilter === 'active') {
            $query->where('last_login_at', '>=', now()->subDays(7));
        }

        // Sorting: default user yang paling lama tidak login / belum login di atas
        $sortBy = $request->input('sort_by', 'last_login_at');
        $sortOrder = $request->input('sort_order', 'asc');

        if ($sortBy === 'last_login_at') {
            if ($sortOrder === 'asc') {
                $query->orderByRaw('last_login_at IS NOT NULL, last_login_at ASC');
            } else {
                $query->orderByRaw('last_login_at IS NULL, last_login_at DESC');
            }
        } else {
            $query->orderBy($sortBy, $sortOrder);
        }

        $paginated = $query->paginate($perPage);

        // Enhance with last activity log
        $userIds = $paginated->getCollection()->pluck('id')->toArray();
        $latestActivities = ActivityLog::whereIn('user_id', $userIds)
            ->select('user_id', 'action', 'description', 'created_at')
            ->orderBy('id', 'desc')
            ->get()
            ->unique('user_id')
            ->keyBy('user_id');

        $items = $paginated->getCollection()->map(function ($u) use ($latestActivities) {
            $daysSinceLogin = null;
            $statusLabel = 'never';

            if ($u->last_login_at) {
                $daysSinceLogin = (int) now()->diffInDays($u->last_login_at);
                $statusLabel = $daysSinceLogin <= 7 ? 'active' : ($daysSinceLogin <= 30 ? 'inactive_7' : 'inactive_30');
            }

            $lastAct = $latestActivities->get($u->id);

            return [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role,
                'company' => $u->company ?: 'rbs',
                'nik' => $u->nik,
                'phone' => $u->phone,
                'last_login_at' => $u->last_login_at ? $u->last_login_at->format('Y-m-d H:i:s') : null,
                'last_login_human' => $u->last_login_at ? $u->last_login_at->diffForHumans() : 'Belum Pernah Login',
                'last_login_ip' => $u->last_login_ip ?: '-',
                'days_since_login' => $daysSinceLogin,
                'status_label' => $statusLabel,
                'last_activity' => $lastAct ? [
                    'action' => $lastAct->action,
                    'description' => $lastAct->description,
                    'created_at' => $lastAct->created_at->format('Y-m-d H:i:s'),
                    'human' => $lastAct->created_at->diffForHumans(),
                ] : null,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $items,
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
            'summary' => [
                'total_users' => $totalUsers,
                'active_recently' => $activeRecently,
                'inactive_over_7_days' => $inactive7,
                'never_logged_in' => $neverLoggedIn,
            ],
        ]);
    }
}
