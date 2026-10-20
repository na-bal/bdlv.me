<?php
declare(strict_types=1);

/**
 * Лента обновлений Мюслей со счётчиком проверок (фича 115.1 в репозитории приложения).
 *
 * Мюсли раз в сутки спрашивают https://bdlv.me/musli/appcast.xml. Этот адрес вшит во
 * все установленные копии, поэтому .htaccess тихо отдаёт его сюда: скрипт дописывает
 * строку в файл и отдаёт ту же ленту байт в байт.
 *
 * Что пишется: время, версия из заголовка Sparkle («Musli/0.1.9 Sparkle/2.8.0») и
 * параметры, которые приложение прибавляет к запросу, — только из белого списка.
 * Адрес, с которого пришёл запрос, НЕ пишется. Для старых копий без номера установки
 * вместо него — суточная метка: адрес, перемешанный с солью текущего дня. Соль
 * прошлых дней стирается, так что вчерашние метки ни с чем не связать.
 *
 * Файлы лежат ВЫШЕ public_html, в ../stats: зеркальная выкладка (rsync --delete по
 * public_html) туда не дотягивается, и снаружи их не скачать.
 *
 * Главное правило: счёт не важнее обновлений. Любая ошибка записи глотается, лента
 * уходит всё равно. Адрес открыт всем (карточка 293), поэтому у записи два потолка на сутки:
 * общий и на один адрес (по метке с солью дня). Сверх потолка лента уходит без строки. Сайту отдаёт PHP 7.4 — без возможностей восьмой версии.
 */

ini_set('display_errors', '0'); // предупреждение в теле сломало бы ленту

const KEYS = ['id', 'name', 'v', 'build', 'os', 'chip', 'model', 'ram', 'first', 'tz', 'lang', 'rec', 'login',
              'tried', 'fail'];
const VALUE_MAX = 64;
/** «Что пробовал»: все 11 возможностей через запятую — 66 знаков, общий предел их режет. */
const LONG_KEYS = ['tried' => 128];

/** Числа можно подменить окружением — только для тестов. Копия Mac проверяет раз в сутки:
 *  200 с адреса — офис за одним адресом, 20 000 в сутки — с большим запасом на сегодня. */
function limit(string $env, int $fallback): int {
    $v = getenv($env);
    return is_string($v) && ctype_digit($v) ? (int) $v : $fallback;
}

function feedPath(): string { return dirname(__DIR__) . '/musli/appcast.xml'; }

/** Папка счёта: .../bdlv.me/stats — на два уровня выше public_html/updates/. */
function statsDir(): string {
    $override = getenv('MUSLI_STATS_DIR'); // только для тестов
    return is_string($override) && $override !== '' ? $override : dirname(__DIR__, 2) . '/stats';
}

/** Буквы, цифры и `. _ : + / , -` — больше в наших полях ничего не бывает. */
function clean($v, int $max = VALUE_MAX): string {
    if (!is_string($v)) return '';
    $v = preg_replace('~[^\p{L}\p{N}._:+/,\-]~u', '', $v);
    return is_string($v) ? mb_substr($v, 0, $max) : '';
}

function clientIp(): string {
    foreach (['HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $k) {
        $raw = $_SERVER[$k] ?? '';
        if (!is_string($raw) || $raw === '') continue;
        $first = trim(explode(',', $raw)[0]);
        if (filter_var($first, FILTER_VALIDATE_IP)) return $first;
    }
    return '';
}

/** Соль сегодняшнего дня (UTC). Создаётся первой проверкой дня; прошлые стираются. */
function todaySalt(string $dir, int $now): string {
    $path = $dir . '/salt-' . gmdate('Y-m-d', $now);
    $h = @fopen($path, 'x');
    if ($h !== false) {
        fwrite($h, bin2hex(random_bytes(32)));
        fclose($h);
        @chmod($path, 0600);
        foreach (glob($dir . '/salt-*') ?: [] as $old) {
            if ($old !== $path) @unlink($old);
        }
    }
    // Вторая проверка в ту же секунду могла застать файл ещё пустым — подождать немного.
    for ($i = 0; $i < 5; $i++) {
        $salt = @file_get_contents($path);
        if (is_string($salt) && $salt !== '') return $salt;
        usleep(20000);
    }
    return '';
}

/** Укладывается ли строка в потолки дня. Счёт — в `checks-day.json` (день, всего, по меткам
 *  адресов), со сменой дня начинается заново. Замок занят дольше 0,3 с — строку пропускаем:
 *  лента не ждёт счёта. */
function dayAllows(string $dir, int $now, string $mark): bool {
    $fh = @fopen($dir . '/checks-day.json', 'c+');
    if ($fh === false) return false;
    $until = microtime(true) + 0.3;
    while (!flock($fh, LOCK_EX | LOCK_NB)) {
        if (microtime(true) >= $until) { fclose($fh); return false; }
        usleep(20000);
    }
    try {
        $data = json_decode((string) stream_get_contents($fh), true);
        $day = gmdate('Y-m-d', $now);
        if (!is_array($data) || ($data['day'] ?? '') !== $day) $data = ['day' => $day, 'total' => 0, 'addr' => []];
        if ($data['total'] >= limit('MUSLI_CHECKS_PER_DAY', 20000)) return false;
        if ($mark !== '' && ($data['addr'][$mark] ?? 0) >= limit('MUSLI_CHECKS_PER_ADDR_DAY', 200)) return false;
        $data['total']++;
        if ($mark !== '') $data['addr'][$mark] = ($data['addr'][$mark] ?? 0) + 1;
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, (string) json_encode($data));
        return true;
    } finally {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}

function record(): void {
    $dir = statsDir();
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) return;

    $now = time();
    $ip = clientIp();
    $salt = todaySalt($dir, $now);
    $mark = ($ip !== '' && $salt !== '') ? substr(hash_hmac('sha256', $ip, $salt), 0, 16) : '';
    if (!dayAllows($dir, $now, $mark)) return;

    $line = ['at' => gmdate('Y-m-d\TH:i:s\Z', $now)];

    $ua = substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 160);
    if (preg_match('~^(\S+)/(\S+) Sparkle/(\S+)~', $ua, $m)) {
        $line['app'] = clean($m[1]);
        $line['ua_v'] = clean($m[2]);
        $line['sparkle'] = clean($m[3]);
    } else {
        $line['ua'] = clean(str_replace(' ', '_', $ua), 80);
    }

    foreach (KEYS as $k) {
        $v = clean($_GET[$k] ?? null, LONG_KEYS[$k] ?? VALUE_MAX);
        if ($v !== '') $line[$k] = $v;
    }

    if (!isset($line['id']) && $salt !== '') {
        $line['day'] = substr(hash_hmac('sha256', $ip . '|' . $ua, $salt), 0, 16);
    }

    $json = json_encode($line, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (is_string($json)) {
        @file_put_contents($dir . '/checks-' . gmdate('Y-m', $now) . '.jsonl', $json . "\n",
            FILE_APPEND | LOCK_EX);
    }
}

function serve(): void {
    $feed = feedPath();
    if (!is_file($feed)) {
        http_response_code(404);
        return;
    }
    header('Content-Type: text/xml');
    // Каждая проверка должна дойти до скрипта, иначе промежуточный кэш съест счёт.
    header('Cache-Control: no-store');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'HEAD') return;
    readfile($feed);
}

try {
    // Sparkle спрашивает GET; HEAD — проверки доступности, их не считаем.
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') record();
} catch (\Throwable $e) {
    // счёт не важнее обновлений
}
serve();
