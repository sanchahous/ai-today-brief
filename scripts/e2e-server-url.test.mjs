import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_E2E_PORT,
  resolveE2eBaseUrl,
  resolveE2ePort,
} from './e2e-server-url.ts';

describe('resolveE2ePort', () => {
  it('defaults to 3000 when PORT is unset', () => {
    assert.equal(resolveE2ePort({}), DEFAULT_E2E_PORT);
    assert.equal(resolveE2ePort({ PORT: '' }), DEFAULT_E2E_PORT);
  });

  it('reads PORT when set', () => {
    assert.equal(resolveE2ePort({ PORT: '3101' }), 3101);
  });

  it('falls back to 3000 for invalid PORT', () => {
    assert.equal(resolveE2ePort({ PORT: 'abc' }), DEFAULT_E2E_PORT);
    assert.equal(resolveE2ePort({ PORT: '0' }), DEFAULT_E2E_PORT);
  });
});

describe('resolveE2eBaseUrl', () => {
  it('defaults to http://127.0.0.1:3000 when unset', () => {
    assert.equal(resolveE2eBaseUrl({}), 'http://127.0.0.1:3000');
  });

  it('derives from PORT when set', () => {
    assert.equal(resolveE2eBaseUrl({ PORT: '3101' }), 'http://127.0.0.1:3101');
  });

  it('prefers E2E_BASE_URL over PORT', () => {
    assert.equal(
      resolveE2eBaseUrl({ PORT: '3101', E2E_BASE_URL: 'http://127.0.0.1:3999' }),
      'http://127.0.0.1:3999',
    );
  });
});
