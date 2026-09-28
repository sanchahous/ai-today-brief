// Artifact integrity audit for the After Hours prototype (v3).
// Runs the token contrast gate, hashes every source file index.html loads, checks that each
// referenced file exists, and records image dimensions/weights. Usage: node artifacts/after-hours/audit.mjs
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.dirname(fileURLToPath(import.meta.url));
const exists = (file) => stat(path.join(root, file)).then(() => true, () => false);

// 1. Contrast: the full semantic-pair gate lives in qa/check-tokens.mjs (single source of truth).
execFileSync(process.execPath, [path.join(root, "qa/check-tokens.mjs")], { stdio: "ignore" });
const contrast = JSON.parse(await readFile(path.join(root, "qa/token-contrast.json"), "utf8"));

// 2. Sources: everything index.html references, plus the generated token export.
const html = await readFile(path.join(root, "index.html"), "utf8");
const referenced = [...html.matchAll(/(?:href|src)="([^"#?:]+\.(?:css|js|svg|woff2))"/g)].map((m) => m[1]);
const sources = [...new Set(["index.html", ...referenced, "tokens.json"])];
const missing = [];
const hashes = {};
for (const file of sources) {
  if (!(await exists(file))) {
    missing.push(file);
    continue;
  }
  hashes[file] = createHash("sha256").update(await readFile(path.join(root, file))).digest("hex");
}

// 3. Media: brand/concept assets and exported screens.
const media = [];
for (const dir of ["assets", "screens", "screens-v3"]) {
  if (!(await exists(dir))) continue;
  for (const file of (await readdir(path.join(root, dir))).filter((f) => /\.(png|jpe?g|webp|avif)$/.test(f))) {
    const full = path.join(root, dir, file);
    const info = await sharp(full).metadata();
    media.push({ file: `${dir}/${file}`, width: info.width, height: info.height, format: info.format, bytes: (await stat(full)).size });
  }
}

const results = {
  date: new Date().toISOString().slice(0, 10),
  version: contrast.version,
  contrast: { pairs: contrast.pairs, failures: contrast.failures, report: "qa/token-contrast.json" },
  hashes,
  missing,
  media,
  scope: "Token contrast gate, source integrity and exported image metadata. Browser QA (axe, overflow, type floor, targets) lives in qa/run-qa.mjs.",
};
await writeFile(path.join(root, "artifact-audit.json"), JSON.stringify(results, null, 2) + "\n");
process.stdout.write(JSON.stringify({ contrastPairs: contrast.pairs, contrastFailures: contrast.failures, sources: Object.keys(hashes).length, missing, images: media.length }, null, 2) + "\n");
if (contrast.failures || missing.length) process.exitCode = 1;
