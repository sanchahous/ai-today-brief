import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Same pattern as the illustration-plan F5 grep. Allowed in tests/fixtures only. */
const PINNED_MODEL_VERSION = /sonnet-5|gpt-5|gemini-3\.[0-9]/;

function isSkippedDir(name: string): boolean {
  return name === 'node_modules' || name === '__fixtures__' || name === '.git';
}

function isTestFile(name: string): boolean {
  return name.endsWith('.test.ts') || name.endsWith('.test.tsx');
}

function listProductionFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!isSkippedDir(entry.name)) stack.push(full);
        continue;
      }
      if (isTestFile(entry.name)) continue;
      out.push(full);
    }
  }
  return out;
}

describe('F5 model version pins', () => {
  it('production pipeline/ and src/ do not pin sonnet-5, gpt-5, or gemini-3.x ids', () => {
    const hits: string[] = [];
    for (const root of ['pipeline', 'src']) {
      for (const file of listProductionFiles(root)) {
        const text = readFileSync(file, 'utf8');
        if (!PINNED_MODEL_VERSION.test(text)) continue;
        hits.push(relative(process.cwd(), file).replaceAll('\\', '/'));
      }
    }
    expect(hits).toEqual([]);
  });
});
