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
}

export interface InlineKeyboard {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

export type ReviewAction = 'approve' | 'reject';

/** Pipeline auto-curate vs editor hand-pick — different Telegram chrome. */
export type ReviewChannel = 'pipeline' | 'custom';

const APPROVE_PREFIX = 'ap:';
const REJECT_PREFIX = 'rj:';

/** Telegram caps callback_data at 64 bytes; `<prefix><uuid>` is 39 — safe. */
export function callbackData(action: ReviewAction, itemId: string): string {
  return (action === 'approve' ? APPROVE_PREFIX : REJECT_PREFIX) + itemId;
}

export function parseCallbackData(data: string): { action: ReviewAction; itemId: string } | null {
  if (data.startsWith(APPROVE_PREFIX)) return { action: 'approve', itemId: data.slice(APPROVE_PREFIX.length) };
  if (data.startsWith(REJECT_PREFIX)) return { action: 'reject', itemId: data.slice(REJECT_PREFIX.length) };
  return null;
}

export function reviewKeyboard(itemId: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '✅ Схвалити', callback_data: callbackData('approve', itemId) },
        { text: '❌ Відхилити', callback_data: callbackData('reject', itemId) },
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
  lines.push(
    `🗂 ${opts.total} ${pluralCards(opts.total)} до перегляду`,
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
