// Contrast gate for tokens.css: every text and UI-boundary pair in Night and Day.
// Usage: node artifacts/after-hours/qa/check-tokens.mjs   (exit 1 on any failure)
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const css = await readFile(path.join(here, "../tokens.css"), "utf8");
const block = (selector) => {
  const start = css.indexOf(selector);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  return "";
};
const parse = (text) => Object.fromEntries([...text.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const night = parse(block(":root {"));
const day = { ...night, ...parse(block('html[data-theme="day"] {')) };

function resolve(tokens, key) {
  let value = tokens[key];
  for (let i = 0; i < 6 && value?.startsWith("var("); i++) value = tokens[value.slice(6, -1)];
  return value;
}
function toRgb(hex) {
  const clean = hex.replace("#", "");
  return clean.match(/../g).map((part) => parseInt(part, 16) / 255);
}
function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const text = 4.5;
const ui = 3;
const surfaces = ["bg", "surface", "raised"];
const pairs = [];
for (const fg of ["text", "muted", "faint", "accent", "signal", "claret", "error", "success", "warning"]) for (const bg of surfaces) pairs.push([fg, bg, text]);
for (const cat of Object.keys(night).filter((k) => k.startsWith("cat-"))) for (const bg of surfaces) pairs.push([cat, bg, text]);
// Footer and wells sit on the deeper background; overlays host hover and skeleton states.
for (const fg of ["text", "muted", "faint", "accent"]) for (const bg of ["bg-deep", "overlay"]) pairs.push([fg, bg, text]);
pairs.push(["on-accent", "accent-fill", text], ["on-accent", "accent-fill-hover", text], ["on-velvet", "velvet", text], ["on-velvet", "velvet-deep", text], ["selection-text", "selection-bg", text], ["claret", "velvet", ui]);
for (const bg of surfaces) pairs.push(["line-strong", bg, ui], ["focus", bg, ui], ["accent-fill", bg, ui]);
// Brand stage stays dark in both themes.
pairs.push(["parchment", "stage", text], ["brass-400", "stage", text], ["celadon-300", "stage", text]);

const results = [];
for (const [theme, tokens] of [["night", night], ["day", day]]) {
  for (const [fg, bg, min] of pairs) {
    const a = resolve(tokens, fg);
    const b = resolve(tokens, bg);
    if (!a?.startsWith("#") || !b?.startsWith("#")) { results.push({ theme, fg, bg, error: `unresolved ${a} / ${b}` }); continue; }
    const value = +ratio(a, b).toFixed(2);
    results.push({ theme, fg, bg, colors: [a, b], ratio: value, minimum: min, pass: value >= min });
  }
}
const failures = results.filter((r) => !r.pass);
await writeFile(path.join(here, "token-contrast.json"), JSON.stringify({ date: new Date().toISOString().slice(0, 10), version: css.match(/v(\d+\.\d+\.\d+(?:-[\w.]+)?)/)?.[1] || "unknown", pairs: results.length, failures: failures.length, results }, null, 2));
console.log(`${results.length} pairs, ${failures.length} failures`);
for (const f of failures) console.log(`  ✗ ${f.theme} ${f.fg} on ${f.bg}: ${f.ratio ?? f.error} (min ${f.minimum})`);
const min = (theme, prefix) => Math.min(...results.filter((r) => r.theme === theme && r.fg.startsWith(prefix) && r.ratio).map((r) => r.ratio));
console.log(`lowest category text ratio — night ${min("night", "cat-")}, day ${min("day", "cat-")}`);
if (failures.length) process.exitCode = 1;
