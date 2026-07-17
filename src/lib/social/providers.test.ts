import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSocialPublisher } from './providers';
import type { SocialPostForDelivery, SocialPublishError } from './types';

const ENV_KEYS = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHANNEL_ID',
  'X_API_KEY',
  'X_API_SECRET',
  'X_ACCESS_TOKEN',
  'X_ACCESS_SECRET',
  'THREADS_ACCESS_TOKEN',
  'LINKEDIN_ACCESS_TOKEN',
  'LINKEDIN_ORGANIZATION_URN',
  'LINKEDIN_VERSION',
  'META_PAGE_ACCESS_TOKEN',
  'FACEBOOK_PAGE_ID',
  'INSTAGRAM_ACCOUNT_ID',
  'META_GRAPH_VERSION',
] as const;

function post(
  channel: SocialPostForDelivery['channel'],
  overrides: Partial<SocialPostForDelivery> = {},
): SocialPostForDelivery {
  return {
    id: 'post-id',
    channel,
    text:
      channel === 'x'
        ? 'A link-free AI engineering update for builders.'
        : 'A useful AI engineering update for builders with practical context.',
    firstComment: channel === 'x' ? 'Read: https://aitodaybrief.com/r/s/test' : null,
    assets: [],
    altText: null,
    idempotencyKey: 'idempotency',
    attempt: 1,
    ...overrides,
  };
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('social provider contracts', () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'tg-token';
    process.env.TELEGRAM_CHANNEL_ID = '-1001';
    process.env.X_API_KEY = 'x-key';
    process.env.X_API_SECRET = 'x-secret';
    process.env.X_ACCESS_TOKEN = 'x-token';
    process.env.X_ACCESS_SECRET = 'x-access-secret';
    process.env.THREADS_ACCESS_TOKEN = 'threads-token';
    process.env.LINKEDIN_ACCESS_TOKEN = 'linkedin-token';
    process.env.LINKEDIN_ORGANIZATION_URN = '1234';
    process.env.LINKEDIN_VERSION = '202607';
    process.env.META_PAGE_ACCESS_TOKEN = 'meta-token';
    process.env.FACEBOOK_PAGE_ID = 'page-1';
    process.env.INSTAGRAM_ACCOUNT_ID = 'ig-1';
    process.env.META_GRAPH_VERSION = 'v24.0';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it('publishes Telegram through sendMessage', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json({ result: { message_id: 42 } }));
    const receipt = await getSocialPublisher('telegram').publish(post('telegram'));
    expect(receipt.externalId).toBe('42');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/sendMessage');
  });

  it('publishes the X root and tracked self-reply', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ data: { id: 'root-1' } }))
      .mockResolvedValueOnce(json({ data: { id: 'reply-1' } }));
    const receipt = await getSocialPublisher('x').publish(post('x'));
    expect(receipt.externalId).toBe('root-1');
    const replyBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(replyBody.reply.in_reply_to_tweet_id).toBe('root-1');
  });

  it('uses Threads create-container then publish', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ id: 'container-1' }))
      .mockResolvedValueOnce(json({ id: 'thread-1' }));
    const receipt = await getSocialPublisher('threads').publish(post('threads'));
    expect(receipt.externalId).toBe('thread-1');
    expect(String(fetchMock.mock.calls[1][0])).toContain('threads_publish');
  });

  it('sends a LinkedIn organization post with version headers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(
        {},
        {
          status: 201,
          headers: { 'content-type': 'application/json', 'x-restli-id': 'urn:li:share:1' },
        },
      ),
    );
    const receipt = await getSocialPublisher('linkedin').publish(post('linkedin'));
    expect(receipt.externalId).toBe('urn:li:share:1');
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['LinkedIn-Version']).toBe('202607');
  });

  it('publishes Facebook to the configured Page feed', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ id: 'page-1_99' }));
    const receipt = await getSocialPublisher('facebook').publish(post('facebook'));
    expect(receipt.externalId).toBe('page-1_99');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/page-1/feed');
  });

  it('publishes an Instagram image container', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ id: 'ig-container' }))
      .mockResolvedValueOnce(json({ id: 'ig-media' }));
    const receipt = await getSocialPublisher('instagram').publish(
      post('instagram', {
        assets: [
          {
            url: 'https://cdn.example/slide.jpg',
            width: 1080,
            height: 1350,
            mimeType: 'image/jpeg',
          },
        ],
      }),
    );
    expect(receipt.externalId).toBe('ig-media');
    expect(String(fetchMock.mock.calls[1][0])).toContain('media_publish');
  });

  it('classifies a publish timeout as ambiguous', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    await expect(getSocialPublisher('telegram').publish(post('telegram'))).rejects.toMatchObject({
      kind: 'ambiguous',
      code: 'provider_no_response',
    } satisfies Partial<SocialPublishError>);
  });
});
