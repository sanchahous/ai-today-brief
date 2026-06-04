import { afterEach, describe, expect, it } from 'vitest';
import { getBeehiivCredentials } from '@/lib/beehiiv-config';

const ENV_KEYS = [
  'BEEHIIV_API_KEY',
  'BEEHIIV_PUBLICATION_ID',
  'BEEHIIV_PUBLICATION_ID_API_V2',
  'BEEHIIV_PUBLICATION_ID_API_V1',
] as const;

function clearBeehiivEnv(): void {
  for (const key of ENV_KEYS) delete process.env[key];
}

afterEach(() => {
  clearBeehiivEnv();
});

describe('getBeehiivCredentials', () => {
  it('returns null when keys are missing', () => {
    clearBeehiivEnv();
    expect(getBeehiivCredentials()).toBeNull();
  });

  it('prefers canonical publication id', () => {
    process.env.BEEHIIV_API_KEY = 'key';
    process.env.BEEHIIV_PUBLICATION_ID = 'pub_canonical';
    process.env.BEEHIIV_PUBLICATION_ID_API_V2 = 'pub_v2';
    expect(getBeehiivCredentials()).toEqual({
      apiKey: 'key',
      publicationId: 'pub_canonical',
    });
  });

  it('falls back to API v2 then v1 aliases', () => {
    process.env.BEEHIIV_API_KEY = 'key';
    process.env.BEEHIIV_PUBLICATION_ID_API_V2 = 'pub_v2';
    expect(getBeehiivCredentials()?.publicationId).toBe('pub_v2');

    delete process.env.BEEHIIV_PUBLICATION_ID_API_V2;
    process.env.BEEHIIV_PUBLICATION_ID_API_V1 = 'pub_v1';
    expect(getBeehiivCredentials()?.publicationId).toBe('pub_v1');
  });
});
