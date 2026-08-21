/**
 * Telegram is the only channel of the six that renders rich text, and it only
 * does so when the send call carries a `parse_mode`. Until this module the
 * provider sent plain text, so any accent or code block written by the editor
 * reached the channel as raw asterisks or backticks.
 *
 * MarkdownV2 was rejected on purpose: it requires escaping fifteen characters
 * anywhere in the copy, and a single missed one makes Telegram reject the whole
 * message at publish time. HTML has three reserved characters, so we escape the
 * text first and only then promote a closed whitelist of markers into tags.
 * Nothing a model writes can introduce an unsupported tag this way.
 */

const BOLD = /\*\*([^\n*][^*]*?)\*\*/g;
const CODE_BLOCK = /```(?:[a-z0-9+#-]*)\n([\s\S]*?)```/gi;
const INLINE_CODE = /`([^`\n]+)`/g;

export function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Editor-facing markers, in the order they must be resolved: fenced blocks
 * before inline code, so a fence is never split into two inline spans.
 */
export function toTelegramHtml(text: string) {
  return escapeTelegramHtml(text)
    .replace(CODE_BLOCK, (_match, body: string) => `<pre>${body.replace(/\n+$/, '')}</pre>`)
    .replace(INLINE_CODE, (_match, body: string) => `<code>${body}</code>`)
    .replace(BOLD, (_match, body: string) => `<b>${body}</b>`);
}

/**
 * Length Telegram will count after it parses the entities, which is what the
 * 1024-character caption cap and the 4096-character message cap apply to.
 */
export function telegramRenderedLength(text: string) {
  return text
    .replace(CODE_BLOCK, (_match, body: string) => body.replace(/\n+$/, ''))
    .replace(INLINE_CODE, '$1')
    .replace(BOLD, '$1').length;
}

/**
 * Markers that render on Telegram and would show up raw everywhere else.
 *
 * Deliberately rebuilt per call: `BOLD` and `INLINE_CODE` carry the `g` flag,
 * and `RegExp.test` on a global pattern advances `lastIndex`, so sharing them
 * here would make every second call on the same string return false.
 */
export function containsTelegramMarkup(text: string) {
  return (
    new RegExp(BOLD.source).test(text) ||
    new RegExp(INLINE_CODE.source).test(text) ||
    text.includes('```')
  );
}
