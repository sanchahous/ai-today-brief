import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  renderWeeklyDigestPdf,
  type WeeklyPdfInput,
  type WeeklyPdfLocale,
} from '../src/lib/weekly-digest/pdf';

function sample(locale: WeeklyPdfLocale): WeeklyPdfInput {
  const uk = locale === 'uk';

  return {
    locale,
    issueLabel: uk ? 'Випуск 12' : 'Issue 12',
    title: uk ? 'Тиждень практичних AI-рішень' : 'The week in practical AI systems',
    intro: uk
      ? 'П’ять подій, які змінюють роботу розробників і продуктових команд.'
      : 'Five developments changing how builders and product teams work.',
    editorNote: uk
      ? 'Цього тижня головна тема — перехід від демонстрацій до надійних систем.'
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
      sourceName: 'Example source',
      sourceUrl: 'https://example.com/source',
      eventDate: '2026-07-21',
    })),
  };
}

async function main() {
  const outputDirectory = join(process.cwd(), 'tmp', 'pdfs');
  await mkdir(outputDirectory, { recursive: true });

  for (const locale of ['en', 'uk'] as const) {
    const pdf = await renderWeeklyDigestPdf(sample(locale));
    const outputPath = join(outputDirectory, `weekly-digest-${locale}.pdf`);
    await writeFile(outputPath, pdf);
    process.stdout.write(`${outputPath}\n`);
  }
}

void main();
