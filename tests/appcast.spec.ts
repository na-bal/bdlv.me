import { test, expect } from "@playwright/test";

const APPCAST_URL = "/musli/appcast.xml";
const SITE = "https://bdlv.me";

// Версии, для которых физически лежат DMG в astro/public/products/musli/.
// Менять при изменении ретеншена в task 016.
const SHIPPED_DMG_VERSIONS = ["0.0.19", "0.0.20", "0.0.21"];
const LATEST_VERSION = "0.0.21";

test.describe("appcast.xml — Sparkle feed", () => {
  test("/musli/appcast.xml responds 200 with valid Sparkle XML", async ({
    request,
  }) => {
    const res = await request.get(APPCAST_URL);
    expect(res.status()).toBe(200);

    const xml = await res.text();
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain("<rss");
    expect(xml).toContain("xmlns:sparkle=");
    expect(xml).toContain("<title>Musli Updates</title>");
  });

  test("all <enclosure> URLs point at /products/musli/ (not legacy /musli/)", async ({
    request,
  }) => {
    const xml = await (await request.get(APPCAST_URL)).text();

    const enclosureUrls = [...xml.matchAll(/<enclosure[^>]*url="([^"]+)"/g)].map(
      (m) => m[1],
    );

    expect(enclosureUrls.length).toBeGreaterThan(0);
    for (const url of enclosureUrls) {
      expect(url, "no legacy /musli/ binary URLs").not.toMatch(
        /^https:\/\/bdlv\.me\/musli\/Musli-/,
      );
      // 0.0.2 был .zip, остальные .dmg — оставляем оба варианта для истории.
      expect(url, "all enclosure URLs are /products/musli/").toMatch(
        /^https:\/\/bdlv\.me\/products\/musli\/Musli-[\d.]+\.(dmg|zip)$/,
      );
    }
  });

  test("release notes for ALL historical versions are preserved", async ({
    request,
  }) => {
    const xml = await (await request.get(APPCAST_URL)).text();

    // Старые версии до ретеншена тоже должны быть в appcast (release notes сохраняются).
    expect(xml).toContain("Version 0.0.20");
    expect(xml).toContain("Version 0.0.10");
    expect(xml).toContain("Version 0.0.5");

    // CDATA-блоки с описанием релизов на месте.
    const items = xml.match(/<item>/g) ?? [];
    expect(items.length).toBeGreaterThanOrEqual(18);
  });

  test("shipped DMG files (retention window) are actually served", async ({
    request,
  }) => {
    for (const version of SHIPPED_DMG_VERSIONS) {
      const url = `/products/musli/Musli-${version}.dmg`;
      const res = await request.head(url);
      expect(res.status(), `${url} should be served`).toBe(200);
    }
  });

  test("latest version DMG matches appcast top <item>", async ({ request }) => {
    const xml = await (await request.get(APPCAST_URL)).text();

    // Берём enclosure URL первого <item> — это последняя версия.
    const firstItem = xml.split("<item>")[1] ?? "";
    const firstUrl = firstItem.match(/<enclosure[^>]*url="([^"]+)"/)?.[1];

    expect(firstUrl).toBe(`${SITE}/products/musli/Musli-${LATEST_VERSION}.dmg`);

    const dmg = await request.head(`/products/musli/Musli-${LATEST_VERSION}.dmg`);
    expect(dmg.status()).toBe(200);
  });
});
