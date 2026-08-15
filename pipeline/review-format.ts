/**
 * Pure helpers for the Telegram per-item review: the message text, the inline
 * keyboard, and the `callback_data` contract shared with the webhook handler.
 * No IO here — unit-tested.
 */

export interface ReviewItem {
  id: string;
  rank: number;
  category_slug: string | null;
  title_en: string | null;
  title_uk: string | null;
  summary_en: string;
  summary_uk: string | null;
  why_matters_en: string | null;
  why_matters_uk: string | null;
  source_name: string | null;
  url: string | null;
  /** Auto-check note (lang-check + VERIFY) — must be visible on the card. */
  review_comment: string | null;
}

export interface InlineKeyboard {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

export type ReviewAction = 'approve' | 'reject' | 'redo' | 'take';

/** Pipeline auto-curate vs editor hand-pick — different Telegram chrome. */
export type ReviewChannel = 'pipeline' | 'custom';

const APPROVE_PREFIX = 'ap:';
const REJECT_PREFIX = 'rj:';
const REDO_PREFIX = 'rd:';
const TAKE_PREFIX = 'tk:';

const PREFIX_BY_ACTION: Record<ReviewAction, string> = {
  approve: APPROVE_PREFIX,
  reject: REJECT_PREFIX,
  redo: REDO_PREFIX,
  take: TAKE_PREFIX,
};

/** Telegram caps callback_data at 64 bytes; `<prefix><uuid>` is 39 — safe. */
export function callbackData(action: ReviewAction, itemId: string): string {
  return PREFIX_BY_ACTION[action] + itemId;
}

export function parseCallbackData(data: string): { action: ReviewAction; itemId: string } | null {
  if (data.startsWith(APPROVE_PREFIX)) return { action: 'approve', itemId: data.slice(APPROVE_PREFIX.length) };
  if (data.startsWith(REJECT_PREFIX)) return { action: 'reject', itemId: data.slice(REJECT_PREFIX.length) };
  if (data.startsWith(REDO_PREFIX)) return { action: 'redo', itemId: data.slice(REDO_PREFIX.length) };
  if (data.startsWith(TAKE_PREFIX)) return { action: 'take', itemId: data.slice(TAKE_PREFIX.length) };
  return null;
}

/**
 * 🔁 deletes the still-pending row outright (embedding cascades away), so the
 * next progón can re-propose the story with a fresh write-up. ❌ reject means
 * "kill this story for the day" — its embedding keeps suppressing the story in
 * the intra-day dedup. Two different "no" verbs on purpose. ✍️ asks for the
 * editor's take — the human verdict paragraph rendered on the article page.
 */
export function reviewKeyboard(itemId: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '✅ Схвалити', callback_data: callbackData('approve', itemId) },
        { text: '❌ Відхилити', callback_data: callbackData('reject', itemId) },
      ],
      [
        { text: '🔁 Переробити', callback_data: callbackData('redo', itemId) },
        { text: '✍️ Тейк', callback_data: callbackData('take', itemId) },
      ],
    ],
  };
}

/** Escape the five characters Telegram's HTML parse mode treats specially. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Telegram alert for sources that came back failed/empty this run — a dead
 * source must surface in the review chat instead of the pool degrading quietly.
 * RSS lists its individual dead feeds: one broken lab feed must not hide
 * behind ten healthy media feeds.
 */
export function formatSourceHealthAlert(
  unhealthy: Array<{
    source: string;
    status: 'ok' | 'empty' | 'failed';
    count: number;
    dead_feeds?: string[];
  }>,
): string {
  const lines = unhealthy.map((h) => {
    if (h.status === 'ok' && h.dead_feeds?.length) {
      return `• <b>${escapeHtml(h.source)}</b> — мертві фіди: ${escapeHtml(h.dead_feeds.join(', '))}`;
    }
    const note = h.status === 'failed' ? 'помилка запиту' : '0 статей';
    const feeds = h.dead_feeds?.length ? ` (${escapeHtml(h.dead_feeds.join(', '))})` : '';
    return `• <b>${escapeHtml(h.source)}</b> — ${note}${feeds}`;
  });
  return ['⚠️ <b>ДЖЕРЕЛА НЕДОСТУПНІ</b> (цей прогін)', ...lines].join('\n');
}

/**
 * A strong, full-width visual divider that breaks the chat stream so each card
 * reads as a distinct "block" rather than blurring into the previous message.
 * The N/M counter is baked into the divider so the eye lands on it first.
 */
export function cardDivider(position: number, total: number, channel: ReviewChannel = 'pipeline'): string {
  const marker = channel === 'custom' ? '🔵' : '🟡';
  return `${marker} ▔▔▔▔▔ <b>${position}/${total}</b> ▔▔▔▔▔`;
}

/**
 * The batch header sent ONCE before a run's review cards. Announces the brief,
 * the date, and how many cards are coming — so the reviewer knows a new review
 * stream is starting (and where it ends).
 */
export function formatBatchHeader(opts: {
  date: string;
  total: number;
  title?: string | null;
  /** Pack number within the calendar day (1 = morning lead). */
  edition?: number;
  /** 4 h progón window label, e.g. "08:00–10:30". */
  cycleLabel?: string;
  channel?: ReviewChannel;
  /** Original topic line the editor typed (custom channel only). */
  editorTopic?: string | null;
  /** Pending cards from EARLIER cycles still awaiting a decision (above in chat). */
  pendingEarlier?: number;
}): string {
  const channel = opts.channel ?? 'pipeline';
  const lines =
    channel === 'custom'
      ? [
          '╍╍╍╍╍╍╍╍╍╍╍╍╍╍╍╍╍',
          '✏️ <b>ПЕРСОНАЛЬНА НОВИНА</b>',
          '<i>Editor pick · не з автоматичного pipeline</i>',
          `📅 ${escapeHtml(opts.date)}`,
        ]
      : ['━━━━━━━━━━━━━━━━━', "📋 <b>РЕВ'Ю БРИФУ</b>", `📅 ${escapeHtml(opts.date)}`];

  if (channel === 'pipeline' && opts.edition && opts.edition > 1) {
    lines.push(`📦 Пак <b>${opts.edition}</b>`);
  }
  if (channel === 'pipeline' && opts.cycleLabel) {
    lines.push(`🕐 Прогін ${escapeHtml(opts.cycleLabel)} (Kyiv)`);
  }
  if (opts.editorTopic) {
    lines.push(`📌 ${escapeHtml(opts.editorTopic)}`);
  }
  if (opts.title) lines.push(`🗞 <i>${escapeHtml(opts.title)}</i>`);
  lines.push(`🗂 ${opts.total} ${pluralCards(opts.total)} до перегляду`);
  if (opts.pendingEarlier && opts.pendingEarlier > 0) {
    lines.push(
      `⏳ Ще ${opts.pendingEarlier} ${pluralCards(opts.pendingEarlier)} з попередніх прогонів чекають рішення вище — 🚀 зʼявиться лише після ВСІХ.`,
    );
  }
  lines.push(
    channel === 'custom' ? '╍╍╍╍╍╍╍╍╍╍╍╍╍╍╍╍╍' : '━━━━━━━━━━━━━━━━━',
    'Натискай ✅/❌ на кожній картці.',
    channel === 'custom'
      ? 'Після схвалення — 🚀 опублікує цей пак на сайті.'
      : 'Наприкінці зʼявиться кнопка 🚀 для публікації.',
  );
  return lines.join('\n');
}

function pluralCards(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'картка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'картки';
  return 'карток';
}

/**
 * One review card (Telegram HTML parse mode). `position`/`total` are 1-based.
 * Ukrainian is primary (the reviewer reads UK); the EN title sits below in
 * small italics for reference (useful when source links are in EN).
 *
 * Starts with a bold divider (see `cardDivider`) so cards never blur together
 * in the chat stream.
 */
export function formatItemMessage(
  item: ReviewItem,
  position: number,
  total: number,
  channel: ReviewChannel = 'pipeline',
): string {
  const titleEn = escapeHtml(item.title_en ?? '(untitled)');
  const titleUk = escapeHtml(item.title_uk ?? titleEn);
  const category = escapeHtml(item.category_slug ?? 'uncategorized');
  const summary = escapeHtml(item.summary_uk ?? item.summary_en);
  const customTag = channel === 'custom' ? '✏️ <b>EDITOR PICK</b>\n' : '';
  const lines = [
    customTag + cardDivider(position, total, channel),
    `🗂 <b>${category}</b>`,
    '',
    `📰 <b>${titleUk}</b>`,
    `<i>${titleEn}</i>`,
    '',
    summary,
  ];
  const whyUk = item.why_matters_uk ?? item.why_matters_en;
  if (whyUk) lines.push('', `💡 <b>Навіщо:</b> ${escapeHtml(whyUk)}`);
  // VERIFY/lang-check verdicts decide approvals — they must be impossible to miss.
  if (item.review_comment) {
    lines.push('', `🚨 <b>${escapeHtml(item.review_comment)}</b>`);
  }
  if (item.url) {
    const src = escapeHtml(item.source_name ?? 'source');
    lines.push('', `🔗 <a href="${escapeHtml(item.url)}">${src}</a>`);
  }
  return lines.join('\n');
}

/** The message text after a decision — original card with a status line, no buttons. */
export function decoratedAfterDecision(
  original: string,
  action: ReviewAction,
  comment?: string,
): string {
  const head = action === 'approve' ? '✅ <b>APPROVED</b>' : '❌ <b>REJECTED</b>';
  const reason = action === 'reject' && comment ? `\n💬 ${escapeHtml(comment)}` : '';
  return `${head}${reason}\n\n${original}`;
}

/** Separate review-chat card: copy-ready edition cover prompt, no approve buttons. */
export function formatCoverPromptMessage(input: {
  date?: string | null;
  edition?: number | null;
  title: string;
  canonical: string;
  midjourney: string;
  negative: string;
}): string {
  const lines = ['━━━━━━━━━━━━━━━━━', '🖼 <b>ПРОМПТ ОБКЛАДИНКИ</b>'];
  if (input.date) lines.push(`📅 ${escapeHtml(input.date)}`);
  if (input.edition && input.edition > 1) lines.push(`📦 Пак <b>${input.edition}</b>`);
  lines.push(
    `<b>${escapeHtml(input.title)}</b>`,
    '',
    '<b>Canonical</b>',
    `<pre>${escapeHtml(input.canonical)}</pre>`,
    '<b>Midjourney</b>',
    `<pre>${escapeHtml(input.midjourney)}</pre>`,
    '<b>Negative</b>',
    `<pre>${escapeHtml(input.negative)}</pre>`,
  );
  return lines.join('\n');
}
