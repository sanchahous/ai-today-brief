import type { Lang } from '@/lib/site';

/**
 * Editorial home-landing content that isn't database-backed: the FAQ and the
 * demo sponsor unit. Both ship in EN + UK. The FAQ feeds visible copy and
 * FAQPage JSON-LD; the sponsor is a clearly-labelled native placeholder (real
 * placements arrive with the `sponsors` table post-launch).
 */

export interface Faq {
  q: Record<Lang, string>;
  a: Record<Lang, string>;
}

export const FAQS: Faq[] = [
  {
    q: { en: 'What is AI Today Brief?', uk: 'Що таке AI Today Brief?' },
    a: {
      en: 'AI Today Brief is a daily, human-edited digest of the most important AI-engineering news for people who build with AI. We read hundreds of sources, drop the hype, and present each story with a “why it matters” analysis and key takeaways.',
      uk: 'AI Today Brief — щоденний, відредагований людиною дайджест найважливіших новин AI-інженерії для тих, хто будує з AI. Ми читаємо сотні джерел, відкидаємо хайп і подаємо кожну новину з аналізом «чому це важливо» та ключовими висновками.',
    },
  },
  {
    q: { en: 'How often is it updated?', uk: 'Як часто оновлюється контент?' },
    a: {
      en: 'A new brief ships every day. The “All news” feed and the category pages update automatically as soon as the daily curation-and-analysis pipeline finishes.',
      uk: 'Новий бриф виходить щодня. Стрічка «Усі новини» та сторінки категорій оновлюються автоматично, щойно завершується щоденний пайплайн добору й аналізу.',
    },
  },
  {
    q: { en: 'Is it free?', uk: 'Це безкоштовно?' },
    a: {
      en: 'Yes — reading the brief and the archive is free. The email digest is free too; subscribe to get the highlights in your inbox each morning.',
      uk: 'Так, читання брифу та архіву безкоштовне. Email-дайджест теж безкоштовний — підпишіться, щоб отримувати головне на пошту щоранку.',
    },
  },
  {
    q: { en: 'Where do you source the news?', uk: 'Звідки ви берете новини?' },
    a: {
      en: 'From official lab and vendor blogs, GitHub releases, arXiv, tech media and developer communities. Every story links back to its primary source.',
      uk: 'З офіційних блогів лабораторій і вендорів, релізів на GitHub, arXiv, технічних медіа та профільних спільнот. Кожна новина має посилання на першоджерело.',
    },
  },
  {
    q: { en: 'Is it available in Ukrainian?', uk: 'Чи доступно українською?' },
    a: {
      en: 'Yes. Every story and analysis is available in Ukrainian and English — switch languages from the header in one click.',
      uk: 'Так. Кожна новина й аналіз доступні українською та англійською — перемкнути мову можна у шапці сайту в один клік.',
    },
  },
];

export interface Sponsor {
  brand: string;
  /** Brand colour — drives the native-unit tint. */
  color: string;
  tagline: Record<Lang, string>;
  body: Record<Lang, string>;
  cta: Record<Lang, string>;
  url: string;
}

export const SPONSOR: Sponsor = {
  brand: 'Vector DB',
  color: '#5BC9F0',
  tagline: { en: 'Postgres, built for AI', uk: 'Postgres, готовий до AI' },
  body: {
    en: 'Vector search, elastic scaling and a free tier for side-projects. Spin up a database for your RAG in 60 seconds.',
    uk: 'Векторний пошук, гнучке масштабування й безкоштовний tier для пет-проєктів. Розгорніть базу для свого RAG за 60 секунд.',
  },
  cta: { en: 'Try it free', uk: 'Спробувати безкоштовно' },
  url: 'https://example.com',
};
