import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const PAGE_URL = "/lab/maze-explorer/";
const PROCESS_URL = "/lab/maze-explorer/process/";

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

test.describe("/lab/maze-explorer/ — эксперимент", () => {
  test("returns 200, has title, h1, share meta, no 404s on own assets", async ({ page }) => {
    const errors = await trackOwnAssetErrors(page);

    const response = await page.goto(PAGE_URL);
    expect(response, "navigation produced a response").not.toBeNull();
    expect(response!.status(), `${PAGE_URL} responds with 200`).toBe(200);

    await expect(page).toHaveTitle(/лабиринт|maze/i);
    // h1 присутствует в DOM (визуально может быть скрыт sr-only поверх canvas).
    await expect(page.locator("h1")).toHaveCount(1);

    await expectChromeAndShareMeta(page);

    expect(errors, "no 404s on own assets").toEqual([]);
  });

  test("renders the game shell: .maze-game, #gameCanvas, mobile dpad", async ({ page }) => {
    await page.goto(PAGE_URL);

    await expect(page.locator(".maze-game"), ".maze-game container present").toBeVisible();

    const canvas = page.locator("#gameCanvas");
    await expect(canvas, "#gameCanvas present").toHaveCount(1);

    // canvas с ненулевыми размерами — ядро рендера завелось.
    const box = await canvas.boundingBox();
    expect(box, "canvas has bounding box").not.toBeNull();
    expect(box!.width, "canvas width > 0").toBeGreaterThan(0);
    expect(box!.height, "canvas height > 0").toBeGreaterThan(0);

    for (const dir of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
      const btn = page.locator(`.dpad-btn[data-key="${dir}"]`);
      await expect(btn, `dpad button ${dir} present`).toHaveCount(1);
    }
  });

  test("canvas actually paints (raycasting started, not a black void)", async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.waitForLoadState("networkidle");

    // Дать игровому циклу несколько кадров на отрисовку.
    await page.waitForTimeout(500);

    const meanLuma = await page.evaluate(() => {
      const c = document.getElementById("gameCanvas") as HTMLCanvasElement | null;
      if (!c) return -1;
      const ctx = c.getContext("2d");
      if (!ctx) return -1;
      // Сэмплируем горизонтальную полоску в центре, не весь canvas — быстрее.
      const w = Math.max(1, Math.floor(c.width));
      const y = Math.floor(c.height / 2);
      const data = ctx.getImageData(0, y, w, 1).data;
      let sum = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        // относительная яркость
        sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        count++;
      }
      return count === 0 ? -1 : sum / count;
    });

    expect(meanLuma, "canvas was sampled").toBeGreaterThanOrEqual(0);
    // Полностью чёрный canvas = 0; реальный кадр > 5 даже при тёмной палитре.
    expect(meanLuma, "canvas is not a black void").toBeGreaterThan(5);
  });

  test("at least one banner image from /lab/maze-explorer/banners/ is fetched 200", async ({
    page,
  }) => {
    const bannerHits: string[] = [];
    page.on("response", (response) => {
      const url = response.url();
      if (/\/lab\/maze-explorer\/banners\//.test(url) && response.status() === 200) {
        bannerHits.push(url);
      }
    });

    await page.goto(PAGE_URL);
    await page.waitForLoadState("networkidle");
    // На случай ленивой подгрузки текстур — додать кадров.
    await page.waitForTimeout(500);

    expect(
      bannerHits.length,
      "at least one banner image was loaded from /lab/maze-explorer/banners/",
    ).toBeGreaterThan(0);
  });

  test("does not link to a paired process page (single-page experiment)", async ({ page }) => {
    await page.goto(PAGE_URL);
    const processLink = page.locator(`a[href="${PROCESS_URL}"]`);
    await expect(processLink, "no /process/ link on a single-page experiment").toHaveCount(0);
  });

  test("JS-island isolation: vendor maze script is not in the shared _astro bundle", async () => {
    // Этот тест опирается на артефакт билда (astro/dist/_astro/).
    // playwright.config.ts запускает `npm run build && npm run preview` перед тестами
    // из корня astro/, так что cwd = astro/.
    const distAstro = path.resolve(process.cwd(), "dist", "_astro");
    test.skip(!fs.existsSync(distAstro), `dist/_astro not found at ${distAstro}`);

    const files = fs.readdirSync(distAstro);
    const leaked = files.filter((f) => /maze[-_]?explorer/i.test(f));
    expect(
      leaked,
      `vendor JS-island leaked into shared _astro bundle: ${leaked.join(", ")}`,
    ).toEqual([]);
  });
});
