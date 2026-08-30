import { describe, expect, it } from 'vitest';
import {
  endpointProviderSlug,
  normalizeUptime,
  openRouterPriceRouting,
  providersBelowUptimeFloor,
} from './openrouter-provider-routing';

describe('openRouterPriceRouting', () => {
  it('sorts by price and carries an uptime ignore list', () => {
    expect(openRouterPriceRouting({ ignore: ['Azure', 'azure'], maxLatencyS: 15 })).toEqual({
      sort: 'price',
      allow_fallbacks: true,
      require_parameters: true,
      preferred_max_latency: 15,
      ignore: ['azure'],
    });
  });

  it('omits ignore when every endpoint clears the floor', () => {
    expect(openRouterPriceRouting({ ignore: [] }).ignore).toBeUndefined();
  });
});

describe('providersBelowUptimeFloor', () => {
  it('treats values above 1 as percents and ignores the low ones', () => {
    expect(normalizeUptime(99.6)).toBeCloseTo(0.996);
    expect(normalizeUptime(0.958)).toBeCloseTo(0.958);
    const ignored = providersBelowUptimeFloor(
      [
        { provider_name: 'DigitalOcean', uptime_last_1d: 99.6 },
        { provider_name: 'Azure', uptime_last_1d: 95.8 },
        { name: 'StreamLake | deepseek/x', uptime_last_1d: 0.986 },
      ],
      0.99,
    );
    expect(ignored).toEqual(['azure', 'streamlake']);
  });

  it('slugifies provider names', () => {
    expect(endpointProviderSlug({ provider_name: 'DigitalOcean' })).toBe('digitalocean');
    expect(endpointProviderSlug({ name: 'StreamLake | model' })).toBe('streamlake');
  });
});
