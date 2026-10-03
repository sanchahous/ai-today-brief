/**
 * Task status fragments: one wiki/tasks/<id>.md per task.
 * Shared lists stay stable pointers. The rollup is printed, never written.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const POINTER = '<!-- task-status: fragments -->';
export const TASKS_DIR = 'tasks';
export const MANIFEST_NAME = '_manifest.json';
export const RESERVED_PAGES = new Set(['README.md']);

const POINTER_PAGES = [
  'now.md',
  'index.md',
  'product/after-hours-epic-handoff.md',
  'product/after-hours-redesign-epic.md',
];

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function fenceBody(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

/** Bodies of ```verbatim fences, in file order. */
export function verbatimBodies(markdown) {
  const bodies = [];
  const re = /```verbatim\n([\s\S]*?)\n```/g;
  let match = re.exec(markdown);
  while (match) {
    bodies.push(match[1]);
    match = re.exec(markdown);
  }
  return bodies;
}

export function readUtf8(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

function fragmentFiles(tasksDir) {
  return readdirSync(tasksDir)
    .filter((name) => name.endsWith('.md') && !RESERVED_PAGES.has(name))
    .sort((a, b) => a.localeCompare(b));
}

function taskIdFromFile(body, filename) {
  const line = body.match(/^Task:\s*(\S+)\s*$/m);
  return { declared: line?.[1] ?? '', filenameId: filename.replace(/\.md$/, '') };
}

function headerErrors(page, body) {
  const head = body.split('\n').slice(0, 14).join('\n');
  const errors = [];
  if (!/^#\s+\S/m.test(head)) errors.push(`${page}: немає H1`);
  for (const field of ['Summary:', 'Sources:', 'Last updated:', 'Task:']) {
    if (!head.includes(field)) errors.push(`${page}: немає «${field}» у перших 14 рядках`);
  }
  if (!body.includes('## Status')) errors.push(`${page}: немає розділу ## Status`);
  return errors;
}

function takeHash(pool, hash) {
  const index = pool.findIndex((body) => sha256(body) === hash);
  if (index < 0) return false;
  pool.splice(index, 1);
  return true;
}

export function groupHash(bodies) {
  return sha256(bodies.map((body) => body.trim()).join('\n'));
}

export function verbatimFence(text) {
  const body = fenceBody(text);
  if (body.includes('```')) {
    throw new Error('verbatim block contains a fence marker');
  }
  return `\`\`\`verbatim\n${body}\n\`\`\``;
}

/**
 * @param {string} wikiRoot
 * @returns {string[]} human-readable errors; empty means the catalog is intact
 */
export function checkTaskFragments(wikiRoot) {
  const errors = [];
  const tasksDir = join(wikiRoot, TASKS_DIR);
  const manifestPath = join(tasksDir, MANIFEST_NAME);
  if (!existsSync(manifestPath)) {
    return ['немає wiki/tasks/_manifest.json'];
  }
  const manifest = JSON.parse(readUtf8(manifestPath));
  const blocks = manifest.blocks ?? [];
  const groups = manifest.groups ?? [];

  for (const page of POINTER_PAGES) {
    const abs = join(wikiRoot, page);
    if (!existsSync(abs) || !readUtf8(abs).includes(POINTER)) {
      errors.push(`${page}: немає маркера стабільного посилання на фрагменти`);
    }
  }

  const nowPath = join(wikiRoot, 'now.md');
  if (!existsSync(nowPath) || !readUtf8(nowPath).includes('WEEKLY_CONTENT_STUDIO_V2=off')) {
    errors.push('now.md: зник заморожений факт WEEKLY_CONTENT_STUDIO_V2=off');
  }

  const readme = join(tasksDir, 'README.md');
  if (!existsSync(readme) || !readUtf8(readme).includes('npm run wiki:tasks')) {
    errors.push('wiki/tasks/README.md: немає команди зведення npm run wiki:tasks');
  }

  /** @type {Map<string, string[]>} */
  const pools = new Map();
  for (const filename of fragmentFiles(tasksDir)) {
    const body = readUtf8(join(tasksDir, filename));
    const { declared, filenameId } = taskIdFromFile(body, filename);
    errors.push(...headerErrors(`tasks/${filename}`, body));
    if (declared !== filenameId) {
      errors.push(`tasks/${filename}: Task: ${declared || '(порожньо)'} не збігається з іменем файлу`);
    }
    const fences = verbatimBodies(body);
    if (fences.length === 0) errors.push(`tasks/${filename}: немає блоку verbatim`);
    pools.set(filenameId, fences);
  }

  for (const block of blocks) {
    const pool = pools.get(block.task);
    if (!pool || !takeHash(pool, block.sha256)) {
      errors.push(`маніфест: немає verbatim для ${block.task} / ${block.source}`);
    }
  }

  for (const group of groups) {
    const groupBlocks = blocks.filter((block) => block.group === group.id);
    const bodies = [];
    let missing = false;
    for (const block of groupBlocks) {
      const file = readUtf8(join(tasksDir, `${block.task}.md`));
      const body = verbatimBodies(file).find((item) => sha256(item) === block.sha256);
      if (body == null) {
        missing = true;
        break;
      }
      bodies.push(body);
    }
    if (missing) continue;
    if (groupHash(bodies) !== group.sha256) {
      errors.push(`група ${group.id}: хеш зчеплених записів не збігається з маніфестом`);
    }
  }

  return errors;
}

export function renderRollup(wikiRoot) {
  const tasksDir = join(wikiRoot, TASKS_DIR);
  const lines = [
    '# Зведення статусів задач',
    '',
    'Джерело: wiki/tasks/<id>.md. Цей текст друкується на льоту і не комітиться.',
    '',
  ];
  for (const filename of fragmentFiles(tasksDir)) {
    if (filename.startsWith('archive-')) continue;
    const body = readUtf8(join(tasksDir, filename));
    const id = filename.replace(/\.md$/, '');
    const first = verbatimBodies(body)[0]?.trim().split('\n')[0] ?? '(порожньо)';
    const preview = first.length > 180 ? `${first.slice(0, 177)}...` : first;
    lines.push(`- \`${id}\` — ${preview}`);
  }
  lines.push('');
  return lines.join('\n');
}
