import { test, expect } from "@playwright/test";

test.describe("home page", () => {
  test("returns 200, has BDLV.me title, no 404s", async ({ page }) => {
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

    const response = await page.goto("/");
    expect(response, "navigation produced a response").not.toBeNull();
    expect(response!.status(), "/ responds with 200").toBe(200);

    await expect(page).toHaveTitle(/BDLV\.me/i);
    expect(errors, "no 404s during page load").toEqual([]);
  });

  test("renders main image with non-empty alt", async ({ page }) => {
    await page.goto("/");

    const images = page.locator("main img");
    await expect(images.first()).toBeVisible();

    const altValues = await images.evaluateAll((els) =>
      els.map((el) => (el as HTMLImageElement).alt),
    );
    expect(altValues.length).toBeGreaterThan(0);
    expect(
      altValues.some((alt) => typeof alt === "string" && alt.trim().length > 0),
      "at least one main image has non-empty alt",
    ).toBe(true);
  });

  test("renders site header and footer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("nav links point at /lab/ and /products/", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: /основная навигация/i });
    await expect(nav).toBeVisible();

    const labLink = nav.getByRole("link", { name: /лаборатория/i });
    const productsLink = nav.getByRole("link", { name: /продукты/i });
    await expect(labLink).toHaveAttribute("href", "/lab/");
    await expect(productsLink).toHaveAttribute("href", "/products/");
  });

  test("has OG and Twitter share meta", async ({ page }) => {
    await page.goto("/");

    const expectMetaContent = async (selector: string) => {
      const locator = page.locator(selector);
      await expect(locator, `${selector} present`).toHaveCount(1);
      const content = await locator.getAttribute("content");
      expect(content, `${selector} has non-empty content`).toBeTruthy();
      expect((content ?? "").trim().length).toBeGreaterThan(0);
    };

    await expectMetaContent('meta[property="og:title"]');
    await expectMetaContent('meta[property="og:description"]');
    await expectMetaContent('meta[property="og:image"]');
    await expectMetaContent('meta[name="twitter:card"]');
  });
});
