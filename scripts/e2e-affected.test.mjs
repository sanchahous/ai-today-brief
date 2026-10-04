import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as serverUrl from './e2e-server-url.ts';

const script = ts.transpileModule(
  fs.readFileSync(new URL('./e2e-affected.ts', import.meta.url), 'utf8').replace('void main();', 'main();'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

for (const platform of ['win32', 'linux']) {
  test(`${platform}: broad changes refuse an existing server without any process commands`, async () => {
    const commands = [];
    const errors = [];
    const stopped = new Error('exit');
    const exitCodes = [];
    const dependencies = {
      'node:fs': fs,
      'node:child_process': { spawnSync: (...args) => { commands.push(args); return { status: 0 }; } },
      './e2e-server-url': {
        ...serverUrl,
        resolveE2eBaseUrl: () => 'http://127.0.0.1:3100',
        resolveE2ePort: () => 3100,
      },
    };
    const result = runInNewContext(script, {
      exports: {},
      require: (name) => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
        return dependencies[name];
      },
      process: {
        platform,
        env: { PORT: '3100', E2E_AFFECTED_FILES: 'src/app/globals.css' },
        argv: ['node', 'scripts/e2e-affected.ts'],
        exit: (code) => { exitCodes.push(code); throw stopped; },
      },
      console: { log: () => {}, error: (message) => errors.push(message) },
      fetch: async (url) => { assert.equal(url, 'http://127.0.0.1:3100'); return { status: 200 }; },
      AbortController,
      setTimeout,
      clearTimeout,
    });
    await assert.rejects(result, (error) => error === stopped);
    assert.deepEqual(exitCodes, [1]);
    assert.match(errors.join('\n'), /broad change requires a fresh server/);
    assert.deepEqual(commands, []);
  });
}
