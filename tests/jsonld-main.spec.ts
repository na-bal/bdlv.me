import { test, expect } from "@playwright/test";

const SITE = "https://bdlv.me";

test.describe("JSON-LD on home — Person + WebSite", () => {
  test("two valid JSON-LD blocks parse, contain Person and WebSite types", async ({
    page,
  }) => {
    await page.goto("/");

    const scripts = page.locator('script[type="application/ld+json"]');
    await expect(scripts).toHaveCount(2);

    const payloads = await scripts.allTextContents();
    const parsed = payloads.map((raw) => {
      try {
        return JSON.parse(raw);
      } catch (e) {
        throw new Error(`JSON-LD payload не парсится:\n${raw}\n${(e as Error).message}`);
      }
    });

    const types = parsed.map((p) => p["@type"]);
    expect(types).toContain("Person");
    expect(types).toContain("WebSite");

    const person = parsed.find((p) => p["@type"] === "Person")!;
    expect(person["@context"]).toMatch(/schema\.org/);
    expect(person.name).toMatch(/Беделев/);
    expect(person.url).toBe(SITE);
    expect(Array.isArray(person.sameAs)).toBe(true);

    const website = parsed.find((p) => p["@type"] === "WebSite")!;
    expect(website["@context"]).toMatch(/schema\.org/);
    expect(website.name).toMatch(/BDLV/i);
    expect(website.url).toBe(SITE);
    expect(website.inLanguage).toBe("ru");
  });

  test("JSON-LD is NOT present on other pages (only home)", async ({ page }) => {
    await page.goto("/lab/");
    const scripts = page.locator('script[type="application/ld+json"]');
    await expect(scripts).toHaveCount(0);
  });
});
