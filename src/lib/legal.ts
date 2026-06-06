/**
 * Legal copy: Privacy (GDPR-shaped), Terms, and an AI-disclosure aligned with
 * the EU AI Act art. 50 (applicable 2026-08-02).
 *
 * Operator / data controller: Oleksandr Kuzmenko (sole operator), contact
 * hello@sashakuzmenko.com. Plain-language wording for a solo-operated service;
 * keep current as processors or practices change.
 */
import type { Lang } from '@/lib/site';

type Bi = Record<Lang, string>;

export interface LegalSection {
  heading: Bi;
  body: Bi[];
}

export interface LegalDoc {
  title: Bi;
  /** ISO date — shown as "last updated". */
  updated: string;
  intro: Bi;
  sections: LegalSection[];
}

export type LegalKey = 'privacy' | 'terms' | 'ai-disclosure';

const PRIVACY: LegalDoc = {
  title: { uk: 'Політика приватності', en: 'Privacy Policy' },
  updated: '2026-06-01',
  intro: {
    uk: 'Ця політика пояснює, які персональні дані збирає AI Today Brief, з якою метою та як ви можете ними керувати. Контролер даних — Oleksandr Kuzmenko (одноосібний оператор сервісу). Контакт: hello@sashakuzmenko.com.',
    en: 'This policy explains what personal data AI Today Brief collects, why, and how you can control it. Data controller — Oleksandr Kuzmenko (sole operator of the service). Contact: hello@sashakuzmenko.com.',
  },
  sections: [
    {
      heading: { uk: 'Які дані ми збираємо', en: 'What we collect' },
      body: [
        {
          uk: 'Email-адреса та мова — коли ви підписуєтесь на дайджест. Технічні дані: знеособлена статистика відвідувань (за вашою згодою), країна за IP (без зберігання повної IP-адреси).',
          en: 'Email address and language — when you subscribe to the digest. Technical data: anonymised visit statistics (with your consent) and country derived from IP (we do not store the full IP).',
        },
      ],
    },
    {
      heading: { uk: 'Правова підстава (GDPR)', en: 'Legal basis (GDPR)' },
      body: [
        {
          uk: 'Email-розсилка — на підставі вашої згоди (ст. 6(1)(a) GDPR) із підтвердженням через double opt-in. Аналітика — на підставі згоди через банер cookie. Ви можете відкликати згоду будь-коли.',
          en: 'Email digest — on the basis of your consent (Art. 6(1)(a) GDPR), confirmed via double opt-in. Analytics — on the basis of consent given in the cookie banner. You may withdraw consent at any time.',
        },
      ],
    },
    {
      heading: { uk: 'Хто обробляє дані', en: 'Processors we use' },
      body: [
        {
          uk: 'Email — Beehiiv (розсилка дайджесту) і Resend (транзакційні листи). Аналітика — Google Analytics 4. Хостинг і база даних — Vercel і Supabase. З кожним постачальником діє угода про обробку даних (DPA).',
          en: 'Email — Beehiiv (digest) and Resend (transactional). Analytics — Google Analytics 4. Hosting and database — Vercel and Supabase. A data-processing agreement (DPA) is in place with each provider.',
        },
      ],
    },
    {
      heading: { uk: 'Ваші права', en: 'Your rights' },
      body: [
        {
          uk: 'Ви маєте право на доступ, виправлення, видалення, обмеження обробки, перенесення даних і заперечення проти обробки. Щоб скористатися ними, напишіть на hello@sashakuzmenko.com. Відписатися можна в один клік у будь-якому листі.',
          en: 'You have the right to access, rectify, erase, restrict, port your data and object to processing. To exercise them, email hello@sashakuzmenko.com. You can unsubscribe in one click from any email.',
        },
      ],
    },
    {
      heading: { uk: 'Cookies та зберігання', en: 'Cookies & retention' },
      body: [
        {
          uk: 'Технічні cookies необхідні для роботи сайту; аналітичні — лише за згодою (керується в «Налаштуваннях cookie» у футері). Дані підписки зберігаємо, доки підписка активна, і видаляємо протягом 30 днів після відписки.',
          en: 'Essential cookies are required for the site; analytics cookies run only with consent (managed via "Cookie settings" in the footer). We keep subscription data while the subscription is active and delete it within 30 days of unsubscribe.',
        },
      ],
    },
    {
      heading: { uk: 'Міжнародні передачі', en: 'International transfers' },
      body: [
        {
          uk: 'Деякі процесори розташовані за межами вашої країни. Такі передачі здійснюються на підставі стандартних договірних положень (SCC) або інших належних механізмів захисту відповідно до GDPR.',
          en: 'Some processors are located outside your country. Such transfers rely on Standard Contractual Clauses (SCCs) or other appropriate safeguards under the GDPR.',
        },
      ],
    },
  ],
};

const TERMS: LegalDoc = {
  title: { uk: 'Умови користування', en: 'Terms of Service' },
  updated: '2026-06-01',
  intro: {
    uk: 'Користуючись AI Today Brief, ви погоджуєтесь із цими умовами. Сервіс надає Oleksandr Kuzmenko. Якщо ви не згодні з умовами, будь ласка, не користуйтеся сайтом.',
    en: 'By using AI Today Brief you agree to these terms. The service is provided by Oleksandr Kuzmenko. If you do not agree, please do not use the site.',
  },
  sections: [
    {
      heading: { uk: 'Використання сервісу', en: 'Use of the service' },
      body: [
        {
          uk: 'AI Today Brief — інформаційний дайджест. Ви погоджуєтесь не зловживати сервісом, не намагатись зламати чи перевантажити його та не використовувати автоматичний збір даних без дозволу.',
          en: 'AI Today Brief is an informational digest. You agree not to abuse the service, attempt to break or overload it, or scrape it without permission.',
        },
      ],
    },
    {
      heading: { uk: 'Контент та інтелектуальна власність', en: 'Content & intellectual property' },
      body: [
        {
          uk: 'Резюме й аналіз готує редакція AI Today Brief; права на оригінальні матеріали належать їхнім авторам, і ми посилаємось на першоджерела. Не відтворюйте наш контент масово без посилання та дозволу.',
          en: 'Summaries and analysis are produced by the AI Today Brief editorial team; rights to the original works belong to their authors, and we link to primary sources. Do not reproduce our content at scale without attribution and permission.',
        },
      ],
    },
    {
      heading: { uk: 'AI-контент і відмова від гарантій', en: 'AI content & disclaimer' },
      body: [
        {
          uk: 'Частину матеріалів готує AI під наглядом редактора (див. AI-розкриття). Контент надається «як є», без гарантій точності. Це не професійна порада — перевіряйте критичну інформацію за першоджерелами.',
          en: 'Some content is AI-assisted under editorial review (see AI disclosure). Content is provided "as is" without warranty of accuracy. It is not professional advice — verify critical information against primary sources.',
        },
      ],
    },
    {
      heading: { uk: 'Обмеження відповідальності', en: 'Limitation of liability' },
      body: [
        {
          uk: 'У межах, дозволених законом, оператор не несе відповідальності за непрямі збитки, пов’язані з використанням сервісу.',
          en: 'To the extent permitted by law, the operator is not liable for indirect damages arising from use of the service.',
        },
      ],
    },
    {
      heading: { uk: 'Зміни та право, що застосовується', en: 'Changes & governing law' },
      body: [
        {
          uk: 'Ми можемо оновлювати ці умови; про суттєві зміни повідомимо на сайті. Ці умови регулюються застосовним законодавством Європейського Союзу, зокрема GDPR. Спори ми прагнемо вирішувати шляхом перемовин, а якщо це неможливо — у порядку, передбаченому застосовним законодавством.',
          en: 'We may update these terms; we will announce material changes on the site. These terms are governed by applicable European Union law, including the GDPR. We aim to resolve disputes through good-faith negotiation; failing that, under the applicable law.',
        },
      ],
    },
  ],
};

const AI_DISCLOSURE: LegalDoc = {
  title: { uk: 'Розкриття щодо AI', en: 'AI Disclosure' },
  updated: '2026-06-01',
  intro: {
    uk: 'Ми відкрито позначаємо участь штучного інтелекту у створенні контенту — і для людей, і машинозчитувано. Це відповідає духу EU AI Act (ст. 50, застосовується з 02.08.2026) і нашому принципу довіри.',
    en: 'We openly label AI involvement in our content — for humans and machine-readably. This aligns with the spirit of the EU AI Act (Art. 50, applicable 2026-08-02) and with our trust-first principle.',
  },
  sections: [
    {
      heading: { uk: 'Як ми використовуємо AI', en: 'How we use AI' },
      body: [
        {
          uk: 'Мовні моделі допомагають читати джерела, готувати чернетки резюме, блоків «чому це важливо» та перекладів EN↔UK. AI не ухвалює рішення «що публікувати» — це робить людина.',
          en: 'Language models help read sources and draft summaries, "why it matters" blocks and EN↔UK translations. AI does not decide "what to publish" — a human does.',
        },
      ],
    },
    {
      heading: { uk: 'Людський нагляд', en: 'Human oversight' },
      body: [
        {
          uk: 'Кожен бриф проходить редактора-людину перед публікацією: перевірка фактів, тон, відсів дублів. Відповідальність за опублікований матеріал несе редакція, а не модель.',
          en: 'Every brief passes a human editor before publishing: fact-checks, tone, de-duplication. The editorial team — not the model — is responsible for what is published.',
        },
      ],
    },
    {
      heading: { uk: 'Джерела й атрибуція', en: 'Sources & attribution' },
      body: [
        {
          uk: 'Кожна новина має посилання на першоджерело. Ми агрегуємо й пояснюємо, додаючи цінність (контекст, висновки), а не видаємо чужу роботу за власну.',
          en: 'Every story links to its primary source. We aggregate and explain, adding value (context, takeaways), rather than passing others’ work off as our own.',
        },
      ],
    },
    {
      heading: { uk: 'Машинозчитуване маркування', en: 'Machine-readable labelling' },
      body: [
        {
          uk: 'Сторінки несуть структуровані дані про участь AI; для згенерованих медіа плануємо метадані C2PA. Так платформи й answer-engine можуть коректно позначати наш контент.',
          en: 'Pages carry structured data about AI involvement; for any generated media we plan C2PA metadata. This lets platforms and answer engines label our content correctly.',
        },
      ],
    },
    {
      heading: { uk: 'Точність і виправлення', en: 'Accuracy & corrections' },
      body: [
        {
          uk: 'AI може помилятися. Помітили неточність — напишіть на hello@sashakuzmenko.com, і ми виправимо її та позначимо правку. Критичну інформацію завжди звіряйте з першоджерелом.',
          en: 'AI can make mistakes. Spotted an error? Email hello@sashakuzmenko.com and we’ll fix it and mark the correction. Always verify critical information against the primary source.',
        },
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalKey, LegalDoc> = {
  privacy: PRIVACY,
  terms: TERMS,
  'ai-disclosure': AI_DISCLOSURE,
};
