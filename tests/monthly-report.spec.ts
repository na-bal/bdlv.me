import { test, expect } from "@playwright/test";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer, type Server as HttpServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Приёмник сводок месяца Мюслей (фича 117.4 в репозитории приложения).
// Мюсли шлют сюда числа месяца (только по согласию человека) и, если человек написал, пару слов.
// Числа — строкой в файл ВНЕ public_html, рядом со счётом проверок обновлений; слова — ещё и в
// Telegram тем же ботом, что заявки с сайта. Адрес отправителя не пишется. «Принято» — только
// после записи на диск: приложение по нему зажигает блёстки на карточке месяца.
// Скрипт гоняется встроенным сервером PHP, Telegram — заглушкой на этом же Mac.

const SCRIPT = resolve(process.cwd(), "public", "updates", "report.php");
const FIXTURES = resolve(process.cwd(), "tests", "fixtures");
const hasPhp = spawnSync("php", ["-v"]).status === 0;

const ID = "3f9a2c71e0b84d6a9c15e2f07b6d8a41";
const NAME = "хитрый-ёж-бежит-домой";
const OCT = "2026-09-17..2026-10-16";

type Tg = { calls: Record<string, string>[]; fail: boolean; server: HttpServer; url: string };
type Box = { url: string; stats: string; tg: Tg; stop: () => void };

async function startTelegram(): Promise<Tg> {
  const tg = { calls: [] as Record<string, string>[], fail: false } as Tg;
  let next = 100;
  tg.server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      tg.calls.push(Object.fromEntries(new URLSearchParams(body)));
      if (tg.fail) {
        res.writeHead(502).end("down");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, result: { message_id: next++ } }));
    });
  });
  await new Promise<void>((r) => tg.server.listen(0, "127.0.0.1", r));
  const addr = tg.server.address();
  tg.url = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  return tg;
}

async function start(env: Record<string, string> = {}, stats?: string): Promise<Box> {
  const root = mkdtempSync(join(tmpdir(), "monthly-report-"));
  mkdirSync(join(root, "updates"));
  writeFileSync(join(root, "updates", "report.php"), readFileSync(SCRIPT));
  const secrets = join(root, "secrets.php");
  writeFileSync(secrets, "<?php return ['telegram_token' => 'T0K', 'telegram_chat_id' => '42'];");
  const statsDir = stats ?? join(root, "stats");
  const tg = await startTelegram();

  const port = 20000 + Math.floor(Math.random() * 5000);
  const proc: ChildProcess = spawn("php", ["-S", `127.0.0.1:${port}`, "-t", root], {
    env: {
      ...process.env,
      MUSLI_STATS_DIR: statsDir,
      MUSLI_SECRETS: secrets,
      MUSLI_TELEGRAM_API: tg.url,
      ...env,
    },
    stdio: "ignore",
  });
  const url = `http://127.0.0.1:${port}/updates/report.php`;
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(url, { method: "HEAD" });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return { url, stats: statsDir, tg, stop: () => { proc.kill(); tg.server.close(); } };
}

function report(month = OCT, extra: Record<string, unknown> = {}) {
  return {
    v: "0.1.11", month, n: 5, name: NAME, id: ID, meetings: 23, minutes: 860, days: 15, opened: 9,
    card: "marathoner", step: 3, how: "manual",
    when: { morning: 6, afternoon: 13, evening: 4 },
    fails: { transcription: 2, "recording.others-silent": 1 },
    ...extra,
  };
}

function words(extra: Record<string, unknown> = {}) {
  return { type: "words", id: ID, name: NAME, month: OCT, key: crypto.randomUUID(), kinds: ["idea"],
           message: "Было бы здорово, если бы Мюсли сами ставили тег", ...extra };
}

async function post(box: Box, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(box.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Musli/0.1.11", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

function rows(stats: string, prefix = "reports-"): Record<string, any>[] {
  if (!existsSync(stats)) return [];
  return readdirSync(stats)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".jsonl"))
    .flatMap((f) => readFileSync(join(stats, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
}

test.describe("приёмник сводок месяца — updates/report.php", () => {
  test.skip(!hasPhp, "нужен php в PATH (brew install php)");

  let box: Box;
  test.afterEach(() => box?.stop());

  test("сводка — строка на диске, потом «принято»; без слов в Telegram ничего", async () => {
    box = await start();
    const res = await post(box, { type: "report", reports: [report()] }, { "X-Real-IP": "203.0.113.7" });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true, accepted: [OCT] });

    const [line] = rows(box.stats);
    expect(line).toMatchObject({ kind: "report", id: ID, name: NAME, month: OCT, meetings: 23, card: "marathoner",
                                 when: { morning: 6, afternoon: 13, evening: 4 } });
    expect(line.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(JSON.stringify(line)).not.toContain("203.0.113.7");
    expect(box.tg.calls).toHaveLength(0);
  });

  test("указатель повторов разложен по первым знакам номера — не один растущий файл", async () => {
    box = await start();
    await post(box, { type: "report", reports: [report()] });
    const other = "ab" + ID.slice(2);
    await post(box, { type: "report", reports: [report(OCT, { id: other })] });
    expect(existsSync(join(box.stats, "reports-seen.json"))).toBe(false);
    expect(readdirSync(join(box.stats, "reports-seen")).sort()).toEqual(["3f.json", "ab.json"]);
    const shard = JSON.parse(readFileSync(join(box.stats, "reports-seen", "ab.json"), "utf8"));
    expect(Object.keys(shard)).toEqual([`${other}|${OCT}`]);
  });

  test("тот же месяц той же установки второй раз не пишется, но «принято»", async () => {
    box = await start();
    await post(box, { type: "report", reports: [report()] });
    const again = await post(box, { type: "report", reports: [report()] });
    expect(again.json).toEqual({ ok: true, accepted: [OCT] });
    expect(rows(box.stats)).toHaveLength(1);
  });

  test("первая отправка давнего человека — все месяцы одной просьбой", async () => {
    box = await start();
    const months = ["2026-06-17..2026-07-16", "2026-07-17..2026-08-16", "2026-08-17..2026-09-16", OCT];
    const res = await post(box, { type: "report", reports: months.map((m) => report(m)) });
    expect(res.json.accepted).toEqual(months);
    expect(rows(box.stats).map((r) => r.month)).toEqual(months);
  });

  test("неверное — отказ и ничего на диске", async () => {
    box = await start();
    expect((await fetch(box.url)).status).toBe(405);
    expect((await post(box, "{ битый")).status).toBe(400);
    expect((await post(box, { type: "report", reports: [report(OCT, { id: "не-номер" })] })).status).toBe(422);
    expect((await post(box, { type: "report", reports: [report("октябрь")] })).status).toBe(422);
    expect((await post(box, { type: "report", reports: [] })).status).toBe(422);
    expect((await post(box, { type: "что-то" })).status).toBe(422);
    const huge = report(OCT, { pad: "x".repeat(70_000) });
    expect((await post(box, { type: "report", reports: [huge] })).status).toBe(413);
    expect(rows(box.stats)).toHaveLength(0);
  });

  test("значения чистятся: длинное обрезается, вложенное глубже одного уровня и чужие ключи — нет", async () => {
    box = await start();
    await post(box, { type: "report", reports: [report(OCT, {
      model: "a\"b<script>\n" + "y".repeat(300),
      deep: { a: { b: 1 } },
      "bad key!": 1,
      bundle: ["2026-06-17..2026-07-16"],
      disk_gb: 6.2,
      perm_mic: true,
    })] });
    const [line] = rows(box.stats);
    expect(line.model.length).toBeLessThanOrEqual(64);
    expect(line.model).not.toContain("<");
    expect(line).not.toHaveProperty("deep");
    expect(line).not.toHaveProperty("bad key!");
    expect(line.bundle).toEqual(["2026-06-17..2026-07-16"]);
    expect(line.disk_gb).toBe(6.2);
    expect(line.perm_mic).toBe(true);
  });

  test("слова — строка со ссылкой на месяц, контакт отдельно, сообщение в Telegram", async () => {
    box = await start();
    await post(box, { type: "report", reports: [report()] });
    const res = await post(box, words({ contact: "anna.k@mail.ru" }));
    expect(res.json).toEqual({ ok: true });

    const said = rows(box.stats).find((r) => r.kind === "words")!;
    expect(said).toMatchObject({ id: ID, month: OCT, kinds: ["idea"], message: expect.stringContaining("тег") });
    expect(JSON.stringify(rows(box.stats))).not.toContain("anna.k@mail.ru");
    expect(rows(box.stats, "contacts")).toEqual([expect.objectContaining({ id: ID, contact: "anna.k@mail.ru" })]);

    expect(box.tg.calls).toHaveLength(1);
    const msg = box.tg.calls[0];
    expect(msg.chat_id).toBe("42");
    expect(msg.text).toContain(`Привет из Мюслей · ${NAME}`);
    expect(msg.text).toContain("октябрь · Марафонец · 0.1.11");
    expect(msg.text).toContain("идея: Было бы здорово");
    expect(msg.text).toContain("ответить: anna.k@mail.ru");
    expect(msg.text).toContain("23 встречи · 15 дней с записью · раскрыто 9 из 11");
    expect(msg.text).toContain(`pulse --who ${NAME}`);
  });

  test("повтор тех же слов после обрыва не пишется и не шлётся второй раз", async () => {
    box = await start();
    await post(box, { type: "report", reports: [report()] });
    const same = words();
    await post(box, same);
    expect((await post(box, same)).json).toEqual({ ok: true });
    expect(rows(box.stats).filter((r) => r.kind === "words")).toHaveLength(1);
    expect(box.tg.calls).toHaveLength(1);
  });

  test("дописка — ответом на первое сообщение", async () => {
    box = await start();
    await post(box, { type: "report", reports: [report()] });
    await post(box, words());
    await post(box, words({ kinds: ["use"], message: "Нашла в поиске встречу двухмесячной давности" }));
    expect(box.tg.calls).toHaveLength(2);
    expect(box.tg.calls[0].reply_to_message_id).toBeUndefined();
    expect(box.tg.calls[1].reply_to_message_id).toBe("100");
    expect(box.tg.calls[1].text).toContain(`Дописано · ${NAME} · к октябрю`);
    expect(box.tg.calls[1].text).toContain("польза: Нашла в поиске");
    expect(box.tg.calls[1].text).toContain("без контакта — ответить нельзя");
  });

  test("сбой — помечен в заголовке, рядом сбои месяца из сводки", async () => {
    box = await start();
    await post(box, { type: "report", reports: [report()] });
    await post(box, words({ kinds: ["bug"], message: "В Телемосте не слышно собеседников" }));
    const text = box.tg.calls[0].text;
    expect(text.startsWith(`⚠️ Сбой · ${NAME}`)).toBe(true);
    expect(text).toContain("сбой: В Телемосте");
    expect(text).toContain("сбои месяца: расшифровка 2, запись — собеседников не слышно 1");
  });

  test("слова к первой отправке за несколько месяцев — одно сообщение со всеми", async () => {
    box = await start();
    const months = ["2026-06-17..2026-07-16", "2026-07-17..2026-08-16", OCT];
    await post(box, { type: "report", reports: months.map((m) => report(m)) });
    await post(box, words({ kinds: ["emotion"], message: "Порадовало" }));
    expect(box.tg.calls).toHaveLength(1);
    expect(box.tg.calls[0].text).toContain("сразу за 3 месяца: июль — октябрь");
  });

  test("Telegram недоступен — слова всё равно на диске и «принято»", async () => {
    box = await start();
    box.tg.fail = true;
    await post(box, { type: "report", reports: [report()] });
    const res = await post(box, words());
    expect(res.json).toEqual({ ok: true });
    expect(rows(box.stats).filter((r) => r.kind === "words")).toHaveLength(1);
    expect(rows(box.stats).some((r) => r.warn === "telegram-failed")).toBe(true);
  });

  test("потолок сообщений в Telegram за час — дальше только на диск", async () => {
    box = await start({ MUSLI_REPORT_TG_PER_HOUR: "1" });
    await post(box, { type: "report", reports: [report()] });
    await post(box, words());
    await post(box, words({ message: "ещё" }));
    expect(box.tg.calls).toHaveLength(1);
    expect(rows(box.stats).filter((r) => r.kind === "words")).toHaveLength(2);
    expect(rows(box.stats).some((r) => r.warn === "telegram-capped")).toBe(true);
  });

  test("одна установка не может завалить приёмник: потолок просьб в час", async () => {
    box = await start({ MUSLI_REPORT_PER_ID_HOUR: "3" });
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await post(box, words({ message: `раз ${i}` }))).status);
    expect(codes).toEqual([200, 200, 200, 429]);
  });

  test("сырые строки старше 14 месяцев сервер убирает сам", async () => {
    const stats = mkdtempSync(join(tmpdir(), "monthly-report-stats-"));
    const now = new Date();
    const ym = (back: number) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
      return d.toISOString().slice(0, 7);
    };
    writeFileSync(join(stats, `reports-${ym(15)}.jsonl`), "{}\n");
    writeFileSync(join(stats, `reports-${ym(13)}.jsonl`), "{}\n");
    writeFileSync(join(stats, `checks-${ym(20)}.jsonl`), "{}\n");
    box = await start({}, stats);
    await post(box, { type: "report", reports: [report()] });
    const files = readdirSync(stats);
    expect(files).not.toContain(`reports-${ym(15)}.jsonl`);
    expect(files).toContain(`reports-${ym(13)}.jsonl`);
    expect(files, "чужие файлы не трогаем").toContain(`checks-${ym(20)}.jsonl`);
  });

  // Тела ниже собраны самим приложением (MusliTests/MonthReportTests.swift, writeServerFixtures) —
  // если приложение и приёмник разойдутся в полях, это всплывёт здесь, а не на живой проверке.
  // Переписать при смене строк сводки: конфиг /tmp/musli_report_fixture.json, {"out": "<этот репозиторий>/tests/fixtures"};
  // отставание ловит serverFixtures_matchTheCurrentFormat в приложении.
  test("настоящая просьба приложения: принята, каждое поле сохранено как есть", async () => {
    box = await start();
    const body = JSON.parse(readFileSync(join(FIXTURES, "musli-report-request.json"), "utf8"));
    const res = await post(box, body);
    expect(res.status).toBe(200);
    expect(res.json.accepted).toEqual(body.reports.map((r: any) => r.month));
    const stored = rows(box.stats).filter((r) => r.kind === "report");
    expect(stored).toHaveLength(body.reports.length);
    body.reports.forEach((sent: Record<string, unknown>, i: number) => {
      for (const [key, value] of Object.entries(sent)) {
        expect(stored[i][key], `поле ${key}`).toEqual(value);
      }
    });
  });

  test("настоящие слова приложения: приняты, сообщение в Telegram, контакт отдельно", async () => {
    box = await start();
    const reports = JSON.parse(readFileSync(join(FIXTURES, "musli-report-request.json"), "utf8"));
    await post(box, reports);
    const words = JSON.parse(readFileSync(join(FIXTURES, "musli-words-request.json"), "utf8"));
    const res = await post(box, words);
    expect(res.status).toBe(200);
    const said = rows(box.stats).find((r) => r.kind === "words")!;
    expect(said.message).toBe(words.message);
    expect(said.kinds).toEqual(words.kinds);
    expect(said.month).toBe(words.month);
    expect(said.contact, "контакт не рядом с числами").toBeUndefined();
    expect(rows(box.stats, "contacts")[0].contact).toBe(words.contact);
    expect(box.tg.calls).toHaveLength(1);
    expect(box.tg.calls[0].text).toContain(words.message);
  });
});
