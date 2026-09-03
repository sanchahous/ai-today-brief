import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSocialPublisher } from './providers';
import type { SocialPostForDelivery, SocialPublishError } from './types';

const ENV_KEYS = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHANNEL_ID',
  'PUBLISHER_TELEGRAM_BOT_TOKEN',
  'PUBLISHER_TELEGRAM_CHANNEL_ID',
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
    firstComment:
      channel === 'x' || channel === 'linkedin'
        ? 'Read: https://aitodaybrief.com/en/weekly/example?s=test'
        : null,
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
    delete process.env.PUBLISHER_TELEGRAM_BOT_TOKEN;
    delete process.env.PUBLISHER_TELEGRAM_CHANNEL_ID;
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

  it('prefers isolated Telegram publisher credentials when configured', async () => {
    process.env.PUBLISHER_TELEGRAM_BOT_TOKEN = 'publisher-token';
    process.env.PUBLISHER_TELEGRAM_CHANNEL_ID = '-1002003';
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json({ result: { message_id: 43 } }));

    await getSocialPublisher('telegram').publish(post('telegram'));

    expect(String(fetchMock.mock.calls[0][0])).toContain('botpublisher-token/sendMessage');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      chat_id: '-1002003',
    });
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

  it('publishes a native Threads sequence as chained replies', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ id: 'container-1' }))
      .mockResolvedValueOnce(json({ id: 'thread-1' }))
      .mockResolvedValueOnce(json({ id: 'container-2' }))
      .mockResolvedValueOnce(json({ id: 'thread-2' }))
      .mockResolvedValueOnce(json({ id: 'container-3' }))
      .mockResolvedValueOnce(json({ id: 'thread-3' }));
    const receipt = await getSocialPublisher('threads').publish(
      post('threads', { contentParts: ['Thesis', 'Evidence', 'Question?'] }),
    );
    expect(receipt.externalId).toBe('thread-1');
    expect(String(fetchMock.mock.calls[2][0])).toContain('reply_to_id=thread-1');
    expect(String(fetchMock.mock.calls[4][0])).toContain('reply_to_id=thread-2');
    expect(receipt.providerMeta).toMatchObject({
      reply_ids: ['thread-2', 'thread-3'],
      sequence_length: 3,
    });
  });

  it('resumes a partially published Threads sequence without duplicating its root', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ id: 'container-2' }))
      .mockResolvedValueOnce(json({ id: 'thread-2' }))
      .mockResolvedValueOnce(json({ id: 'container-3' }))
      .mockResolvedValueOnce(json({ id: 'thread-3' }));
    const receipt = await getSocialPublisher('threads').publish(
      post('threads', {
        contentParts: ['Thesis', 'Evidence', 'Question?'],
        providerMeta: {
          partial_sequence: true,
          creation_ids: ['container-1'],
          published_ids: ['thread-1'],
          sequence_length: 3,
        },
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[0][0])).toContain('reply_to_id=thread-1');
    expect(receipt.externalId).toBe('thread-1');
    expect(receipt.providerMeta).toMatchObject({
      published_ids: ['thread-1', 'thread-2', 'thread-3'],
      partial_sequence: false,
    });
  });

  it('returns durable reconciliation progress when a Threads reply fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ id: 'container-1' }))
      .mockResolvedValueOnce(json({ id: 'thread-1' }))
      .mockResolvedValueOnce(json({ error: 'bad reply' }, { status: 400 }));
    await expect(
      getSocialPublisher('threads').publish(
        post('threads', { contentParts: ['Thesis', 'Evidence', 'Question?'] }),
      ),
    ).rejects.toMatchObject({
      kind: 'ambiguous',
      code: 'partial_threads_sequence',
      providerMeta: {
        partial_sequence: true,
        published_ids: ['thread-1'],
        sequence_length: 3,
      },
    } satisfies Partial<SocialPublishError>);
  });

  it('sends a LinkedIn organization post with version headers', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        json(
          {},
          {
            status: 201,
            headers: { 'content-type': 'application/json', 'x-restli-id': 'urn:li:share:1' },
          },
        ),
      )
      .mockResolvedValueOnce(json({ id: 'urn:li:comment:9' }, { status: 201 }));
    const receipt = await getSocialPublisher('linkedin').publish(post('linkedin'));
    expect(receipt.externalId).toBe('urn:li:share:1');
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['LinkedIn-Version']).toBe('202607');
    expect(receipt.providerMeta).toMatchObject({ comment_id: 'urn:li:comment:9' });
    const postBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(postBody.content.article.source).toBe(
      'https://aitodaybrief.com/en/weekly/example?s=test',
    );
    expect(postBody.content.media).toBeUndefined();
  });

  it('attaches a native article card so the post, not the comment, carries the preview', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        json(
          { value: { uploadUrl: 'https://upload.linkedin.test', image: 'urn:li:image:cover' } },
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(
        json(
          {},
          {
            status: 201,
            headers: { 'content-type': 'application/json', 'x-restli-id': 'urn:li:share:1' },
          },
        ),
      )
      .mockResolvedValueOnce(json({ id: 'urn:li:comment:9' }, { status: 201 }));
    await getSocialPublisher('linkedin').publish(
      post('linkedin', {
        firstComment: `Breakdown: https://aitodaybrief.com/en/weekly/example?utm_source=linkedin&s=test`,
        assets: [{ url: 'https://cdn.example/cover.jpg', mimeType: 'image/jpeg' }],
      }),
    );
    const postCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/rest/posts'),
    );
    const body = JSON.parse(String(postCall?.[1]?.body));
    expect(body.content.article).toMatchObject({
      source: 'https://aitodaybrief.com/en/weekly/example?s=test',
      thumbnail: 'urn:li:image:cover',
    });
    expect(body.content.media).toBeUndefined();
  });

  it('posts the tracked link as a LinkedIn first comment on the published post', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        json(
          {},
          {
            status: 201,
            headers: { 'content-type': 'application/json', 'x-restli-id': 'urn:li:share:1' },
          },
        ),
      )
      .mockResolvedValueOnce(json({ id: 'urn:li:comment:9' }, { status: 201 }));
    await getSocialPublisher('linkedin').publish(post('linkedin'));
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain('/socialActions/urn%3Ali%3Ashare%3A1/comments');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      object: 'urn:li:share:1',
      message: {
        text: 'Read\n\nhttps://aitodaybrief.com/en/weekly/example?s=test',
      },
    });
  });

  it('needs reconciliation when the LinkedIn post lands but its comment fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        json(
          {},
          {
            status: 201,
            headers: { 'content-type': 'application/json', 'x-restli-id': 'urn:li:share:1' },
          },
        ),
      )
      .mockResolvedValueOnce(json({ error: 'nope' }, { status: 400 }));
    await expect(getSocialPublisher('linkedin').publish(post('linkedin'))).rejects.toMatchObject({
      kind: 'ambiguous',
      code: 'partial_linkedin_comment',
      providerMeta: { partial_sequence: true, post_id: 'urn:li:share:1', comment_pending: true },
    } satisfies Partial<SocialPublishError>);
  });

  it('refuses a LinkedIn post whose tracked link is missing from the first comment', async () => {
    expect(() =>
      getSocialPublisher('linkedin').validate?.(post('linkedin', { firstComment: null })),
    ).toThrow(/first comment/i);
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

  it('publishes Instagram carousel children before the parent container', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ id: 'child-1' }))
      .mockResolvedValueOnce(json({ id: 'child-2' }))
      .mockResolvedValueOnce(json({ id: 'carousel' }))
      .mockResolvedValueOnce(json({ id: 'ig-carousel-media' }));
    const receipt = await getSocialPublisher('instagram').publish(
      post('instagram', {
        assets: ['one', 'two'].map((name) => ({
          url: `https://cdn.example/${name}.jpg`,
          width: 1080,
          height: 1350,
          mimeType: 'image/jpeg' as const,
        })),
      }),
    );
    expect(receipt.externalId).toBe('ig-carousel-media');
    expect(String(fetchMock.mock.calls[0][0])).toContain('is_carousel_item=true');
    expect(String(fetchMock.mock.calls[2][0])).toContain('media_type=CAROUSEL');
    expect(String(fetchMock.mock.calls[2][0])).toContain('children=child-1%2Cchild-2');
  });

  it('classifies a publish timeout as ambiguous', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    await expect(getSocialPublisher('telegram').publish(post('telegram'))).rejects.toMatchObject({
      kind: 'ambiguous',
      code: 'provider_no_response',
    } satisfies Partial<SocialPublishError>);
  });
});
