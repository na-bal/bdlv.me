import { test, expect } from "@playwright/test";

test("home page returns 200, has a title, no 404s in console", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" && /404|Failed to load resource/i.test(text)) {
      consoleErrors.push(text);
    }
  });
  page.on("response", (response) => {
    if (response.status() === 404) {
      consoleErrors.push(`404: ${response.url()}`);
    }
  });

  const response = await page.goto("/");
  expect(response, "navigation produced a response").not.toBeNull();
  expect(response!.status(), "/ responds with 200").toBe(200);

  await expect(page).toHaveTitle(/.+/);

  expect(consoleErrors, "no 404s during page load").toEqual([]);
});
