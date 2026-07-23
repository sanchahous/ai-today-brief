import type { Lang } from '@/lib/site';

export const WEEKLY_COPY: Record<
  Lang,
  {
    eyebrow: string;
    allDigests: string;
    contents: string;
    editorNote: string;
    keyTakeaways: string;
    why: string;
    practical: string;
    takeaway: string;
    source: string;
    watch: string;
    videoTitle: string;
    videoDescription: string;
    readFull: string;
    downloadPdf: string;
    previous: string;
    next: string;
    latestTitle: string;
    latestSubtitle: string;
    period: string;
  }
> = {
  en: {
    eyebrow: 'Weekly digest',
    allDigests: 'All digests',
    contents: 'In this issue',
    editorNote: 'Editor’s note',
    keyTakeaways: 'What to remember this week',
    why: 'Why it matters',
    practical: 'Practical example',
    takeaway: 'The takeaway',
    source: 'Primary source',
    watch: 'Watch the weekly briefing',
    videoTitle: 'This week in AI — video briefing',
    videoDescription: 'One concise briefing, with English audio and English or Ukrainian captions.',
    readFull: 'Read the full digest',
    downloadPdf: 'Download the English PDF',
    previous: 'Previous issue',
    next: 'Next issue',
    latestTitle: 'The weekly AI digest',
    latestSubtitle:
      'The most important shifts, with practical context for people who build with AI.',
    period: 'Week',
  },
  uk: {
    eyebrow: 'Тижневий дайджест',
    allDigests: 'Усі дайджести',
    contents: 'У цьому випуску',
    editorNote: 'Слово редактора',
    keyTakeaways: 'Що варто запам’ятати цього тижня',
    why: 'Чому це важливо',
    practical: 'Практичний приклад',
    takeaway: 'Головний висновок',
    source: 'Першоджерело',
    watch: 'Дивитися тижневий брифінг',
    videoTitle: 'Цей тиждень в AI — відеобрифінг',
    videoDescription:
      'Один стислий брифінг з англійською озвучкою та англійськими або українськими субтитрами.',
    readFull: 'Читати повний дайджест',
    downloadPdf: 'Завантажити український PDF',
    previous: 'Попередній випуск',
    next: 'Наступний випуск',
    latestTitle: 'Тижневий AI-дайджест',
    latestSubtitle: 'Найважливіші зміни тижня з практичним контекстом для тих, хто будує з AI.',
    period: 'Тиждень',
  },
};
