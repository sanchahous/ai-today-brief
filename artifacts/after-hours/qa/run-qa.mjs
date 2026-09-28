// After Hours prototype QA harness.
// Usage (repo root, with the preview server running on 4318):
//   node artifacts/after-hours-motion/serve.mjs            # in another terminal
//   node artifacts/after-hours/qa/run-qa.mjs [--browsers=chromium,firefox,webkit] [--quick] [--shots] [--routes=home,news] [--motion=on] [--out=file.json]
// --motion=on runs without prefers-reduced-motion and waits for entrances to settle, so controls that
// exist only while motion is on (brand replay, gesture demos) are checked too.
// Writes artifacts/after-hours/qa/qa-report.json. Screenshots (with --shots) go to the
// git-ignored artifacts/_local/after-hours-qa/.
import { chromium, firefox, webkit } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const base = process.env.QA_BASE || "http://127.0.0.1:4318/after-hours/";
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const engines = { chromium, firefox, webkit };
const browsers = String(args.browsers || "chromium").split(",");
const shotsDir = path.join(repo, "artifacts/_local/after-hours-qa");
const axeSource = await readFile(path.join(repo, "node_modules/axe-core/axe.min.js"), "utf8");

const viewports = args.quick
  ? [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844, mobile: true }]
  : [
      { name: "desktop", width: 1440, height: 900 },
      { name: "laptop", width: 1024, height: 768 },
      { name: "tablet", width: 768, height: 1024, mobile: true },
      { name: "mobile", width: 390, height: 844, mobile: true },
      { name: "small", width: 360, height: 780, mobile: true },
    ];
const themes = String(args.themes || "night,day").split(",");
const langs = String(args.langs || "en,uk").split(",");

// Runs inside the page. Everything here must be self-contained.
function inspect() {
  const out = { overflow: [], smallText: [], smallTargets: [], headings: [], images: [], jsonld: null, meta: {} };
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) {
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > vw + 1 && getComputedStyle(el).position !== "fixed") {
        const inScroller = el.closest(".table-scroll,.signal-strip,[data-scroll-x]");
        if (!inScroller) out.overflow.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} → ${Math.round(r.right)}px`);
      }
      if (out.overflow.length > 8) break;
    }
  }
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) return false;
    if (el.closest("[aria-hidden='true'],.sr-only,[hidden],dialog:not([open])")) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent.trim()) continue;
    const el = node.parentElement;
    if (!el || seen.has(el) || el.closest("svg,script,style")) continue;
    seen.add(el);
    if (!visible(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 12) out.smallText.push(`${size}px ${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join(".")} “${node.textContent.trim().slice(0, 28)}”`);
  }
  // SVG text that is visible as a picture still has to be readable at its rendered size.
  for (const t of document.querySelectorAll("svg text")) {
    const svg = t.ownerSVGElement;
    if (!svg || !visible(svg)) continue;
    const scale = svg.getBoundingClientRect().width / (svg.viewBox?.baseVal?.width || svg.getBoundingClientRect().width || 1);
    const size = parseFloat(t.getAttribute("font-size") || getComputedStyle(t).fontSize) * scale;
    if (size < 9) out.smallText.push(`svg ${size.toFixed(1)}px “${t.textContent.trim().slice(0, 20)}”`);
  }
  if (window.matchMedia("(pointer: coarse)").matches || innerWidth < 800) {
    for (const el of document.querySelectorAll("a[href],button,input,select,textarea,summary,[role=button],label:has(input)")) {
      if (!visible(el)) continue;
      if (el.matches("a") && el.closest("p,li,td,dd,figcaption,label,.reading,.prose") && !el.matches(".button,.chip")) continue; // inline links (WCAG 2.5.8 exception)
      if (el.matches("a") && getComputedStyle(el, "::after").position === "absolute") continue; // block link: the whole card is the target
      const r = el.getBoundingClientRect();
      if ((r.height < 44 || r.width < 24) && !el.matches("input[type=checkbox],input[type=radio]")) out.smallTargets.push(`${Math.round(r.width)}×${Math.round(r.height)} ${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join(".")} “${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}”`);
    }
  }
  out.headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(visible).map((h) => +h.tagName[1]);
  out.h1 = out.headings.filter((h) => h === 1).length;
  out.skips = out.headings.reduce((acc, h, i, all) => (i && h > all[i - 1] + 1 ? acc + 1 : acc), 0);
  out.images = [...document.images].filter((i) => !i.getAttribute("alt") && i.getAttribute("alt") !== "").map((i) => i.src.split("/").pop());
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')];
  out.jsonld = ld.map((s) => { try { const j = JSON.parse(s.textContent); return (j["@graph"] || [j]).map((n) => n["@type"]).flat(); } catch { return ["INVALID"]; } }).flat();
  out.meta = {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || "",
    canonical: document.querySelector('link[rel="canonical"]')?.href || "",
    lang: document.documentElement.lang,
  };
  out.scrollWidth = document.documentElement.scrollWidth;
  out.clientWidth = vw;
  return out;
}

const report = { date: new Date().toISOString(), base, browsers, viewports: viewports.map((v) => v.name), results: [] };
if (args.shots) await mkdir(shotsDir, { recursive: true });

/* Use the newest locally installed build when the exact revision Playwright expects is missing
   (no download needed; results are labelled with the build actually used). */
async function launch(name) {
  // QA_PLAYWRIGHT_CORE: path to another playwright-core whose protocol matches the installed builds.
  if (process.env.QA_PLAYWRIGHT_CORE && name !== "chromium") {
    const { pathToFileURL } = await import("node:url");
    const core = await import(pathToFileURL(path.join(process.env.QA_PLAYWRIGHT_CORE, "index.mjs")).href);
    const version = JSON.parse(await readFile(path.join(process.env.QA_PLAYWRIGHT_CORE, "package.json"), "utf8")).version;
    return { browser: await core[name].launch(), build: `playwright-core ${version}` };
  }
  try {
    return { browser: await engines[name].launch(), build: "bundled" };
  } catch (error) {
    const { readdir } = await import("node:fs/promises");
    const home = path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
    const dirs = (await readdir(home)).filter((d) => d.startsWith(`${name}-`)).sort();
    const dir = dirs.pop();
    if (!dir) throw error;
    const exe = name === "firefox" ? path.join(home, dir, "firefox", "firefox.exe") : name === "webkit" ? path.join(home, dir, "Playwright.exe") : path.join(home, dir, "chrome-win", "chrome.exe");
    return { browser: await engines[name].launch({ executablePath: exe }), build: dir };
  }
}
report.builds = {};
for (const name of browsers) {
  const { browser, build } = await launch(name);
  report.builds[name] = build;
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: name !== "firefox" && !!vp.mobile, hasTouch: !!vp.mobile, reducedMotion: args.motion === "on" ? "no-preference" : "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
    await page.goto(base + "#/home", { waitUntil: "load" });
    const allRoutes = await page.evaluate(() => (typeof routes !== "undefined" ? routes.slice() : []));
    const routes = args.routes ? allRoutes.filter((r) => String(args.routes).split(",").includes(r)) : allRoutes;
    for (const theme of themes) for (const lang of langs) {
      if (name !== "chromium" && lang === "uk" && vp.name !== "mobile") continue;
      for (const route of routes) {
        errors.length = 0;
        await page.goto(`${base}?theme=${theme}&lang=${lang}#/${route}`, { waitUntil: "load" });
        await page.evaluate(({ theme: th, lang: lg }) => {
          if (window.__qaSet) return window.__qaSet({ theme: th, lang: lg });
          // Baseline prototype (before the v3 URL contract): set the script globals directly.
          // eslint-disable-next-line no-undef
          lang = lg; theme = th; render(false);
        }, { theme, lang });
        await page.waitForTimeout(args.motion === "on" ? 4000 : 120);
        const data = await page.evaluate(inspect);
        let axe = null;
        if (name === "chromium" && !args.noaxe) {
          await page.addScriptTag({ content: axeSource });
          axe = await page.evaluate(async () => {
            const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] }, resultTypes: ["violations"] });
            return r.violations.map((v) => ({ id: v.id, impact: v.impact, count: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(" ") + (n.any?.[0]?.message ? " — " + n.any[0].message.slice(0, 110) : "")) }));
          });
        }
        if (args.shots && lang === "en") await page.screenshot({ path: path.join(shotsDir, `${name}-${vp.name}-${theme}-${route}.png`), fullPage: vp.name === "desktop" || vp.name === "mobile" });
        report.results.push({ browser: name, viewport: vp.name, theme, lang, route, errors: [...errors], axe, ...data });
      }
    }
    await context.close();
  }
  await browser.close();
}

const summary = {};
for (const r of report.results) {
  const key = `${r.browser}/${r.viewport}/${r.theme}/${r.lang}`;
  summary[key] ??= { pages: 0, overflow: 0, smallText: 0, smallTargets: 0, axe: 0, errors: 0, h1Problems: 0 };
  const s = summary[key];
  s.pages++;
  s.overflow += r.overflow.length ? 1 : 0;
  s.smallText += r.smallText.length;
  s.smallTargets += r.smallTargets.length;
  s.axe += (r.axe || []).reduce((n, v) => n + v.count, 0);
  s.errors += r.errors.length;
  s.h1Problems += r.h1 === 1 ? 0 : 1;
}
report.summary = summary;
await writeFile(path.join(here, args.out || "qa-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(summary, null, 2));
