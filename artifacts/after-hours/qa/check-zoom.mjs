// Low-vision checks for every route: WCAG 1.4.4 (the reader sets the browser font size to 32 px, i.e. text
// at 200%, emulated with CDP Page.setFontSizes so rem type and em breakpoints respond as in a real browser)
// at 1280 px, and WCAG 1.4.10 (reflow at 320 CSS px ≈ 400% zoom).
// Reports page-level horizontal overflow outside intentional scroll containers, and text that is
// clipped by its own box. Usage (preview server on 4318): node artifacts/after-hours/qa/check-zoom.mjs
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.QA_BASE || "http://127.0.0.1:4318/after-hours/";
const modes = [
  { name: "text-200", width: 1280, height: 800, fontSize: 32 },
  { name: "reflow-320", width: 320, height: 640, fontSize: null },
];

function inspectPage() {
  const vw = document.documentElement.clientWidth;
  const overflow = [];
  const clipped = [];
  if (document.documentElement.scrollWidth > vw + 1) {
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.right <= vw + 1 || getComputedStyle(el).position === "fixed") continue;
      if (el.closest(".table-scroll,.signal-strip,[data-scroll-x],pre,.output-code")) continue;
      overflow.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join(".")} → ${Math.round(r.right)}px`);
      if (overflow.length > 6) break;
    }
  }
  // Text clipped by overflow:hidden on its own element (truncation that hides content at large sizes).
  for (const el of document.querySelectorAll("h1,h2,h3,p,a,button,label,span,li,dt,dd,td,th")) {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || el.closest("[aria-hidden='true'],.sr-only,dialog:not([open]),svg")) continue;
    if (s.overflow !== "hidden" && s.overflowX !== "hidden" && s.overflowY !== "hidden") continue;
    if (!el.textContent.trim() || s.textOverflow === "ellipsis") continue;
    const box = el.getBoundingClientRect();
    if (box.width <= 1 || box.height <= 1 || s.clip === "rect(0px, 0px, 0px, 0px)" || s.clipPath === "inset(50%)") continue; // visually hidden label
    if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) {
      clipped.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join(".")} “${el.textContent.trim().slice(0, 30)}”`);
      if (clipped.length > 6) break;
    }
  }
  return { overflow, clipped, scrollWidth: document.documentElement.scrollWidth, clientWidth: vw };
}

const browser = await chromium.launch();
const results = [];
for (const mode of modes) {
  const context = await browser.newContext({ viewport: { width: mode.width, height: mode.height }, reducedMotion: "reduce" });
  const page = await context.newPage();
  if (mode.fontSize) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Page.setFontSizes", { fontSizes: { standard: mode.fontSize, fixed: Math.round(mode.fontSize * 0.8125) } });
  }
  await page.goto(base + "#/home", { waitUntil: "load" });
  const rootSize = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  if (mode.fontSize && rootSize !== mode.fontSize + "px") throw new Error("font size emulation failed: " + rootSize);
  const routes = await page.evaluate(() => routes.slice()); // eslint-disable-line no-undef
  for (const lang of ["en", "uk"]) {
    for (const route of routes) {
      await page.goto(`${base}?lang=${lang}#/${route}`, { waitUntil: "load" });
      await page.evaluate((lg) => window.__qaSet({ lang: lg }), lang);
      await page.waitForTimeout(80);
      results.push({ mode: mode.name, lang, route, ...(await page.evaluate(inspectPage)) });
    }
  }
  await context.close();
}
await browser.close();
const failing = results.filter((r) => r.overflow.length || r.clipped.length);
await writeFile(path.join(here, "zoom-report.json"), JSON.stringify({ date: new Date().toISOString(), pages: results.length, failing: failing.length, results }, null, 2) + "\n");
console.log(JSON.stringify({ pages: results.length, failing: failing.length }, null, 2));
failing.slice(0, 30).forEach((r) => console.log(` - ${r.mode}/${r.lang}/${r.route}`, JSON.stringify({ overflow: r.overflow, clipped: r.clipped })));
if (failing.length) process.exitCode = 1;
