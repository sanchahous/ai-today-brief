import type { Lang } from '@/lib/site';

type VisualCopy = {
  comparisonTitle: string;
  metricsTitle: string;
  keyNumbersTitle: string;
  processTitle: string;
  sourceWord: string;
  processFromActions: string;
  chartNote: string;
  keyNumbersNote: string;
};

const COPY: Record<Lang, VisualCopy> = {
  en: {
    comparisonTitle: 'Comparison',
    metricsTitle: 'Metric chart',
    keyNumbersTitle: 'Key numbers',
    processTitle: 'How it works',
    sourceWord: 'Source',
    processFromActions: 'Step names are taken from What to do today.',
    chartNote: 'The chart compares only values that share a unit. Each figure is copied from the story.',
    keyNumbersNote: 'Each figure is copied from the story.',
  },
  uk: {
    comparisonTitle: 'Порівняння',
    metricsTitle: 'Міні-графік метрик',
    keyNumbersTitle: 'Ключові числа',
    processTitle: 'Як це працює',
    sourceWord: 'Джерело',
    processFromActions: 'Назви кроків узяті з блоку «Що зробити сьогодні».',
    chartNote:
      'Графік порівнює лише значення з однаковою одиницею. Кожне число скопійоване з історії.',
    keyNumbersNote: 'Кожне число скопійоване з історії.',
  },
};

export function visualCopy(lang: Lang): VisualCopy {
  return COPY[lang];
}

export function sourceLine(lang: Lang, sourceName: string, labels: string[]): string {
  const copy = visualCopy(lang);
  return `${copy.sourceWord}: ${sourceName} — ${labels.join(', ')}`;
}

export function valuesDescription(
  lang: Lang,
  sourceName: string,
  items: ReadonlyArray<{ label: string; display: string }>,
  note: string,
): string {
  const copy = visualCopy(lang);
  const pairs = items.map((item) => `${item.label}: ${item.display}`).join('. ');
  return `${copy.sourceWord}: ${sourceName}. ${pairs}. ${note}`;
}
