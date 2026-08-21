import { describe, expect, it } from 'vitest';
import {
  containsTelegramMarkup,
  escapeTelegramHtml,
  telegramRenderedLength,
  toTelegramHtml,
} from './telegram-format';

describe('telegram formatting', () => {
  it('escapes HTML before promoting any marker', () => {
    expect(toTelegramHtml('vLLM <script>alert(1)</script> & co')).toBe(
      'vLLM &lt;script&gt;alert(1)&lt;/script&gt; &amp; co',
    );
  });

  it('promotes the supported marker subset', () => {
    expect(toTelegramHtml('Only **95 billion** fire per `--reasoning low`')).toBe(
      'Only <b>95 billion</b> fire per <code>--reasoning low</code>',
    );
  });

  it('keeps a fenced block whole instead of splitting it into inline spans', () => {
    expect(toTelegramHtml('run:\n```bash\nvllm serve qwen\n```')).toBe(
      'run:\n<pre>vllm serve qwen</pre>',
    );
  });

  it('leaves an unpaired marker alone', () => {
    expect(toTelegramHtml('2 * 3 * 4 and ** nothing')).toBe('2 * 3 * 4 and ** nothing');
  });

  it('counts the length Telegram counts, not the markup', () => {
    // Telegram applies the 1024 caption cap to parsed text, so the markers
    // themselves must not push a valid caption over the limit.
    expect(telegramRenderedLength('**95B** active')).toBe('95B active'.length);
    expect(escapeTelegramHtml('a & b').length).toBeGreaterThan('a & b'.length);
  });

  it('detects markup repeatably', () => {
    // The underlying patterns are global; a shared RegExp would make every
    // second call on the same string return false.
    const text = 'Only **95 billion** fire per token';
    expect(containsTelegramMarkup(text)).toBe(true);
    expect(containsTelegramMarkup(text)).toBe(true);
    expect(containsTelegramMarkup('plain copy with no markers')).toBe(false);
  });
});
