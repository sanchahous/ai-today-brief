import { readFileSync } from 'fs';
import { test, expect } from 'vitest';

test('news page does not read searchParams to preserve ISR', () => {
  const content = readFileSync('src/app/[lang]/news/page.tsx', 'utf-8');
  // Ensure the server component doesn't take searchParams in its props
  expect(content).not.toMatch(/NewsPage\([^)]*searchParams/);
  // Ensure we don't use it from props directly inside
  expect(content).not.toMatch(/const {[^}]*searchParams[^}]*} = props/);
});
