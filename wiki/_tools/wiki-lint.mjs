#!/usr/bin/env node
/**
 * wiki-lint — детермінована частина аудиту бази знань.
 *
 * Перевіряє те, що можна перевірити машиною: наявність ядрових файлів, формат
 * сторінки, биті відносні посилання, сирітські сторінки, сторінки поза index.md,
 * відсутні цитати, застарілі дати.
 *
 * Семантику (суперечності між сторінками, застарілі під новіші джерела
 * твердження, концепти без власної сторінки) робить агент за запитом «run lint».
 *
 * Використання:
 *   node wiki/_tools/wiki-lint.mjs           звіт, завжди exit 0
 *   node wiki/_tools/wiki-lint.mjs --strict  exit 1, якщо є error-рівень
 *
 * Правило проєкту: лінтер НІЧОГО не виправляє автоматично.
 */

import { access, readdir, readFile } from 'node:fs/promises';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WIKI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(WIKI_ROOT, '..');
const CORE_PAGES = ['index.md', 'log.md', 'overview.md', 'now.md', 'open-questions.md'];
const ROOT_PAGES = new Set(CORE_PAGES);
const SKIP_DIRS = new Set(['_tools']);
const ORPHAN_EXEMPT_DIRS = new Set(['_meta']);
// Шаблон навмисно містить placeholder-посилання й дати — його формат не перевіряємо.
const TEMPLATE_PAGES = new Set(['_meta/page-template.md']);
// Структурні сторінки: їхній вміст — посилання й журнал, а не фактичні твердження.
const CITATION_EXEMPT = new Set(['index.md', 'log.md']);
const STALE_DAYS = 90;

const exists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

// Always normalize backslashes regardless of the host OS -- path.sep is '/'
// on POSIX, which used to make this a no-op there and left any
// Windows-style separator untouched (only ever exercised in CI/dev on
// Windows, since relative()'s own output already matches the host OS).
const toPosix = (p) => p.split(/[\\/]/).join('/');
const findings = [];
const add = (level, page, message, hint) => findings.push({ level, page, message, hint });

/** Усі .md під wiki/, крім _tools/. */
async function collectPages(dir = WIKI_ROOT, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await collectPages(full, acc);
    } else if (entry.name.endsWith('.md')) {
      acc.push(toPosix(relative(WIKI_ROOT, full)));
    }
  }
  return acc;
}

/** Відносні markdown-посилання: [text](path.md#anchor). Зовнішні та якорі — пропускаємо. */
function extractLinks(body) {
  const links = [];
  const re = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const target = m[1];
    if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) continue;
    links.push(target);
  }
  return links;
}

function checkFormat(page, body) {
  const head = body.split('\n').slice(0, 14).join('\n');
  if (!/^#\s+\S/m.test(head)) {
    add('error', page, 'немає H1-заголовка на початку сторінки', 'див. wiki/_meta/page-template.md');
  }
  for (const field of ['Summary:', 'Sources:', 'Last updated:']) {
    if (!head.includes(field)) {
      add('error', page, `немає поля «${field}» у шапці`, 'скопіювати шапку з wiki/_meta/page-template.md');
    }
  }
  const dateMatch = body.match(/Last updated:\s*(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    const ageDays = Math.floor((Date.now() - Date.parse(dateMatch[1])) / 86_400_000);
    if (Number.isFinite(ageDays) && ageDays > STALE_DAYS) {
      add('warn', page, `не оновлювалась ${ageDays} днів`, 'перечитати й або оновити дату, або переписати');
    }
  } else if (/Last updated:/.test(body)) {
    add('warn', page, 'дата в «Last updated» не у форматі YYYY-MM-DD');
  }
}

function checkCitations(page, body) {
  const contentLines = body
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('>'));
  const hasSourceMarkers = /\(source:|\(needs verification\)|\(assumption\)/i.test(body);
  const declaredNoSource = /Sources:\s*(none|немає)/i.test(body);
  if (!CITATION_EXEMPT.has(page) && contentLines.length > 25 && !hasSourceMarkers && !declaredNoSource) {
    add(
      'warn',
      page,
      'жодного маркера джерела на сторінці з великим обсягом тексту',
      'додати (source: …) до фактичних тверджень або Sources: none (analysis)',
    );
  }
  if (page !== 'open-questions.md' && /⚠️\s*Conflict/i.test(body) && !/open-questions/.test(body)) {
    add('warn', page, 'є маркер Conflict, але немає посилання на open-questions.md');
  }
}

async function main() {
  const pages = (await collectPages()).sort();
  const pageSet = new Set(pages);

  for (const core of CORE_PAGES) {
    if (!pageSet.has(core)) add('error', core, 'ядрова сторінка відсутня');
  }

  const incoming = new Map(pages.map((p) => [p, 0]));
  let indexTargets = new Set();

  for (const page of pages) {
    const body = await readFile(join(WIKI_ROOT, page), 'utf8');
    const isTemplate = TEMPLATE_PAGES.has(page);
    if (!isTemplate) {
      checkFormat(page, body);
      checkCitations(page, body);
    }

    const targets = new Set();
    if (isTemplate) continue;
    for (const link of extractLinks(body)) {
      const [pathPart] = link.split('#');
      if (!pathPart) continue;
      const absolute = resolve(dirname(join(WIKI_ROOT, page)), pathPart);
      const resolved = toPosix(relative(WIKI_ROOT, absolute));
      if (resolved.startsWith('..')) {
        // Посилання за межі wiki/ (наприклад ../docs/… до міграції) — перевіряємо на диску.
        if (!(await exists(absolute))) {
          add('error', page, `бите зовнішнє посилання → ${link}`, `нема файлу ${toPosix(relative(REPO_ROOT, absolute))}`);
        }
        continue;
      }
      if (!pageSet.has(resolved)) {
        add('error', page, `бите посилання → ${link}`, `нема файлу wiki/${resolved}`);
        continue;
      }
      targets.add(resolved);
      if (resolved !== page) incoming.set(resolved, (incoming.get(resolved) ?? 0) + 1);
    }
    if (page === 'index.md') indexTargets = targets;
  }

  for (const page of pages) {
    const dir = page.includes('/') ? page.split('/')[0] : '';
    if (ROOT_PAGES.has(page) || ORPHAN_EXEMPT_DIRS.has(dir)) continue;
    if ((incoming.get(page) ?? 0) === 0) {
      add('warn', page, 'сирітська сторінка — жодного вхідного посилання', 'залінкувати з index.md або з тематичної сторінки');
    }
    if (!indexTargets.has(page)) {
      add('warn', page, 'сторінки немає в index.md', 'додати рядок у відповідний розділ index.md');
    }
  }

  const errors = findings.filter((f) => f.level === 'error');
  const warns = findings.filter((f) => f.level === 'warn');

  console.log(`\nwiki-lint · ${pages.length} сторінок · ${errors.length} error · ${warns.length} warn\n`);
  if (findings.length === 0) {
    console.log('Чисто.\n');
    return 0;
  }
  findings
    .sort((a, b) => (a.level === b.level ? a.page.localeCompare(b.page) : a.level === 'error' ? -1 : 1))
    .forEach((f, i) => {
      const tag = f.level === 'error' ? 'ERROR' : 'warn ';
      console.log(`${String(i + 1).padStart(3)}. [${tag}] wiki/${f.page} — ${f.message}`);
      if (f.hint) console.log(`      → ${f.hint}`);
    });
  console.log('\nЛінтер нічого не виправляє. Показати список власнику й чекати OK.\n');
  return errors.length > 0 && process.argv.includes('--strict') ? 1 : 0;
}

process.exitCode = await main();
