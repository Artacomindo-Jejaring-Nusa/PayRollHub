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

    // Admin Only Operations
    Route::middleware('admin')->group(function () {
        // Payroll Modifications
        Route::post('/payrolls', [PayrollController::class, 'store']);
        Route::put('/payrolls/{payroll}', [PayrollController::class, 'update']);
        Route::patch('/payrolls/{payroll}/status', [PayrollController::class, 'updateStatus']);
        Route::delete('/payrolls/{payroll}', [PayrollController::class, 'destroy']);
        Route::post('/payrolls/import/preview', [PayrollController::class, 'previewImport']);
        Route::post('/payrolls/import', [PayrollController::class, 'import']);

        // User Account Management
        Route::apiResource('users', UserController::class);
    });
});
