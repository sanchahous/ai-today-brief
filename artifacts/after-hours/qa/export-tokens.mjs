// Generates ../tokens.json from ../tokens.css (the single source of truth) and the Tension v3
// constants. Usage: node artifacts/after-hours/qa/export-tokens.mjs — never edit tokens.json by hand.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const css = await readFile(path.join(root, "tokens.css"), "utf8");
const version = css.match(/v(\d+\.\d+\.\d+(?:-[\w.]+)?)/)?.[1] || "unknown";
const block = (selector) => {
  const start = css.indexOf(selector);
  const open = css.indexOf("{", start);
  return css.slice(open + 1, css.indexOf("\n}", open));
};
const parse = (text) => Object.fromEntries([...text.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().replace(/\s+/g, " ")]));
const base = parse(block(":root {"));
const day = parse(block('html[data-theme="day"] {'));
const uk = parse(block('html[lang="uk"] {'));
const resolve = (tokens, value) => {
  for (let i = 0; i < 6 && /^var\(--[\w-]+\)$/.test(value || ""); i++) value = tokens[value.slice(6, -1)];
  return value;
};
const pick = (tokens, keys) => Object.fromEntries(keys.filter((k) => k in tokens).map((k) => [k, tokens[k]]));
const primitiveKeys = Object.keys(base).filter((k) => /^(ink|parchment|paper|press|brass|celadon|claret|velvet|coral)-?/.test(k) && /^#/.test(base[k]));
const categoryKeys = ["tools", "tutorials", "cost", "agents", "vibe", "creative", "local", "career", "models"];
const roleKeys = ["bg", "bg-deep", "stage", "surface", "raised", "overlay", "text", "muted", "faint", "accent", "accent-hover", "accent-fill", "accent-fill-hover", "on-accent", "signal", "claret", "velvet", "velvet-deep", "on-velvet", "line", "line-strong", "focus", "error", "success", "warning", "selection-bg", "selection-text", "tint-accent", "tint-signal", "tint-claret", "tint-hover", "scrim"];
const role = (tokens, key) => {
  const raw = tokens[key];
  const ref = /^var\(--([\w-]+)\)$/.exec(raw || "")?.[1];
  return ref ? { ref, value: resolve(tokens, raw) } : { value: raw };
};
const dayTokens = { ...base, ...day };
const contrast = JSON.parse(await readFile(path.join(here, "token-contrast.json"), "utf8"));

const out = {
  $comment: "Generated from tokens.css by qa/export-tokens.mjs. Do not edit by hand.",
  name: "After Hours",
  version,
  generated: new Date().toISOString().slice(0, 10),
  layers: "primitives → semantic roles (Night default, Day override) → component tokens. Components consume semantic tokens only.",
  primitives: pick(base, primitiveKeys),
  semantic: {
    night: Object.fromEntries(roleKeys.map((k) => [k, role(base, k)])),
    day: Object.fromEntries(roleKeys.map((k) => [k, role(dayTokens, k)])),
  },
  category: {
    note: "Text/badge colour per theme (≥ 4.5:1 on surface and bg). Art hues are theme-independent: banners are always drawn on the dark stage.",
    night: Object.fromEntries(categoryKeys.map((k) => [k, base[`cat-${k}`]])),
    day: Object.fromEntries(categoryKeys.map((k) => [k, day[`cat-${k}`]])),
    art: Object.fromEntries(categoryKeys.map((k) => [k, base[`art-${k}`]])),
  },
  effects: {
    night: pick(base, ["stage-light", "sheen", "brass-gradient", "grain-opacity", "shadow-1", "shadow-2", "shadow-pop"]),
    day: pick(day, ["stage-light", "sheen", "grain-opacity", "shadow-1", "shadow-2", "shadow-pop"]),
  },
  typography: {
    families: pick(base, ["display", "sans", "mono"]),
    ukOverride: uk,
    floorPx: 12,
    scale: Object.fromEntries(["2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl"].map((k) => [k, base[`text-${k}`].replace(/\s*\/\*.*$/, "")])),
    leading: pick(base, ["leading-tight", "leading-heading", "leading-body", "leading-reading"]),
    tracking: pick(base, ["tracking-display", "tracking-heading", "tracking-meta", "tracking-eyebrow"]),
    measure: base.measure,
  },
  space: pick(base, Object.keys(base).filter((k) => k.startsWith("space-")).concat(["gutter", "section-y"])),
  shape: pick(base, ["radius", "radius-sm", "radius-md", "radius-lg", "radius-pill"]),
  size: pick(base, ["touch-floor", "control-sm", "control-md", "control-lg", "icon-sm", "icon-md", "max", "max-wide", "reading", "header-h"]),
  zIndex: pick(base, ["z-base", "z-sticky", "z-dropdown", "z-overlay", "z-dialog", "z-toast"]),
  breakpoints: {
    note: "max-width media queries in em, so layouts reflow when the reader enlarges the browser font size; px = value at the default 16 px",
    compact: { em: 23.75, px: 380 },
    narrow: { em: 25, px: 400 },
    phone: { em: 47.5, px: 760 },
    tablet: { em: 60, px: 960 },
    laptop: { em: 68.75, px: 1100 },
    navCompact: { em: 73.75, px: 1180 },
    desktop: { em: 80, px: 1280 },
  },
  accessibility: {
    standard: "WCAG 2.2 AA",
    textFloorPx: 12,
    targetMinPx: 44,
    targetMinAA: 24,
    focus: { width: 2, offset: 3, token: "focus" },
    contrastGate: { script: "qa/check-tokens.mjs", pairs: contrast.pairs, failures: contrast.failures },
    reducedMotion: "static final frame; no autoplay",
    forcedColors: "supported (system colours, visible focus)",
  },
  motion: {
    system: "Tension v3",
    durations: pick(base, ["fast", "standard", "entrance"]),
    easing: pick(base, ["ease", "ease-in-out", "ease-release"]),
    spring: { mass: 1, stiffness: 240, damping: 24 },
    gestures: { settle: 640, curtain: 720, fold: 760, index: 440, rule: 620, draw: 900, count: 900, press: 480, focus: 300, reveal: 520, confirm: 420, strum: 520, grow: 820, record: 1400, disclose: 360 },
    maxActiveUiAnimations: 32,
    brand: {
      name: "The Resolve",
      durationMs: 3400,
      acts: [
        { name: "Signals", fromMs: 0, toMs: 900 },
        { name: "Edit", fromMs: 900, toMs: 2050 },
        { name: "Resolve", fromMs: 2050, toMs: 3400 },
      ],
      ribs: 16,
      strokesPerRib: 4,
      signalLandsMs: 2600,
      iterations: 1,
      budget: "own atomic WAAPI budget; no filters; one mask",
    },
    viewTransitions: "route cross-fade where supported; skipped for reduced motion",
  },
  deprecated: { paper: "text", ink: "on-accent", brass: "accent", mint: "signal" },
};
await writeFile(path.join(root, "tokens.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`tokens.json v${version}: ${Object.keys(out.primitives).length} primitives, ${roleKeys.length} roles × 2 themes, ${categoryKeys.length} categories`);
