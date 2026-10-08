<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => (function () {
        $raw = env('ALLOWED_ORIGINS', env('FRONTEND_URL', ''));
        $list = array_map('trim', explode(',', (string) $raw));
        $list = array_merge($list, [
            'https://rimbunbuanasejahtera.com',
            'https://www.rimbunbuanasejahtera.com',
            'https://riamamandiripratama.com',
            'https://www.riamamandiripratama.com',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
        ]);
        return array_values(array_unique(array_filter($list)));
    })(),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
