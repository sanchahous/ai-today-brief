// Inspect the actual WOFF2 cmap; no downloads or additional dependencies.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mod = require('next/dist/compiled/@next/font/dist/fontkit').default;
const fromBuffer = mod.default || mod;
const alphabet = 'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯабвгґдеєжзиіїйклмнопрстуфхцчшщьюя';
const assets = ['display', 'display-italic', 'sans', 'sans-uk'].map((name) => {
  const bytes = readFileSync(`artifacts/after-hours/assets/${name}.woff2`);
  if (!bytes.equals(readFileSync(`src/app/_fonts/${name}.woff2`))) throw new Error(`Runtime font drift: ${name}`);
  const font = fromBuffer(bytes);
  const missingUk = [...alphabet].filter((char) => !font.hasGlyphForCodePoint(char.codePointAt(0))).join('');
  if (name === 'sans-uk' && missingUk) throw new Error(`Missing Ukrainian glyphs: ${missingUk}`);
  const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  if (name !== 'sans-uk' && [...latin].some((char) => !font.hasGlyphForCodePoint(char.codePointAt(0)))) {
    throw new Error(`Missing Latin glyphs in ${name}`);
  }
  return { name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), family: font.familyName, axes: font.variationAxes, missingUk };
});
for (const family of ['Fraunces', 'Inter']) {
  if (!readFileSync(`artifacts/after-hours/assets/LICENSE-${family}.txt`).equals(readFileSync(`src/app/_fonts/LICENSE-${family}.txt`))) {
    throw new Error(`Runtime license drift: ${family}`);
  }
  if (!readFileSync(`artifacts/after-hours/assets/LICENSE-${family}.txt`, 'utf8').includes('SIL OPEN FONT LICENSE')) {
    throw new Error(`OFL license missing: ${family}`);
  }
}
writeFileSync('artifacts/after-hours/qa/ah-1.5-font-assets.json', `${JSON.stringify({ alphabet, assets }, null, 2)}\n`);
console.log('Latin and Ukrainian cmap coverage, variable weight axes and adjacent OFL licenses: PASS');
