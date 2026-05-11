import { test, expect, type Page } from "@playwright/test";

const SITE = "https://bdlv.me";

async function attr(page: Page, selector: string, name: string) {
  return await page.locator(selector).first().getAttribute(name);
}

test.describe("SEO meta layer — canonical + OG/Twitter", () => {
  test("home: canonical, og:url absolute, og:type=website, og:image absolute, twitter:card=summary_large_image", async ({
    page,
  }) => {
    await page.goto("/");

    expect(await attr(page, 'link[rel="canonical"]', "href")).toBe(`${SITE}/`);
    expect(await attr(page, 'meta[property="og:url"]', "content")).toBe(`${SITE}/`);
    expect(await attr(page, 'meta[property="og:type"]', "content")).toBe("website");
    expect(await attr(page, 'meta[property="og:image"]', "content")).toBe(`${SITE}/blobbo.svg`);
    expect(await attr(page, 'meta[name="twitter:card"]', "content")).toBe("summary_large_image");

    const ogTitle = await attr(page, 'meta[property="og:title"]', "content");
    expect(ogTitle).toMatch(/bdlv\.me/i);
    const ogDesc = await attr(page, 'meta[property="og:description"]', "content");
    expect(ogDesc).toMatch(/беделев|лаборатор|эксперимент/i);

    expect(await attr(page, 'meta[name="author"]', "content")).toBe("Александр Беделев");
  });

  test("/lab/: canonical and og:type=website", async ({ page }) => {
    await page.goto("/lab/");

    expect(await attr(page, 'link[rel="canonical"]', "href")).toBe(`${SITE}/lab/`);
    expect(await attr(page, 'meta[property="og:url"]', "content")).toBe(`${SITE}/lab/`);
    expect(await attr(page, 'meta[property="og:type"]', "content")).toBe("website");
  });

  test("/lab/cactus/: canonical, og:type=article, og:image is the cover", async ({
    page,
  }) => {
    await page.goto("/lab/cactus/");

    expect(await attr(page, 'link[rel="canonical"]', "href")).toBe(`${SITE}/lab/cactus/`);
    expect(await attr(page, 'meta[property="og:url"]', "content")).toBe(`${SITE}/lab/cactus/`);
    expect(await attr(page, 'meta[property="og:type"]', "content")).toBe("article");
    expect(await attr(page, 'meta[property="og:image"]', "content")).toBe(
      `${SITE}/lab/cactus/images/cover.svg`,
    );
    expect(await attr(page, 'meta[name="twitter:image"]', "content")).toBe(
      `${SITE}/lab/cactus/images/cover.svg`,
    );
  });

  test("/products/: canonical and og:type=website", async ({ page }) => {
    await page.goto("/products/");

    expect(await attr(page, 'link[rel="canonical"]', "href")).toBe(`${SITE}/products/`);
    expect(await attr(page, 'meta[property="og:url"]', "content")).toBe(`${SITE}/products/`);
    expect(await attr(page, 'meta[property="og:type"]', "content")).toBe("website");
  });
});
