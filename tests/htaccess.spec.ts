import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// .htaccess — Apache-конфиг. В Node-preview директивы не исполняются, поэтому
// тест проверяет ФАКТ наличия правильных директив в файле, а не их поведение.
// Реальное поведение (410/301) проверяется на проде в task 020.

const DIST_HTACCESS = resolve(process.cwd(), "dist", ".htaccess");

const GONE_HTML_FILES = [
  "index.html",
  "projects.html",
  "b.html",
  "cactus.html",
  "cactus-process.html",
  "go-to-penis.html",
  "latest-updates.html",
  "maze-explorer.html",
  "my-sex-tape.html",
  "my-sex-tape-process.html",
  "pantone-colors.html",
  "pantone-colors-process.html",
  "wallpaper-room.html",
];

test.describe(".htaccess — Apache config", () => {
  test(".htaccess copied into dist/ from public/", () => {
    expect(existsSync(DIST_HTACCESS), `expected file at ${DIST_HTACCESS}`).toBe(true);
  });

  test("contains RewriteEngine On", () => {
    const text = readFileSync(DIST_HTACCESS, "utf8");
    expect(text).toMatch(/^RewriteEngine\s+On$/m);
  });

  test("forces HTTPS", () => {
    const text = readFileSync(DIST_HTACCESS, "utf8");
    expect(text).toMatch(/RewriteCond\s+%\{HTTPS\}\s+!=on/);
    expect(text).toMatch(/https:\/\/%\{HTTP_HOST\}%\{REQUEST_URI\}\s+\[R=301,L\]/);
  });

  test("redirects www.bdlv.me to bdlv.me", () => {
    const text = readFileSync(DIST_HTACCESS, "utf8");
    expect(text).toMatch(/HTTP_HOST.*www\\\.bdlv\\\.me/);
    expect(text).toContain("https://bdlv.me%{REQUEST_URI} [R=301,L]");
  });

  test("appcast.xml is excluded BEFORE /musli/ redirect rules", () => {
    const text = readFileSync(DIST_HTACCESS, "utf8");
    const lines = text.split("\n");

    const appcastIdx = lines.findIndex((l) => /musli\/appcast\\\.xml/.test(l));
    const musliRedirectIdx = lines.findIndex((l) =>
      /\^musli\/\?\$.*\/products\/musli\//.test(l),
    );

    expect(appcastIdx, "appcast rule present").toBeGreaterThanOrEqual(0);
    expect(musliRedirectIdx, "/musli/ redirect rule present").toBeGreaterThanOrEqual(0);
    expect(
      appcastIdx,
      "appcast exception must come BEFORE /musli/ redirect (order matters)",
    ).toBeLessThan(musliRedirectIdx);
  });

  test("old /musli/Musli-*.dmg URLs are 410 Gone", () => {
    const text = readFileSync(DIST_HTACCESS, "utf8");
    expect(text).toMatch(/RewriteRule\s+\^musli\/Musli-\[\\d\.\]\+\\\.\(dmg\|zip\)\$\s+-\s+\[G,L\]/);
  });

  test("/musli/ redirects to /products/musli/", () => {
    const text = readFileSync(DIST_HTACCESS, "utf8");
    expect(text).toContain("RewriteRule ^musli/?$ /products/musli/ [R=301,L]");
    expect(text).toContain("RewriteRule ^musli/(.+)$ /products/musli/$1 [R=301,L]");
  });

  test("all 13 legacy HTML URLs are 410 Gone", () => {
    const text = readFileSync(DIST_HTACCESS, "utf8");
    const lines = text.split("\n");
    for (const file of GONE_HTML_FILES) {
      // В .htaccess строка вида: RewriteRule ^index\.html$  - [G,L]
      // Точки в имени файла экранированы как \. — это часть Apache regex-синтаксиса.
      const escapedFilename = file.replace(/\./g, "\\.");
      const ruleAnchor = `^${escapedFilename}$`;
      const matchingLine = lines.find(
        (l) =>
          l.startsWith("RewriteRule") &&
          l.includes(ruleAnchor) &&
          l.includes("[G,L]"),
      );
      expect(matchingLine, `expected 410 rule for ${file}`).toBeTruthy();
    }
  });

  test("has cache headers for hashed assets and HTML", () => {
    const text = readFileSync(DIST_HTACCESS, "utf8");
    expect(text).toContain("mod_headers.c");
    // Long cache for js/css (hashed).
    expect(text).toMatch(/max-age=31536000.*immutable/);
    // HTML revalidates.
    expect(text).toMatch(/\\\.html\$.+\n.+max-age=\d+, must-revalidate/);
  });
});
