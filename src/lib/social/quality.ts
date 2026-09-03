import { isPrivateSignedStorageUrl, isSocialImageMime } from './asset-ref';
import {
  dailyVisualInstagramCarouselIssues,
  type DailyVisualInstagramCarouselSpec,
} from './daily-visual-carousel';
import { instagramCarouselIssues } from './instagram-carousel';
import { containsServiceMarkers, serviceMarkerIssueMessage } from './service-markers';
import { containsTelegramMarkup } from './telegram-format';
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
    // The tracked link goes in the first comment: an outbound URL in the body
    // measurably suppresses page reach, and the comment carries it for free.
    rootUrlStrategy: 'none',
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
/** Self-reply must still read as a sentence after the URL is stripped. */
const MIN_TRACKED_COMMENT_COPY = 20;

export function trackedCommentHasCopy(comment: string | null | undefined): boolean {
  URL_RE.lastIndex = 0;
  const remainder = (comment ?? '').replace(URL_RE, '').replace(/\s+/g, ' ').trim();
  return remainder.length >= MIN_TRACKED_COMMENT_COPY;
}

function isDailyVisualInstagramCarousel(
  value: NonNullable<SocialDraft['instagramCarousel']>,
): value is DailyVisualInstagramCarouselSpec {
  return 'kind' in value && value.kind === 'daily_visual';
}

function issue(
  code: string,
  message: string,
  field?: QualityIssue['field'],
  suggestedFix?: string,
): QualityIssue {
  return {
    code,
    message,
    ...(field ? { field } : {}),
    ...(suggestedFix ? { suggestedFix } : {}),
  };
}

function validateAsset(channel: SocialChannel, draft: SocialDraft, blocking: QualityIssue[]) {
  const rule = CHANNEL_RULES[channel];
  if (rule.requiresAsset && draft.assets.length === 0) {
    blocking.push(issue('asset_required', `${channel} requires an image.`, 'asset_urls'));
    return;
  }

  for (const asset of draft.assets) {
    if (!isSocialImageMime(asset.mimeType)) {
      blocking.push(
        issue(
          'asset_format',
          asset.mimeType
            ? 'Only JPEG, PNG, and WebP assets are allowed.'
            : 'Social assets must declare an image MIME type.',
          'asset_urls',
        ),
      );
    }
    if (!asset.width || !asset.height || asset.width <= 0 || asset.height <= 0) {
      blocking.push(
        issue('asset_dimensions', 'Social assets must include positive width and height.', 'asset_urls'),
      );
    }
    if (asset.url && isPrivateSignedStorageUrl(asset.url) && !asset.artifactId) {
      blocking.push(
        issue(
          'asset_stale_url',
          'Private weekly assets must persist artifactId; a signed URL alone is not a delivery contract.',
          'asset_urls',
        ),
      );
    }
    if (!asset.artifactId && !asset.url) {
      blocking.push(
        issue('asset_missing', 'A social asset is missing both artifactId and a public URL.', 'asset_urls'),
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
  const contentParts = (draft.contentParts ?? []).map((part) => part.trim()).filter(Boolean);
  const distributionText = contentParts.length > 1 ? contentParts.join('\n') : text;
  const rootUrls = text.match(URL_RE) ?? [];
  const urls = (draft.channel === 'threads' ? distributionText : text).match(URL_RE) ?? [];
  const hashtags = distributionText.match(HASHTAG_RE) ?? [];
  const emoji = distributionText.match(EMOJI_RE) ?? [];

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
  if (FORBIDDEN_CHAR_RE.test(distributionText)) {
    blocking.push(
      issue(
        'forbidden_characters',
        'Remove control, zero-width, or bidirectional override characters.',
        'post_text',
      ),
    );
  }
  if (
    containsServiceMarkers(text) ||
    contentParts.some((part) => containsServiceMarkers(part)) ||
    containsServiceMarkers(draft.firstComment ?? '')
  ) {
    blocking.push(issue('service_markers', serviceMarkerIssueMessage(), 'post_text'));
  }
  if (draft.channel !== 'telegram' && containsTelegramMarkup([text, ...contentParts].join('\n'))) {
    blocking.push(
      issue(
        'raw_markup',
        'Only Telegram renders rich text. Remove **, ` and ``` — every other channel prints them literally.',
        'post_text',
      ),
    );
  }
  if (/…|\.{3}/.test([text, ...contentParts].join(' '))) {
    blocking.push(
      issue(
        'artificial_ellipsis',
        'Rewrite the copy instead of truncating it with an ellipsis.',
        'content_parts',
      ),
    );
  }
  if (draft.channel === 'threads') {
    if (contentParts.length < 3 || contentParts.length > 5) {
      blocking.push(
        issue('threads_parts', 'Threads requires a 3–5 part sequence.', 'content_parts'),
      );
    }
    if (contentParts.some((part) => part.length > 500)) {
      blocking.push(
        issue(
          'threads_part_length',
          'Every Threads part must be at most 500 characters.',
          'content_parts',
        ),
      );
    }
  }
  if (draft.channel === 'x' && contentParts.length > 0) {
    if (contentParts.length !== 2 || contentParts.some((part) => part.length > 280)) {
      blocking.push(
        issue(
          'x_parts',
          'X content parts must contain the root and one self-reply, each at most 280 characters.',
          'content_parts',
        ),
      );
    }
  }
  const instagramCarousel = draft.instagramCarousel;
  if (draft.channel === 'instagram' && instagramCarousel) {
    const specIssues = isDailyVisualInstagramCarousel(instagramCarousel)
      ? dailyVisualInstagramCarouselIssues(instagramCarousel)
      : instagramCarouselIssues(
          instagramCarousel,
          draft.currentRevisionItemIds ??
            instagramCarousel.slides.flatMap((slide) =>
              slide.kind === 'story' ? [slide.revisionItemId] : [],
            ),
        );
    for (const specIssue of specIssues) {
      blocking.push(issue(specIssue.code, specIssue.message, 'content_parts'));
    }
  } else if (draft.channel === 'instagram' && contentParts.length > 0) {
    if (contentParts.length < 7 || contentParts.length > 9) {
      blocking.push(
        issue('instagram_slides', 'Instagram requires 7–9 carousel slide texts.', 'content_parts'),
      );
    }
  }
  if (rule.rootUrlStrategy === 'none' && rootUrls.length > 0) {
    blocking.push(issue('root_url', 'This channel format must be link-free.', 'post_text'));
  }
  if (rule.rootUrlStrategy === 'one' && urls.length !== 1) {
    blocking.push(issue('url_count', 'Use exactly one tracked URL in the post body.', 'post_text'));
  }
  if (draft.channel === 'x' && !(draft.firstComment ?? '').match(URL_RE)) {
    blocking.push(
      issue('x_reply_url', 'X requires the tracked URL in the self-reply.', 'first_comment'),
    );
  } else if (draft.channel === 'x' && !trackedCommentHasCopy(draft.firstComment)) {
    blocking.push(
      issue(
        'x_reply_bare_url',
        'X self-reply must include a practical line, not only the tracked URL.',
        'first_comment',
      ),
    );
  }
  if (draft.channel === 'linkedin' && !(draft.firstComment ?? '').match(URL_RE)) {
    blocking.push(
      issue(
        'linkedin_comment_url',
        'LinkedIn requires the tracked URL in the first comment, not in the post body.',
        'first_comment',
      ),
    );
  }

  const cyrillic = (distributionText.match(CYRILLIC_RE) ?? []).length;
  const latin = (distributionText.match(LATIN_RE) ?? []).length;
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
    blocking.push(
      issue(
        'schedule_past',
        'Schedule is already in the past.',
        undefined,
        'Pick a future Europe/Kyiv datetime, Save draft, then Approve.',
      ),
    );
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
  if (draft.channel === 'threads' && !distributionText.includes('?')) {
    warnings.push(
      issue('threads_question', 'Consider ending the Threads post with a real question.'),
    );
  }

  return { blocking, warnings, checkedAt: now.toISOString() };
}

function envEnabled(value: string | undefined) {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');
}

/**
 * Save is allowed with warnings. Approval is not: factual score, critic
 * presence, and any remaining structural/asset blockers still gate publish.
 */
export function socialApprovalBlockers(
  report: QualityReport,
  options?: { criticRequired?: boolean },
): QualityIssue[] {
  const criticRequired =
    options?.criticRequired ?? envEnabled(process.env.SOCIAL_CRITIC_REQUIRED);
  const blockers = [...report.blocking];
  const critic = report.critic;
  if (!critic) {
    if (criticRequired) {
      blockers.push(
        issue(
          'critic_required',
          'A successful current-generation critic audit is required before approval.',
        ),
      );
    }
    return blockers;
  }
  if (typeof critic.score === 'number' && critic.score < 85) {
    blockers.push(
      issue(
        'critic_score',
        `Independent factual critic scored this variant ${critic.score}/100; 85 is required.`,
      ),
    );
  }
  return blockers;
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

/**
 * Saving a variant re-runs the quality gate + critic. Keep generation provenance
 * (writer, platform fit, hook metadata) that those steps do not recompute.
 */
export function mergePreservedQualityProvenance(
  next: QualityReport,
  previous: unknown,
): QualityReport {
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)) return next;
  const prior = previous as Record<string, unknown>;
  const writer =
    next.writer ??
    (prior.writer && typeof prior.writer === 'object' && !Array.isArray(prior.writer)
      ? (prior.writer as QualityReport['writer'])
      : undefined);
  const platformFitScore =
    typeof next.platformFitScore === 'number'
      ? next.platformFitScore
      : typeof prior.platformFitScore === 'number'
        ? prior.platformFitScore
        : undefined;
  const hookAngle =
    typeof next.hookAngle === 'string' && next.hookAngle.trim()
      ? next.hookAngle
      : typeof prior.hookAngle === 'string' && prior.hookAngle.trim()
        ? prior.hookAngle
        : undefined;
  const hookCandidates = next.hookCandidates?.length
    ? next.hookCandidates
    : Array.isArray(prior.hookCandidates)
      ? prior.hookCandidates.filter(
          (candidate): candidate is string =>
            typeof candidate === 'string' && Boolean(candidate.trim()),
        )
      : undefined;
  return {
    ...next,
    ...(writer ? { writer } : {}),
    ...(typeof platformFitScore === 'number' ? { platformFitScore } : {}),
    ...(hookAngle ? { hookAngle } : {}),
    ...(hookCandidates?.length ? { hookCandidates } : {}),
  };
}

/** Near-identical same-language cross-posts are blocked; native reuse of facts is allowed. */
export function findBlindCrossPosts(drafts: SocialDraft[]): Map<SocialChannel, QualityIssue[]> {
  const result = new Map<SocialChannel, QualityIssue[]>();
  for (let leftIndex = 0; leftIndex < drafts.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < drafts.length; rightIndex += 1) {
      const left = drafts[leftIndex];
      const right = drafts[rightIndex];
      if (left.locale !== right.locale) continue;
      const similarity = jaccard(
        tokenSet([left.text, ...(left.contentParts ?? [])].join(' ')),
        tokenSet([right.text, ...(right.contentParts ?? [])].join(' ')),
      );
      if (similarity <= 0.65) continue;
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
