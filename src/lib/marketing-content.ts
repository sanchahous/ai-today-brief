import type { Lang } from '@/lib/site';
import type { IconKey } from '@/components/icons';

type Bi = Record<Lang, string>;

export interface SubscribeBenefit {
  icon: IconKey;
  title: Bi;
  body: Bi;
}

/** Subscribe landing value props (ported from prototype; no fabricated metrics). */
export const SUBSCRIBE_BENEFITS: SubscribeBenefit[] = [
  {
    icon: 'optimization',
    title: { uk: '5 хвилин замість годин', en: '5 minutes, not hours' },
    body: {
      uk: 'Один лист щоранку з топ-новинами та аналізом. Ми читаємо сотні джерел, щоб ви не мусили.',
      en: 'One email each morning with the top stories and analysis. We read hundreds of sources so you don’t have to.',
    },
  },
  {
    icon: 'tools',
    title: { uk: 'Сигнал, а не шум', en: 'Signal, not noise' },
    body: {
      uk: 'Лише те, що змінює вашу роботу: релізи інструментів, агенти, дослідження та практичні гайди.',
      en: 'Only what changes your work: tool releases, agents, research and practical guides.',
    },
  },
  {
    icon: 'career',
    title: { uk: 'Без спаму, повний контроль', en: 'No spam, full control' },
    body: {
      uk: 'Підтвердження через double opt-in, відписка в один клік, жодного продажу даних третім сторонам.',
      en: 'Double opt-in confirmation, one-click unsubscribe, and we never sell your data to third parties.',
    },
  },
];

export interface AudienceStat {
  value: string;
  label: Bi;
}

/** Media-kit audience highlights — qualitative, not fabricated list metrics. */
export const AUDIENCE_STATS: AudienceStat[] = [
  { value: 'Daily', label: { uk: 'Щоденний бриф', en: 'Daily brief' } },
  { value: 'EN · UK', label: { uk: 'Двомовні випуски', en: 'Bilingual editions' } },
  {
    value: 'Builders',
    label: { uk: 'Розробники й tech-ліди', en: 'Developers & tech leads' },
  },
  {
    value: 'Native',
    label: { uk: 'Чесно позначена реклама', en: 'Clearly disclosed ads' },
  },
];

export interface AdSlot {
  name: Bi;
  placement: Bi;
  note: Bi;
}

export const AD_INVENTORY: AdSlot[] = [
  {
    name: { uk: 'Основний спонсор розсилки', en: 'Primary newsletter sponsor' },
    placement: { uk: 'Email · над згином', en: 'Email · above the fold' },
    note: { uk: '1 на випуск · нативний блок із disclosure', en: '1 per issue · native, disclosed' },
  },
  {
    name: { uk: 'Deep-dive розміщення', en: 'Deep-dive placement' },
    placement: { uk: 'Email + сайт', en: 'Email + site' },
    note: { uk: 'Розгорнутий формат · 3–6× ставки', en: 'Long-form · 3–6× the primary rate' },
  },
  {
    name: { uk: 'Нативний слот у фіді', en: 'Native feed unit' },
    placement: { uk: 'Сайт · стрічка новин', en: 'Site · news feed' },
    note: { uk: 'Позначено «Партнерський», із трекінгом CTR', en: 'Labelled “Sponsored”, CTR-tracked' },
  },
  {
    name: { uk: 'Слот на сторінці матеріалу', en: 'Item-page slot' },
    placement: { uk: 'Сайт · перманлінк', en: 'Site · permalink' },
    note: { uk: 'Контекстне розміщення за темою', en: 'Contextual, by topic' },
  },
];

export const ADVERTISE_BENEFITS: Bi[] = [
  {
    uk: 'Залучена нішева аудиторія розробників і AI-практиків, а не випадковий трафік.',
    en: 'An engaged, niche audience of developers and AI practitioners — not random traffic.',
  },
  {
    uk: 'Нативні, чесно позначені розміщення, що не ламають досвід читання.',
    en: 'Native, clearly disclosed placements that don’t break the reading experience.',
  },
  {
    uk: 'Прозора звітність: реальні impressions і CTR із власної аналітики.',
    en: 'Transparent reporting: real impressions and CTR from our own analytics.',
  },
];
