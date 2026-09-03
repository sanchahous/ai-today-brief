import 'server-only';
import { telegramRenderedLength, toTelegramHtml } from './telegram-format';

import { randomBytes } from 'node:crypto';
import { buildOAuth1Header, type OAuth1Credentials } from '../../../pipeline/social-repost';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type {
  PublishReceipt,
  SocialChannel,
  SocialPostForDelivery,
  SocialPublisher,
} from './types';
import { compactLinkedInComment, linkedInArticleContent } from './linkedin-article';
import { SocialPublishError } from './types';

type JsonObject = Record<string, unknown>;

interface RequestOptions {
  stage: 'prepare' | 'publish';
  timeoutMs?: number;
}

async function providerJson(
  url: string | URL,
  init: RequestInit,
  options: RequestOptions,
): Promise<JsonObject> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
    });
  } catch (error) {
    throw new SocialPublishError(
      `Provider request ended without a response: ${error instanceof Error ? error.message : 'network error'}`,
      options.stage === 'publish' ? 'ambiguous' : 'retryable',
      'provider_no_response',
      { cause: error },
    );
  }

  const raw = await response.text();
  let body: JsonObject;
  try {
    body = raw ? (JSON.parse(raw) as JsonObject) : {};
  } catch {
    body = { raw: raw.slice(0, 500) };
  }
  if (!response.ok) {
    const kind = response.status === 429 || response.status >= 500 ? 'retryable' : 'permanent';
    throw new SocialPublishError(
      `Provider HTTP ${response.status}: ${raw.slice(0, 400)}`,
      kind,
      `http_${response.status}`,
    );
  }
  const responseId = response.headers.get('x-restli-id');
  if (responseId) body.__response_id = responseId;
  return body;
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new SocialPublishError(`${name} is not configured.`, 'permanent', 'not_configured');
  return value;
}

function requiredFirst(names: readonly string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new SocialPublishError(
    `${names.join(' or ')} is not configured.`,
    'permanent',
    'not_configured',
  );
}

type OAuthChannel = 'threads' | 'linkedin' | 'instagram' | 'facebook';

interface StoredOAuthSecret {
  accessToken: string;
  refreshToken: string | null;
  fromEnvironment: boolean;
}

async function oauthSecret(channel: OAuthChannel, envName: string): Promise<StoredOAuthSecret> {
  const configured = process.env[envName]?.trim();
  if (configured) return { accessToken: configured, refreshToken: null, fromEnvironment: true };
  const { data, error } = await getSupabaseAdmin().rpc('read_social_oauth_secret', {
    p_channel: channel,
  });
  if (error || !data) {
    throw new SocialPublishError(
      `${channel} OAuth token is not connected.`,
      'permanent',
      'not_configured',
    );
  }
  try {
    const parsed = JSON.parse(data) as { access_token?: unknown; refresh_token?: unknown };
    if (typeof parsed.access_token === 'string' && parsed.access_token) {
      return {
        accessToken: parsed.access_token,
        refreshToken: typeof parsed.refresh_token === 'string' ? parsed.refresh_token : null,
        fromEnvironment: false,
      };
    }
  } catch {
    // Backwards-compatible with tokens stored before the JSON envelope.
  }
  return { accessToken: data, refreshToken: null, fromEnvironment: false };
}

async function oauthToken(channel: OAuthChannel, envName: string) {
  return (await oauthSecret(channel, envName)).accessToken;
}

async function accountRecord(channel: OAuthChannel) {
  const { data } = await getSupabaseAdmin()
    .from('social_accounts')
    .select('provider_account_id,token_expires_at')
    .eq('channel', channel)
    .maybeSingle();
  return data;
}

async function shouldRefresh(channel: OAuthChannel, envName: string) {
  if (process.env[envName]?.trim()) return false;
  const account = await accountRecord(channel);
  if (!account?.token_expires_at) return false;
  return new Date(account.token_expires_at).getTime() <= Date.now() + 7 * 86_400_000;
}

async function storeRefreshedSecret(
  channel: OAuthChannel,
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number,
) {
  const account = await accountRecord(channel);
  const { error } = await getSupabaseAdmin().rpc('store_social_oauth_secret', {
    p_channel: channel,
    p_secret: JSON.stringify({
      access_token: accessToken,
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
    }),
    p_expires_at: new Date(Date.now() + Math.max(300, expiresIn) * 1000).toISOString(),
    p_provider_account_id: account?.provider_account_id ?? null,
  });
  if (error) throw new SocialPublishError(error.message, 'retryable', 'token_store_failed');
}

async function providerAccountId(channel: 'linkedin' | 'instagram' | 'facebook', envName: string) {
  const configured = process.env[envName]?.trim();
  if (configured) return configured;
  const { data } = await getSupabaseAdmin()
    .from('social_accounts')
    .select('provider_account_id')
    .eq('channel', channel)
    .maybeSingle();
  if (!data?.provider_account_id) {
    throw new SocialPublishError(
      `${channel} provider account id is missing.`,
      'permanent',
      'not_configured',
    );
  }
  return data.provider_account_id;
}

function assetUrl(post: SocialPostForDelivery, index = 0) {
  return post.assets[index]?.url;
}

class TelegramPublisher implements SocialPublisher {
  readonly channel = 'telegram' as const;

  validate(post: SocialPostForDelivery) {
    if (!post.text.trim() || telegramRenderedLength(post.text) > 4096) {
      throw new SocialPublishError(
        'Telegram text is empty or exceeds 4096 characters.',
        'permanent',
        'invalid_copy',
      );
    }
  }

  async publish(post: SocialPostForDelivery): Promise<PublishReceipt> {
    // The review bot remains on TELEGRAM_BOT_TOKEN. Production publishing can
    // use an isolated bot and channel without coupling the two permissions.
    const token = requiredFirst(['PUBLISHER_TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_TOKEN']);
    const chatId = requiredFirst(['PUBLISHER_TELEGRAM_CHANNEL_ID', 'TELEGRAM_CHANNEL_ID']);
    const photo = assetUrl(post);
    if (photo && telegramRenderedLength(post.text) > 1024) {
      const photoResult = await providerJson(
        `https://api.telegram.org/bot${token}/sendPhoto`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, photo, caption: 'AI Today Brief' }),
        },
        { stage: 'publish' },
      );
      const photoId = (photoResult.result as { message_id?: number } | undefined)?.message_id;
      if (!photoId) {
        throw new SocialPublishError(
          'Telegram returned no photo message id.',
          'ambiguous',
          'missing_external_id',
        );
      }
      try {
        const textResult = await providerJson(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: toTelegramHtml(post.text),
              parse_mode: 'HTML',
              link_preview_options: { is_disabled: true },
              reply_parameters: { message_id: photoId },
            }),
          },
          { stage: 'publish' },
        );
        const messageId = (textResult.result as { message_id?: number } | undefined)?.message_id;
        if (!messageId) throw new Error('missing text message id');
        return {
          externalId: String(messageId),
          providerMeta: { method: 'sendPhoto+sendMessage', photo_message_id: photoId },
        };
      } catch (error) {
        throw new SocialPublishError(
          `Telegram photo ${photoId} posted, but digest text failed: ${error instanceof Error ? error.message : 'unknown error'}`,
          'ambiguous',
          'partial_telegram_post',
          { cause: error },
        );
      }
    }
    const method = photo && telegramRenderedLength(post.text) <= 1024 ? 'sendPhoto' : 'sendMessage';
    const body =
      method === 'sendPhoto'
        ? {
            chat_id: chatId,
            photo,
            caption: toTelegramHtml(post.text),
            parse_mode: 'HTML' as const,
          }
        : {
            chat_id: chatId,
            text: toTelegramHtml(post.text),
            parse_mode: 'HTML' as const,
            link_preview_options: { is_disabled: true },
          };
    const result = await providerJson(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
      { stage: 'publish' },
    );
    const message = result.result as { message_id?: number } | undefined;
    if (!message?.message_id) {
      throw new SocialPublishError(
        'Telegram returned no message id.',
        'ambiguous',
        'missing_external_id',
      );
    }
    return { externalId: String(message.message_id), providerMeta: { method } };
  }
}

function xCredentials(): OAuth1Credentials {
  return {
    consumerKey: required('X_API_KEY'),
    consumerSecret: required('X_API_SECRET'),
    accessToken: required('X_ACCESS_TOKEN'),
    accessSecret: required('X_ACCESS_SECRET'),
  };
}

async function publishTweet(text: string, replyToId?: string, mediaId?: string) {
  const endpoint = 'https://api.x.com/2/tweets';
  const credentials = xCredentials();
  const authorization = buildOAuth1Header(
    'POST',
    endpoint,
    credentials,
    randomBytes(16).toString('hex'),
    String(Math.floor(Date.now() / 1000)),
  );
  const result = await providerJson(
    endpoint,
    {
      method: 'POST',
      headers: { Authorization: authorization, 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        ...(replyToId ? { reply: { in_reply_to_tweet_id: replyToId } } : {}),
        ...(mediaId ? { media: { media_ids: [mediaId] } } : {}),
      }),
    },
    { stage: 'publish' },
  );
  const id = (result.data as { id?: string } | undefined)?.id;
  if (!id)
    throw new SocialPublishError('X returned no post id.', 'ambiguous', 'missing_external_id');
  return id;
}

async function uploadXImage(post: SocialPostForDelivery) {
  const sourceUrl = assetUrl(post);
  if (!sourceUrl) return null;
  const source = await fetch(sourceUrl, { signal: AbortSignal.timeout(15_000) });
  if (!source.ok)
    throw new SocialPublishError('X image could not be loaded.', 'retryable', 'asset_fetch');
  const bytes = Buffer.from(await source.arrayBuffer());
  if (bytes.length > 5 * 1024 * 1024) {
    throw new SocialPublishError('X images must be at most 5 MB.', 'permanent', 'asset_size');
  }
  const endpoint = 'https://api.x.com/2/media/upload';
  const credentials = xCredentials();
  const authorization = buildOAuth1Header(
    'POST',
    endpoint,
    credentials,
    randomBytes(16).toString('hex'),
    String(Math.floor(Date.now() / 1000)),
  );
  const uploaded = await providerJson(
    endpoint,
    {
      method: 'POST',
      headers: { Authorization: authorization, 'content-type': 'application/json' },
      body: JSON.stringify({
        media: bytes.toString('base64'),
        media_category: 'tweet_image',
        media_type: post.assets[0].mimeType ?? 'image/jpeg',
        shared: false,
      }),
    },
    { stage: 'prepare', timeoutMs: 30_000 },
  );
  const id = String((uploaded.data as { id?: string } | undefined)?.id ?? '');
  if (!id) throw new SocialPublishError('X returned no media id.', 'retryable', 'missing_media_id');
  if (post.altText) {
    const metadataEndpoint = 'https://api.x.com/2/media/metadata';
    const metadataAuthorization = buildOAuth1Header(
      'POST',
      metadataEndpoint,
      credentials,
      randomBytes(16).toString('hex'),
      String(Math.floor(Date.now() / 1000)),
    );
    await providerJson(
      metadataEndpoint,
      {
        method: 'POST',
        headers: { Authorization: metadataAuthorization, 'content-type': 'application/json' },
        body: JSON.stringify({ id, metadata: { alt_text: { text: post.altText.slice(0, 1000) } } }),
      },
      { stage: 'prepare' },
    );
  }
  return id;
}

class XPublisher implements SocialPublisher {
  readonly channel = 'x' as const;

  validate(post: SocialPostForDelivery) {
    if (!post.text.trim() || post.text.length > 280 || /https?:\/\//i.test(post.text)) {
      throw new SocialPublishError(
        'X root must be link-free and at most 280 characters.',
        'permanent',
        'invalid_copy',
      );
    }
    if (!post.firstComment || post.firstComment.length > 280) {
      throw new SocialPublishError(
        'X requires a self-reply of at most 280 characters.',
        'permanent',
        'invalid_reply',
      );
    }
  }

  async publish(post: SocialPostForDelivery): Promise<PublishReceipt> {
    const mediaId = await uploadXImage(post);
    const rootId = await publishTweet(post.text, undefined, mediaId ?? undefined);
    let replyId: string;
    try {
      replyId = await publishTweet(post.firstComment!, rootId);
    } catch (error) {
      // The visible root exists. Retrying the whole delivery would duplicate it,
      // so reconciliation is always required even when the reply failed clearly.
      throw new SocialPublishError(
        `X root ${rootId} posted, but the self-reply failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        'ambiguous',
        'partial_x_thread',
        {
          cause: error,
          providerMeta: { partial_sequence: true, root_id: rootId, reply_pending: true },
        },
      );
    }
    return {
      externalId: rootId,
      url: `https://x.com/i/web/status/${rootId}`,
      providerMeta: { reply_id: replyId, media_id: mediaId },
    };
  }
}

class ThreadsPublisher implements SocialPublisher {
  readonly channel = 'threads' as const;

  async refreshCredentials() {
    if (!(await shouldRefresh('threads', 'THREADS_ACCESS_TOKEN'))) return;
    const current = await oauthSecret('threads', 'THREADS_ACCESS_TOKEN');
    const refreshToken = current.refreshToken ?? current.accessToken;
    const url = new URL('https://graph.threads.net/refresh_access_token');
    url.searchParams.set('grant_type', 'th_refresh_token');
    url.searchParams.set('access_token', refreshToken);
    const refreshed = await providerJson(url, { method: 'GET' }, { stage: 'prepare' });
    const accessToken = typeof refreshed.access_token === 'string' ? refreshed.access_token : '';
    if (!accessToken) {
      throw new SocialPublishError(
        'Threads refresh returned no access token.',
        'retryable',
        'token_refresh_failed',
      );
    }
    await storeRefreshedSecret(
      'threads',
      accessToken,
      accessToken,
      Number(refreshed.expires_in) || 5_184_000,
    );
  }

  validate(post: SocialPostForDelivery) {
    const parts = post.contentParts?.length ? post.contentParts : [post.text];
    if (
      parts.length < 1 ||
      parts.length > 5 ||
      parts.some((part) => !part.trim() || part.length > 500)
    ) {
      throw new SocialPublishError(
        'Threads requires 1–5 non-empty messages of at most 500 characters each.',
        'permanent',
        'invalid_copy',
      );
    }
  }

  async publish(post: SocialPostForDelivery): Promise<PublishReceipt> {
    const accessToken = await oauthToken('threads', 'THREADS_ACCESS_TOKEN');
    const parts = post.contentParts?.length ? post.contentParts : [post.text];
    const previous =
      post.providerMeta &&
      typeof post.providerMeta === 'object' &&
      !Array.isArray(post.providerMeta)
        ? (post.providerMeta as Record<string, unknown>)
        : {};
    const resumable =
      previous.partial_sequence === true && previous.sequence_length === parts.length;
    const creationIds =
      resumable && Array.isArray(previous.creation_ids)
        ? previous.creation_ids.filter((value): value is string => typeof value === 'string')
        : [];
    const publishedIds =
      resumable && Array.isArray(previous.published_ids)
        ? previous.published_ids.filter((value): value is string => typeof value === 'string')
        : [];
    if (publishedIds.length > parts.length) {
      throw new SocialPublishError(
        'Stored Threads reconciliation progress is incompatible with the current sequence.',
        'permanent',
        'invalid_reconciliation_state',
      );
    }

    const publishPart = async (text: string, replyToId: string | undefined, root: boolean) => {
      const create = new URL('https://graph.threads.net/me/threads');
      create.searchParams.set('media_type', root && assetUrl(post) ? 'IMAGE' : 'TEXT');
      create.searchParams.set('text', text);
      if (replyToId) create.searchParams.set('reply_to_id', replyToId);
      if (root && assetUrl(post)) create.searchParams.set('image_url', assetUrl(post)!);
      if (root && assetUrl(post) && post.altText) create.searchParams.set('alt_text', post.altText);
      const created = await providerJson(
        create,
        { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
        { stage: 'prepare' },
      );
      const creationId = String(created.id ?? '');
      if (!creationId) {
        throw new SocialPublishError(
          'Threads returned no container id.',
          'retryable',
          'missing_container',
        );
      }
      creationIds.push(creationId);

      const publish = new URL('https://graph.threads.net/me/threads_publish');
      publish.searchParams.set('creation_id', creationId);
      const published = await providerJson(
        publish,
        { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
        { stage: 'publish' },
      );
      const id = String(published.id ?? '');
      if (!id) {
        throw new SocialPublishError(
          'Threads returned no post id.',
          'ambiguous',
          'missing_external_id',
        );
      }
      publishedIds.push(id);
      return id;
    };

    try {
      for (const [index, text] of parts.entries()) {
        if (index < publishedIds.length) continue;
        await publishPart(text, index === 0 ? undefined : publishedIds[index - 1], index === 0);
      }
    } catch (error) {
      if (publishedIds.length > 0) {
        throw new SocialPublishError(
          `Threads sequence partially published (${publishedIds.length}/${parts.length}); reconciliation is required: ${error instanceof Error ? error.message : 'unknown error'}`,
          'ambiguous',
          'partial_threads_sequence',
          {
            cause: error,
            providerMeta: {
              partial_sequence: true,
              creation_ids: creationIds,
              published_ids: publishedIds,
              sequence_length: parts.length,
            },
          },
        );
      }
      throw error;
    }

    return {
      externalId: publishedIds[0]!,
      providerMeta: {
        creation_ids: creationIds,
        published_ids: publishedIds,
        reply_ids: publishedIds.slice(1),
        sequence_length: parts.length,
        partial_sequence: false,
      },
    };
  }
}

async function uploadLinkedInImage(
  post: SocialPostForDelivery,
  token: string,
  owner: string,
  version: string,
) {
  const initialized = await providerJson(
    'https://api.linkedin.com/rest/images?action=initializeUpload',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'LinkedIn-Version': version,
        'X-Restli-Protocol-Version': '2.0.0',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ initializeUploadRequest: { owner } }),
    },
    { stage: 'prepare' },
  );
  const value = initialized.value as { uploadUrl?: string; image?: string } | undefined;
  if (!value?.uploadUrl || !value.image) {
    throw new SocialPublishError(
      'LinkedIn image initialization was incomplete.',
      'retryable',
      'missing_upload',
    );
  }
  const source = await fetch(assetUrl(post)!, { signal: AbortSignal.timeout(15_000) });
  if (!source.ok)
    throw new SocialPublishError('Social image could not be loaded.', 'retryable', 'asset_fetch');
  const uploaded = await fetch(value.uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': post.assets[0].mimeType ?? 'image/jpeg',
    },
    body: await source.arrayBuffer(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!uploaded.ok) {
    throw new SocialPublishError(
      `LinkedIn image upload failed (${uploaded.status}).`,
      'retryable',
      'image_upload',
    );
  }
  return value.image;
}

class LinkedInPublisher implements SocialPublisher {
  readonly channel = 'linkedin' as const;

  async refreshCredentials() {
    if (!(await shouldRefresh('linkedin', 'LINKEDIN_ACCESS_TOKEN'))) return;
    const current = await oauthSecret('linkedin', 'LINKEDIN_ACCESS_TOKEN');
    if (!current.refreshToken) return;
    const refreshed = await providerJson(
      'https://www.linkedin.com/oauth/v2/accessToken',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: current.refreshToken,
          client_id: required('LINKEDIN_CLIENT_ID'),
          client_secret: required('LINKEDIN_CLIENT_SECRET'),
        }),
      },
      { stage: 'prepare' },
    );
    const accessToken = typeof refreshed.access_token === 'string' ? refreshed.access_token : '';
    if (!accessToken) {
      throw new SocialPublishError(
        'LinkedIn refresh returned no access token.',
        'retryable',
        'token_refresh_failed',
      );
    }
    await storeRefreshedSecret(
      'linkedin',
      accessToken,
      typeof refreshed.refresh_token === 'string' ? refreshed.refresh_token : current.refreshToken,
      Number(refreshed.expires_in) || 5_184_000,
    );
  }

  validate(post: SocialPostForDelivery) {
    if (!post.text.trim() || post.text.length > 3000) {
      throw new SocialPublishError(
        'LinkedIn copy must be 1–3000 characters.',
        'permanent',
        'invalid_copy',
      );
    }
    // The tracked link lives in the first comment so the post body stays free
    // of an outbound URL, which LinkedIn demotes in page reach.
    if (!post.firstComment?.trim()) {
      throw new SocialPublishError(
        'LinkedIn requires a first comment carrying the tracked URL.',
        'permanent',
        'invalid_reply',
      );
    }
  }

  async publish(post: SocialPostForDelivery): Promise<PublishReceipt> {
    const token = await oauthToken('linkedin', 'LINKEDIN_ACCESS_TOKEN');
    const ownerId = await providerAccountId('linkedin', 'LINKEDIN_ORGANIZATION_URN');
    const owner = ownerId.startsWith('urn:li:organization:')
      ? ownerId
      : `urn:li:organization:${ownerId}`;
    const version = process.env.LINKEDIN_VERSION?.trim() || '202607';
    const image = assetUrl(post) ? await uploadLinkedInImage(post, token, owner, version) : null;
    const article = linkedInArticleContent({
      text: post.text,
      firstComment: post.firstComment,
      thumbnail: image,
    });
    const result = await providerJson(
      'https://api.linkedin.com/rest/posts',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'LinkedIn-Version': version,
          'X-Restli-Protocol-Version': '2.0.0',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          author: owner,
          commentary: post.text,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
          ...(article
            ? { content: article }
            : image
              ? { content: { media: { id: image, title: post.altText || 'AI Today Brief' } } }
              : {}),
        }),
      },
      { stage: 'publish' },
    );
    const id = String(result.id ?? result.urn ?? result.__response_id ?? '');
    if (!id)
      throw new SocialPublishError(
        'LinkedIn returned no post id.',
        'ambiguous',
        'missing_external_id',
      );

    let commentId: string | null;
    try {
      const comment = await providerJson(
        `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(id)}/comments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'LinkedIn-Version': version,
            'X-Restli-Protocol-Version': '2.0.0',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            actor: owner,
            object: id,
            message: { text: compactLinkedInComment(post.firstComment) },
          }),
        },
        { stage: 'publish' },
      );
      commentId = String(comment.id ?? comment.$URN ?? '') || null;
    } catch (error) {
      // The post is already live. Re-running delivery would duplicate it, so
      // this always needs reconciliation rather than a retry -- same contract
      // as a failed X self-reply.
      throw new SocialPublishError(
        `LinkedIn post ${id} published, but the tracked-link comment failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        'ambiguous',
        'partial_linkedin_comment',
        {
          cause: error,
          providerMeta: { partial_sequence: true, post_id: id, comment_pending: true, image },
        },
      );
    }

    return { externalId: id, providerMeta: { image, comment_id: commentId } };
  }
}

function graphBase() {
  return `https://graph.facebook.com/${process.env.META_GRAPH_VERSION?.trim() || 'v24.0'}`;
}

async function refreshMetaCredentials(channel: 'facebook' | 'instagram') {
  if (!(await shouldRefresh(channel, 'META_PAGE_ACCESS_TOKEN'))) return;
  const current = await oauthSecret(channel, 'META_PAGE_ACCESS_TOKEN');
  if (!current.refreshToken) return;
  const exchange = new URL(`${graphBase()}/oauth/access_token`);
  exchange.searchParams.set('grant_type', 'fb_exchange_token');
  exchange.searchParams.set('client_id', required('META_APP_ID'));
  exchange.searchParams.set('client_secret', required('META_APP_SECRET'));
  exchange.searchParams.set('fb_exchange_token', current.refreshToken);
  const refreshed = await providerJson(exchange, { method: 'GET' }, { stage: 'prepare' });
  const userToken = typeof refreshed.access_token === 'string' ? refreshed.access_token : '';
  if (!userToken) {
    throw new SocialPublishError(
      'Meta refresh returned no access token.',
      'retryable',
      'token_refresh_failed',
    );
  }
  const accountsUrl = new URL(`${graphBase()}/me/accounts`);
  accountsUrl.searchParams.set('fields', 'id,access_token,instagram_business_account{id,username}');
  accountsUrl.searchParams.set('access_token', userToken);
  const accounts = await providerJson(accountsUrl, { method: 'GET' }, { stage: 'prepare' });
  const pages = Array.isArray(accounts.data)
    ? (accounts.data as Array<{
        id?: string;
        access_token?: string;
        instagram_business_account?: { id?: string };
      }>)
    : [];
  const account = await accountRecord(channel);
  const page =
    channel === 'facebook'
      ? pages.find((candidate) => candidate.id === account?.provider_account_id)
      : pages.find(
          (candidate) => candidate.instagram_business_account?.id === account?.provider_account_id,
        );
  if (!page?.access_token) {
    throw new SocialPublishError(
      `Meta no longer returns the connected ${channel} account.`,
      'permanent',
      'account_revoked',
    );
  }
  await storeRefreshedSecret(
    channel,
    page.access_token,
    userToken,
    Number(refreshed.expires_in) || 5_184_000,
  );
}

class FacebookPublisher implements SocialPublisher {
  readonly channel = 'facebook' as const;
  async refreshCredentials() {
    await refreshMetaCredentials('facebook');
  }
  validate(post: SocialPostForDelivery) {
    if (!post.text.trim())
      throw new SocialPublishError('Facebook copy is empty.', 'permanent', 'invalid_copy');
  }
  async publish(post: SocialPostForDelivery): Promise<PublishReceipt> {
    const pageId = await providerAccountId('facebook', 'FACEBOOK_PAGE_ID');
    const token = await oauthToken('facebook', 'META_PAGE_ACCESS_TOKEN');
    const url = new URL(`${graphBase()}/${pageId}/${assetUrl(post) ? 'photos' : 'feed'}`);
    url.searchParams.set('access_token', token);
    url.searchParams.set('message', post.text);
    if (assetUrl(post)) url.searchParams.set('url', assetUrl(post)!);
    if (assetUrl(post) && post.altText) url.searchParams.set('alt_text_custom', post.altText);
    const result = await providerJson(url, { method: 'POST' }, { stage: 'publish' });
    const id = String(result.post_id ?? result.id ?? '');
    if (!id)
      throw new SocialPublishError(
        'Facebook returned no post id.',
        'ambiguous',
        'missing_external_id',
      );
    return { externalId: id, url: `https://www.facebook.com/${id.replace('_', '/posts/')}` };
  }
}

async function createInstagramContainer(
  accountId: string,
  token: string,
  params: Record<string, string>,
) {
  const url = new URL(`${graphBase()}/${accountId}/media`);
  url.searchParams.set('access_token', token);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const result = await providerJson(url, { method: 'POST' }, { stage: 'prepare' });
  const id = String(result.id ?? '');
  if (!id)
    throw new SocialPublishError(
      'Instagram returned no container id.',
      'retryable',
      'missing_container',
    );
  return id;
}

class InstagramPublisher implements SocialPublisher {
  readonly channel = 'instagram' as const;
  async refreshCredentials() {
    await refreshMetaCredentials('instagram');
  }
  validate(post: SocialPostForDelivery) {
    if (!post.text.trim() || post.text.length > 2200 || post.assets.length === 0) {
      throw new SocialPublishError(
        'Instagram requires media and a caption of at most 2200 characters.',
        'permanent',
        'invalid_post',
      );
    }
  }
  async publish(post: SocialPostForDelivery): Promise<PublishReceipt> {
    const accountId = await providerAccountId('instagram', 'INSTAGRAM_ACCOUNT_ID');
    const token = await oauthToken('instagram', 'META_PAGE_ACCESS_TOKEN');
    let containerId: string;
    if (post.assets.length === 1) {
      const imageUrl = assetUrl(post);
      if (!imageUrl) {
        throw new SocialPublishError('Instagram is missing a resolved image URL.', 'permanent', 'asset_missing');
      }
      containerId = await createInstagramContainer(accountId, token, {
        image_url: imageUrl,
        caption: post.text,
      });
    } else {
      const children: string[] = [];
      for (const asset of post.assets.slice(0, 10)) {
        if (!asset.url) {
          throw new SocialPublishError('Instagram is missing a resolved image URL.', 'permanent', 'asset_missing');
        }
        children.push(
          await createInstagramContainer(accountId, token, {
            image_url: asset.url,
            is_carousel_item: 'true',
          }),
        );
      }
      containerId = await createInstagramContainer(accountId, token, {
        media_type: 'CAROUSEL',
        children: children.join(','),
        caption: post.text,
      });
    }
    const publish = new URL(`${graphBase()}/${accountId}/media_publish`);
    publish.searchParams.set('access_token', token);
    publish.searchParams.set('creation_id', containerId);
    const result = await providerJson(
      publish,
      { method: 'POST' },
      { stage: 'publish', timeoutMs: 30_000 },
    );
    const id = String(result.id ?? '');
    if (!id)
      throw new SocialPublishError(
        'Instagram returned no media id.',
        'ambiguous',
        'missing_external_id',
      );
    return { externalId: id, providerMeta: { creation_id: containerId } };
  }
}

const PUBLISHERS: Record<SocialChannel, SocialPublisher> = {
  telegram: new TelegramPublisher(),
  x: new XPublisher(),
  threads: new ThreadsPublisher(),
  linkedin: new LinkedInPublisher(),
  facebook: new FacebookPublisher(),
  instagram: new InstagramPublisher(),
};

export function getSocialPublisher(channel: SocialChannel): SocialPublisher {
  return PUBLISHERS[channel];
}
