import { describe, expect, it, vi } from 'vitest';
import {
  DAILY_VISUAL_DIRECTION_MAX_OUTPUT_TOKENS,
  DAILY_VISUAL_DIRECTION_OPENROUTER_MODEL,
  generateDailyVisualDirectionSingleAttempt,
} from './daily-visual-direction-provider';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('generateDailyVisualDirectionSingleAttempt', () => {
  it('makes one bounded OpenRouter request instead of walking a provider or model ladder', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        choices: [{ message: { content: '{"displayTitleEn":"A clear daily shift"}' } }],
        usage: { prompt_tokens: 40, completion_tokens: 12, cost: 0.003 },
      }),
    );

    const result = await generateDailyVisualDirectionSingleAttempt(
      'Return one direction.',
      { OPEN_ROUTER_API_KEY: 'router-key', GEMINI_API_KEY: 'gemini-key' },
      fetchImpl,
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ provider: 'openrouter', usage: { costUsd: 0.003 } });
    const [, request] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: DAILY_VISUAL_DIRECTION_OPENROUTER_MODEL,
      max_tokens: DAILY_VISUAL_DIRECTION_MAX_OUTPUT_TOKENS,
    });
  });

  it('does not fall through to Gemini after the one selected provider fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ error: { message: 'busy' } }, 503));

    await expect(
      generateDailyVisualDirectionSingleAttempt(
        'Return one direction.',
        { OPEN_ROUTER_API_KEY: 'router-key', GEMINI_API_KEY: 'gemini-key' },
        fetchImpl,
      ),
    ).rejects.toThrow('OpenRouter daily visual direction HTTP 503');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
