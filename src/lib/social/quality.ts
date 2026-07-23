import type { QualityIssue, QualityReport, SocialChannel, SocialDraft } from './types';

interface ChannelRule {
  maxChars: number;
  minChars: number;
  maxHashtags: number;
  maxEmoji: number;
  requiresAsset?: boolean;
  requiresAltWithAsset?: boolean;
  rootUrlStrategy: 'none' | 'one' | 'any';
}

export const CHANNEL_RULES: Record<SocialChannel, ChannelRule> = {
  telegram: {
    maxChars: 4096,
    minChars: 80,
    maxHashtags: 3,
    maxEmoji: 8,
    requiresAltWithAsset: true,
    rootUrlStrategy: 'one',
  },
  x: {
    maxChars: 280,
    minChars: 40,
    maxHashtags: 2,
    maxEmoji: 2,
    requiresAltWithAsset: true,
    rootUrlStrategy: 'none',
  },
  threads: {
    maxChars: 500,
    minChars: 120,
    maxHashtags: 2,
    maxEmoji: 3,
    requiresAltWithAsset: true,
    rootUrlStrategy: 'one',
  },
  linkedin: {
    maxChars: 3000,
    minChars: 300,
    maxHashtags: 3,
    maxEmoji: 3,
    requiresAltWithAsset: true,
    rootUrlStrategy: 'one',
  },
  instagram: {
    maxChars: 2200,
    minChars: 180,
    maxHashtags: 5,
    maxEmoji: 5,
    requiresAsset: true,
    requiresAltWithAsset: true,
    rootUrlStrategy: 'none',
  },
  facebook: {
    maxChars: 63206,
    minChars: 120,
    maxHashtags: 3,
    maxEmoji: 5,
    requiresAltWithAsset: true,
    rootUrlStrategy: 'one',
  },
};

const URL_RE = /https?:\/\/[^\s)\]}]+/gi;
const HASHTAG_RE = /(^|\s)#[\p{L}\p{N}_]+/gu;
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const CYRILLIC_RE = /[\u0400-\u04ff]/g;
const LATIN_RE = /[a-z]/gi;
const FORBIDDEN_CHAR_RE =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;

function issue(code: string, message: string, field?: QualityIssue['field']): QualityIssue {
  return { code, message, ...(field ? { field } : {}) };
}

function validateAsset(channel: SocialChannel, draft: SocialDraft, blocking: QualityIssue[]) {
  const rule = CHANNEL_RULES[channel];
  if (rule.requiresAsset && draft.assets.length === 0) {
    blocking.push(issue('asset_required', `${channel} requires an image.`, 'asset_urls'));
    return;
  }

  for (const asset of draft.assets) {
    if (asset.mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)) {
      blocking.push(
        issue('asset_format', 'Only JPEG, PNG, and WebP assets are allowed.', 'asset_urls'),
      );
    }
    if (asset.bytes && asset.bytes > 10 * 1024 * 1024) {
      blocking.push(issue('asset_size', 'Each social asset must be at most 10 MB.', 'asset_urls'));
    }
    if (channel === 'x' && asset.bytes && asset.bytes > 5 * 1024 * 1024) {
      blocking.push(issue('x_asset_size', 'X images must be at most 5 MB.', 'asset_urls'));
    }
    if (channel === 'instagram' && asset.width && asset.height) {
      const ratio = asset.width / asset.height;
      if (Math.abs(ratio - 0.8) > 0.015) {
        blocking.push(
          issue(
            'instagram_ratio',
            'Instagram feed assets must use a 4:5 aspect ratio.',
            'asset_urls',
          ),
        );
      }
    } else if (channel !== 'instagram' && asset.width && asset.height) {
      const ratio = asset.width / asset.height;
      if (ratio < 1.75 || ratio > 1.92) {
        blocking.push(
          issue(
            'landscape_ratio',
            'Landscape social assets must be 1200×630 or 1200×675.',
            'asset_urls',
          ),
        );
      }
    }
  }

  if (draft.assets.length > 0 && rule.requiresAltWithAsset && !draft.altText?.trim()) {
    blocking.push(issue('alt_required', 'Alt text is required for this channel.', 'alt_text'));
  }
}

export function runQualityGate(draft: SocialDraft, now = new Date()): QualityReport {
  const blocking: QualityIssue[] = [];
  const warnings: QualityIssue[] = [];
  const rule = CHANNEL_RULES[draft.channel];
  const text = draft.text.trim();
  const urls = text.match(URL_RE) ?? [];
  const hashtags = text.match(HASHTAG_RE) ?? [];
  const emoji = text.match(EMOJI_RE) ?? [];

  if (!draft.sourceApproved) {
    blocking.push(
      issue('source_not_approved', 'The source story is not published and approved.', 'source'),
    );
  }
  if (text.length < rule.minChars || text.length > rule.maxChars) {
    blocking.push(
      issue(
        'length',
        `Text must contain ${rule.minChars}–${rule.maxChars} characters; found ${text.length}.`,
        'post_text',
      ),
    );
  }
  if (hashtags.length > rule.maxHashtags) {
    blocking.push(issue('hashtags', `Use at most ${rule.maxHashtags} hashtags.`, 'post_text'));
  }
  if (emoji.length > rule.maxEmoji) {
    blocking.push(issue('emoji', `Use at most ${rule.maxEmoji} emoji.`, 'post_text'));
  }
  if (FORBIDDEN_CHAR_RE.test(text)) {
    blocking.push(
      issue(
        'forbidden_characters',
        'Remove control, zero-width, or bidirectional override characters.',
        'post_text',
      ),
    );
  }
  if (rule.rootUrlStrategy === 'none' && urls.length > 0) {
    blocking.push(issue('root_url', 'This channel format must be link-free.', 'post_text'));
  }
  if (rule.rootUrlStrategy === 'one' && urls.length > 1) {
    blocking.push(issue('too_many_urls', 'Use at most one URL in the post body.', 'post_text'));
  }
  if (draft.channel === 'x' && !(draft.firstComment ?? '').match(URL_RE)) {
    blocking.push(
      issue('x_reply_url', 'X requires the tracked URL in the self-reply.', 'first_comment'),
    );
  }

  const cyrillic = (text.match(CYRILLIC_RE) ?? []).length;
  const latin = (text.match(LATIN_RE) ?? []).length;
  if (draft.locale === 'uk' && cyrillic < 12) {
    blocking.push(
      issue('language_uk', 'Ukrainian variants need meaningful Cyrillic copy.', 'post_text'),
    );
  }
  if (draft.locale === 'en' && cyrillic > Math.max(6, latin * 0.15)) {
    blocking.push(
      issue('language_en', 'English variants contain too much Cyrillic copy.', 'post_text'),
    );
  }

  if (new Date(draft.scheduledFor).getTime() <= now.getTime() - 5 * 60_000) {
    blocking.push(issue('schedule_past', 'Schedule is already in the past.'));
  }
  if (draft.sourceFacts.length === 0) {
    blocking.push(issue('facts_missing', 'No approved fact snapshot is attached.', 'source'));
  }

  validateAsset(draft.channel, draft, blocking);

  if (draft.channel === 'linkedin' && text.length < 600) {
    warnings.push(
      issue('linkedin_short', 'LinkedIn performs best with the planned 600–1200 character format.'),
    );
  }
  if (draft.channel === 'threads' && !text.includes('?')) {
    warnings.push(
      issue('threads_question', 'Consider ending the Threads post with a real question.'),
    );
  }

  return { blocking, warnings, checkedAt: now.toISOString() };
}

function normalized(text: string) {
  return text
    .toLocaleLowerCase()
    .replace(URL_RE, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function tokenSet(value: string) {
  return new Set(
    normalized(value)
      .split(' ')
      .filter((token) => token.length > 2),
  );
}

function jaccard(left: Set<string>, right: Set<string>) {
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

/** Near-identical same-language cross-posts are blocked; native reuse of facts is allowed. */
export function findBlindCrossPosts(drafts: SocialDraft[]): Map<SocialChannel, QualityIssue[]> {
  const result = new Map<SocialChannel, QualityIssue[]>();
  for (let leftIndex = 0; leftIndex < drafts.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < drafts.length; rightIndex += 1) {
      const left = drafts[leftIndex];
      const right = drafts[rightIndex];
      if (left.locale !== right.locale) continue;
      const similarity = jaccard(tokenSet(left.text), tokenSet(right.text));
      if (similarity < 0.82) continue;
      for (const [current, other] of [
        [left, right],
        [right, left],
      ] as const) {
        result.set(current.channel, [
          ...(result.get(current.channel) ?? []),
          issue(
            'blind_cross_post',
            `Copy is ${Math.round(similarity * 100)}% similar to ${other.channel} after URL removal.`,
            'post_text',
          ),
        ]);
      }
    }
  }
  return result;
}
