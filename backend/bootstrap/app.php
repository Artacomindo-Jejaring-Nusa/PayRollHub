<?php

use App\Http\Middleware\EnsureIsAdmin;
use App\Http\Middleware\EnsureIsSuperAdmin;
use App\Http\Middleware\SecurityHeadersMiddleware;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;

// Pastikan zona waktu selalu Indonesia Barat (WIB)
date_default_timezone_set('Asia/Jakarta');

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->prepend(HandleCors::class);
        $middleware->append(SecurityHeadersMiddleware::class);
        $middleware->alias([
            'admin' => EnsureIsAdmin::class,
            'super_admin' => EnsureIsSuperAdmin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, \Illuminate\Http\Request $request) {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthenticated. Sesi login telah berakhir atau token otentikasi tidak valid.',
            ], 401);
        });
    })->create();
