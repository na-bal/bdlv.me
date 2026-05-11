import { test, expect, type Page } from "@playwright/test";

const INDEX_URL = "/lab/";

const ALL_SLUGS = [
  "pantone-colors",
  "my-sex-tape",
  "go-to-penis",
  "cactus",
  "wallpaper-room",
  "maze-explorer",
  "latest-updates",
  "blacknote",
];

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

test.describe("/lab/ — индекс лаборатории", () => {
  test("returns 200, has Лаборатория title, h1, no 404s", async ({ page }) => {
    const errors = await trackErrors(page);

    const response = await page.goto(INDEX_URL);
    expect(response, "navigation produced a response").not.toBeNull();
    expect(response!.status(), `${INDEX_URL} responds with 200`).toBe(200);

    await expect(page).toHaveTitle(/лаборатори/i);
    await expect(
      page.getByRole("heading", { level: 1, name: /лаборатори/i }),
    ).toBeVisible();

    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();

    expect(errors, "no 404s during page load").toEqual([]);
  });

  test("renders all 8 experiment links pointing at the right URLs", async ({
    page,
  }) => {
    await page.goto(INDEX_URL);

    for (const slug of ALL_SLUGS) {
      await expect(
        page.locator(`main a[href="/lab/${slug}/"]`).first(),
        `link to /lab/${slug}/ is visible`,
      ).toBeVisible();
    }
  });

  test("groups experiments by all four categories", async ({ page }) => {
    await page.goto(INDEX_URL);

    await expect(page.getByText(/стикерпаки/i).first()).toBeVisible();
    await expect(page.getByText(/услуги/i).first()).toBeVisible();
    await expect(page.getByText(/текстура/i).first()).toBeVisible();
    await expect(page.getByText(/ансортед/i).first()).toBeVisible();
  });

  test("alert banner is gone after migration", async ({ page }) => {
    await page.goto(INDEX_URL);
    await expect(page.locator("main").getByText(/потерпите/i)).toHaveCount(0);
    await expect(page.locator("main .alert")).toHaveCount(0);
  });

  test("category links navigate to experiment pages", async ({ page }) => {
    await page.goto(INDEX_URL);

    await page.locator('main a[href="/lab/pantone-colors/"]').first().click();
    await expect(page).toHaveURL(/\/lab\/pantone-colors\/?$/);
  });
});
