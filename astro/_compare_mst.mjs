import { chromium } from "playwright";

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "750", width: 750, height: 900 },
];

const PAGES = [
  {
    name: "experiment",
    old: "http://localhost:4322/my-sex-tape.html",
    next: "http://localhost:4321/lab/my-sex-tape/",
  },
  {
    name: "process",
    old: "http://localhost:4322/my-sex-tape-process.html",
    next: "http://localhost:4321/lab/my-sex-tape/process/",
  },
];

async function snapshot(page, url, path) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const step = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        if (total >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  });
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path, fullPage: true });
}

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  for (const page of PAGES) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const oldPage = await context.newPage();
    await snapshot(oldPage, page.old, `/tmp/compare/mst-${page.name}-${vp.name}-old.png`);
    const newPage = await context.newPage();
    await snapshot(newPage, page.next, `/tmp/compare/mst-${page.name}-${vp.name}-new.png`);
    await context.close();
    console.log(`done ${page.name} @ ${vp.name}`);
  }
}

await browser.close();
