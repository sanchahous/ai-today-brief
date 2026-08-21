import type { Lang } from '@/lib/site';

export const WEEKLY_COPY: Record<
  Lang,
  {
    eyebrow: string;
    allDigests: string;
    contents: string;
    editorNote: string;
    keyTakeaways: string;
    actionBoardEyebrow: string;
    actionBoard: string;
    actionBoardNote: string;
    actionBoardJump: string;
    why: string;
    practical: string;
    takeaway: string;
    limitation: string;
    editorsView: string;
    editorsViewNote: string;
    discuss: string;
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
    actionBoardEyebrow: 'Start here',
    actionBoard: 'What to put to work this week',
    actionBoardNote:
      'Concrete moves from this issue — the tool, the step, and what it costs you.',
    actionBoardJump: 'Read the story',
    why: 'Why it matters',
    practical: 'Practical example',
    takeaway: 'The takeaway',
    limitation: 'Limitation',
    editorsView: "Editor's view",
    editorsViewNote: 'Our read — not established by the sources above.',
    discuss: 'Worth discussing',
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
    actionBoardEyebrow: 'Почніть звідси',
    actionBoard: 'Що взяти в роботу цього тижня',
    actionBoardNote:
      'Конкретні кроки з цього випуску — інструмент, дія і чого вона вартує.',
    actionBoardJump: 'Читати історію',
    why: 'Чому це важливо',
    practical: 'Практичний приклад',
    takeaway: 'Головний висновок',
    limitation: 'Обмеження',
    editorsView: 'Погляд редакції',
    editorsViewNote: 'Наша думка — не підтверджена джерелами вище.',
    discuss: 'Варто подискутувати',
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
