import { test, expect, type Page } from "@playwright/test";

const URL = "/lab/wallpaper-room/";

async function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" && /404|Failed to load resource/i.test(text)) {
      // Ошибки внутри iframe (spline.design) приходят с другим origin —
      // их игнорируем: внешние ресурсы не наша зона ответственности.
      if (/spline\.design|prod\.spline/i.test(text)) return;
      errors.push(text);
    }
  });
  page.on("response", (response) => {
    if (response.status() === 404) {
      const url = response.url();
      if (/spline\.design|prod\.spline/i.test(url)) return;
      errors.push(`404: ${url}`);
    }
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

test.describe("/lab/wallpaper-room/ — эксперимент", () => {
  test("returns 200, has title, h1, no own 404s", async ({ page }) => {
    const errors = await trackErrors(page);

    const response = await page.goto(URL);
    expect(response, "navigation produced a response").not.toBeNull();
    expect(response!.status(), `${URL} responds with 200`).toBe(200);

    await expect(page).toHaveTitle(/комната|wallpaper/i);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await expectChromeAndShareMeta(page);

    expect(errors, "no 404s on own assets").toEqual([]);
  });

  test("embeds a Spline iframe with the scene", async ({ page }) => {
    await page.goto(URL);
    const iframe = page.locator('iframe[src*="spline.design"]').first();
    await expect(iframe, "Spline iframe is present").toHaveCount(1);
    await expect(iframe).toBeVisible();
  });

  test("shows a loading overlay with helpful text while the scene loads", async ({ page }) => {
    await page.goto(URL);
    const overlay = page.locator('[data-testid="wallpaper-loading"]');
    await expect(overlay, "loading overlay is present in the DOM").toHaveCount(1);
    const text = (await overlay.innerText()).trim();
    expect(text.length, "overlay communicates the load state").toBeGreaterThan(10);
    expect(text.toLowerCase()).toMatch(/загруз|комнат|секунд/);
  });

  test("does not link to a paired process page (single-page experiment)", async ({ page }) => {
    await page.goto(URL);
    const processLink = page.locator(`a[href="${URL}process/"]`);
    await expect(processLink).toHaveCount(0);
  });
});
