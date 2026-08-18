import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  renderWeeklyDigestPdf,
  type WeeklyPdfInput,
  type WeeklyPdfLocale,
} from '../src/lib/weekly-digest/pdf';

// Lengths are taken from a real edition (Issue 4, 2026-08-09): a 108-character
// headline, a 1018-character standfirst, ~4.2k-character feature bodies. A
// short, tidy fixture hides exactly the overflow the layout has to survive.
function repeatToLength(unit: string, targetLength: number) {
  let out = '';
  while (out.length < targetLength) out += (out ? ' ' : '') + unit;
  const cut = out.slice(0, targetLength);
  return cut.slice(0, cut.lastIndexOf(' ') + 1).trim() || cut.trim();
}

function sample(locale: WeeklyPdfLocale): WeeklyPdfInput {
  const uk = locale === 'uk';

  return {
    locale,
    issueLabel: uk ? 'Випуск 4' : 'Issue 4',
    title: uk
      ? "Qwen3.8 з 95 мільярдами активних параметрів, дешевша агентна пам'ять IBM і чому китайські лабораторії тепер володіють дозвільним ліцензуванням"
      : "Qwen3.8's 95 Billion Active Parameters, IBM's Cheaper Agent Memory, and Why Chinese Labs Now Own Permissive Licensing",
    intro: repeatToLength(
      uk
        ? 'Alibaba відкрила Qwen3.8, і головне число тут не 2,4 трильйона параметрів, а 95 мільярдів активних на токен. Та сама інстинктивна ставка на ефективність видно і в інших релізах тижня.'
        : 'Alibaba open-sourced Qwen3.8 this week, and the headline number is almost a distraction. The number that matters is 95 billion: that is how many parameters actually fire per token. The same efficiency instinct shows up elsewhere this week.',
      1018,
    ),
    editorNote: uk
      ? 'Цей випуск синтезує первинні джерела — release notes Qwen3.8, опубліковані бенчмарки IBM Research і звіт Hugging Face — поряд з окремо позначеною редакційною аналітикою. Ми не проганяли ці бенчмарки самі.'
      : 'This edition synthesizes primary sources — Qwen3.8 release notes, IBM Research benchmarks, and the Hugging Face report — alongside separately labeled editorial analysis. We did not run these benchmarks ourselves.',
    weekStart: '2026-08-09',
    weekEnd: '2026-08-15',
    webUrl: `https://aitodaybrief.com/${locale}/weekly/ai-weekly-2026-08-09`,
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    keyTakeaways: Array.from({ length: 4 }, (_, index) =>
      repeatToLength(
        uk
          ? `Практичний висновок ${index + 1} для команд, які впроваджують AI у продакшн цього кварталу.`
          : `Practical takeaway ${index + 1} for teams shipping AI to production this quarter.`,
        150,
      ),
    ),
    stories: Array.from({ length: 7 }, (_, index) => {
      const feature = index < 3;
      return {
        rank: index + 1,
        title: uk
          ? `OpenAI розгортає надшвидкий режим для GPT-5.6 Sol і заявляє про 14-кратне прискорення на кремнії Cerebras ${index + 1}`
          : `OpenAI Rolls Out Ultrafast Mode for GPT-5.6 Sol, Claims 14X Speedup on Cerebras Silicon ${index + 1}`,
        summary: repeatToLength(
          uk
            ? 'Короткий доказовий підсумок події без перебільшень і з посиланням на першоджерело.'
            : 'A concise, evidence-backed summary of what shipped, without hype and with a primary source.',
          feature ? 320 : 420,
        ),
        body: repeatToLength(
          uk
            ? 'Повний контекст події пояснює, що саме змінилося, для кого це важливо та які обмеження варто врахувати командам.'
            : 'The full context explains what changed, who it affects, and which limitations teams should consider.',
          feature ? 4200 : 850,
        ),
        why: repeatToLength(
          uk
            ? 'Це змінює вартість, швидкість і надійність продуктового циклу для команд, що вже мають AI у проді.'
            : 'It changes cost, speed, and reliability across the product cycle for teams already running AI.',
          280,
        ),
        practical: repeatToLength(
          uk
            ? 'Команда може перевірити підхід у невеликому внутрішньому процесі перед production-впровадженням.'
            : 'A team can validate the approach in a small internal workflow before a production rollout.',
          300,
        ),
        takeaway: repeatToLength(
          uk
            ? 'Перевіряйте цінність на реальних задачах, а не на демонстраціях.'
            : 'Validate value on real workloads, not on demos.',
          180,
        ),
        limitation: repeatToLength(
          uk
            ? 'Дані описують лише один звітований випадок, а не універсальну поведінку системи.'
            : 'The data describes one reported case, not universal behavior.',
          190,
        ),
        sourceName: 'Example source',
        sourceUrl: 'https://example.com/source',
        eventDate: '2026-08-12',
      };
    }),
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
