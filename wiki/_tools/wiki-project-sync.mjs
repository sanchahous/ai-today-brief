#!/usr/bin/env node
/**
 * wiki-project-sync — тести синхрону wiki зі структурою/фактами проєкту.
 *
 * Падає (exit 1), коли:
 * - код під watcher змінився пізніше, ніж задекларовані wiki-сторінки;
 * - ключовий факт із коду/.env більше відсутній у wiki;
 * - лічильник (напр. міграції) у index не збігається з диском;
 * - index ✅ вказує на відсутній файл, або 📋 на файл, який уже існує.
 *
 * Контракт: wiki/_meta/project-sync.json
 *
 *   node wiki/_tools/wiki-project-sync.mjs
 *   npm run wiki:sync
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadJson, runProjectSync } from './lib/project-sync.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WIKI = resolve(ROOT, 'wiki');
const CONTRACT = resolve(WIKI, '_meta/project-sync.json');

const contract = loadJson(CONTRACT);
const findings = runProjectSync({ repoRoot: ROOT, wikiRoot: WIKI, contract });
const errors = findings.filter((f) => f.level === 'error');
const warns = findings.filter((f) => f.level === 'warn');

console.log(
  `\nwiki-project-sync · ${contract.watchers?.length ?? 0} watchers · ${contract.facts?.length ?? 0} facts · ${errors.length} error · ${warns.length} warn\n`,
);

if (findings.length === 0) {
  console.log('Wiki синхронна з проєктом.\n');
  process.exitCode = 0;
} else {
  findings
    .sort((a, b) => (a.level === b.level ? a.code.localeCompare(b.code) : a.level === 'error' ? -1 : 1))
    .forEach((f, i) => {
      const tag = f.level === 'error' ? 'ERROR' : 'warn ';
      console.log(`${String(i + 1).padStart(3)}. [${tag}] ${f.code} — ${f.message}`);
      if (f.hint) console.log(`      → ${f.hint}`);
    });
  console.log(
    '\nОновити відповідні wiki-сторінки (і wiki/log.md), потім знову npm run wiki:sync.\n',
  );
  process.exitCode = errors.length > 0 ? 1 : 0;
}
