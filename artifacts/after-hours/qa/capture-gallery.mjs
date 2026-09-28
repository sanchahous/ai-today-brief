// Captures the v3 review gallery and writes ../gallery-v3.html.
// Every route: desktop 1440 (Night, Day; stored at 1080 px wide) and mobile 390 (Night); full page capped; WebP.
// Usage (preview server on 4318): node artifacts/after-hours/qa/capture-gallery.mjs [--routes=home,news]
import { chromium } from "playwright";
import sharp from "sharp";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const out = path.join(root, "screens-v3");
const base = process.env.QA_BASE || "http://127.0.0.1:4318/after-hours/";
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const QUALITY = 56;
const shots = [
  { key: "desktop-night", width: 1440, height: 900, theme: "night", store: 1080, maxH: 4600 },
  { key: "desktop-day", width: 1440, height: 900, theme: "day", store: 1080, maxH: 4600 },
  { key: "mobile-night", width: 390, height: 844, theme: "night", mobile: true, store: 390, maxH: 4200 },
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const probe = await browser.newPage();
await probe.goto(base + "#/home", { waitUntil: "load" });
const { routes, names } = await probe.evaluate(() => {
  lang = "uk"; // eslint-disable-line no-undef
  return { routes: routes.slice(), names: labels() }; // eslint-disable-line no-undef
});
await probe.close();
const selected = args.routes ? routes.filter((r) => String(args.routes).split(",").includes(r)) : routes;
if (!args.routes) for (const file of await readdir(out)) await rm(path.join(out, file));

const meta = {};
for (const shot of shots) {
  const context = await browser.newContext({ viewport: { width: shot.width, height: shot.height }, deviceScaleFactor: 1, isMobile: !!shot.mobile, hasTouch: !!shot.mobile, reducedMotion: "reduce" });
  const page = await context.newPage();
  for (const route of selected) {
    await page.goto(`${base}?theme=${shot.theme}&lang=en#/${route}`, { waitUntil: "load" });
    await page.evaluate((theme) => window.__qaSet({ theme, lang: "en" }), shot.theme);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const png = await page.screenshot({ fullPage: true });
    const image = sharp(png);
    const { width, height } = await image.metadata();
    const file = `${route}-${shot.key}.webp`;
    const scale = shot.store / width;
    const kept = Math.min(height, Math.round(shot.maxH / scale));
    const stored = await image.extract({ left: 0, top: 0, width, height: kept }).resize({ width: shot.store }).webp({ quality: QUALITY, effort: 5 }).toFile(path.join(out, file));
    meta[file] = { width: stored.width, height: stored.height, fullHeight: height };
  }
  await context.close();
}
await browser.close();

const all = (await readdir(out)).filter((f) => f.endsWith(".webp"));
let bytes = 0;
for (const f of all) bytes += (await stat(path.join(out, f))).size;
const dims = Object.fromEntries(
  await Promise.all(all.map(async (f) => [f, meta[f] || (await sharp(path.join(out, f)).metadata())])),
);
const img = (file, alt, cls) => `<a class="${cls}" href="screens-v3/${file}"><img src="screens-v3/${file}" alt="${alt}" width="${dims[file].width}" height="${dims[file].height}" loading="lazy" decoding="async"></a>`;
const cards = routes
  .map((route, i) => {
    const name = names[route] || route;
    const files = shots.map((s) => `${route}-${s.key}.webp`);
    if (!files.every((f) => dims[f])) return "";
    return `<article class="shot-card"><header><span class="shot-no">${String(i + 1).padStart(2, "0")}</span><h2>${name}</h2><a href="index.html#/${route}">Живий макет ↗</a></header><div class="shot-row">${img(files[0], `${name} — desktop, нічна тема`, "shot-desktop")}${img(files[1], `${name} — desktop, денна тема`, "shot-desktop")}${img(files[2], `${name} — mobile, нічна тема`, "shot-mobile")}</div><p class="shot-legend"><span>Desktop 1440 · Ніч</span><span>Desktop 1440 · День</span><span>Mobile 390 · Ніч</span></p></article>`;
  })
  .join("");
const html = `<!doctype html>
<html lang="uk" data-theme="night">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>After Hours v3 — галерея макетів</title>
<meta name="description" content="Знімки всіх ${routes.length} маршрутів прототипу After Hours v3: desktop у нічній і денній темах та mobile.">
<link rel="icon" href="assets/mark.svg" type="image/svg+xml">
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="style.css">
<style>
body{background:var(--bg)}
.gallery-top{max-width:1500px;margin:0 auto;padding:var(--space-12) var(--gutter) var(--space-8)}
.gallery-top h1{font-family:var(--display);font-size:var(--text-5xl);font-weight:400;letter-spacing:var(--tracking-display);line-height:var(--leading-tight);margin:var(--space-4) 0}
.gallery-top h1 em{color:var(--accent)}
.gallery-top p{max-width:70ch;color:var(--muted)}
.gallery-top .button-row{margin-top:var(--space-6)}
.gallery-grid{max-width:1500px;margin:0 auto;padding:0 var(--gutter) var(--space-16);display:grid;gap:var(--space-8)}
.shot-card{border:1px solid var(--line);border-radius:var(--radius-lg);background:var(--surface);padding:var(--space-5)}
.shot-card header{display:flex;align-items:baseline;gap:var(--space-4);margin-bottom:var(--space-4)}
.shot-card h2{font-family:var(--display);font-size:var(--text-2xl);font-weight:400;margin:0}
.shot-card header a{margin-left:auto;color:var(--accent);min-height:var(--touch-floor);display:inline-flex;align-items:center}
.shot-no{color:var(--accent);font-family:var(--mono);font-size:var(--text-2xs);letter-spacing:var(--tracking-meta)}
.shot-row{display:grid;grid-template-columns:1fr 1fr 190px;gap:var(--space-3);align-items:start}
.shot-row a{display:block;height:420px;overflow:hidden;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--bg-deep)}
.shot-row img{display:block;width:100%;height:auto}
.shot-legend{display:grid;grid-template-columns:1fr 1fr 190px;gap:var(--space-3);margin:var(--space-2) 0 0;color:var(--muted);font-family:var(--mono);font-size:var(--text-2xs);letter-spacing:var(--tracking-meta);text-transform:uppercase}
@media(max-width:900px){.shot-row,.shot-legend{grid-template-columns:1fr 1fr}.shot-row .shot-mobile{grid-column:span 2;justify-self:start;width:min(100%,240px);height:420px}.shot-legend span:last-child{grid-column:span 2}.shot-row a{height:260px}}
@media(max-width:560px){.shot-row,.shot-legend{grid-template-columns:1fr}.shot-row .shot-mobile{grid-column:auto}.shot-legend{display:none}.shot-card header{flex-wrap:wrap}}
</style>
</head>
<body>
<a class="skip" href="#gallery">Перейти до галереї</a>
<header class="gallery-top">
<p class="eyebrow">AI Today Brief / After Hours v3 / ${new Date().toISOString().slice(0, 10)}</p>
<h1>Усі макети. <em>Обидві теми.</em></h1>
<p>${routes.length} маршрутів прототипу: desktop 1440 px у нічній і денній темах та mobile 390 px. Знімки зняті з живого прототипу скриптом <code>qa/capture-gallery.mjs</code>; desktop збережено в ширині 1080 px; довгі сторінки обрізані — повну версію показує живий макет.</p>
<div class="button-row"><a class="button" href="index.html#/home">Відкрити прототип ↗</a><a class="button outline" href="index.html#/coverage">Покриття продукту ↗</a><a class="button ghost" href="../after-hours-motion/fold-review.html">The Resolve покадрово ↗</a></div>
</header>
<main id="gallery" class="gallery-grid">${cards}</main>
</body>
</html>
`;
await writeFile(path.join(root, "gallery-v3.html"), html);
console.log(`gallery-v3.html: ${selected.length} routes captured, ${all.length} images, ${(bytes / 1048576).toFixed(1)} MB`);
