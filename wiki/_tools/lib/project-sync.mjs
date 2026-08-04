/**
 * Pure helpers for wiki ↔ project sync checks.
 * Used by wiki-project-sync.mjs and node:test.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

export function toPosix(p) {
  return p.split(sep).join('/');
}

export function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function readText(path) {
  return readFileSync(path, 'utf8');
}

/** Expand watcher paths to concrete repo-relative POSIX file paths. */
export function resolveWatchedFiles(repoRoot, watcher) {
  const filter = watcher.pathFilter ? new RegExp(watcher.pathFilter) : null;
  const out = [];

  const consider = (abs) => {
    const rel = toPosix(relative(repoRoot, abs));
    if (filter && !filter.test(rel)) return;
    out.push(rel);
  };

  const walk = (abs) => {
    let st;
    try {
      st = statSync(abs);
    } catch {
      return;
    }
    if (st.isFile()) {
      consider(abs);
      return;
    }
    if (!st.isDirectory()) return;
    for (const name of readdirSync(abs)) {
      if (name === 'node_modules' || name === '.git') continue;
      walk(join(abs, name));
    }
  };

  for (const p of watcher.paths ?? []) {
    walk(resolve(repoRoot, p));
  }
  return [...new Set(out)].sort((a, b) => a.localeCompare(b));
}

/** Latest commit unix time for the given paths, or null if none. */
export function gitLatestCommitUnix(repoRoot, paths) {
  if (!paths.length) return null;
  try {
    const out = execFileSync(
      'git',
      ['log', '-1', '--format=%ct', '--', ...paths],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
    if (!out) return null;
    const n = Number(out);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function extractFact(repoRoot, fact) {
  const abs = resolve(repoRoot, fact.fromFile);
  if (!existsSync(abs)) {
    return { ok: false, error: `source file missing: ${fact.fromFile}` };
  }
  const body = readText(abs);
  const re = new RegExp(fact.regex, 'm');
  const m = body.match(re);
  if (!m) {
    return { ok: false, error: `regex did not match in ${fact.fromFile}: /${fact.regex}/` };
  }
  let value = m[1] ?? m[0];
  if (fact.format) {
    value = fact.format.replace(/\$\{(\d+)\}/g, (_, i) => m[Number(i)] ?? '');
  }
  return { ok: true, value };
}

export function countFiles(repoRoot, countRule) {
  const dir = resolve(repoRoot, countRule.globDir);
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((name) => name.endsWith(countRule.globExt)).length;
}

export function extractIndexStatuses(indexBody) {
  const existing = [];
  const planned = [];
  for (const line of indexBody.split('\n')) {
    const check = line.match(/✅\s*\[[^\]]*\]\(([^)#]+\.md)/);
    if (check) existing.push(check[1].replace(/^\.\//, ''));
    const plannedTick = line.match(/📋\s*`([^`]+)`/);
    if (plannedTick) {
      let p = plannedTick[1].trim();
      if (!p.endsWith('.md')) p = `${p}.md`;
      // entries like architecture/stack.md
      planned.push(p.replace(/^wiki\//, ''));
    }
  }
  return { existing: [...new Set(existing)], planned: [...new Set(planned)] };
}

/**
 * @returns {{ level: 'error'|'warn', code: string, message: string, hint?: string }[]}
 */
export function runProjectSync({ repoRoot, wikiRoot, contract, nowUnix = Math.floor(Date.now() / 1000) }) {
  const findings = [];
  const add = (level, code, message, hint) => findings.push({ level, code, message, hint });

  for (const watcher of contract.watchers ?? []) {
    const codeFiles = resolveWatchedFiles(repoRoot, watcher);
    const wikiRepoPaths = (watcher.wikiPages ?? []).map((p) => toPosix(`wiki/${p}`));

    for (const page of wikiRepoPaths) {
      if (!existsSync(resolve(repoRoot, page))) {
        add('error', `watcher:${watcher.id}:missing-wiki`, `немає ${page}`, `створити або прибрати з watcher ${watcher.id}`);
      }
    }

    const codeTs = gitLatestCommitUnix(repoRoot, codeFiles);
    const wikiTs = gitLatestCommitUnix(repoRoot, wikiRepoPaths);
    if (codeTs != null && wikiTs != null && codeTs > wikiTs) {
      const lagHours = Math.round((codeTs - wikiTs) / 3600);
      add(
        'error',
        `watcher:${watcher.id}:stale-wiki`,
        `код під «${watcher.id}» новіший за wiki на ~${lagHours}h`,
        `оновити ${watcher.wikiPages.join(', ')} (контент + Last updated) і закомітити в цій же гілці`,
      );
    } else if (codeTs != null && wikiTs == null) {
      add(
        'error',
        `watcher:${watcher.id}:wiki-never-committed`,
        `є код для «${watcher.id}», але wiki-сторінки ще не в git`,
        `додати ${watcher.wikiPages.join(', ')}`,
      );
    }

    for (const page of watcher.wikiPages ?? []) {
      const abs = resolve(wikiRoot, page);
      if (!existsSync(abs)) continue;
      const body = readText(abs);
      const dm = body.match(/Last updated:\s*(\d{4}-\d{2}-\d{2})/);
      if (!dm) continue;
      const updated = Date.parse(`${dm[1]}T00:00:00Z`);
      if (!Number.isFinite(updated)) continue;
      const ageDays = Math.floor((nowUnix * 1000 - updated) / 86_400_000);
      if (ageDays > 45) {
        add(
          'warn',
          `watcher:${watcher.id}:header-stale`,
          `${page}: Last updated ${dm[1]} (${ageDays} днів)`,
          'перевірити актуальність і оновити дату після ревʼю',
        );
      }
    }
  }

  for (const fact of contract.facts ?? []) {
    const extracted = extractFact(repoRoot, fact);
    if (!extracted.ok) {
      add('error', `fact:${fact.id}:extract`, extracted.error);
      continue;
    }
    for (const wikiFile of fact.mustAppearIn ?? []) {
      const abs = resolve(repoRoot, wikiFile);
      if (!existsSync(abs)) {
        add('error', `fact:${fact.id}:missing-page`, `немає ${wikiFile}`);
        continue;
      }
      const body = readText(abs);
      if (!body.includes(extracted.value)) {
        add(
          'error',
          `fact:${fact.id}:missing-value`,
          `${wikiFile} не містить «${extracted.value}» (з ${fact.fromFile})`,
          `після зміни коду синхронізувати wiki; значення зараз: ${extracted.value}`,
        );
      }
    }
  }

  for (const countRule of contract.counts ?? []) {
    const actual = countFiles(repoRoot, countRule);
    const wikiAbs = resolve(repoRoot, countRule.wikiPage);
    if (!existsSync(wikiAbs)) {
      add('error', `count:${countRule.id}:missing-page`, `немає ${countRule.wikiPage}`);
      continue;
    }
    const body = readText(wikiAbs);
    const m = body.match(new RegExp(countRule.wikiRegex));
    if (!m) {
      add(
        'error',
        `count:${countRule.id}:no-mention`,
        `${countRule.wikiPage} не згадує кількість (${countRule.wikiRegex})`,
        `додати факт на кшталт «~${actual} міграцій»`,
      );
      continue;
    }
    const documented = Number(m[1]);
    const tol = countRule.tolerance ?? 0;
    if (!Number.isFinite(documented) || Math.abs(documented - actual) > tol) {
      add(
        'error',
        `count:${countRule.id}:mismatch`,
        `${countRule.id}: у wiki ${documented}, у репо ${actual}`,
        `оновити ${countRule.wikiPage} під актуальну кількість файлів`,
      );
    }
  }

  if (contract.index) {
    const indexAbs = resolve(wikiRoot, 'index.md');
    const indexBody = readText(indexAbs);
    const { existing, planned } = extractIndexStatuses(indexBody);
    if (contract.index.requireExistingForCheckmark) {
      for (const page of existing) {
        if (!existsSync(resolve(wikiRoot, page))) {
          add('error', 'index:checkmark-missing', `index ✅ → wiki/${page} відсутній`);
        }
      }
    }
    if (contract.index.forbidExistingForPlanned) {
      for (const page of planned) {
        if (existsSync(resolve(wikiRoot, page))) {
          add(
            'error',
            'index:planned-but-exists',
            `index 📋 \`${page}\`, але файл уже є`,
            'поміняти 📋 на ✅ і залінкувати як готову сторінку',
          );
        }
      }
    }
  }

  return findings;
}
