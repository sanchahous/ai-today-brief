/**
 * Prototype UI strings + SEO copy (Senior content writer deliverable).
 *
 * Split from data.ts so the post/category *content* stays separate from
 * the *chrome* (labels, hero, SEO blocks). Keys extend the production
 * i18n set (src/i18n/strings.ts) where it makes sense.
 */
import type { Lang } from './data';

type Dict = Record<string, string>;

export const T: Record<Lang, Dict> = {
  uk: {
    // ── chrome ──
    siteName: 'AI Brief',
    tagline: 'Топ AI-новин для розробників — щодня',
    navHome: 'Головна',
    navNews: 'Усі новини',
    navCategories: 'Категорії',
    skipToContent: 'Перейти до вмісту',
    langSwitch: 'EN',
    themeToggle: 'Змінити тему',

    // ── home hero / product description (SEO) ──
    heroEyebrow: 'Щоденний AI-дайджест',
    heroTitle: 'Уся AI-індустрія за 5 хвилин на день — без шуму',
    heroSubtitle:
      'Ми читаємо сотні джерел, відкидаємо хайп і залишаємо лише те, що змінює вашу роботу: релізи інструментів, агенти, дослідження та практичні гайди. Українською та англійською.',
    heroStatStories: 'новин на тиждень',
    heroStatSources: 'джерел',
    heroStatCategories: 'категорій',
    heroCtaPrimary: 'Усі новини',
    heroCtaSecondary: 'Топ тижня',

    // ── search block ──
    searchTitle: 'Знайдіть те, що цікавить',
    searchPlaceholder: 'Пошук за інструментом, темою або джерелом…',
    searchAria: 'Пошук новин',
    searchButton: 'Шукати',
    searchPopular: 'Популярне:',
    searchHeaderPlaceholder: 'Пошук новин…',
    openSearch: 'Відкрити пошук',
    closeSearch: 'Закрити пошук',
    searchNoResults: 'Нічого не знайдено',
    seeAll: 'Усі результати ({n})',
    menu: 'Меню',
    closeMenu: 'Закрити меню',
    subtopicsLabel: 'Підтеми',

    // ── categories block ──
    categoriesEyebrow: 'Теми',
    categoriesTitle: 'Топ-6 категорій',
    categoriesSubtitle: 'Оберіть напрям — кожна категорія оновлюється щодня.',
    categoryCta: 'До категорії',
    categoryArticles: 'матеріалів',
    categoryLatest: 'Свіже в категорії',

    // ── top of the week ──
    weekEyebrow: 'Редакційний вибір',
    weekTitle: 'Топ новини тижня',
    weekSubtitle: 'Найважливіше, що сталося в AI за останні 7 днів.',
    weekCta: 'Переглянути всі новини',
    featured: 'Головна новина',

    // ── video teaser (provisioned) ──
    videoEyebrow: 'Скоро',
    videoTitle: 'Відеоогляди тижня',
    videoSubtitle:
      'Щотижневий 10-хвилинний відеодайджест найважливіших подій. Підпишіться, щоб не пропустити запуск.',
    videoCta: 'Сповістити про запуск',

    // ── all-news page ──
    newsTitle: 'Усі новини',
    newsLead:
      'Повний архів AI-новин з пошуком, фільтрами та сортуванням. Кожен матеріал — з аналізом «чому це важливо» й ключовими висновками.',
    summaryTitle: 'Зведення останніх подій',
    resultsCount: 'Знайдено матеріалів:',
    sortLabel: 'Сортування',
    sortNewest: 'Найновіші',
    sortOldest: 'Найстаріші',
    sortRelevance: 'За релевантністю',
    sortDiscussed: 'Найбільш обговорювані',
    filters: 'Фільтри',
    filterCategories: 'Категорії',
    filterDate: 'Період',
    filterReset: 'Скинути все',
    applyFilters: 'Застосувати',
    'date.today': 'Сьогодні',
    'date.week': 'Тиждень',
    'date.month': 'Місяць',
    'date.all': 'Весь час',

    // ── post card ──
    readMin: 'хв читання',
    readMore: 'Розгорнути аналіз',
    readLess: 'Згорнути',
    openFull: 'Відкрити повністю',
    whyMatters: 'Чому це важливо',
    keyTakeaways: 'Ключові висновки',
    save: 'Зберегти',
    saved: 'Збережено',
    share: 'Поділитися',
    comments: 'Коментарі',
    watchVideo: 'Відеоогляд',
    soon: 'скоро',
    shareOnX: 'Поділитися в X',
    shareOnLinkedin: 'Поділитися в LinkedIn',
    copyLink: 'Скопіювати лінк',
    copied: 'Скопійовано ✓',

    // ── pagination ──
    prev: 'Назад',
    next: 'Далі',
    page: 'Сторінка',

    // ── states ──
    loading: 'Завантаження…',
    emptyTitle: 'Нічого не знайдено',
    emptyBody: 'Спробуйте ширший запит або скиньте фільтри.',

    // ── footer ──
    footerTagline: 'Щоденний AI-дайджест для розробників',
    footerRights: 'Усі права захищено',

    // ── FEATURE F1 — email digest subscription ──
    subEyebrow: 'Email-дайджест',
    subTitle: 'Головне про AI — щоранку на пошту',
    subBody: 'Один лист на день: топ новини з аналізом. Без спаму, відписка в один клік.',
    subPlaceholder: 'your@email.com',
    subButton: 'Підписатися',
    subProof: 'розробників вже читають',
    subDone: 'Готово! Перевірте пошту, щоб підтвердити підписку.',
    subPrivacy: 'Підписуючись, ви погоджуєтесь з політикою конфіденційності.',
    subReferral: 'Запросіть друга — і відкрийте архів deep-dive за минулі місяці.',

    // ── FEATURE F2 — native sponsor ──
    sponsorLabel: 'Партнерський матеріал',
    sponsorWhy: 'Чому я це бачу?',

    // ── FEATURE F3 — SEO FAQ ──
    faqEyebrow: 'FAQ',
    faqTitle: 'Часті запитання',
    faqSubtitle: 'Коротко про те, як працює AI Brief.',

    // ── FEATURE F4 — trending topics ──
    trendingEyebrow: 'Тренди',
    trendingTitle: 'Гарячі теми тижня',
    trendingSubtitle:
      'Найбільш згадувані інструменти й концепти. Натисніть, щоб зібрати всі матеріали.',
    trendingSidebar: 'Популярні теми',
    mentions: 'згадок',

    // ── FEATURE F5 — saved stories ──
    savedTitle: 'Збережене',
    savedOpen: 'Збережене',
    savedEmpty: 'Поки нічого не збережено. Тисніть «Зберегти» на будь-якій новині.',
    savedRemove: 'Прибрати',
    savedCount: 'збережено',

    // ── FEATURE F6 — structured data / E-E-A-T ──
    breadcrumbHome: 'Головна',
    updated: 'Оновлено',
    curatedBy: 'Куратор',
    bylineRole: 'AI Product Engineer',
    bylineTrust: 'Перевірено редактором · джерела вказані',

    // ── prototype toolbar ──
    protoLabel: 'Прототип',
    protoHome: 'Головна',
    protoNews: 'Усі новини',
    protoLoading: 'Показати завантаження',
    protoFeatures: 'Підсвітити фічі',
    protoScreen: 'Екран',
    protoResetConsent: 'Скинути cookie-згоду',
    protoRegion: 'Регіон',

    // ── header / nav additions ──
    navAbout: 'Про нас',
    subscribeCta: 'Підписатися',

    // ── footer ──
    footerProduct: 'Продукт',
    footerCompany: 'Компанія',
    footerLegalCol: 'Правове',
    footerConcepts: 'Концепти',
    footerAbout: 'Про нас',
    footerAdvertise: 'Реклама',
    footerPrivacy: 'Приватність',
    footerTerms: 'Умови',
    footerAiDisclosure: 'AI-розкриття',
    footerCookie: 'Налаштування cookie',
    footerFollow: 'Стежте за нами',
    footerStatus: 'Статус',
    footerAiNote: 'Матеріали готує AI під наглядом людини-редактора. Джерела вказані.',

    // ── subscribe modal ──
    subSending: 'Підписуємо…',
    subErrorInvalid: 'Перевірте формат email-адреси.',
    subClose: 'Закрити',
    subSuccessTitle: 'Майже готово!',
    subTrustNoSpam: 'Один лист на день. Без спаму.',
    subTrustOptIn: 'Підтвердження через double opt-in.',
    subTrustUnsub: 'Відписка в один клік будь-коли.',

    // ── prototype navigator (toolbar groups + screen names) ──
    grpProduct: 'Продукт',
    grpTrust: 'Довіра / конверсія',
    grpLegal: 'Правове',
    grpSystem: 'Система',
    scHome: 'Головна',
    scNews: 'Усі новини',
    scItem: 'Стаття (перманлінк)',
    scBrief: 'Денний бриф',
    scCategory: 'Категорія',
    scConcept: 'Концепт-хаб',
    scSearch: 'Пошук',
    scSubscribe: 'Підписка (лендинг)',
    scAbout: 'Про нас / методологія',
    scAdvertise: 'Реклама / медіа-кіт',
    scPrivacy: 'Приватність',
    scTerms: 'Умови',
    scAiDisclosure: 'AI-розкриття',
    scDashboard: 'Live-статус',
    sc404: '404',

    // ── cookie-consent (CMP) ──
    cookieTitle: 'Ми поважаємо вашу приватність',
    cookieBodyEU:
      'Використовуємо cookies для аналітики, щоб покращувати продукт. Оберіть, що дозволити — технічні cookies потрібні завжди.',
    cookieBodyUA:
      'Технічні cookies потрібні для роботи сайту, аналітичні — лише за вашою згодою. Показуємо це для прозорості.',
    cookieAccept: 'Прийняти всі',
    cookieReject: 'Лише необхідні',
    cookieManage: 'Налаштувати',
    cookieSave: 'Зберегти вибір',
    cookieEssential: 'Необхідні',
    cookieEssentialDesc: 'Потрібні для базової роботи сайту. Не вимикаються.',
    cookieAnalytics: 'Аналітика',
    cookieAnalyticsDesc: 'Анонімна статистика відвідувань, щоб покращувати контент.',
    cookieAds: 'Маркетинг',
    cookieAdsDesc: 'Вимірювання ефективності промо. За замовчуванням вимкнено.',
    cookiePolicy: 'Політика приватності',
    cookieRegionNote: 'Демо-регіон',

    // ── AI-disclosure inline note ──
    aiNoteLabel: 'AI-чернетка · перевірено редактором',
    aiNoteLink: 'Як ми використовуємо AI',

    // ── subscribe landing ──
    subLandTitle: 'Головне про AI — щоранку на пошту, за 5 хвилин',
    subLandLead:
      'Приєднуйтесь до 24 800+ розробників, які починають день з AI Brief. Один лист, нуль шуму, відписка в один клік.',
    subLandWhatTitle: 'Що ви отримаєте',
    subLandSampleTitle: 'Приклад випуску',
    subLandSampleLead: 'Ось що було в брифі цього тижня:',
    subLandFaqTitle: 'Поширені запитання',

    // ── about / methodology ──
    aboutEyebrow: 'Про проєкт',
    aboutTitle: 'Як ми робимо AI Brief',
    aboutHowTitle: 'Як це працює',
    aboutSourcesTitle: 'Звідки беремо новини',
    aboutDisclosureTitle: 'Прозорість щодо AI',
    aboutDisclosureCta: 'Повна AI-політика',
    aboutWhoTitle: 'Хто за цим стоїть',
    aboutWhoBody:
      'Проєкт курує Oleksandr Kuzmenko, AI Product Engineer. Редакційні рішення й фінальна вичитка завжди за людиною.',
    aboutContactTitle: 'Зв’язок',
    aboutContactBody: 'Питання, виправлення чи пропозиція партнерства? Напишіть нам.',
    aboutContactCta: 'Написати',

    // ── legal + 404 ──
    legalUpdated: 'Оновлено',
    legalToc: 'Зміст',
    legalLawyerWarn:
      'Це шаблон, а не юридична консультація. Поля у [квадратних дужках] потрібно заповнити, а весь текст — погодити з юристом перед публікацією.',
    notFoundTitle: 'Сторінку не знайдено',
    notFoundBody:
      'Можливо, посилання застаріло або сторінку перенесено. Спробуйте пошук або поверніться на головну.',

    // ── item / brief / concept / search ──
    itemSource: 'Першоджерело',
    itemRelated: 'Схожі матеріали',
    briefItemsLabel: 'У цьому випуску',
    conceptStories: 'Матеріали по темі',
    conceptOther: 'Інші концепти',
    searchTitlePage: 'Пошук',
    searchResultsFor: 'Результати для',

    // ── advertise / media kit ──
    advEyebrow: 'Спонсорам',
    advTitle: 'Розкажіть про свій продукт нашій аудиторії',
    advLead:
      'AI Brief читають тисячі розробників і tech-лідів щодня. Нативні, чесно позначені розміщення з прозорою звітністю.',
    advAudience: 'Аудиторія',
    advInventory: 'Інвентар розміщень',
    advWhy: 'Чому AI Brief',
    advContactBody: 'Напишіть нам — надішлемо повний медіа-кіт зі ставками й доступними датами.',
    advContactCta: 'Запросити медіа-кіт',

    // ── sponsor "why am I seeing this?" popover ──
    sponsorWhyTitle: 'Чому ви це бачите?',
    sponsorWhyBody:
      'Це нативне партнерське розміщення, чесно позначене. Воно допомагає тримати AI Brief безкоштовним.',
    sponsorWhyCta: 'Про рекламу',

    // ── live-status dashboard ──
    dashTitle: 'Live-статус проєкту',
    dashLead:
      'Технічне здоров’я системи в реальному часі — продуктивність, навантаження БД, пайплайн і розсилки. Це не аналітика аудиторії (GA4 окремо).',
    dashNote: 'Дизайн-прототип. Значення тут — приклади; справжні джерела даних — у списку внизу.',
    dashCwv: 'Core Web Vitals',
    dashLighthouse: 'Lighthouse (mobile)',
    dashDbLoad: 'Навантаження Supabase',
    dashDbTables: 'Таблиці',
    dashHealth: 'Здоров’я системи',
    dashSources: 'Джерела даних',
    dashTarget: 'ціль',
    dashRows: 'рядків',
  },
  en: {
    siteName: 'AI Brief',
    tagline: 'Top AI news for developers — every day',
    navHome: 'Home',
    navNews: 'All news',
    navCategories: 'Categories',
    skipToContent: 'Skip to content',
    langSwitch: 'UA',
    themeToggle: 'Toggle theme',

    heroEyebrow: 'Daily AI digest',
    heroTitle: 'The whole AI industry in 5 minutes a day — no noise',
    heroSubtitle:
      'We read hundreds of sources, drop the hype, and keep only what changes how you work: tool releases, agents, research and practical guides. In Ukrainian and English.',
    heroStatStories: 'stories / week',
    heroStatSources: 'sources',
    heroStatCategories: 'categories',
    heroCtaPrimary: 'Browse all news',
    heroCtaSecondary: 'Top of the week',

    searchTitle: 'Find what you need',
    searchPlaceholder: 'Search by tool, topic or source…',
    searchAria: 'Search news',
    searchButton: 'Search',
    searchPopular: 'Popular:',
    searchHeaderPlaceholder: 'Search news…',
    openSearch: 'Open search',
    closeSearch: 'Close search',
    searchNoResults: 'No matches',
    seeAll: 'See all results ({n})',
    menu: 'Menu',
    closeMenu: 'Close menu',
    subtopicsLabel: 'Subtopics',

    categoriesEyebrow: 'Topics',
    categoriesTitle: 'Top 6 categories',
    categoriesSubtitle: 'Pick a direction — every category updates daily.',
    categoryCta: 'Open category',
    categoryArticles: 'articles',
    categoryLatest: 'Latest in this category',

    weekEyebrow: 'Editor’s pick',
    weekTitle: 'Top news of the week',
    weekSubtitle: 'The most important things that happened in AI over the last 7 days.',
    weekCta: 'Browse all news',
    featured: 'Lead story',

    videoEyebrow: 'Coming soon',
    videoTitle: 'Weekly video reviews',
    videoSubtitle:
      'A weekly 10-minute video digest of what mattered most. Subscribe so you don’t miss the launch.',
    videoCta: 'Notify me at launch',

    newsTitle: 'All news',
    newsLead:
      'The full AI-news archive with search, filters and sorting. Every story ships with a “why it matters” analysis and key takeaways.',
    summaryTitle: 'This week at a glance',
    resultsCount: 'Stories found:',
    sortLabel: 'Sort',
    sortNewest: 'Newest',
    sortOldest: 'Oldest',
    sortRelevance: 'Most relevant',
    sortDiscussed: 'Most discussed',
    filters: 'Filters',
    filterCategories: 'Categories',
    filterDate: 'Period',
    filterReset: 'Reset all',
    applyFilters: 'Apply',
    'date.today': 'Today',
    'date.week': 'Week',
    'date.month': 'Month',
    'date.all': 'All time',

    readMin: 'min read',
    readMore: 'Read deep dive',
    readLess: 'Show less',
    openFull: 'Open full story',
    whyMatters: 'Why it matters',
    keyTakeaways: 'Key takeaways',
    save: 'Save',
    saved: 'Saved',
    share: 'Share',
    comments: 'Comments',
    watchVideo: 'Video review',
    soon: 'soon',
    shareOnX: 'Share on X',
    shareOnLinkedin: 'Share on LinkedIn',
    copyLink: 'Copy link',
    copied: 'Copied ✓',

    prev: 'Prev',
    next: 'Next',
    page: 'Page',

    loading: 'Loading…',
    emptyTitle: 'Nothing found',
    emptyBody: 'Try a broader query or reset the filters.',

    footerTagline: 'A daily AI digest for developers',
    footerRights: 'All rights reserved',

    // ── FEATURE F1 — email digest subscription ──
    subEyebrow: 'Email digest',
    subTitle: 'The best of AI — in your inbox each morning',
    subBody: 'One email a day: top stories with analysis. No spam, one-click unsubscribe.',
    subPlaceholder: 'your@email.com',
    subButton: 'Subscribe',
    subProof: 'developers already read it',
    subDone: 'Done! Check your inbox to confirm your subscription.',
    subPrivacy: 'By subscribing you agree to the privacy policy.',
    subReferral: 'Refer a friend to unlock the deep-dive archive from past months.',

    // ── FEATURE F2 — native sponsor ──
    sponsorLabel: 'Sponsored',
    sponsorWhy: 'Why am I seeing this?',

    // ── FEATURE F3 — SEO FAQ ──
    faqEyebrow: 'FAQ',
    faqTitle: 'Frequently asked questions',
    faqSubtitle: 'A quick primer on how AI Brief works.',

    // ── FEATURE F4 — trending topics ──
    trendingEyebrow: 'Trending',
    trendingTitle: 'Hot topics this week',
    trendingSubtitle: 'The most-mentioned tools and concepts. Tap one to gather every story.',
    trendingSidebar: 'Popular topics',
    mentions: 'mentions',

    // ── FEATURE F5 — saved stories ──
    savedTitle: 'Saved',
    savedOpen: 'Saved',
    savedEmpty: 'Nothing saved yet. Hit “Save” on any story.',
    savedRemove: 'Remove',
    savedCount: 'saved',

    // ── FEATURE F6 — structured data / E-E-A-T ──
    breadcrumbHome: 'Home',
    updated: 'Updated',
    curatedBy: 'Curated by',
    bylineRole: 'AI Product Engineer',
    bylineTrust: 'Editor-reviewed · sources cited',

    protoLabel: 'Prototype',
    protoHome: 'Home',
    protoNews: 'All news',
    protoLoading: 'Show loading',
    protoFeatures: 'Highlight features',
    protoScreen: 'Screen',
    protoResetConsent: 'Reset cookie consent',
    protoRegion: 'Region',

    // ── header / nav additions ──
    navAbout: 'About',
    subscribeCta: 'Subscribe',

    // ── footer ──
    footerProduct: 'Product',
    footerCompany: 'Company',
    footerLegalCol: 'Legal',
    footerConcepts: 'Concepts',
    footerAbout: 'About',
    footerAdvertise: 'Advertise',
    footerPrivacy: 'Privacy',
    footerTerms: 'Terms',
    footerAiDisclosure: 'AI disclosure',
    footerCookie: 'Cookie settings',
    footerFollow: 'Follow us',
    footerStatus: 'Status',
    footerAiNote: 'Content is AI-assisted under human editorial review. Sources are cited.',

    // ── subscribe modal ──
    subSending: 'Subscribing…',
    subErrorInvalid: 'Please check the email format.',
    subClose: 'Close',
    subSuccessTitle: 'Almost there!',
    subTrustNoSpam: 'One email a day. No spam.',
    subTrustOptIn: 'Confirmed via double opt-in.',
    subTrustUnsub: 'One-click unsubscribe anytime.',

    // ── prototype navigator (toolbar groups + screen names) ──
    grpProduct: 'Product',
    grpTrust: 'Trust / conversion',
    grpLegal: 'Legal',
    grpSystem: 'System',
    scHome: 'Home',
    scNews: 'All news',
    scItem: 'Story (permalink)',
    scBrief: 'Daily brief',
    scCategory: 'Category',
    scConcept: 'Concept hub',
    scSearch: 'Search',
    scSubscribe: 'Subscribe (landing)',
    scAbout: 'About / methodology',
    scAdvertise: 'Advertise / media kit',
    scPrivacy: 'Privacy',
    scTerms: 'Terms',
    scAiDisclosure: 'AI disclosure',
    scDashboard: 'Live status',
    sc404: '404',

    // ── cookie-consent (CMP) ──
    cookieTitle: 'We respect your privacy',
    cookieBodyEU:
      'We use cookies for analytics to improve the product. Choose what to allow — essential cookies are always on.',
    cookieBodyUA:
      'Essential cookies keep the site working; analytics cookies run only with your consent. Shown here for transparency.',
    cookieAccept: 'Accept all',
    cookieReject: 'Essential only',
    cookieManage: 'Customise',
    cookieSave: 'Save choices',
    cookieEssential: 'Essential',
    cookieEssentialDesc: 'Required for the site to work. Always on.',
    cookieAnalytics: 'Analytics',
    cookieAnalyticsDesc: 'Anonymous visit stats so we can improve the content.',
    cookieAds: 'Marketing',
    cookieAdsDesc: 'Measuring promo performance. Off by default.',
    cookiePolicy: 'Privacy policy',
    cookieRegionNote: 'Demo region',

    // ── AI-disclosure inline note ──
    aiNoteLabel: 'AI draft · editor-reviewed',
    aiNoteLink: 'How we use AI',

    // ── subscribe landing ──
    subLandTitle: 'The best of AI — in your inbox each morning, in 5 minutes',
    subLandLead:
      'Join 24,800+ developers who start the day with AI Brief. One email, zero noise, one-click unsubscribe.',
    subLandWhatTitle: 'What you get',
    subLandSampleTitle: 'A sample issue',
    subLandSampleLead: 'Here’s what made this week’s brief:',
    subLandFaqTitle: 'Frequently asked questions',

    // ── about / methodology ──
    aboutEyebrow: 'About',
    aboutTitle: 'How we make AI Brief',
    aboutHowTitle: 'How it works',
    aboutSourcesTitle: 'Where the news comes from',
    aboutDisclosureTitle: 'AI transparency',
    aboutDisclosureCta: 'Full AI policy',
    aboutWhoTitle: 'Who’s behind it',
    aboutWhoBody:
      'The project is curated by Oleksandr Kuzmenko, AI Product Engineer. Editorial decisions and the final edit are always human.',
    aboutContactTitle: 'Contact',
    aboutContactBody: 'A question, a correction or a partnership idea? Get in touch.',
    aboutContactCta: 'Email us',

    // ── legal + 404 ──
    legalUpdated: 'Updated',
    legalToc: 'Contents',
    legalLawyerWarn:
      'This is a template, not legal advice. Fields in [square brackets] must be filled in and the whole text reviewed by a lawyer before publishing.',
    notFoundTitle: 'Page not found',
    notFoundBody:
      'The link may be outdated or the page moved. Try a search or head back to the home page.',

    // ── item / brief / concept / search ──
    itemSource: 'Primary source',
    itemRelated: 'Related stories',
    briefItemsLabel: 'In this issue',
    conceptStories: 'Stories on this topic',
    conceptOther: 'Other concepts',
    searchTitlePage: 'Search',
    searchResultsFor: 'Results for',

    // ── advertise / media kit ──
    advEyebrow: 'For sponsors',
    advTitle: 'Put your product in front of our audience',
    advLead:
      'AI Brief is read by thousands of developers and tech leads every day. Native, clearly disclosed placements with transparent reporting.',
    advAudience: 'Audience',
    advInventory: 'Placement inventory',
    advWhy: 'Why AI Brief',
    advContactBody: 'Email us and we’ll send the full media kit with rates and available dates.',
    advContactCta: 'Request the media kit',

    // ── sponsor "why am I seeing this?" popover ──
    sponsorWhyTitle: 'Why are you seeing this?',
    sponsorWhyBody:
      'This is a native, clearly disclosed sponsorship. It helps keep AI Brief free.',
    sponsorWhyCta: 'About advertising',

    // ── live-status dashboard ──
    dashTitle: 'Project live status',
    dashLead:
      'Real-time technical health — performance, database load, pipeline and sends. This is not audience analytics (GA4 is separate).',
    dashNote: 'Design prototype. The values here are examples; the real data sources are listed at the bottom.',
    dashCwv: 'Core Web Vitals',
    dashLighthouse: 'Lighthouse (mobile)',
    dashDbLoad: 'Supabase load',
    dashDbTables: 'Tables',
    dashHealth: 'System health',
    dashSources: 'Data sources',
    dashTarget: 'target',
    dashRows: 'rows',
  },
};

/** Popular search-query chips shown under the search box. */
export const POPULAR_QUERIES: Record<Lang, string[]> = {
  uk: ['Claude Code', 'MCP', 'prompt caching', 'агенти', 'RAG', 'Cursor'],
  en: ['Claude Code', 'MCP', 'prompt caching', 'agents', 'RAG', 'Cursor'],
};

/** Two-paragraph editorial summary for the All-news SEO block. */
export const WEEK_SUMMARY: Record<Lang, string[]> = {
  uk: [
    'Цього тижня в центрі уваги — інструменти для агентів: Claude Code запустив фонові агенти й нативний перегляд PR прямо в терміналі, а протокол MCP у версії 1.2 додав стрімінг ресурсів і гранулярну авторизацію. Разом це робить продакшн-агентів помітно безпечнішими й зручнішими.',
    'У дослідженнях головний сигнал — структурований пошук стабільно випереджає «довгий контекст» на реальних задачах, що підкріплює тренд на економну архітектуру: prompt caching у реальних кейсах зрізає рахунок за API на 70%+. Паралельно виходять практичні гайди — від збору власного агента для рев’ю коду до чесного розбору, коли файнтюн справді виправданий.',
  ],
  en: [
    'This week was all about agent tooling: Claude Code shipped background agents and a native PR review flow inside the terminal, while the MCP protocol v1.2 added resource streaming and granular authorization. Together they make production agents noticeably safer and easier to run.',
    'On the research side, the strongest signal is that structured retrieval consistently beats “long context” on real-world tasks — reinforcing the move toward economical architecture, with prompt caching cutting real API bills by 70%+. Alongside, the practical guides keep coming: from building your own code-review agent to an honest take on when fine-tuning actually pays off.',
  ],
};

export function makeT(lang: Lang) {
  return (key: string) => T[lang][key] ?? key;
}
