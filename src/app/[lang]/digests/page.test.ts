import { readFileSync } from 'fs';
import { expect, test } from 'vitest';

test('digests page does not read searchParams to preserve ISR', () => {
  const content = readFileSync('src/app/[lang]/digests/page.tsx', 'utf-8');
  expect(content).not.toMatch(/DigestsPage\([^)]*searchParams/);
  expect(content).not.toMatch(/const {[^}]*searchParams[^}]*} = props/);
});
