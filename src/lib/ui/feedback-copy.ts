import type { Lang } from '@/lib/site';

function assertCount(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

function locale(lang: Lang): 'en' | 'uk' {
  return lang === 'uk' ? 'uk' : 'en';
}

/** Honest “updated N hours ago” line. Callers pass the real age; 0 is “less than an hour”. */
export function updatedAgoLabel(hoursAgo: number, lang: Lang): string {
  assertCount(hoursAgo, 'hoursAgo');
  const when =
    hoursAgo === 0
      ? lang === 'uk'
        ? 'менш ніж годину тому'
        : 'less than an hour ago'
      : new Intl.RelativeTimeFormat(locale(lang), { numeric: 'always' }).format(-hoursAgo, 'hour');
  if (lang === 'uk') return `Оновлено ${when}. Нових матеріалів може бракувати.`;
  return `Updated ${when}. New stories may be missing.`;
}

function volumeWords(shown: number, lang: Lang): { latest: string; noun: string } {
  if (lang === 'uk') {
    const rule = new Intl.PluralRules('uk').select(shown);
    if (rule === 'one') return { latest: 'останній', noun: 'матеріал' };
    if (rule === 'few') return { latest: 'останні', noun: 'матеріали' };
    return { latest: 'останні', noun: 'матеріалів' };
  }
  return shown === 1
    ? { latest: 'latest', noun: 'story' }
    : { latest: 'latest', noun: 'stories' };
}

/** Honest cap: the number is the count actually shown, not a marketing floor. */
export function shownVolumeLabel(shown: number, lang: Lang): string {
  assertCount(shown, 'shown');
  const count = new Intl.NumberFormat(locale(lang)).format(shown);
  const words = volumeWords(shown, lang);
  if (lang === 'uk') {
    return `Показано ${words.latest} ${count} ${words.noun}. Давніші — через пошук.`;
  }
  return `Showing the ${words.latest} ${count} ${words.noun}. Older coverage: use search.`;
}
