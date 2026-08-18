import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { renderWeeklyDigestPdf, type WeeklyPdfInput } from './pdf';
import { openWeeklyPdfPreview } from './pdf-preview';

// A4 in points, mirroring the renderer. The footer rule is the line body text
// must never cross -- overlapping it is the "text sits on the footer" defect.
const PAGE_HEIGHT = 841.89;
const FOOTER_RULE_Y = PAGE_HEIGHT - 74;
const CONTENTS_PAGE = 2;

function repeatToLength(unit: string, targetLength: number): string {
  let out = '';
  while (out.length < targetLength) out += (out ? ' ' : '') + unit;
  const cut = out.slice(0, targetLength);
  return cut.slice(0, cut.lastIndexOf(' ') + 1).trim() || cut.trim();
}

/**
 * Sized from a real edition (Issue 4, 2026-08-09): a 116-character headline, a
 * 1018-character standfirst, ~4.2k-character feature bodies, ~800 for radar
 * items. The previous short fixture rendered cleanly while production editions
 * overflowed the cover onto a blank page and ran to 14 pages.
 */
function fixture(locale: 'en' | 'uk', storyCount = 5): WeeklyPdfInput {
  const uk = locale === 'uk';
  return {
    locale,
    issueLabel: uk ? 'Випуск 12' : 'Issue 12',
    title: uk
      ? 'Qwen3.8 з 95 мільярдами активних параметрів, дешевша агентна память IBM і чому китайські лабораторії тепер володіють дозвільним ліцензуванням'
      : "Qwen3.8's 95 Billion Active Parameters, IBM's Cheaper Agent Memory, and Why Chinese Labs Now Own Permissive Licensing",
    intro: repeatToLength(
      uk
        ? 'Alibaba відкрила Qwen3.8, і головне число тут не 2,4 трильйона параметрів, а 95 мільярдів активних на токен.'
        : 'Alibaba open-sourced Qwen3.8 this week, and the number that matters is 95 billion: that is how many parameters actually fire per token.',
      1018,
    ),
    editorNote: repeatToLength(
      uk
        ? 'Цей випуск синтезує первинні джерела поряд з окремо позначеною редакційною аналітикою.'
        : 'This edition synthesizes primary sources alongside separately labeled editorial analysis.',
      330,
    ),
    weekStart: '2026-07-19',
    weekEnd: '2026-07-25',
    webUrl: `https://aitodaybrief.com/${locale}/weekly/ai-weekly-2026-07-19`,
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    keyTakeaways: Array.from({ length: 4 }, (_, index) =>
      repeatToLength(
        uk
          ? `Практичний висновок ${index + 1} для команд, які впроваджують AI.`
          : `Practical takeaway ${index + 1} for teams shipping AI to production.`,
        150,
      ),
    ),
    stories: Array.from({ length: storyCount }, (_, index) => {
      const feature = index < 3;
      return {
        rank: index + 1,
        title: uk
          ? `Важлива новина тижня ${index + 1} про ефективність відкритих моделей і вартість інференсу`
          : `Important development of the week ${index + 1} on open-weight efficiency and inference cost`,
        summary: repeatToLength(
          uk
            ? 'Короткий доказовий підсумок події без перебільшень.'
            : 'A concise, evidence-backed summary without hype.',
          feature ? 320 : 420,
        ),
        body: repeatToLength(
          uk
            ? 'Повний контекст події пояснює, що саме змінилося, для кого це важливо та які обмеження слід врахувати.'
            : 'The full context explains what changed, who it affects, and which limitations teams should consider.',
          feature ? 4200 : 850,
        ),
        why: repeatToLength(
          uk
            ? 'Це впливає на вартість, швидкість і надійність продуктового циклу.'
            : 'It changes cost, speed, and reliability across the product cycle.',
          280,
        ),
        practical: repeatToLength(
          uk
            ? 'Команда може перевірити підхід у невеликому внутрішньому процесі перед production.'
            : 'A team can validate the approach in a small internal workflow before production.',
          300,
        ),
        takeaway: repeatToLength(
          uk
            ? 'Перевіряйте цінність на реальних завданнях, а не на демонстраціях.'
            : 'Validate value on real workloads, not demos.',
          180,
        ),
        limitation: repeatToLength(
          uk
            ? 'Дані описують лише один звітований випадок, не універсальну поведінку.'
            : 'The data describes one reported case, not universal behavior.',
          190,
        ),
        sourceName: 'Example source',
        sourceUrl: 'https://example.com/source',
        eventDate: '2026-07-21',
      };
    }),
  };
}

interface PlacedText {
  text: string;
  /** Distance from the left edge, in points. */
  x: number;
  /** Baseline distance from the top of the page, in points. */
  y: number;
}

async function readPages(pdf: Buffer): Promise<PlacedText[][]> {
  const document = await getDocument({ data: new Uint8Array(pdf) }).promise;
  try {
    const pages: PlacedText[][] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      pages.push(
        // Marked-content entries carry no glyphs, hence the `str` narrowing.
        content.items.flatMap((item) =>
          'str' in item && item.str.trim()
            ? [
                {
                  text: item.str,
                  x: item.transform[4] ?? 0,
                  y: PAGE_HEIGHT - (item.transform[5] ?? 0),
                },
              ]
            : [],
        ),
      );
    }
    return pages;
  } finally {
    await document.destroy();
  }
}

/**
 * Page numbers the contents rows jump to, in row order. A GoTo annotation
 * carries a named destination, which resolves to the page it was registered on.
 */
async function readContentsJumps(pdf: Buffer) {
  const document = await getDocument({ data: new Uint8Array(pdf) }).promise;
  try {
    const annotations = await (await document.getPage(CONTENTS_PAGE)).getAnnotations();
    const links = annotations
      .filter((annotation) => typeof annotation.dest === 'string')
      .sort((a, b) => b.rect[1] - a.rect[1]);
    const jumps: number[] = [];
    for (const link of links) {
      const explicit = await document.getDestination(link.dest);
      jumps.push((await document.getPageIndex(explicit?.[0])) + 1);
    }
    return jumps;
  } finally {
    await document.destroy();
  }
}

/** Right-hand page-number column of the contents page, in row order. */
function contentsPageColumn(items: PlacedText[]) {
  return items
    .filter((item) => item.x > 500 && /^\d+$/.test(item.text))
    .sort((a, b) => a.y - b.y)
    .map((item) => Number(item.text));
}

/** Letter-spaced runs come back split, so compare without whitespace. */
function dense(items: PlacedText[]) {
  return items
    .map((item) => item.text)
    .join('')
    .replace(/\s+/g, '');
}

describe('renderWeeklyDigestPdf', () => {
  it('initializes the in-process PDF.js worker used by server previews', () => {
    const worker = (
      globalThis as typeof globalThis & {
        pdfjsWorker?: { WorkerMessageHandler?: unknown };
      }
    ).pdfjsWorker;
    expect(worker?.WorkerMessageHandler).toEqual(expect.any(Function));
  });

  it.each(['en', 'uk'] as const)('renders a substantial %s A4 PDF', async (locale) => {
    const pdf = await renderWeeklyDigestPdf(fixture(locale));
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(18_000);
  });

  it('rejects an invalid story count', async () => {
    await expect(
      renderWeeklyDigestPdf({ ...fixture('en'), stories: fixture('en').stories.slice(0, 2) }),
    ).rejects.toThrow('3 to 7');
  });

  it('prints a full 7-story edition as 7 A4 pages', async () => {
    // Cover, contents, three features, radar, closing. Giving every item the
    // illustrated spread -- and letting each one flow across page breaks -- is
    // what produced the 14-to-21-page editions readers would not finish.
    const pdf = await renderWeeklyDigestPdf(fixture('en', 7));
    const document = await openWeeklyPdfPreview(pdf, 0.4);
    try {
      expect(document.length).toBe(7);
    } finally {
      await document.destroy();
    }
  });

  it('drops the radar page when an edition has only the top 3', async () => {
    const pdf = await renderWeeklyDigestPdf(fixture('en', 3));
    const pages = await readPages(pdf);
    expect(pages).toHaveLength(6);
  });

  it('jumps from every contents row to the page that story lands on', async () => {
    // Cover 1, contents 2, features 3-5, one shared radar page 6, closing 7.
    const pdf = await renderWeeklyDigestPdf(fixture('en', 7));
    expect(await readContentsJumps(pdf)).toEqual([3, 4, 5, 6, 6, 6, 6]);
    const pages = await readPages(pdf);
    expect(contentsPageColumn(pages[1] ?? [])).toEqual([3, 4, 5, 6, 6, 6, 6]);
  });

  it('renumbers the contents when an edition has no radar page', async () => {
    const pdf = await renderWeeklyDigestPdf(fixture('uk', 3));
    expect(await readContentsJumps(pdf)).toEqual([3, 4, 5]);
    const pages = await readPages(pdf);
    expect(contentsPageColumn(pages[1] ?? [])).toEqual([3, 4, 5]);
  });

  it('keeps the whole cover block on the cover page', async () => {
    // A 116-character headline plus a 1018-character standfirst used to overflow
    // page 1, which pushed the issue label, the week range and the site URL onto
    // an otherwise blank page 2 -- printed in cover colours on paper stock.
    const pages = await readPages(await renderWeeklyDigestPdf(fixture('en', 7)));
    const cover = dense(pages[0] ?? []);
    expect(cover).toContain('Issue12');
    expect(cover).toContain('2026-07-19');
    expect(cover).toContain('2026-07-25');
    expect(cover).toContain('aitodaybrief.com');
    expect(dense(pages[1] ?? [])).toContain('Insidethisedition');
  });

  it('never lets content cross the footer rule', async () => {
    const pages = await readPages(await renderWeeklyDigestPdf(fixture('en', 7)));
    pages.slice(1).forEach((items, index) => {
      const page = index + 2;
      const belowRule = dense(items.filter((item) => item.y > FOOTER_RULE_Y));
      expect({ page, belowRule }).toEqual({
        page,
        belowRule: `AITODAYBRIEF·Issue12Page${page}of7`,
      });
    });
  });

  it.each([
    ['en', 'Page2of7'],
    ['uk', 'Стор.2з7'],
  ] as const)('numbers %s pages in words rather than "Issue / n"', async (locale, expected) => {
    const pages = await readPages(await renderWeeklyDigestPdf(fixture(locale, 7)));
    expect(dense(pages[1] ?? [])).toContain(expected);
  });

  it('can rasterize generated pages for the private admin preview', async () => {
    const bytes = await renderWeeklyDigestPdf(fixture('uk'));
    const document = await openWeeklyPdfPreview(bytes, 0.4);
    try {
      expect(document.length).toBe(7);
      const firstPage = await document.getPage(1);
      expect(firstPage.subarray(1, 4).toString()).toBe('PNG');
      expect(firstPage.length).toBeGreaterThan(4_000);
    } finally {
      await document.destroy();
    }
  });
});
