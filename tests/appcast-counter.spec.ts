import { test, expect } from "@playwright/test";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Счётчик проверок обновлений Мюслей (фича 115.1 в репозитории приложения).
// Адрес ленты `/musli/appcast.xml` вшит во все установленные копии, поэтому
// .htaccess тихо отдаёт его скрипту `updates/appcast.php`: тот дописывает строку
// в файл ВНЕ public_html и отдаёт ту же ленту. Apache и его правила здесь не
// исполняются — скрипт гоняется встроенным сервером PHP, правило проверяется
// текстом в htaccess.spec.ts, а живое поведение — пробой на боевом сервере.

const PUBLIC = resolve(process.cwd(), "public");
const SCRIPT = join(PUBLIC, "updates", "appcast.php");
const FEED = join(PUBLIC, "musli", "appcast.xml");
const UA = "Musli/0.1.10 Sparkle/2.8.0";

const hasPhp = spawnSync("php", ["-v"]).status === 0;

type Server = { url: string; stats: string; stop: () => void };

/** Копия раскладки сайта во временной папке + свой файл счёта. */
async function startServer(stats?: string, env: Record<string, string> = {}): Promise<Server> {
  const root = mkdtempSync(join(tmpdir(), "appcast-counter-"));
  mkdirSync(join(root, "updates"));
  mkdirSync(join(root, "musli"));
  copyFileSync(SCRIPT, join(root, "updates", "appcast.php"));
  copyFileSync(FEED, join(root, "musli", "appcast.xml"));
  const statsDir = stats ?? join(root, "stats");

  const port = 18000 + Math.floor(Math.random() * 2000);
  const proc: ChildProcess = spawn("php", ["-S", `127.0.0.1:${port}`, "-t", root], {
    env: { ...process.env, MUSLI_STATS_DIR: statsDir, ...env },
    stdio: "ignore",
  });
  const url = `http://127.0.0.1:${port}/updates/appcast.php`;
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(url, { method: "HEAD" });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return { url, stats: statsDir, stop: () => proc.kill() };
}

function lines(stats: string): Record<string, string>[] {
  const files = readdirSync(stats).filter((f) => /^checks-\d{4}-\d{2}\.jsonl$/.test(f));
  return files.flatMap((f) =>
    readFileSync(join(stats, f), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l)),
  );
}

test.describe("счётчик проверок обновлений — updates/appcast.php", () => {
  test.skip(!hasPhp, "нужен php в PATH (brew install php)");

  let server: Server;
  test.afterEach(() => server?.stop());

  test("отдаёт ленту байт в байт", async () => {
    server = await startServer();
    const res = await fetch(`${server.url}?id=a1`, { headers: { "User-Agent": UA } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/xml");
    expect(await res.text()).toBe(readFileSync(FEED, "utf8"));
  });

  test("пишет поля из белого списка и ничего сверх", async () => {
    server = await startServer();
    const q = new URLSearchParams({
      id: "4f1c9e2a7b",
      name: "хитрый-ёж-бежит-домой",
      v: "0.1.10",
      os: "27.0",
      rec: "3",
      login: "1",
      evil: "1",
    });
    await fetch(`${server.url}?${q}`, {
      headers: { "User-Agent": UA, "X-Real-IP": "203.0.113.7" },
    });

    const [line] = lines(server.stats);
    expect(line).toMatchObject({
      id: "4f1c9e2a7b",
      name: "хитрый-ёж-бежит-домой",
      v: "0.1.10",
      os: "27.0",
      rec: "3",
      login: "1",
      app: "Musli",
      ua_v: "0.1.10",
    });
    expect(line.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(line).not.toHaveProperty("evil");
    expect(line, "у кого есть номер — суточная метка не нужна").not.toHaveProperty("day");
    expect(JSON.stringify(line)).not.toContain("203.0.113.7");
  });

  test("что пробовал и был ли сбой — полный список возможностей не режется", async () => {
    server = await startServer();
    // Все 11 возможностей — 66 знаков, длиннее общего предела в 64.
    const tried = "call,voices,names,notes,tags,people,search,ai,export,hotkeys,pause";
    const q = new URLSearchParams({ id: "4f1c9e2a7b", tried, fail: "1" });
    await fetch(`${server.url}?${q}`, { headers: { "User-Agent": UA } });

    const [line] = lines(server.stats);
    expect(line.tried).toBe(tried);
    expect(line.fail).toBe("1");
  });

  test("старая копия без номера — суточная метка, адреса нет", async () => {
    server = await startServer();
    const old = { "User-Agent": "Musli/0.1.9 Sparkle/2.8.0" };
    await fetch(server.url, { headers: { ...old, "X-Real-IP": "203.0.113.7" } });
    await fetch(server.url, { headers: { ...old, "X-Real-IP": "203.0.113.7" } });
    await fetch(server.url, { headers: { ...old, "X-Real-IP": "198.51.100.4" } });

    const [a, b, c] = lines(server.stats);
    expect(a.ua_v).toBe("0.1.9");
    expect(a.day).toMatch(/^[0-9a-f]{16}$/);
    expect(b.day, "тот же адрес в тот же день — та же метка").toBe(a.day);
    expect(c.day, "другой адрес — другая метка").not.toBe(a.day);

    const raw = readdirSync(server.stats)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => readFileSync(join(server.stats, f), "utf8"))
      .join("");
    expect(raw).not.toContain("203.0.113.7");
    expect(raw).not.toContain("198.51.100.4");
  });

  test("соль прошлых дней стирается — вчерашние метки не пересчитать", async () => {
    const stats = mkdtempSync(join(tmpdir(), "appcast-stats-"));
    writeFileSync(join(stats, "salt-2000-01-01"), "old");
    server = await startServer(stats);
    await fetch(server.url, { headers: { "User-Agent": UA } });

    const salts = readdirSync(stats).filter((f) => f.startsWith("salt-"));
    const today = new Date().toISOString().slice(0, 10);
    expect(salts).toEqual([`salt-${today}`]);
  });

  test("чужие знаки и длинные значения обрезаются", async () => {
    server = await startServer();
    const q = new URLSearchParams({
      id: 'a"b<script> c\n' + "x".repeat(200),
      model: "Mac15,6",
      ram: "17179869184",
    });
    await fetch(`${server.url}?${q}`, { headers: { "User-Agent": UA } });

    const [line] = lines(server.stats);
    expect(line.id).toMatch(/^[\p{L}\p{N}._:+\/,-]+$/u);
    expect(line.id.length).toBeLessThanOrEqual(64);
    expect(line.model).toBe("Mac15,6");
    expect(line.ram).toBe("17179869184");
  });

  // 293: адрес ленты открыт — поток запросов не должен забивать место на хостинге.

  test("потолок строк в сутки — дальше лента уходит без записи", async () => {
    server = await startServer(undefined, { MUSLI_CHECKS_PER_DAY: "3" });
    const feed = readFileSync(FEED, "utf8");
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${server.url}?id=a${i}`, { headers: { "User-Agent": UA, "X-Real-IP": `198.51.100.${i}` } });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(feed);
    }
    expect(lines(server.stats)).toHaveLength(3);
  });

  test("один адрес — свой потолок в сутки, другие адреса не задеты; адрес не пишется", async () => {
    server = await startServer(undefined, { MUSLI_CHECKS_PER_ADDR_DAY: "2" });
    for (let i = 0; i < 4; i++) {
      await fetch(`${server.url}?id=b${i}`, { headers: { "User-Agent": UA, "X-Real-IP": "203.0.113.7" } });
    }
    await fetch(`${server.url}?id=c1`, { headers: { "User-Agent": UA, "X-Real-IP": "198.51.100.4" } });
    expect(lines(server.stats).map((l) => l.id)).toEqual(["b0", "b1", "c1"]);
    for (const f of readdirSync(server.stats)) {
      expect(readFileSync(join(server.stats, f), "utf8"), f).not.toContain("203.0.113.7");
    }
  });

  test("не смог записать — лента всё равно уходит", async () => {
    const locked = mkdtempSync(join(tmpdir(), "appcast-locked-"));
    chmodSync(locked, 0o500);
    server = await startServer(join(locked, "stats"));
    const res = await fetch(`${server.url}?id=a1`, { headers: { "User-Agent": UA } });
    chmodSync(locked, 0o700);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(readFileSync(FEED, "utf8"));
    expect(existsSync(join(locked, "stats"))).toBe(false);
  });
});
