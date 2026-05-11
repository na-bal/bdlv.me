import { test, expect, type Page } from "@playwright/test";

const EXPERIMENT_URL = "/lab/cactus/";
const PROCESS_URL = "/lab/cactus/process/";

async function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" && /404|Failed to load resource/i.test(text)) {
      errors.push(text);
    }
  });
  page.on("response", (response) => {
    if (response.status() === 404) {
      errors.push(`404: ${response.url()}`);
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

async function expectMainHasNonEmptyText(page: Page) {
  const main = page.locator("main");
  await expect(main).toBeVisible();
  const text = (await main.innerText()).trim();
  expect(text.length, "main has non-empty content").toBeGreaterThan(20);
}

async function expectChromeAndShareMeta(page: Page) {
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expectMetaContent(page, 'meta[property="og:title"]');
  await expectMetaContent(page, 'meta[property="og:description"]');
  await expectMetaContent(page, 'meta[property="og:image"]');
  await expectMetaContent(page, 'meta[name="twitter:card"]');
}

test.describe("/lab/cactus/ — эксперимент", () => {
  test("returns 200, has Cactus title, h1, content, no 404s", async ({ page }) => {
    const errors = await trackErrors(page);

    const response = await page.goto(EXPERIMENT_URL);
    expect(response, "navigation produced a response").not.toBeNull();
    expect(response!.status(), `${EXPERIMENT_URL} responds with 200`).toBe(200);

    await expect(page).toHaveTitle(/кактус/i);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await expectMainHasNonEmptyText(page);
    await expectChromeAndShareMeta(page);

    expect(errors, "no 404s during page load").toEqual([]);
  });

  test("links to the paired process page", async ({ page }) => {
    await page.goto(EXPERIMENT_URL);
    const link = page.locator(`a[href="${PROCESS_URL}"]`).first();
    await expect(link, `link to ${PROCESS_URL} is present`).toBeVisible();
  });
});

test.describe("/lab/cactus/process/ — процесс", () => {
  test("returns 200, has Cactus title, content, no 404s", async ({ page }) => {
    const errors = await trackErrors(page);

    const response = await page.goto(PROCESS_URL);
    expect(response, "navigation produced a response").not.toBeNull();
    expect(response!.status(), `${PROCESS_URL} responds with 200`).toBe(200);

    await expect(page).toHaveTitle(/кактус/i);
    await expectMainHasNonEmptyText(page);
    await expectChromeAndShareMeta(page);

    expect(errors, "no 404s during page load").toEqual([]);
  });

  test("links back to the experiment page", async ({ page }) => {
    await page.goto(PROCESS_URL);
    const link = page.locator(`a[href="${EXPERIMENT_URL}"]`).first();
    await expect(link, `back-link to ${EXPERIMENT_URL} is present`).toBeVisible();
  });
});
