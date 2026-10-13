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
    $decodedPath = str_replace(['../', '..\\'], '', urldecode($path));
    $baseDir = storage_path('app/public');
    $fullPath = $baseDir . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $decodedPath);

    if (!file_exists($fullPath) || is_dir($fullPath)) {
        $publicPath = public_path('storage' . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $decodedPath));
        if (file_exists($publicPath) && !is_dir($publicPath)) {
            $fullPath = $publicPath;
        } else {
            abort(404, 'File lampiran tidak ditemukan.');
        }
    }

    $mimeType = @mime_content_type($fullPath) ?: 'image/jpeg';

    return response()->file($fullPath, [
        'Content-Type' => $mimeType,
        'Access-Control-Allow-Origin' => '*',
        'Access-Control-Allow-Methods' => 'GET, HEAD, OPTIONS',
        'Cache-Control' => 'public, max-age=86400',
    ]);
})->where('path', '.*');
