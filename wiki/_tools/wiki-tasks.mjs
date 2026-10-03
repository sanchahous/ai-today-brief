#!/usr/bin/env node
/**
 * wiki:tasks — друкує зведення фрагментів статусу.
 * wiki:tasks --check — перевіряє форму фрагментів і повноту переносу (частина wiki:check).
 *
 * Нічого не записує у спільні списки і не оновлює файли.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTaskFragments, renderRollup } from './lib/task-fragments.mjs';

const WIKI = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

if (!check) {
  process.stdout.write(renderRollup(WIKI));
} else {
  const errors = checkTaskFragments(WIKI);
  if (errors.length === 0) {
    console.log('\nwiki-tasks · фрагменти цілі\n');
  } else {
    console.log(`\nwiki-tasks · ${errors.length} error\n`);
    errors.forEach((error, index) => {
      console.log(`${String(index + 1).padStart(3)}. ${error}`);
    });
    console.log('');
    process.exitCode = 1;
  }
}
