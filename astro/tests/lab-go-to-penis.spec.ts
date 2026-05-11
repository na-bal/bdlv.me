import { test, expect, type Page } from "@playwright/test";

const PAGE_URL = "/lab/go-to-penis/";

const YMAPS_HOST = /(^|\/\/)([\w.-]*\.)?(api-maps\.yandex|yandex)\./i;

function isYmapsRequest(url: string): boolean {
  return YMAPS_HOST.test(url);
}

async function trackOwnAssetErrors(page: Page) {
  // Считаем ошибочными только 404 на наши ассеты — Yandex Maps API
  // (api-maps.yandex.ru, mc.yandex.ru) намеренно игнорируем: внешний сервис,
  // в офлайн/CI он может падать, но это не наш дефект.
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (!/404|Failed to load resource/i.test(text)) return;
    if (isYmapsRequest(text)) return;
    errors.push(text);
  });
  page.on("response", (response) => {
    if (response.status() !== 404) return;
    const url = response.url();
    if (isYmapsRequest(url)) return;
    errors.push(`404: ${url}`);
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

test.describe("/lab/go-to-penis/ — эксперимент", () => {
  test("returns 200, has title, h1, content, no 404s on own assets", async ({ page }) => {
    const errors = await trackOwnAssetErrors(page);

    const response = await page.goto(PAGE_URL);
    expect(response, "navigation produced a response").not.toBeNull();
    expect(response!.status(), `${PAGE_URL} responds with 200`).toBe(200);

    await expect(page).toHaveTitle(/иди\s*на|go\s*to\s*penis|х[у🦆]/i);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await expectMainHasNonEmptyText(page);
    await expectChromeAndShareMeta(page);

    expect(errors, "no 404s on own assets").toEqual([]);
  });

  test("renders the map container and both action buttons", async ({ page }) => {
    await page.goto(PAGE_URL);

    const map = page.locator("#map");
    await expect(map, "map container #map is present").toBeVisible();

    const getCoordinates = page.locator("#getCoordinates");
    await expect(getCoordinates, "button #getCoordinates is present").toBeVisible();

    const share = page.locator("#share");
    await expect(share, "button #share is present").toBeVisible();
  });

  test("does not link to a paired process page (single-page experiment)", async ({ page }) => {
    await page.goto(PAGE_URL);
    const processLink = page.locator(`a[href="${PAGE_URL}process/"]`);
    await expect(processLink, "no /process/ link on a single-page experiment").toHaveCount(0);
  });
});
