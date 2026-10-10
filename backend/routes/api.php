<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PayrollController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes for PayrollHub
|--------------------------------------------------------------------------
*/

// Public Authentication
Route::post('/login', [AuthController::class, 'login']);

// Developer Feature Passkey Verification
Route::post('/dev/verify-key', function (\Illuminate\Http\Request $request) {
    $inputKey = trim($request->input('key', ''));
    $validKeys = ['DEV-REPORT-2026', 'ARTAC-DEV-2026', 'DEV-2026', env('DEV_ACCESS_KEY', 'DEV-REPORT-2026')];
    if (in_array(strtoupper($inputKey), array_map('strtoupper', $validKeys))) {
        return response()->json([
            'status' => 'success',
            'message' => 'Developer Access Key valid. Fitur berhasil dibuka.',
            'valid' => true,
        ]);
    }
    return response()->json([
        'status' => 'error',
        'message' => 'Developer Access Key tidak valid. Silakan periksa kembali.',
        'valid' => false,
    ], 422);
});

// Authenticated Routes (Requires Bearer token from Sanctum)
Route::middleware('auth:sanctum')->group(function () {
    // Auth Session
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Payroll Read & Export (Accessible by Admin and Viewer)
    Route::get('/payrolls', [PayrollController::class, 'index']);
    Route::get('/payrolls/export', [PayrollController::class, 'export']);
    Route::get('/payrolls/template', [PayrollController::class, 'downloadTemplate']);
    Route::get('/payrolls/{payroll}/slip-pdf', [PayrollController::class, 'slipPdf']);
    Route::get('/payrolls/{payroll}', [PayrollController::class, 'show']);

    // Announcements (Read-only for all logged in users, Write for Admin & HR)
    Route::get('/announcements', [\App\Http\Controllers\Api\AnnouncementController::class, 'index']);
    Route::post('/announcements', [\App\Http\Controllers\Api\AnnouncementController::class, 'store']);
    Route::put('/announcements/{announcement}', [\App\Http\Controllers\Api\AnnouncementController::class, 'update']);
    Route::delete('/announcements/{announcement}', [\App\Http\Controllers\Api\AnnouncementController::class, 'destroy']);

    // Admin & HR Review of Work Reports
    Route::get('/admin/work-reports/export', [\App\Http\Controllers\Api\AdminWorkReportController::class, 'export']);
    Route::get('/admin/work-reports/{workReport}/pdf', [\App\Http\Controllers\Api\AdminWorkReportController::class, 'downloadSinglePdf']);
    Route::get('/admin/work-reports', [\App\Http\Controllers\Api\AdminWorkReportController::class, 'index']);
    Route::put('/admin/work-reports/{workReport}/status', [\App\Http\Controllers\Api\AdminWorkReportController::class, 'updateStatus']);

    // Employee Self-Service Portal Routes
    Route::prefix('employee')->group(function () {
        Route::get('/dashboard', [\App\Http\Controllers\Api\EmployeePortalController::class, 'dashboard']);
        Route::get('/payrolls', [\App\Http\Controllers\Api\EmployeePortalController::class, 'payrolls']);
        Route::get('/payrolls/{id}', [\App\Http\Controllers\Api\EmployeePortalController::class, 'showPayroll']);
        Route::get('/payrolls/{id}/slip-pdf', [\App\Http\Controllers\Api\EmployeePortalController::class, 'downloadSlipPdf']);
        Route::get('/profile', [\App\Http\Controllers\Api\EmployeePortalController::class, 'profile']);
        Route::put('/profile', [\App\Http\Controllers\Api\EmployeePortalController::class, 'updateProfile']);
        Route::get('/work-reports', [\App\Http\Controllers\Api\EmployeePortalController::class, 'workReports']);
        Route::post('/work-reports', [\App\Http\Controllers\Api\EmployeePortalController::class, 'storeWorkReport']);
        Route::get('/announcements', [\App\Http\Controllers\Api\EmployeePortalController::class, 'announcements']);

        // Employee Geofence Attendance (Absensi Radius)
        Route::get('/attendance/today', [\App\Http\Controllers\Api\EmployeeAttendanceController::class, 'today']);
        Route::post('/attendance/check-in', [\App\Http\Controllers\Api\EmployeeAttendanceController::class, 'checkIn']);
        Route::post('/attendance/check-out', [\App\Http\Controllers\Api\EmployeeAttendanceController::class, 'checkOut']);
        Route::get('/attendance/history', [\App\Http\Controllers\Api\EmployeeAttendanceController::class, 'history']);
    });

    // Admin Only Operations
    Route::middleware('admin')->group(function () {
        // Attendance Management & Settings (Admin)
        Route::get('/admin/attendances', [\App\Http\Controllers\Api\AdminAttendanceController::class, 'index']);
        Route::get('/admin/attendances/summary', [\App\Http\Controllers\Api\AdminAttendanceController::class, 'summary']);
        Route::get('/admin/attendances/export', [\App\Http\Controllers\Api\AdminAttendanceController::class, 'export']);
        Route::get('/admin/attendance-settings', [\App\Http\Controllers\Api\AdminAttendanceController::class, 'getSettings']);
        Route::put('/admin/attendance-settings', [\App\Http\Controllers\Api\AdminAttendanceController::class, 'updateSettings']);

        // Payroll Modifications
        Route::post('/payrolls', [PayrollController::class, 'store']);
        Route::put('/payrolls/{payroll}', [PayrollController::class, 'update']);
        Route::match(['patch', 'post', 'put'], '/payrolls/{payroll}/status', [PayrollController::class, 'updateStatus']);
        Route::delete('/payrolls/{payroll}', [PayrollController::class, 'destroy']);
        Route::post('/payrolls/import/preview', [PayrollController::class, 'previewImport']);
        Route::post('/payrolls/import', [PayrollController::class, 'import']);

        // User Account Management
        Route::apiResource('users', UserController::class);
    });

    // Super Admin Only Operations (Audit Trail / Activity Logs)
    Route::middleware('super_admin')->group(function () {
        Route::get('/admin/activity-logs', [\App\Http\Controllers\Api\ActivityLogController::class, 'index']);
        Route::get('/admin/activity-logs/stats', [\App\Http\Controllers\Api\ActivityLogController::class, 'stats']);
    });
});

