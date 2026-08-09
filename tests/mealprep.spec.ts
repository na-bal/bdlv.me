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

  test("зона нажатия у плиты: пункт ≥ 56 px, чекбокс ≥ 26 px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/mealprep/runbook-2026-08-09.html");

    const m = await page.evaluate(() => {
      const items = [...document.querySelectorAll(".checklist li:not(.group)")];
      return {
        minLi: Math.min(...items.map((li) => li.getBoundingClientRect().height)),
        minBox: Math.min(
          ...items.map((li) => li.querySelector(".box")!.getBoundingClientRect().width),
        ),
      };
    });
    // мокрым пальцем стоя: всё, что меньше 44 px, считается непринятым
    expect(m.minLi).toBeGreaterThanOrEqual(56);
    expect(m.minBox).toBeGreaterThanOrEqual(26);
  });

  test("красных рельсов не больше двенадцати", async ({ page }) => {
    await page.goto("/mealprep/runbook-2026-08-09.html");
    const red = await page.locator('.checklist li[data-kind="safe"]').count();
    expect(red).toBeGreaterThan(0);
    // больше двенадцати — критерий «безопасность» размыт
    expect(red).toBeLessThanOrEqual(12);
  });

  test("таймеры и сигнал готовности размечены", async ({ page }) => {
    await page.goto("/mealprep/runbook-2026-08-09.html");
    // задание требует минимум четыре шага с таймером
    expect(await page.locator("[data-timer]").count()).toBeGreaterThanOrEqual(4);
    // кнопка запуска рендерится скриптом на каждый такой шаг
    expect(await page.locator(".timer-start").count()).toBeGreaterThanOrEqual(4);
    expect(await page.locator(".ready").count()).toBeGreaterThan(0);
    // шапка-прогресс живая
    await expect(page.locator(".runbar__count")).toContainText("/");
  });

  test("сборка знает сегодня и листает дни", async ({ page }) => {
    await page.goto("/mealprep/sborka-2026-08-09.html");
    const visible = page.locator(".card[data-day]:not(.is-other)");
    await expect(visible).toHaveCount(1);

    const before = await page.locator(".today__d").textContent();
    await page.locator('[data-day-nav="-1"]').click();
    await expect(page.locator(".today__d")).not.toHaveText(before!);
    await expect(page.locator(".card[data-day]:not(.is-other)")).toHaveCount(1);
  });

  test("ловушка разморозки молчит, когда она отмечена", async ({ page }) => {
    await page.goto("/mealprep/sborka-2026-08-09.html");

    const todayFrozen = await page
      .locator(".card[data-day].is-today[data-frozen='1']")
      .count();
    test.skip(todayFrozen === 0, "сегодняшний день не морозильный");

    // не отмечено — врезка есть
    await expect(page.locator(".thaw-guard")).toBeVisible();

    const from = await page
      .locator(".card[data-day].is-today")
      .getAttribute("data-thaw-from");
    await page.evaluate((d) => {
      localStorage.setItem("mealprep:thaw", JSON.stringify({ [d!]: true }));
    }, from);
    await page.reload();

    // отмечено — врезки нет. Врезка, которая горит всегда, будет отключена вниманием.
    await expect(page.locator(".thaw-guard")).toHaveCount(0);
  });

  test("страница «Холодильник» отдаётся и сортирует сроки", async ({ page }) => {
    const res = await page.goto("/mealprep/holodilnik-2026-08-09.html");
    expect(res?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );

    const rows = page.locator(".burn__row[data-burn]");
    expect(await rows.count()).toBeGreaterThan(5);
    // статус считается из даты, а не вписан руками
    await expect(page.locator(".burn__s").first()).not.toBeEmpty();
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
