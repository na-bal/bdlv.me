import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const PAGE_URL = "/lab/latest-updates/";
const PROCESS_URL = "/lab/latest-updates/process/";

async function trackOwnAssetErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (!/404|Failed to load resource/i.test(text)) return;
    errors.push(text);
  });
  page.on("response", (response) => {
    if (response.status() !== 404) return;
    errors.push(`404: ${response.url()}`);
  });
  return errors;
}

async function expectMetaContent(page: Page, selector: string) {
  const locator = page.locator(selector);
  await expect(locator, `${selector} present`).toHaveCount(1);
  const content = await locator.getAttribute("content");
  expect(content, `${selector} has non-empty content`).toBeTruthy();
  expect((content ?? "").trim().length).toBeGreaterThan(0);
}

async function expectChromeAndShareMeta(page: Page) {
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expectMetaContent(page, 'meta[property="og:title"]');
  await expectMetaContent(page, 'meta[property="og:description"]');
  await expectMetaContent(page, 'meta[property="og:image"]');
  await expectMetaContent(page, 'meta[name="twitter:card"]');
}

test.describe("/lab/latest-updates/ — эксперимент", () => {
  test("returns 200, has title, h1, share meta, no 404s on own assets", async ({ page }) => {
    const errors = await trackOwnAssetErrors(page);

    const response = await page.goto(PAGE_URL);
    expect(response, "navigation produced a response").not.toBeNull();
    expect(response!.status(), `${PAGE_URL} responds with 200`).toBe(200);

    await expect(page).toHaveTitle(/termynal|terminal|обновлен|updates/i);
    await expect(page.locator("h1")).toHaveCount(1);

    await expectChromeAndShareMeta(page);

    expect(errors, "no 404s on own assets").toEqual([]);
  });

  test("renders the termynal container with at least one ty-line", async ({ page }) => {
    await page.goto(PAGE_URL);

    const termynal = page.locator("#termynal[data-termynal]");
    await expect(termynal, "#termynal[data-termynal] container present").toHaveCount(1);

    // Termynal на старте очищает контейнер и ре-вставляет строки по таймерам.
    // Ждём появления первой [data-ty] строки внутри контейнера.
    await page.waitForSelector("#termynal [data-ty]", { timeout: 15000 });

    const tyLines = page.locator("#termynal [data-ty]");
    const count = await tyLines.count();
    expect(count, "at least one [data-ty] line inside termynal").toBeGreaterThan(0);
  });

  test("internal links use Astro routes (not legacy .html)", async ({ page }) => {
    await page.goto(PAGE_URL);

    // Termynal асинхронно очищает контейнер и реэлементирует строки по таймерам.
    // Ждём появления первой ссылки на /lab/ — анимация прошла до секции
    // «Добавлен проект …», которая идёт после заголовка текущей версии.
    await page.waitForSelector('#termynal a[href^="/lab/"]', { timeout: 20000 });

    const labLinks = page.locator('#termynal a[href^="/lab/"]');
    const labCount = await labLinks.count();
    expect(labCount, "at least one /lab/ route link present in changelog").toBeGreaterThan(0);

    // И никаких .html в href в пределах термынала.
    const legacyLinks = page.locator('#termynal a[href$=".html"]');
    const legacyCount = await legacyLinks.count();
    expect(legacyCount, "no legacy .html links inside changelog").toBe(0);
  });

  test("does not link to a paired process page (single-page experiment)", async ({ page }) => {
    await page.goto(PAGE_URL);
    const processLink = page.locator(`a[href="${PROCESS_URL}"]`);
    await expect(processLink, "no /process/ link on a single-page experiment").toHaveCount(0);
  });

  test("JS-island isolation: termynal vendor is not in the shared _astro bundle", async () => {
    const distAstro = path.resolve(process.cwd(), "dist", "_astro");
    test.skip(!fs.existsSync(distAstro), `dist/_astro not found at ${distAstro}`);

    const files = fs.readdirSync(distAstro);
    const leaked = files.filter((f) => /termynal/i.test(f));
    expect(
      leaked,
      `vendor JS-island leaked into shared _astro bundle: ${leaked.join(", ")}`,
    ).toEqual([]);
  });
});
