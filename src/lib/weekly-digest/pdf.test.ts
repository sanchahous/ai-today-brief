import { describe, expect, it } from 'vitest';
import { renderWeeklyDigestPdf, type WeeklyPdfInput } from './pdf';
import { openWeeklyPdfPreview } from './pdf-preview';

function fixture(locale: 'en' | 'uk'): WeeklyPdfInput {
  const uk = locale === 'uk';
  return {
    locale,
    issueLabel: uk ? 'Випуск 12' : 'Issue 12',
    title: uk ? 'Тиждень практичних AI-рішень' : 'The week in practical AI systems',
    intro: uk
      ? 'П’ять подій, які змінюють роботу розробників і продуктових команд.'
      : 'Five developments changing how builders and product teams work.',
    editorNote: uk
      ? 'Цього тижня головна тема - перехід від демонстрацій до надійних систем.'
      : 'This week is about the shift from demos to dependable systems.',
    weekStart: '2026-07-19',
    weekEnd: '2026-07-25',
    webUrl: `https://aitodaybrief.com/${locale}/weekly/ai-weekly-2026-07-19`,
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    keyTakeaways: Array.from({ length: 4 }, (_, index) =>
      uk
        ? `Практичний висновок ${index + 1} для команд, які впроваджують AI.`
        : `Practical takeaway ${index + 1} for teams shipping AI.`,
    ),
    stories: Array.from({ length: 5 }, (_, index) => ({
      rank: index + 1,
      title: uk
        ? `Важлива новина тижня ${index + 1}`
        : `Important development of the week ${index + 1}`,
      summary: uk
        ? 'Короткий доказовий підсумок події без перебільшень.'
        : 'A concise, evidence-backed summary without hype.',
      body: uk
        ? 'Повний контекст події пояснює, що саме змінилося, для кого це важливо та які обмеження слід врахувати.'
        : 'The full context explains what changed, who it affects, and which limitations teams should consider.',
      why: uk
        ? 'Це впливає на вартість, швидкість і надійність продуктового циклу.'
        : 'It changes cost, speed, and reliability across the product cycle.',
      practical: uk
        ? 'Команда може перевірити підхід у невеликому внутрішньому процесі перед production.'
        : 'A team can validate the approach in a small internal workflow before production.',
      takeaway: uk
        ? 'Перевіряйте цінність на реальних завданнях, а не на демонстраціях.'
        : 'Validate value on real workloads, not demos.',
      limitation: uk
        ? 'Дані описують лише один звітований випадок, не універсальну поведінку.'
        : 'The data describes one reported case, not universal behavior.',
      sourceName: 'Example source',
      sourceUrl: 'https://example.com/source',
      eventDate: '2026-07-21',
    })),
  };
}

function repeatToLength(unit: string, targetLength: number): string {
  let out = '';
  while (out.length < targetLength) out += (out ? ' ' : '') + unit;
  return out.slice(0, targetLength).trim();
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

  it('keeps a realistic 7-story edition within the approved 10-16 page A4 contract', async () => {
    // Body lengths measured against a real production edition (2026-08-07):
    // rank 1-3 features run ~4100-4240 chars, rank 4-7 radar items ~790-900.
    // Giving every item the full illustrated spread (image + body + 4 info
    // panels) is what pushed real editions to 20-21 pages -- this is the
    // regression guard for that failure (see buildRadarSection in pdf.ts).
    const longBody = repeatToLength(
      'The mechanism behind this shift changes cost, speed, and reliability for teams shipping real systems, not just demos.',
      4200,
    );
    const shortBody = repeatToLength(
      'This smaller radar item covers a narrower but still concrete change worth tracking this week.',
      850,
    );
    const base = fixture('en');
    const template = base.stories[0]!;
    const stories: WeeklyPdfInput['stories'] = Array.from({ length: 7 }, (_, index) => ({
      ...template,
      rank: index + 1,
      title: `${template.title} ${index + 1}`,
      body: index < 3 ? longBody : shortBody,
    }));

    const pdf = await renderWeeklyDigestPdf({ ...base, stories });
    const document = await openWeeklyPdfPreview(pdf, 0.4);
    try {
      expect(document.length).toBeGreaterThanOrEqual(10);
      expect(document.length).toBeLessThanOrEqual(16);
    } finally {
      await document.destroy();
    }
  });

  it('can rasterize generated pages for the private admin preview', async () => {
    const bytes = await renderWeeklyDigestPdf(fixture('uk'));
    const document = await openWeeklyPdfPreview(bytes, 0.4);
    try {
      expect(document.length).toBeGreaterThanOrEqual(7);
      const firstPage = await document.getPage(1);
      expect(firstPage.subarray(1, 4).toString()).toBe('PNG');
      expect(firstPage.length).toBeGreaterThan(4_000);
    } finally {
      await document.destroy();
    }
  });
});
