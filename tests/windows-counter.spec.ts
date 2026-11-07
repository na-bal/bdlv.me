import { test, expect } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const publicDir = resolve('public');
const feed = readFileSync(join(publicDir, 'products/musli/windows/release.json'), 'utf8');
const macFeed = readFileSync(join(publicDir, 'musli/appcast.xml'), 'utf8');
const hasPhp = spawnSync('php', ['-v']).status === 0;
type Box = { win: string; mac: string; stats: string; stop: () => void };
async function start(options: { brokenStats?: boolean; missingFeed?: boolean; missingLogger?: boolean; cap?: string } = {}): Promise<Box> {
  const root = mkdtempSync(join(tmpdir(), 'musli-windows-checks-'));
  mkdirSync(join(root, 'updates'));
  mkdirSync(join(root, 'products/musli/windows'), { recursive: true });
  mkdirSync(join(root, 'musli'));
  for (const name of ['check-log.php', 'latest.php', 'appcast.php']) {
    if (name === 'check-log.php' && options.missingLogger) continue;
    copyFileSync(join(publicDir, 'updates', name), join(root, 'updates', name));
  }
  if (!options.missingFeed) writeFileSync(join(root, 'products/musli/windows/release.json'), feed);
  writeFileSync(join(root, 'musli/appcast.xml'), macFeed);
  const stats = join(root, 'stats');
  if (options.brokenStats) writeFileSync(stats, 'not a directory');
  const port = 23000 + Math.floor(Math.random() * 3000);
  const child = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', root], {
    env: { ...process.env, MUSLI_STATS_DIR: stats, ...(options.cap ? { MUSLI_CHECKS_PER_ADDR_DAY: options.cap } : {}) }, stdio: 'ignore',
  });
  const win = `http://127.0.0.1:${port}/updates/latest.php`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      try { await fetch(win, { method: 'HEAD' }); ready = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    if (!ready) throw new Error('PHP fixture failed to start');
    return { win, mac: `http://127.0.0.1:${port}/updates/appcast.php`, stats, stop: () => child.kill() };
  } catch (error) { child.kill(); throw error; }
}
function rows(stats: string) {
  if (!existsSync(stats)) return [];
  return readdirSync(stats).filter(name => /^checks-\d{4}-\d{2}\.jsonl$/.test(name))
    .flatMap(name => readFileSync(join(stats, name), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)));
}
test.describe('Windows feed counter (PHP; Apache rewrite checked separately)', () => {
  test.skip(!hasPhp, 'PHP is required');
  let box: Box;
  test.afterEach(() => box?.stop());
  test('serves the signed release JSON byte for byte with no-store', async () => {
    box = await start();
    const response = await fetch(`${box.win}?id=fixture&v=0.1.3&rec=1`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe(feed);
    expect(rows(box.stats)).toMatchObject([{ platform: 'windows', id: 'fixture', v: '0.1.3', rec: '1' }]);
  });
  test('platform is chosen by the route, unknown fields and raw IP are excluded', async () => {
    box = await start();
    const q = new URLSearchParams({ id: 'fixture', platform: 'mac', evil: 'secret', name: 'тест-ёж', chip: 'x86_64', os: '10.0.26100' });
    await fetch(`${box.win}?${q}`, { headers: { 'X-Real-IP': '203.0.113.7' } });
    const [row] = rows(box.stats);
    expect(row).toMatchObject({ platform: 'windows', name: 'тест-ёж', chip: 'x86_64', os: '10.0.26100' });
    expect(row).not.toHaveProperty('evil');
    expect(JSON.stringify(row)).not.toContain('203.0.113.7');
  });
  test('HEAD serves headers without a body or a check', async () => {
    box = await start();
    const response = await fetch(box.win, { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(rows(box.stats)).toEqual([]);
  });
  test('a logging failure cannot change or block the update feed', async () => {
    box = await start({ brokenStats: true });
    const response = await fetch(box.win);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(feed);
  });
  test('partial deployment without the optional logger still serves both feeds', async () => {
    box = await start({ missingLogger: true });
    for (const [url, expected] of [[box.win, feed], [box.mac, macFeed]]) {
      const response = await fetch(url);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(expected);
    }
    expect(rows(box.stats)).toEqual([]);
  });
  test('Mac and Windows share the existing per-address cap and keep serving', async () => {
    box = await start({ cap: '1' });
    const mac = await fetch(box.mac, { headers: { 'User-Agent': 'Musli/0.1.10 Sparkle/2.8.0' } });
    expect(await mac.text()).toBe(macFeed);
    const win = await fetch(box.win);
    expect(win.status).toBe(200);
    expect(await win.text()).toBe(feed);
    const saved = rows(box.stats);
    expect(saved).toHaveLength(1);
    expect(saved[0].app).toBe('Musli');
    expect(saved[0]).not.toHaveProperty('platform'); // Mac log shape is unchanged.
  });
  test('missing publication is an honest 404 with no-store', async () => {
    box = await start({ missingFeed: true });
    const response = await fetch(box.win);
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('');
  });
  test('array query values are discarded without warnings in JSON', async () => {
    box = await start();
    const response = await fetch(`${box.win}?id[]=bad&rec[]=bad`);
    expect(await response.text()).toBe(feed);
    const [saved] = rows(box.stats);
    expect(saved.platform).toBe('windows');
    expect(saved).not.toHaveProperty('id');
    expect(saved).not.toHaveProperty('rec');
  });
});
