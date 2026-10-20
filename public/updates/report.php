<?php
declare(strict_types=1);

/**
 * Приёмник сводок месяца Мюслей (фича 117.4 в репозитории приложения).
 *
 * Человек сам решает отправить сводку своего месяца — только числа, без названий встреч,
 * имён и текста — и, если захочет, пару слов разработчику. Сюда приходят два вида просьб:
 *   report — сводки одного или нескольких месяцев (первая отправка давнего человека — все разом);
 *   words  — слова к месяцу: сообщение, о чём оно и, по желанию, почта или ник для ответа.
 *
 * Сводка — строкой в `reports-ГГГГ-ММ.jsonl` (месяц получения), рядом со счётом проверок
 * обновлений, ВЫШЕ public_html: зеркальная выкладка туда не дотягивается, снаружи не скачать.
 * Почта и ник — отдельным файлом `contacts.jsonl`, не рядом с числами. Адрес отправителя не
 * пишется нигде, как и в счётчике проверок.
 *
 * Главные правила:
 *   - «принято» — только после записи на диск: по нему приложение зажигает блёстки;
 *   - тот же месяц той же установки дважды не пишется (повтор после обрыва связи) — ответ тот же;
 *   - слова уходят в Telegram тем же ботом, что заявки с сайта, ПОСЛЕ записи: не ответил бот —
 *     строка на месте; сводки без слов в Telegram не идут;
 *   - сырые строки хранятся 14 месяцев: старые файлы и контакты убираются при записи, без расписания;
 *   - адрес открыт всем (карточка 293): поток с одного адреса отсекается до разбора тела, отказ по
 *     потолку не оставляет отметок, занятый замок — «повторите позже», а не очередь процессов.
 *     Адрес отправителя и здесь не пишется: для потолка — метка, перемешанная с солью дня, как в
 *     счётчике проверок, и живёт она час.
 *
 * Ключ бота — `secrets.php` выше публичной папки: своего у bdlv.me нет — берём соседний,
 * gaasgaas.ru на том же хостинге (один ключ — одно место для замены).
 *
 * Сайту отдаёт PHP 7.4 — без возможностей восьмой версии (ни match, ни str_contains, ни ?->).
 */

ini_set('display_errors', '0');

const BODY_MAX     = 65536;
const REPORTS_MAX  = 36;
const KEYS_MAX     = 150;
const VALUE_MAX    = 64;
const MESSAGE_MAX  = 2000;
const CONTACT_MAX  = 120;
const KEEP_MONTHS  = 14;
const TG_TEXT_MAX  = 4000;   // у Telegram предел 4096
const LOCK_WAIT_MS = 2000;
const KINDS = ['emotion' => 'эмоция', 'use' => 'польза', 'idea' => 'идея', 'bug' => 'сбой'];

/** Числа можно подменить окружением — только для тестов. */
function limit(string $env, int $fallback): int {
    $v = getenv($env);
    return is_string($v) && ctype_digit($v) ? (int) $v : $fallback;
}

function statsDir(): string {
    $override = getenv('MUSLI_STATS_DIR');
    return is_string($override) && $override !== '' ? $override : dirname(__DIR__, 2) . '/stats';
}

function secretsPath(): string {
    $override = getenv('MUSLI_SECRETS');
    if (is_string($override) && $override !== '') return $override;
    $own = dirname(__DIR__, 2) . '/secrets.php';
    return is_file($own) ? $own : dirname(__DIR__, 3) . '/gaasgaas.ru/secrets.php';
}

function telegramApi(): string {
    $override = getenv('MUSLI_TELEGRAM_API');
    return is_string($override) && $override !== '' ? rtrim($override, '/') : 'https://api.telegram.org';
}

function respond(int $code, array $body) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Буквы, цифры и `. _ : + / , -` — как в счётчике проверок обновлений. */
function cleanValue($v, int $max = VALUE_MAX): string {
    if (!is_string($v)) return '';
    $v = preg_replace('~[^\p{L}\p{N}._:+/,\-]~u', '', $v);
    return is_string($v) ? mb_substr($v, 0, $max) : '';
}

/** Текст человека: без управляющих знаков (строки сохраняются), без краевых пробелов. */
function cleanText($v, int $max): string {
    if (!is_string($v)) return '';
    $v = preg_replace('/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    $v = preg_replace("/\r\n?/", "\n", $v) ?? '';
    return mb_substr(trim($v), 0, $max);
}

function validId($v): bool { return is_string($v) && preg_match('/^[0-9a-f]{32}$/', $v) === 1; }

function validMonth($v): bool {
    return is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/', $v) === 1;
}

function isList(array $a): bool { return $a === [] || array_keys($a) === range(0, count($a) - 1); }

/** Сводка как пришла, но только ровные значения: числа, да/нет, короткие строки, список строк,
 *  словарь чисел. Вложенное глубже и чужие ключи — нет. */
function sanitizeReport(array $in): array {
    $out = [];
    foreach ($in as $key => $value) {
        if (count($out) >= KEYS_MAX) break;
        if (!is_string($key) || preg_match('/^[a-z0-9_.\-]{1,40}$/', $key) !== 1) continue;
        if (is_int($value) || is_float($value) || is_bool($value)) {
            $out[$key] = $value;
        } elseif (is_string($value)) {
            $out[$key] = cleanValue($value);
        } elseif (is_array($value) && isList($value)) {
            $list = [];
            foreach (array_slice($value, 0, 40) as $item) {
                if (is_string($item)) $list[] = cleanValue($item);
            }
            $out[$key] = $list;
        } elseif (is_array($value)) {
            $map = [];
            foreach (array_slice($value, 0, 60, true) as $k => $n) {
                $k = cleanValue((string) $k, 40);
                if ($k !== '' && (is_int($n) || is_float($n))) $map[$k] = $n;
            }
            if ($map) $out[$key] = (object) $map;
        }
    }
    return $out;
}

/* --- Файлы под одним замком: просьб мало, простота важнее. --- */

/** Замок занят дольше двух секунд — «повторите позже» (приложение повторит само): процессы PHP
 *  не выстраиваются в очередь, которая задела бы и ленту обновлений на том же хостинге. */
function withLock(string $dir, callable $body) {
    $fh = fopen($dir . '/reports.lock', 'c');
    if ($fh === false) respond(500, ['ok' => false]);
    $until = microtime(true) + LOCK_WAIT_MS / 1000;
    while (!flock($fh, LOCK_EX | LOCK_NB)) {
        if (microtime(true) >= $until) {
            fclose($fh);
            respond(503, ['ok' => false]);
        }
        usleep(50000);
    }
    try {
        return $body();
    } finally {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}

function readJson(string $path): array {
    $raw = @file_get_contents($path);
    $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
    return is_array($data) ? $data : [];
}

function writeJson(string $path, array $data): bool {
    $tmp = $path . '.tmp';
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json) || @file_put_contents($tmp, $json) === false) return false;
    @chmod($tmp, 0600);
    return @rename($tmp, $path);
}

function appendLine(string $path, array $row): bool {
    $fresh = !is_file($path);
    $json = json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $ok = is_string($json) && @file_put_contents($path, $json . "\n", FILE_APPEND | LOCK_EX) !== false;
    if ($fresh) @chmod($path, 0600);
    return $ok;
}

function reportsFile(string $dir, int $now): string { return $dir . '/reports-' . gmdate('Y-m', $now) . '.jsonl'; }

/** Отметки за последний час: укладывается ли просьба во все потолки сразу (`[ключ => потолок]`).
 *  Отметки ставит только прошедший все — отказ не оставляет следа, и мусор файл не растит. */
function rateTake(string $path, array $limits, int $now): bool {
    $data = readJson($path);
    $edge = $now - 3600;
    foreach ($data as $k => $stamps) {
        $kept = array_values(array_filter((array) $stamps, function ($t) use ($edge) { return is_int($t) && $t > $edge; }));
        if ($kept) $data[$k] = $kept; else unset($data[$k]);
    }
    $ok = true;
    foreach ($limits as $key => $max) {
        if (count($data[$key] ?? []) >= $max) $ok = false;
    }
    if ($ok) {
        foreach ($limits as $key => $max) $data[$key][] = $now;
    }
    writeJson($path, $data);
    return $ok;
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

/** Соль дня — тот же файл, что у счётчика проверок (`appcast.php`): создаёт первый за день,
 *  прошлые стираются. Пусто — потолок по адресу на эту просьбу не действует. */
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
    for ($i = 0; $i < 5; $i++) {
        $salt = @file_get_contents($path);
        if (is_string($salt) && $salt !== '') return $salt;
        usleep(20000);
    }
    return '';
}

/** Потолок по адресу — до чтения и разбора тела: случайные номера в теле его не обходят. */
function checkAddress(string $dir, int $now): void {
    $ip = clientIp();
    $salt = $ip !== '' ? todaySalt($dir, $now) : '';
    if ($salt === '') return;
    $mark = 'a:' . substr(hash_hmac('sha256', $ip, $salt), 0, 16);
    $ok = withLock($dir, function () use ($dir, $now, $mark) {
        return rateTake($dir . '/reports-addr.json', [$mark => limit('MUSLI_REPORT_PER_ADDR_HOUR', 30)], $now);
    });
    if (!$ok) respond(429, ['ok' => false]);
}

/** Указатель повторов — по первым двум знакам номера: при десятках тысяч установок один файл
 *  перечитывался бы целиком на каждую просьбу. */
function seenPath(string $dir, string $id): string {
    $shard = $dir . '/reports-seen';
    if (!is_dir($shard)) @mkdir($shard, 0700, true);
    return $shard . '/' . substr($id, 0, 2) . '.json';
}

/** Файлы сводок старше 14 месяцев, записи в этой части указателя и контакты — прочь. */
function prune(string $dir, array &$seen, int $now): void {
    $y = (int) gmdate('Y', $now);
    $m = (int) gmdate('n', $now) - KEEP_MONTHS;
    while ($m < 1) { $m += 12; $y -= 1; }
    $cutoff = sprintf('%04d-%02d', $y, $m);
    foreach (glob($dir . '/reports-*.jsonl') ?: [] as $file) {
        if (preg_match('/reports-(\d{4}-\d{2})\.jsonl$/', $file, $mm) && $mm[1] < $cutoff) @unlink($file);
    }
    foreach ($seen as $key => $entry) {
        if (substr((string) ($entry['got'] ?? ''), 0, 7) < $cutoff) unset($seen[$key]);
    }
    pruneContacts($dir . '/contacts.jsonl', $cutoff);
}

/** Контакты пишутся по порядку: первая строка свежая — переписывать нечего, файл не перечитываем. */
function pruneContacts(string $path, string $cutoff): void {
    $fh = @fopen($path, 'r');
    if ($fh === false) return;
    $first = json_decode((string) fgets($fh), true);
    fclose($fh);
    if (is_array($first) && substr((string) ($first['at'] ?? ''), 0, 7) >= $cutoff) return;
    $kept = '';
    foreach (@file($path) ?: [] as $line) {
        $row = json_decode($line, true);
        if (is_array($row) && substr((string) ($row['at'] ?? ''), 0, 7) >= $cutoff) $kept .= $line;
    }
    $tmp = $path . '.tmp';
    if (@file_put_contents($tmp, $kept) !== false) {
        @chmod($tmp, 0600);
        @rename($tmp, $path);
    }
}

/* --- Telegram --- */

function monthName(string $month, bool $dative = false): string {
    $nom = ['', 'январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
    $dat = ['', 'январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню', 'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю'];
    // Личный месяц называется, как в приложении: начался до 16-го — по началу, позже — по концу.
    $from = (int) substr($month, 8, 2);
    $n = (int) ($from <= 15 ? substr($month, 5, 2) : substr($month, 17, 2));
    return ($dative ? $dat : $nom)[$n] ?? $month;
}

function plural(int $n, string $one, string $few, string $many): string {
    $d = $n % 10; $h = $n % 100;
    $w = ($d === 1 && $h !== 11) ? $one : (($d >= 2 && $d <= 4 && ($h < 12 || $h > 14)) ? $few : $many);
    return "$n $w";
}

function titleName($raw): string {
    $raw = (string) $raw;
    $names = [
        'marathoner' => 'Марафонец', 'sprinter' => 'Спринтер', 'earlyBird' => 'Ранняя пташка',
        'nightOwl' => 'Ночная сова', 'metronome' => 'Метроном', 'hurricane' => 'Ураган', 'polyglot' => 'Полиглот',
        'listener' => 'Слушатель', 'storyteller' => 'Рассказчик', 'conversationalist' => 'Собеседник',
        'tongueTwister' => 'Скороговорка', 'thinker' => 'Мыслитель', 'connector' => 'Связной',
        'pioneer' => 'Первопроходец', 'innerCircle' => 'Свой круг', 'oneOnOne' => 'Один на один',
        'bigStage' => 'Большая сцена', 'summaryCollector' => 'Собиратель итогов', 'archivist' => 'Архивариус',
        'newcomer' => 'Новичок', 'vacation' => 'Каникулы', 'quietMonth' => 'Тихий месяц',
    ];
    return $names[$raw] ?? $raw;
}

function failsLine(array $fails): string {
    $reasons = [
        'voice-missing' => 'нет вашего голоса', 'others-missing' => 'нет собеседников',
        'voice-lost' => 'пропал ваш голос', 'others-lost' => 'пропали собеседники', 'part-lost' => 'потерян кусок',
        'tracks-drifted' => 'дорожки разошлись', 'disk-full' => 'кончилось место',
        'others-silent' => 'собеседников не слышно',
    ];
    $named = ['transcription' => 'расшифровка', 'assembly' => 'сборка записи', 'crash' => 'падения', 'database' => 'база'];
    $parts = [];
    if (!empty($fails['transcription'])) $parts[] = 'расшифровка ' . (int) $fails['transcription'];
    $recording = array_filter(array_keys($fails), function ($k) { return strpos((string) $k, 'recording.') === 0; });
    sort($recording);
    foreach ($recording as $k) {
        $reason = substr($k, strlen('recording.'));
        if (!empty($fails[$k])) $parts[] = 'запись — ' . ($reasons[$reason] ?? $reason) . ' ' . (int) $fails[$k];
    }
    foreach ($fails as $k => $n) {
        if ($k === 'transcription' || strpos((string) $k, 'recording.') === 0 || empty($n)) continue;
        $parts[] = ($named[$k] ?? $k) . ' ' . (int) $n;
    }
    return $parts ? implode(', ', $parts) : 'нет';
}

/** Текст сообщения. Без разметки — любые знаки в словах человека безопасны. */
function wordsText(array $w, array $entry, bool $addition): string {
    $bug = in_array('bug', $w['kinds'], true);
    $name = $w['name'] !== '' ? $w['name'] : $w['id'];
    $head = $addition ? "Дописано · $name · к " . monthName($w['month'], true) : "Привет из Мюслей · $name";
    $lines = [($bug ? '⚠️ Сбой · ' : '') . ($bug && !$addition ? $name : $head)];
    if (!$addition) {
        $meta = [monthName($w['month'])];
        if (!empty($entry['card'])) $meta[] = titleName($entry['card']);
        if (!empty($entry['v'])) $meta[] = $entry['v'];
        $lines[] = implode(' · ', $meta);
        $bundle = $entry['bundle'] ?? [];
        if (count($bundle) > 1) {
            $lines[] = 'сразу за ' . plural(count($bundle), 'месяц', 'месяца', 'месяцев') . ': '
                     . monthName($bundle[0]) . ' — ' . monthName($bundle[count($bundle) - 1]);
        }
    }
    if ($w['message'] !== '') {
        $labels = array_map(function ($k) { return KINDS[$k]; }, $w['kinds']);
        $lines[] = ($labels ? implode(', ', $labels) . ': ' : '') . $w['message'];
    }
    $lines[] = $w['contact'] !== '' ? 'ответить: ' . $w['contact'] : 'без контакта — ответить нельзя';
    if (isset($entry['meetings'])) {
        $lines[] = plural((int) $entry['meetings'], 'встреча', 'встречи', 'встреч') . ' · '
                 . plural((int) ($entry['days'] ?? 0), 'день', 'дня', 'дней') . ' с записью · раскрыто '
                 . (int) ($entry['opened'] ?? 0) . ' из 11';
    }
    if ($bug && isset($entry['fails'])) $lines[] = 'сбои месяца: ' . failsLine((array) $entry['fails']);
    $lines[] = 'pulse --who ' . $name;
    return mb_substr(implode("\n", $lines), 0, TG_TEXT_MAX);
}

/** Номер сообщения в Telegram или null. */
function sendTelegram(string $text, $replyTo) {
    $secrets = @include secretsPath();
    if (!is_array($secrets) || empty($secrets['telegram_token']) || empty($secrets['telegram_chat_id'])) return null;
    $fields = ['chat_id' => (string) $secrets['telegram_chat_id'], 'text' => $text, 'disable_web_page_preview' => 'true'];
    if ($replyTo !== null) $fields['reply_to_message_id'] = (string) $replyTo;
    $ch = curl_init(telegramApi() . '/bot' . $secrets['telegram_token'] . '/sendMessage');
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($fields),
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if (!is_string($body) || $code !== 200) return null;
    $json = json_decode($body, true);
    return is_array($json) && ($json['ok'] ?? false) === true ? ($json['result']['message_id'] ?? 0) : null;
}

/* --- Просьбы --- */

function handleReports(array $in, string $dir, int $now) {
    $reports = $in['reports'] ?? null;
    if (!is_array($reports) || !isList($reports) || count($reports) < 1 || count($reports) > REPORTS_MAX) {
        respond(422, ['ok' => false, 'error' => 'reports']);
    }
    $clean = [];
    foreach ($reports as $r) {
        if (!is_array($r) || !validId($r['id'] ?? null) || !validMonth($r['month'] ?? null)
            || ($r['id'] ?? '') !== ($reports[0]['id'] ?? '')) {
            respond(422, ['ok' => false, 'error' => 'report']);
        }
        $clean[] = sanitizeReport($r);
    }
    $id = $clean[0]['id'];
    $months = array_map(function ($r) { return $r['month']; }, $clean);

    return withLock($dir, function () use ($dir, $now, $id, $clean, $months) {
        if (!rateTake($dir . '/reports-rate.json', [$id => limit('MUSLI_REPORT_PER_ID_HOUR', 20),
                                                    '*' => limit('MUSLI_REPORT_TOTAL_HOUR', 3000)], $now)) {
            respond(429, ['ok' => false]);
        }
        $seen = readJson(seenPath($dir, $id));
        prune($dir, $seen, $now);
        foreach ($clean as $r) {
            $key = $id . '|' . $r['month'];
            if (isset($seen[$key]['report'])) continue;
            if (!appendLine(reportsFile($dir, $now), ['at' => gmdate('Y-m-d\TH:i:s\Z', $now), 'kind' => 'report'] + $r)) {
                respond(500, ['ok' => false]);
            }
            $seen[$key] = ($seen[$key] ?? []) + [
                'report' => true, 'got' => gmdate('Y-m', $now), 'v' => $r['v'] ?? '',
                'card' => is_string($r['card'] ?? null) ? $r['card'] : '',
                'meetings' => $r['meetings'] ?? 0, 'days' => $r['days'] ?? 0, 'opened' => $r['opened'] ?? 0,
                'fails' => $r['fails'] ?? (object) [], 'bundle' => $months,
            ];
        }
        if (!writeJson(seenPath($dir, $id), $seen)) respond(500, ['ok' => false]);
        respond(200, ['ok' => true, 'accepted' => $months]);
    });
}

function handleWords(array $in, string $dir, int $now) {
    $w = [
        'id' => $in['id'] ?? null, 'month' => $in['month'] ?? null,
        'name' => cleanValue($in['name'] ?? ''), 'key' => cleanValue($in['key'] ?? '', 40),
        'kinds' => array_values(array_unique(array_filter((array) ($in['kinds'] ?? []), function ($k) {
            return is_string($k) && isset(KINDS[$k]);
        }))),
        'message' => cleanText($in['message'] ?? '', MESSAGE_MAX),
        'contact' => cleanText(str_replace("\n", ' ', (string) ($in['contact'] ?? '')), CONTACT_MAX),
    ];
    if (!validId($w['id']) || !validMonth($w['month']) || strlen($w['key']) < 8
        || ($w['message'] === '' && $w['contact'] === '')) {
        respond(422, ['ok' => false, 'error' => 'words']);
    }
    $key = $w['id'] . '|' . $w['month'];

    $plan = withLock($dir, function () use ($dir, $now, $w, $key) {
        if (!rateTake($dir . '/reports-rate.json', [$w['id'] => limit('MUSLI_REPORT_PER_ID_HOUR', 20),
                                                    '*' => limit('MUSLI_REPORT_TOTAL_HOUR', 3000)], $now)) {
            respond(429, ['ok' => false]);
        }
        $seen = readJson(seenPath($dir, $w['id']));
        prune($dir, $seen, $now);
        $entry = $seen[$key] ?? ['got' => gmdate('Y-m', $now)];
        if (in_array($w['key'], $entry['words'] ?? [], true)) return null;     // повтор после обрыва
        $at = gmdate('Y-m-d\TH:i:s\Z', $now);
        $row = ['at' => $at, 'kind' => 'words', 'id' => $w['id'], 'name' => $w['name'], 'month' => $w['month'],
                'key' => $w['key'], 'kinds' => $w['kinds'], 'message' => $w['message']];
        if (!appendLine(reportsFile($dir, $now), $row)) respond(500, ['ok' => false]);
        if ($w['contact'] !== '') {
            appendLine($dir . '/contacts.jsonl', ['at' => $at, 'id' => $w['id'], 'month' => $w['month'], 'contact' => $w['contact']]);
        }
        $entry['words'][] = $w['key'];
        $seen[$key] = $entry;
        if (!writeJson(seenPath($dir, $w['id']), $seen)) respond(500, ['ok' => false]);
        // Свой потолок у каждой установки: один человек не забьёт Telegram и общий потолок.
        $capped = !rateTake($dir . '/telegram-rate.json', [$w['id'] => limit('MUSLI_REPORT_TG_PER_ID_HOUR', 3),
                                                           '*' => limit('MUSLI_REPORT_TG_PER_HOUR', 120)], $now);
        if ($capped) appendLine(reportsFile($dir, $now), ['at' => $at, 'warn' => 'telegram-capped', 'id' => $w['id'], 'month' => $w['month']]);
        return $capped ? null : $entry;
    });

    // Telegram — после записи, вне замка: строка уже на диске, что бы ни ответил бот.
    if (is_array($plan)) {
        $first = $plan['tg'] ?? null;
        $sent = sendTelegram(wordsText($w, $plan, $first !== null), $first);
        withLock($dir, function () use ($dir, $now, $w, $key, $sent, $first) {
            if ($sent === null) {
                appendLine(reportsFile($dir, $now), ['at' => gmdate('Y-m-d\TH:i:s\Z', $now), 'warn' => 'telegram-failed',
                                                     'id' => $w['id'], 'month' => $w['month']]);
            } elseif ($first === null) {
                $seen = readJson(seenPath($dir, $w['id']));
                $seen[$key]['tg'] = $sent;
                writeJson(seenPath($dir, $w['id']), $seen);
            }
        });
    }
    respond(200, ['ok' => true]);
}

function handleRequest() {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') respond(405, ['ok' => false]);
    $dir = statsDir();
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) respond(500, ['ok' => false]);
    $now = time();
    checkAddress($dir, $now);

    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > BODY_MAX) respond(413, ['ok' => false]);
    $raw = (string) file_get_contents('php://input', false, null, 0, BODY_MAX + 1);
    if (strlen($raw) > BODY_MAX) respond(413, ['ok' => false]);
    $in = json_decode($raw, true);
    if (!is_array($in)) respond(400, ['ok' => false]);

    $type = $in['type'] ?? '';
    if ($type === 'report') handleReports($in, $dir, $now);
    if ($type === 'words') handleWords($in, $dir, $now);
    respond(422, ['ok' => false, 'error' => 'type']);
}

if (PHP_SAPI !== 'cli') handleRequest();
