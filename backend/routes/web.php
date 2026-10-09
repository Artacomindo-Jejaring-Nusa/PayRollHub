<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Artisan;

Route::get('/', function () {
    return view('welcome');
});



/**
 * Fallback Storage File Viewer (Jika cPanel mematikan symlink atau FollowSymLinks)
 */
Route::get('/storage/{path}', function ($path) {
    $storageRoot = realpath(storage_path('app/public'));
    $fullPath = realpath(storage_path('app/public/' . $path));
    if (!$fullPath || !$storageRoot || !str_starts_with($fullPath, $storageRoot) || !file_exists($fullPath)) {
        abort(404, 'File lampiran tidak ditemukan.');
    }
    return response()->file($fullPath);
})->where('path', '.*');
