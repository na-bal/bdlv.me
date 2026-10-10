import { test, expect, type Page } from "@playwright/test";

const INDEX_URL = "/products/";
const MUSLI_LANDING = "https://gaasgaas.ru/musli/";

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

test.describe("/products/ — каталог продуктов", () => {
  test("returns 200, has Продукты title and h1, no 404s", async ({ page }) => {
    const errors = await trackErrors(page);

    const response = await page.goto(INDEX_URL);
    expect(response, "navigation produced a response").not.toBeNull();
    expect(response!.status(), `${INDEX_URL} responds with 200`).toBe(200);

    await expect(page).toHaveTitle(/продукт/i);
    await expect(
      page.getByRole("heading", { level: 1, name: /продукт/i }),
    ).toBeVisible();

    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();

    expect(errors, "no 404s during page load").toEqual([]);
  });

  test("renders exactly one product card (Musli) linking to the Musli landing", async ({
    page,
  }) => {
    await page.goto(INDEX_URL);

    const cards = page.locator("main .product-card");
    await expect(cards, "exactly one product card visible").toHaveCount(1);

    await expect(cards.first().getByText(/musli/i).first()).toBeVisible();
    await expect(cards.first()).toContainText(/macOS/i);

    // /products/musli/ — только полка образов, страницы там нет (403).
    // Лендинг живёт на gaasgaas.ru.
    await expect(cards.first()).toHaveAttribute("href", MUSLI_LANDING);
  });

  test("product card shows the current Musli app icon", async ({ page }) => {
    await page.goto(INDEX_URL);

    // Новое имя файла, а не замена icon.png: картинки кешируются на год.
    const icon = page.locator('main .product-card img[src="/products/musli/images/app-icon.png"]');
    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute("srcset", /app-icon@2x\.png 2x/);
    expect(await icon.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  });
});
