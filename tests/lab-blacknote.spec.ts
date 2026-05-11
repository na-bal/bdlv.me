import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const PAGE_URL = "/lab/blacknote/";
const PROCESS_URL = "/lab/blacknote/process/";

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

async function expectShareMeta(page: Page) {
  // Без chrome (showHeader=false, showFooter=false), но мета-теги шеринга
  // должны быть на месте — RootLayout их рендерит независимо.
  await expectMetaContent(page, 'meta[property="og:title"]');
  await expectMetaContent(page, 'meta[property="og:description"]');
  await expectMetaContent(page, 'meta[name="twitter:card"]');
}

test.describe("/lab/blacknote/ — эксперимент", () => {
  test("returns 200, has title, h1, share meta, no 404s on own assets", async ({ page }) => {
    const errors = await trackOwnAssetErrors(page);

    const response = await page.goto(PAGE_URL);
    expect(response, "navigation produced a response").not.toBeNull();
    expect(response!.status(), `${PAGE_URL} responds with 200`).toBe(200);

    await expect(page).toHaveTitle(/blacknote|заметк/i);
    // h1 для SEO/a11y, может быть визуально скрыт.
    await expect(page.locator("h1")).toHaveCount(1);

    await expectShareMeta(page);

    expect(errors, "no 404s on own assets").toEqual([]);
  });

  test("renders an editable note surface (main.black-note[contenteditable])", async ({ page }) => {
    await page.goto(PAGE_URL);

    const note = page.locator('main.black-note[contenteditable="true"]');
    await expect(note, "editable .black-note main element is visible").toBeVisible();
  });

  test("shows a placeholder hint via ::before when the note is empty", async ({ page }) => {
    await page.goto(PAGE_URL);

    // Стартовое состояние — без сохранённого контента; плейсхолдер должен быть.
    await page.evaluate(() => {
      // На случай, если в браузере playwright был старый контент — чистим.
      try {
        localStorage.clear();
      } catch {}
    });
    await page.reload();

    const beforeContent = await page.evaluate(() => {
      const el = document.querySelector("main.black-note");
      if (!el) return "";
      return getComputedStyle(el, "::before").getPropertyValue("content") || "";
    });

    expect(
      beforeContent,
      "::before content includes hint about local browser storage",
    ).toMatch(/браузер/i);
  });

  test("typed text persists across reload (localStorage)", async ({ page }) => {
    await page.goto(PAGE_URL);

    // Чистим то, что могло остаться от прошлых прогонов.
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch {}
    });
    await page.reload();

    const note = page.locator('main.black-note[contenteditable="true"]');
    await note.click();
    const sample = "ваня писал и вот что вышло";
    await page.keyboard.type(sample, { delay: 5 });

    // Дать обработчику input записать в localStorage до перезагрузки.
    await page.waitForTimeout(150);

    await page.reload();

    const noteAfter = page.locator('main.black-note[contenteditable="true"]');
    await expect(noteAfter).toBeVisible();
    const text = (await noteAfter.innerText()).trim();
    expect(text, "note content survived reload").toContain(sample);
  });

  test("does not link to a paired process page (single-page experiment)", async ({ page }) => {
    await page.goto(PAGE_URL);
    const processLink = page.locator(`a[href="${PROCESS_URL}"]`);
    await expect(processLink, "no /process/ link on a single-page experiment").toHaveCount(0);
  });

  test("JS-island isolation: blacknote vendor is not in the shared _astro bundle", async () => {
    const distAstro = path.resolve(process.cwd(), "dist", "_astro");
    test.skip(!fs.existsSync(distAstro), `dist/_astro not found at ${distAstro}`);

    const files = fs.readdirSync(distAstro);
    const leaked = files.filter((f) => /black[-_]?note/i.test(f));
    expect(
      leaked,
      `vendor JS-island leaked into shared _astro bundle: ${leaked.join(", ")}`,
    ).toEqual([]);
  });
});
