import { describe, expect, it } from 'vitest';
import { openWeeklyPdfPreview } from './pdf-preview';
import { renderWeeklyLinkedInDocument } from './linkedin-document';

describe('renderWeeklyLinkedInDocument', () => {
  it('renders the approved master as a seven-page native document', async () => {
    const bytes = await renderWeeklyLinkedInDocument({
      title: 'The week AI agents moved from demos into dependable workflows',
      theme: 'Operational AI',
      standfirst:
        'The hard question is no longer whether agents can act, but whether teams can trust the result.',
      conclusion:
        'Pick one workflow with a measurable completion condition and test the operational boundary.',
      webUrl: 'https://aitodaybrief.com/en/weekly/example',
      keyTakeaways: ['Measure verified completion.', 'Keep a human escalation path.'],
      stories: Array.from({ length: 7 }, (_, index) => ({
        rank: index + 1,
        placement: index < 3 ? ('feature' as const) : ('radar' as const),
        headline: `A grounded development ${index + 1}`,
        hook: 'A builder discovered that reliability had become the real product boundary.',
        summary: 'A concise factual summary grounded in the approved master.',
        why: 'This changes the implementation decision for teams moving beyond a controlled demo.',
        takeaway: 'Require an observable completion condition before expanding the workflow.',
        sourceUrl: `https://example.com/source-${index + 1}`,
      })),
    });
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    const document = await openWeeklyPdfPreview(bytes, 0.25);
    try {
      expect(document.length).toBe(7);
    } finally {
      await document.destroy();
    }
  });

  it('keeps production-sized editorial copy inside the seven-page layout', async () => {
    const repeated = (value: string, count: number) =>
      Array.from({ length: count }, () => value).join(' ');
    const bytes = await renderWeeklyLinkedInDocument({
      title: repeated('Operational AI systems need recoverable generation boundaries', 2),
      theme: repeated('Durable workflows and accountable automation', 3),
      standfirst: repeated(
        'The approved weekly master can contain a long editorial standfirst that must remain inside the cover',
        11,
      ),
      conclusion: repeated(
        'Keep every automated handoff observable and preserve the last verified result',
        5,
      ),
      webUrl: 'https://aitodaybrief.com/en/weekly/production-sized-example',
      keyTakeaways: Array.from({ length: 5 }, (_, index) =>
        repeated(`Takeaway ${index + 1} defines a measurable operating decision`, 4),
      ),
      stories: Array.from({ length: 7 }, (_, index) => ({
        rank: index + 1,
        placement: index < 3 ? ('feature' as const) : ('radar' as const),
        headline: repeated(`Grounded development ${index + 1} changes the operating boundary`, 2),
        hook: repeated(
          'A builder found that reliability had become the actual product boundary',
          4,
        ),
        summary: repeated('A concise factual summary grounded in the approved weekly master', 4),
        why: repeated('This changes the implementation decision for teams moving beyond a demo', 4),
        takeaway: repeated(
          'Require an observable completion condition before expanding the workflow',
          4,
        ),
        sourceUrl:
          `https://evidence.example.com/research/${index + 1}/` +
          repeated('a-long-source-path-segment', 5).replaceAll(' ', '/'),
      })),
    });

    const document = await openWeeklyPdfPreview(bytes, 0.25);
    try {
      expect(document.length).toBe(7);
    } finally {
      await document.destroy();
    }
  });
});
