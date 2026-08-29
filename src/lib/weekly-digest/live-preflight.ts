import type { WeeklyPreflightBlocker, WeeklyPreflightTab } from './preflight';

export type LiveWeeklyPreflight = {
  ready: boolean;
  checkedAt: string | null;
  revisionId: string | null;
  blockers: WeeklyPreflightBlocker[];
  error: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function tabFromSlot(code: string, slot: string): WeeklyPreflightTab {
  if (slot.startsWith('article:') || code.includes('article')) return 'article';
  if (slot.startsWith('pdf:') || code.startsWith('pdf_')) return 'pdf';
  if (slot.startsWith('cover') || slot.startsWith('story:') || slot.startsWith('social_asset')) {
    return 'visuals';
  }
  if (
    slot.startsWith('video') ||
    slot.startsWith('captions') ||
    slot.startsWith('thumbnail') ||
    code.startsWith('youtube') ||
    code.startsWith('captions')
  ) {
    return 'video';
  }
  if (code.startsWith('editorial_')) return 'research';
  return 'release';
}

function tabForRpcCode(code: string, slotKey: string | null, channel: string | null): WeeklyPreflightTab {
  if (channel || code.startsWith('social_')) return 'social';
  if (code.startsWith('story_image') || code === 'simulation_not_passed') return 'visuals';
  if (code.startsWith('story_')) return 'stories';
  return tabFromSlot(code, slotKey ?? '');
}

function fixForRpcCode(code: string, tab: WeeklyPreflightTab): string {
  if (code === 'social_assets_stale') {
    return 'Open Social → re-attach the current cover or story images, then Save. Copy approval stays; only the image link is stale.';
  }
  if (code === 'artifact_stale' || code === 'story_image_stale') {
    return `Open ${tab} → regenerate or re-upload so the current input hash matches, then Approve.`;
  }
  if (code === 'social_variant_not_ready' || code === 'social_not_approved') {
    return 'Open Social → finish copy, schedule time, and Approve the channel.';
  }
  if (tab === 'release') {
    return 'Open Release → resolve the listed gate, or add an audited override reason if the RPC still blocks Approve.';
  }
  return `Open ${tab} and clear this live preflight gate before Approve/Ship.`;
}

function mapRpcCode(code: string): WeeklyPreflightBlocker['code'] {
  switch (code) {
    case 'artifact_missing':
    case 'story_image_not_approved':
      return code === 'artifact_missing' ? 'artifact_missing' : 'artifact_not_approved';
    case 'artifact_not_approved':
      return 'artifact_not_approved';
    case 'artifact_stale':
    case 'story_image_stale':
      return 'artifact_stale';
    case 'social_variant_missing':
    case 'social_package_missing':
    case 'social_matrix_incomplete':
      return 'social_missing';
    case 'social_variant_not_ready':
      return 'social_not_approved';
    case 'social_assets_stale':
      return 'social_assets_stale';
    case 'story_count_invalid':
      return 'stories_count';
    case 'simulation_not_passed':
      return 'simulation_not_passed';
    default:
      return 'release_not_ready';
  }
}

function mapRpcBlocker(value: unknown): WeeklyPreflightBlocker | null {
  if (!isRecord(value)) return null;
  const code = asString(value.code) ?? 'unknown';
  const message = asString(value.message) ?? 'Preflight blocked this release.';
  const slotKey = asString(value.slot_key);
  const channel = asString(value.channel);
  const tab = tabForRpcCode(code, slotKey, channel);
  const mapped = mapRpcCode(code);
  const slot = slotKey ?? (channel ? `social:${channel}` : code);
  return {
    code: mapped,
    slot,
    message,
    fix: fixForRpcCode(code, tab),
    tab,
  };
}

/** Maps `weekly_digest_preflight` JSON into the Release-tab blocker list. */
export function parseLiveWeeklyPreflight(value: unknown): LiveWeeklyPreflight {
  if (!isRecord(value)) {
    return {
      ready: false,
      checkedAt: null,
      revisionId: null,
      blockers: [],
      error: 'Live preflight returned an unexpected payload.',
    };
  }
  const rawBlockers = Array.isArray(value.blockers) ? value.blockers : [];
  const blockers = rawBlockers.flatMap((entry) => {
    const mapped = mapRpcBlocker(entry);
    return mapped ? [mapped] : [];
  });
  return {
    ready: value.ready === true,
    checkedAt: asString(value.checked_at),
    revisionId: asString(value.revision_id),
    blockers,
    error: null,
  };
}

export function livePreflightUnavailable(message: string): LiveWeeklyPreflight {
  return {
    ready: false,
    checkedAt: null,
    revisionId: null,
    blockers: [],
    error: message,
  };
}
