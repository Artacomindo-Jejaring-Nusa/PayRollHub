<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Artisan;

Route::get('/', function () {
    return view('welcome');
});



/**
 * Fallback Storage File Viewer (Jika symlink belum dibuat atau diakses langsung)
 */
Route::get('/storage/{path}', function ($path) {
    $decodedPath = urldecode($path);
    $storageRoot = realpath(storage_path('app/public'));
    $fullPath = realpath(storage_path('app/public/' . $decodedPath));
    if (!$fullPath || !$storageRoot || !str_starts_with($fullPath, $storageRoot) || !file_exists($fullPath)) {
        abort(404, 'File lampiran tidak ditemukan.');
    }
    return response()->file($fullPath, [
        'Access-Control-Allow-Origin' => '*',
        'Access-Control-Allow-Methods' => 'GET, HEAD, OPTIONS',
        'Cache-Control' => 'public, max-age=86400',
    ]);
})->where('path', '.*');
