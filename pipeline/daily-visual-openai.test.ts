import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAILY_VISUAL_IMAGE_MODEL, generateDailyVisualImage } from './daily-visual-openai';
import type { DailyVisualImageError } from './daily-visual-openai';

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

afterEach(() => vi.restoreAllMocks());

describe('generateDailyVisualImage', () => {
  it('requests one medium landscape GPT Image 2 render and returns private-ready bytes', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        response({ data: [{ b64_json: Buffer.from('visual-bytes').toString('base64') }] }),
      );
    const image = await generateDailyVisualImage('one clear causal scene', 'test-key', fetchImpl);
    expect(image.bytes.toString()).toBe('visual-bytes');
    expect(image.model).toBe(DAILY_VISUAL_IMAGE_MODEL);
    const [, request] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: 'gpt-image-2',
      size: '1536x1024',
      quality: 'medium',
      output_format: 'webp',
    });
  });

  it('does not pretend a missing key can be billed', async () => {
    await expect(generateDailyVisualImage('scene', '')).rejects.toMatchObject({
      name: 'DailyVisualImageError',
      mayHaveBeenBilled: false,
    } satisfies Partial<DailyVisualImageError>);
  });

  it('holds a reservation for ambiguous provider failures but releases a clear validation failure', async () => {
    await expect(
      generateDailyVisualImage(
        'scene',
        'key',
        vi.fn().mockResolvedValue(response({ error: { message: 'busy' } }, 503)),
      ),
    ).rejects.toMatchObject({ mayHaveBeenBilled: true });
    await expect(
      generateDailyVisualImage(
        'scene',
        'key',
        vi.fn().mockResolvedValue(response({ error: { message: 'bad prompt' } }, 400)),
      ),
    ).rejects.toMatchObject({ mayHaveBeenBilled: false });
  });

  it('treats a malformed successful response as potentially billed', async () => {
    await expect(
      generateDailyVisualImage('scene', 'key', vi.fn().mockResolvedValue(response({ data: [] }))),
    ).rejects.toMatchObject({ mayHaveBeenBilled: true });
  });
});
