import { test, expect } from "@playwright/test";

// Раздел MealPrep: индекс — Astro-роут (src/pages/mealprep/index.astro),
// сами бланки — статика в public/mealprep/.
//
// Главное, что тут проверяется и что легко сломать при добавлении недели:
//  · индекс собирается именно в /mealprep/index.html, потому что все бланки
//    ссылаются на «Главную» как href="index.html";
//  · якорь #recipes жив — на него ведёт пункт «Рецепты» с каждой страницы;
//  · ни одна ссылка индекса не ведёт в 404;
//  · раздел закрыт от индексации и не течёт в sitemap.

const HUB = "/mealprep/";

test.describe("MealPrep — индекс раздела", () => {
  test("индекс отвечает 200 и закрыт от индексации", async ({ page }) => {
    const res = await page.goto(HUB);
    expect(res?.status()).toBe(200);

    await expect(page).toHaveTitle(/MealPrep — все недели/);
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute("content", /noindex/);
  });

  test("стили бланка подключились, а не голый HTML", async ({ page }) => {
    await page.goto(HUB);
    // «бумага» из mealprep.css — если файл не подхватился, фон будет прозрачный
    const bg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(bg).toBe("rgb(241, 237, 227)");
  });

  test("на индексе есть все недели, а не только текущая", async ({ page }) => {
    await page.goto(HUB);

    // текущая неделя
    await expect(page.getByText("MealPrep 10–16.08")).toBeVisible();
    // архив
    await expect(page.getByText("MealPrep 13.06")).toBeVisible();
    await expect(page.getByText("MealPrep 06.06")).toBeVisible();

    await expect(page.locator(".section__label")).toContainText([
      /Текущая неделя/,
    ]);
  });

  test("якорь #recipes на месте — на него ведёт меню всех бланков", async ({
    page,
  }) => {
    await page.goto(HUB);
    await expect(page.locator("#recipes")).toBeAttached();
  });

  test("ни одна ссылка индекса не ведёт в 404", async ({ page, request }) => {
    await page.goto(HUB);

    const hrefs = await page.$$eval("a[href]", (as) =>
      as
        .map((a) => a.getAttribute("href")!)
        .filter((h) => h && !h.startsWith("#") && h !== "./"),
    );
    expect(hrefs.length).toBeGreaterThan(10);

    for (const href of [...new Set(hrefs)]) {
      const res = await request.get(new URL(href, `http://localhost:4331${HUB}`).pathname);
      expect(res.status(), `битая ссылка на индексе: ${href}`).toBe(200);
    }
  });

  test("общие ассеты раздела отдаются", async ({ request }) => {
    for (const a of ["mealprep.css", "mealprep.js"]) {
      const res = await request.get(`${HUB}${a}`);
      expect(res.status(), a).toBe(200);
    }
  });
});

test.describe("MealPrep — бланки", () => {
  test('«Главная» с бланка ведёт на индекс раздела', async ({ page }) => {
    await page.goto("/mealprep/runbook-2026-08-09.html");
    await page.locator("nav.topnav a.home").click();
    await expect(page).toHaveURL(/\/mealprep\/(index\.html)?$/);
    await expect(page).toHaveTitle(/MealPrep — все недели/);
  });

  test("бланки закрыты от индексации, включая архив", async ({ request }) => {
    const pages = [
      "runbook-2026-08-09.html",
      "karta-2026-08-08.html",
      "runbook-2026-06-13.html", // архив недели 2
      "plan-2026-06-01.html", // архив недели 1
    ];
    for (const p of pages) {
      const res = await request.get(`${HUB}${p}`);
      expect(res.status(), p).toBe(200);
      expect(await res.text(), p).toContain('name="robots" content="noindex"');
    }
  });

  test("чек-лист готовки размечен и подхватывает скрипт", async ({ page }) => {
    await page.goto("/mealprep/runbook-2026-08-09.html");
    const items = page.locator(".checklist li:not(.group)");
    expect(await items.count()).toBeGreaterThan(10);

    // mealprep.js навешивает role=checkbox и переключает по клику
    const first = items.first();
    await expect(first).toHaveAttribute("role", "checkbox");
    await first.click();
    await expect(first).toHaveClass(/is-done/);

    // отметка переживает перезагрузку (localStorage)
    await page.reload();
    await expect(page.locator(".checklist li.is-done").first()).toBeVisible();
  });
});
