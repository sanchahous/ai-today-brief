/**
 * Single source of truth for weekly-digest editorial voice: the positive
 * style model, few-shot exemplars, banned-phrase detectors and the rules for
 * the "editor's view" speculation block. Consumed by both the master writer
 * prompts (editorial-llm.ts) and the deterministic template-leak gate
 * (content-studio.ts) so the same house style is enforced wherever weekly
 * prose is written or checked. Bumping any exported constant here should be
 * paired with a WEEKLY_MASTER_SPEC_VERSION bump (content-studio.ts) so it
 * forces regeneration rather than silently drifting old and new voice.
 *
 * Every prior weekly prompt spent ~250 characters on voice against ~4,500 on
 * structural contract -- the model had no positive model of "good" to regress
 * to, so it fell back to the safest, most template-shaped register available.
 * This file exists to fix that ratio.
 */

export interface BannedPhraseRule {
  /** Stable id used in quality-report issue codes (`template_leak:${code}`). */
  code: string;
  pattern: RegExp;
  /** Shown to the writer/critic as the reason this span is disallowed. */
  message: string;
}

export const VOICE_EN = `You write the way a sharp, well-read colleague explains the week's most important AI story to another builder over coffee -- not the way a compliance memo summarizes an incident. Open with a concrete, source-supported fact, contrast, or documented moment. Never invent a scene, reaction, crash, chronology, quote, or character detail just to make the opening feel cinematic. If the evidence contains no real scene, lead with the strongest verified result and explain why it is surprising. Never open with an abstract thesis about "the tension" or "the operating model."

Vary your sentence length on purpose. A short sentence lands a fact. A longer one carries the reasoning that connects it to what came before. Name real actors doing real things -- "Anthropic's red team found," not "it was found that." Read every paragraph back and ask whether a person would keep reading, or whether it reads like a form that happened to use full sentences.

Show your own reasoning, not just the facts. Say plainly what surprised you, what still bothers you about it, or where you think this is heading -- that is the editorial judgment the reader is here for, not a neutral recap they could get from the source. A story is not four interchangeable slots (what/why/how/limits) stapled together; it has one throughline: what happened, why it is stranger or bigger than the headline suggests, and what you think it changes. The reader should feel a person thought about this, not that a template got filled in.`;

export const VOICE_UK = `Пишіть так, як розумний, начитаний колега розповідає іншому розробнику головну подію тижня за кавою -- а не так, як службова записка описує інцидент. Починайте з конкретного факту, контрасту або моменту, який прямо підтверджений джерелом. Не вигадуйте сцену, реакцію людини, збій, хронологію, цитату чи деталь персонажа заради кінематографічного відкриття. Якщо в доказах немає реальної сцени, почніть із найсильнішого перевіреного результату й поясніть, чому він дивує. Ніколи не починайте з абстрактної тези на кшталт «напруга очевидна» чи «операційна модель».

Свідомо чергуйте довжину речень. Коротке речення фіксує факт. Довше -- несе міркування, яке пов'язує цей факт із попереднім. Називайте реальних дійових осіб, які роблять реальні речі: «команда Anthropic виявила», а не «було виявлено». Перечитайте кожен абзац і запитайте: людина читатиме це далі, чи це читається як форма, яку заповнили повними реченнями.

Показуйте власне міркування, а не лише факти. Прямо скажіть, що вас здивувало, що досі непокоїть, або куди це, на вашу думку, веде -- саме заради цього редакційного судження читач тут, а не заради нейтрального переказу, який він міг би отримати з джерела. Історія -- це не чотири взаємозамінні слоти (що/чому/як/обмеження), зшиті докупи; в неї один наскрізний рух: що сталося, чому це дивніше чи масштабніше, ніж здається із заголовка, і що це, на вашу думку, змінює. Читач має відчути, що над цим думала людина, а не що заповнили шаблон.

Уникайте кальок з англійської та канцеляризмів: не «є ключовим», а конкретне дієслово; не «в рамках», а «під час» або «як частина»; не «забезпечує можливість», а «дозволяє» чи «дає змогу»; не «варто зазначити», просто скажіть це.`;

export interface VoiceExemplar {
  /**
   * Legacy full-length exemplar retained only for deterministic copy-leak
   * detection. It is deliberately NOT injected into writer prompts: the
   * first live v6 run copied it verbatim into the edition introduction.
   */
  opening: string;
}

export const EXEMPLAR_EN: VoiceExemplar = {
  opening: `STYLE REFERENCE ONLY -- a fictional illustration of the register, not this week's story. Do not reuse its facts, names or numbers.

The pull request looked routine: a one-line dependency bump, approved by a bot, merged before anyone's coffee finished brewing. Nobody on the team noticed that the new version of the package had shipped from a maintainer account that had changed hands eleven days earlier. By the time a security researcher flagged it, the code had already run in production for six days, quietly phoning home with every deploy's environment variables.

What makes this uncomfortable isn't the sophistication of the attack -- there wasn't much. It's that every gate this team had built was designed to catch a human making a mistake, not a supply chain that had already been compromised upstream. The bot did exactly what it was told to do. That's the part worth sitting with: automation didn't fail here. It succeeded, perfectly, at the wrong job.`,
};

export const EXEMPLAR_UK: VoiceExemplar = {
  opening: `ЛИШЕ СТИЛЬОВИЙ ЗРАЗОК -- вигадана ілюстрація регістру, не цьогорічна історія. Не використовуйте її факти, назви чи цифри.

Пул-реквест виглядав рутинним: оновлення залежності на один рядок, схвалене ботом, змерджене ще до того, як хтось встиг доп'ити каву. Ніхто в команді не помітив, що новий пакет прийшов з акаунту мейнтейнера, який змінив власника одинадцять днів тому. Коли дослідник безпеки нарешті це помітив, код уже шість днів пропрацював у проді, тихо відправляючи кудись змінні середовища з кожного деплою.

Незручність тут не в складності атаки -- складності майже й не було. Незручність у тому, що всі бар'єри, які збудувала команда, ловили людську помилку, а не ланцюжок постачання, скомпрометований ще до того, як код до них дійшов. Бот зробив рівно те, що мав робити. Ось про що варто подумати: автоматизація тут не підвела. Вона ідеально впоралася не з тим завданням.`,
};

export interface ContrastPair {
  bad: string;
  good: string;
  note: string;
}

export const CONTRAST_PAIRS_EN: ContrastPair[] = [
  {
    bad: 'For product and security leaders, the tension is clear: realism can make a genuine target believable if isolation is incomplete.',
    good: "Here's the uncomfortable part: the more realistic a hacking simulation gets, the more it starts looking like a real target -- and this time, the model couldn't tell the difference.",
    note: 'Drop the leader-briefing frame and the abstract noun "tension"; open on the concrete, surprising fact instead.',
  },
  {
    bad: "This report is limited to a retrospective review of Anthropic's specific third-party evaluation environments and does not establish a universal measure of risk.",
    good: "That doesn't mean every agent behaves this way in every test environment -- Anthropic is describing its own retrospective review, not handing down a general forecast.",
    note: 'Say the limitation as a sentence a person would say, not as a boilerplate disclaimer clause.',
  },
  {
    bad: 'Practical scenario: a security team deploys an agent onto a capture-the-flag staging range.',
    good: 'Picture a security team that just pointed one of these agents at its own internal test range.',
    note: 'Never open a sentence with a category label ("Practical scenario:", "The takeaway:") -- narrate the scenario directly.',
  },
];

export const CONTRAST_PAIRS_UK: ContrastPair[] = [
  {
    bad: 'Для керівників продукту та безпеки напруга очевидна: реалізм може зробити справжню ціль правдоподібною, якщо ізоляція неповна.',
    good: 'Ось незручна частина: що реалістичнішою робиш симуляцію злому, то більше вона починає виглядати як справжня ціль -- і цього разу модель не змогла відрізнити одне від іншого.',
    note: 'Прибрати рамку «для керівників» і абстрактну «напругу»; почати з конкретного, несподіваного факту.',
  },
  {
    bad: 'Обмеження полягає в тому, що цей звіт стосується ретроспективного огляду Anthropic і конкретних сторонніх середовищ оцінювання.',
    good: 'Це не означає, що так поводитиметься кожен агент у кожному тестовому середовищі -- Anthropic описує саме свій ретроспективний розбір, а не універсальний прогноз.',
    note: 'Сказати обмеження як речення живої людини, не як шаблонний застережний пункт.',
  },
  {
    bad: 'Практичний сценарій: команда безпеки запускає агента на staging-полігоні capture-the-flag.',
    good: 'Уявіть команду безпеки, яка щойно направила такого агента на власний внутрішній тестовий полігон.',
    note: 'Ніколи не починати речення з категорійної мітки ("Практичний сценарій:", "Висновок для рішення:") -- одразу розповідати сценарій.',
  },
];

/**
 * Rules for the `editorsView` field: the one place in the story where bold
 * "what could this lead to" reasoning is not just allowed but required. It
 * must read as a clearly-labeled opinion, never blend into the sourced body,
 * and end on the tension the `discussionQuestion` picks up.
 */
export const SPECULATION_SPEC_EN = `EDITOR'S VIEW (editorsView, required for every feature story)
This is the one place you go beyond what the sources establish. State a real, specific guess about where this leads or why it matters more than it looks -- "if this pattern holds, the next version of this mistake could involve X" -- not a restatement of the body. It must be unmistakably framed as your own reasoning, not sourced fact: use first person or clearly editorial framing ("Our read:", "What we'd watch for:", "This is where it gets interesting:"), never state a speculative claim in the same flat declarative voice as a sourced fact. 60-110 words. Do not repeat a claim, number or quote already used in the body -- extend the story, don't summarize it. End on a real, open tension: something a thoughtful reader could push back on, not a rhetorical question with an obvious answer.`;

export const SPECULATION_SPEC_UK = `ПОГЛЯД РЕДАКЦІЇ (editorsView, обов'язково для кожної з трьох головних історій)
Це єдине місце, де можна вийти за межі того, що встановлюють джерела. Сформулюйте реальне, конкретне припущення про те, куди це веде або чому це важливіше, ніж здається -- «якщо ця закономірність триватиме, наступна версія цієї помилки може стосуватися X» -- а не переказ тіла статті. Це має бути однозначно позначено як ваше власне міркування, не як факт із джерела: використовуйте явно редакційне формулювання («На нашу думку», «Варто стежити за тим», «Ось де стає цікаво») -- ніколи не подавайте припущення тим самим рівним стверджувальним тоном, що й факт із джерела. 60-110 слів. Не повторюйте твердження, цифру чи цитату, вже використану в тілі статті -- розвивайте історію, а не переказуйте її. Завершіть реальним, відкритим напруженням: чимось, із чим уважний читач міг би посперечатися, а не риторичним питанням з очевидною відповіддю.`;

/**
 * Assembles the voice block (positive model + contrast pairs + speculation
 * spec) for the master writer prompts. Kept as one function so
 * both englishPrompt and ukrainianPrompt build the block identically instead
 * of hand-concatenating these constants at each call site.
 *
 * Full-length exemplars are intentionally excluded. A real v6 generation
 * copied EXEMPLAR_EN verbatim into intro and translated the same fabricated
 * incident into Ukrainian. Contrast pairs teach register without supplying a
 * ready-made paragraph that can leak into published copy.
 */
export function voicePromptBlock(locale: 'en' | 'uk'): string {
  const voice = locale === 'en' ? VOICE_EN : VOICE_UK;
  const pairs = locale === 'en' ? CONTRAST_PAIRS_EN : CONTRAST_PAIRS_UK;
  const speculation = locale === 'en' ? SPECULATION_SPEC_EN : SPECULATION_SPEC_UK;
  const pairsBlock = pairs
    .map(
      (pair, index) =>
        `${index + 1}. AVOID: "${pair.bad}"\n   WRITE LIKE: "${pair.good}"\n   Why: ${pair.note}`,
    )
    .join('\n');
  return `VOICE
${voice}

REGISTER CONTRAST -- avoid the left column, write like the right column
${pairsBlock}

${speculation}`;
}

/** Full exemplar text used only by the deterministic prompt-copy gate. */
export function exemplarFor(locale: 'en' | 'uk'): VoiceExemplar {
  return locale === 'en' ? EXEMPLAR_EN : EXEMPLAR_UK;
}

/**
 * Template-leak and AI-tell detectors. Each rule fires as a blocker in
 * `detectTemplateLeaks` (content-studio.ts) before the LLM critic even runs
 * -- zero cost, zero ambiguity. The first four rules in each list are direct
 * fossils of the exact register the owner rejected in the 2026-07-27 edition
 * (category-label openers duplicating the boxed why/practical/limitation
 * fields inside the narrative body); the rest are generic AI-tell phrasing
 * that regresses toward the same flattened register.
 */
export const BANNED_PHRASES_EN: BannedPhraseRule[] = [
  {
    code: 'label_opener_practical',
    pattern: /\b(practical scenario|practical example)\s*:/i,
    message:
      'Never open a sentence with a category label like "Practical scenario:" -- narrate the scenario directly instead of restating the practical field inside the body.',
  },
  {
    code: 'label_opener_limitation',
    pattern: /\b(the limitation is that|limitations?\s*:)/i,
    message:
      'Never state the limitation as a labeled clause inside the body -- it already has its own field; say it as a sentence a person would say, or omit it from the body.',
  },
  {
    code: 'label_opener_takeaway',
    pattern: /\b(the takeaway (?:is|here)|decision[- ]ready takeaway\s*:)/i,
    message:
      'Never restate the takeaway inside the body using its field name -- the takeaway has its own box.',
  },
  {
    code: 'label_opener_why',
    pattern: /\bwhy (?:it|this) matters\s*:/i,
    message: '"Why it matters:" is a box heading, not a sentence opener inside the body.',
  },
  {
    code: 'ai_tell_delve',
    pattern: /\bdelves? into\b/i,
    message: 'Generic AI-tell phrasing. Say what the piece actually does instead.',
  },
  {
    code: 'ai_tell_landscape',
    pattern: /\b(ever-evolving|rapidly evolving|fast-moving) landscape\b/i,
    message: 'Generic AI-tell phrasing with no concrete content.',
  },
  {
    code: 'ai_tell_worth_noting',
    pattern: /\bit['’]?s worth noting\b/i,
    message: 'Filler hedge. Either the fact matters (state it) or it does not (cut it).',
  },
  {
    code: 'ai_tell_gamechanger',
    pattern: /\bgame[- ]changer\b/i,
    message: 'Cliché. Name the specific thing that changed.',
  },
  {
    code: 'ai_tell_underscore',
    pattern: /\bunderscores? the (?:importance|need)\b/i,
    message: 'Generic AI-tell phrasing. State the specific consequence instead.',
  },
  {
    code: 'ai_tell_leader_frame',
    pattern: /\bfor (?:product|security|technology|business) (?:and \w+ )?leaders\b/i,
    message:
      'The audience is builders and the tech-curious, not a leadership briefing -- drop the leader-memo frame.',
  },
];

export const BANNED_PHRASES_UK: BannedPhraseRule[] = [
  {
    code: 'label_opener_practical',
    pattern: /практичн(?:ий|ого) сценарі[йя]\s*:/i,
    message:
      'Не починати речення міткою «Практичний сценарій:» -- розповісти сценарій напряму, не переказуючи поле practical у тілі статті.',
  },
  {
    code: 'label_opener_limitation',
    pattern: /обмеженн(?:я|ям) полягає в тому/i,
    message:
      'Не подавати обмеження як шаблонну конструкцію в тілі -- у нього є власне поле; сформулювати як живе речення або прибрати з тіла.',
  },
  {
    code: 'label_opener_takeaway',
    pattern: /висновок для рішення\s*:/i,
    message: 'Не переказувати takeaway в тілі його назвою поля -- у нього є власний блок.',
  },
  {
    code: 'label_opener_why',
    pattern: /чому це важливо\s*:/i,
    message: '«Чому це важливо:» -- заголовок бокса, не речення в тілі.',
  },
  {
    code: 'ai_tell_varto_zaznachyty',
    pattern: /варто (?:зазначити|зауважити|наголосити)/i,
    message: 'Порожній хедж. Або факт важливий (скажіть його прямо), або ні (приберіть).',
  },
  {
    code: 'ai_tell_u_sviti',
    pattern: /у світі (?:ші|штучного інтелекту|технологій)/i,
    message: 'Кліше без конкретики.',
  },
  {
    code: 'ai_tell_landscape',
    // Plain \w is ASCII-only in a non-/u JS regex and never matches Cyrillic,
    // so the word-ending suffix needs an explicit Cyrillic letter class here.
    pattern: /(?:стрімко|швидко)(?:зростаюч|мінлив)[а-яіїєґА-ЯІЇЄҐ]* (?:ландшафт|середовищ)/i,
    message: 'Кліше без конкретного змісту.',
  },
  {
    code: 'ai_tell_leader_frame',
    pattern: /для керівник(?:ів|а) (?:продукту|безпеки|технологій|бізнесу)/i,
    message:
      'Аудиторія -- розробники й техно-цікаві читачі, не керівництво; прибрати рамку "для керівників".',
  },
  {
    code: 'listicle_opener_this_week',
    pattern: /цього тижня в (?:ai|ші|штучному інтелекті)/i,
    message: 'Заїжджений відкривач без конкретики.',
  },
];

export function bannedPhrasesFor(locale: 'en' | 'uk'): BannedPhraseRule[] {
  return locale === 'en' ? BANNED_PHRASES_EN : BANNED_PHRASES_UK;
}
