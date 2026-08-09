import { test, expect } from "@playwright/test";

const SITE = "https://bdlv.me";

test.describe("sitemap.xml + robots.txt", () => {
  test("robots.txt responds 200 and points at sitemap-index.xml", async ({
    request,
  }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);

    const text = await res.text();
    expect(text).toMatch(/User-agent:\s*\*/i);
    expect(text).toMatch(/Allow:\s*\//i);
    expect(text).toContain(`Sitemap: ${SITE}/sitemap-index.xml`);
  });

  test("sitemap-index.xml responds 200 and references sitemap-0.xml", async ({
    request,
  }) => {
    const res = await request.get("/sitemap-index.xml");
    expect(res.status()).toBe(200);

    const xml = await res.text();
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain(`${SITE}/sitemap-0.xml`);
  });

  test("sitemap-0.xml contains real pages and excludes dev-* pages", async ({
    request,
  }) => {
    const res = await request.get("/sitemap-0.xml");
    expect(res.status()).toBe(200);

    const xml = await res.text();

    // Реально публикуемые страницы должны быть.
    expect(xml).toContain(`${SITE}/`);
    expect(xml).toContain(`${SITE}/lab/`);
    expect(xml).toContain(`${SITE}/products/`);
    expect(xml).toContain(`${SITE}/lab/cactus/`);
    expect(xml).toContain(`${SITE}/lab/blacknote/`);
    expect(xml).toContain(`${SITE}/lab/maze-explorer/`);

    // Dev-страницы — не должны.
    expect(xml).not.toMatch(/\/dev-layout\b/);
    expect(xml).not.toMatch(/\/dev-layout-noheader\b/);
    expect(xml).not.toMatch(/\/dev-tokens\b/);

    // Личные разделы — тоже не должны: живут по прямой ссылке.
    expect(xml).not.toMatch(/\/vacations\b/);
    expect(xml).not.toMatch(/\/mealprep\b/);
  });
});
