import type { Lang } from '@/lib/site';
import type { IconKey } from '@/components/icons';

type Bi = Record<Lang, string>;

export interface SubscribeBenefit {
  icon: IconKey;
  title: Bi;
  body: Bi;
}

/** Subscribe landing value props (4 confirmed After Hours benefits). */
export const SUBSCRIBE_BENEFITS: SubscribeBenefit[] = [
  {
    icon: 'optimization',
    title: { uk: 'П’ять хвилин', en: 'Five minutes' },
    body: {
      uk: 'Скінченне читання — без нескінченної стрічки.',
      en: 'A finite read that ends — no infinite feed.',
    },
  },
  {
    icon: 'tutorials',
    title: { uk: 'Джерела в кожній історії', en: 'Sources on every story' },
    body: {
      uk: 'Першоджерела, а не скриншоти скриншотів.',
      en: 'Primary links, not screenshots of screenshots.',
    },
  },
  {
    icon: 'tools',
    title: { uk: 'Одна річ для практики', en: 'One thing to try' },
    body: {
      uk: 'Практичний крок того ж дня.',
      en: 'A practical step you can take the same day.',
    },
  },
  {
    icon: 'career',
    title: { uk: 'Тижнева перспектива', en: 'Weekly perspective' },
    body: {
      uk: 'Щопонеділка: тиждень у зв’язку, з action board.',
      en: 'Mondays: the week connected, with an action board.',
    },
  },
];

export interface SubscribeFaq {
  q: Bi;
  a: Bi;
}

/** Confirmed FAQ items for the subscribe page (verified schedule: daily + Monday weekly). */
export const SUBSCRIBE_FAQS: SubscribeFaq[] = [
  {
    q: { en: 'How often will I hear from you?', uk: 'Як часто ви пишете?' },
    a: {
      en: 'One daily email Monday–Saturday and the weekly edition on Mondays. You can pause either.',
      uk: 'Один лист щодня з понеділка по суботу і тижневик щопонеділка. Будь-який можна призупинити.',
    },
  },
  {
    q: { en: 'Is it really free?', uk: 'Це справді безкоштовно?' },
    a: {
      en: 'Yes. Sponsored placements keep it free and are always labelled.',
      uk: 'Так. Спонсорські розміщення тримають його безкоштовним і завжди позначені.',
    },
  },
  {
    q: { en: 'What if I subscribe twice?', uk: 'Що, як я підпишусь двічі?' },
    a: {
      en: 'Nothing breaks — we will just remind you that you are already on the list, without revealing anything to anyone else.',
      uk: 'Нічого не зламається — ми лише нагадаємо, що ви вже в списку, нічого не розкриваючи іншим.',
    },
  },
];

export interface AudienceStat {
  value: string;
  label: Bi;
}

/** Qualitative media-kit audience highlights (unverified numbers excluded per I-6). */
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
  exampleLabel: Bi;
}

/** Real sponsor inventory formats from After Hours prototype & configuration. */
export const AD_INVENTORY: AdSlot[] = [
  {
    name: { uk: 'Слот у щоденному брифі', en: 'Daily brief slot' },
    placement: { uk: 'Сайт і email', en: 'Web and email' },
    note: {
      uk: 'Одна позначена картка після третьої історії, сайт і email.',
      en: 'One labelled card after the third story, web and email.',
    },
    exampleLabel: { uk: 'Спонсорське · приклад', en: 'Sponsored · example' },
  },
  {
    name: { uk: 'Партнер тижневика', en: 'Weekly edition partner' },
    placement: { uk: 'Тижневий випуск', en: 'Weekly edition' },
    note: {
      uk: 'Рядок на обкладинці й картка перед action board.',
      en: 'A line on the cover and a card before the action board.',
    },
    exampleLabel: { uk: 'Спонсорське · приклад', en: 'Sponsored · example' },
  },
  {
    name: { uk: 'Спонсор Toolbox', en: 'Toolbox sponsor' },
    placement: { uk: 'Сторінка утиліти', en: 'Tool page' },
    note: {
      uk: 'Тиха згадка на сторінці утиліти протягом місяця.',
      en: 'A quiet mention on one tool page for a month.',
    },
    exampleLabel: { uk: 'Спонсорське · приклад', en: 'Sponsored · example' },
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
    uk: 'Прозора звітність: реальні покази і CTR із власної аналітики.',
    en: 'Transparent reporting: real impressions and CTR from our own analytics.',
  },
];
