<?php
declare(strict_types=1);

// Windows updater feed: keep the client URL and signed manifest unchanged.
// This counts GET feed checks, not completed downloads or installations.
ini_set('display_errors', '0');
try {
    @include_once __DIR__ . '/check-log.php';
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' && function_exists('record')) record('windows');
} catch (\Throwable $e) {
    // Logging must never prevent an update.
}

$feed = dirname(__DIR__) . '/products/musli/windows/latest.json';
header('Content-Type: application/json');
header('Cache-Control: no-store');
if (!is_file($feed)) {
    http_response_code(404);
    return;
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') readfile($feed);
