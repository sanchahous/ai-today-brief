import type { Lang } from './site';

export type PromptSurface = 'api' | 'claude-code' | 'claude-ai';
export type PromptModel = 'haiku-4-5' | 'sonnet-4-6' | 'fable-5' | 'opus-4-8';
export type PromptSeverity = 'issue' | 'suggestion' | 'info';
export type PromptPlacement = 'system-prompt' | 'user-message' | 'harness';

export interface PromptCitation {
  label: string;
  url: string;
  quote: Partial<Record<Lang, string>>;
}

export interface PromptLintRule {
  id: string;
  title: Record<Lang, string>;
  shortTitle?: Record<Lang, string>;
  severity: PromptSeverity;
  appliesTo: {
    surfaces?: PromptSurface[];
    models?: PromptModel[];
  };
  triggerSummary: Record<Lang, string>;
  recommendation: Record<Lang, string>;
  citations: readonly PromptCitation[];
  explainer: Record<Lang, string>;
  modelGuidance: Record<PromptModel, Record<Lang, string>>;
}

export interface OfficialSnippet {
  id: string;
  title: Record<Lang, string>;
  placement: PromptPlacement;
  purpose: Record<Lang, string>;
  snippet: string;
  citations: readonly PromptCitation[];
}

const promptingGuide: PromptCitation = {
  label: 'Anthropic prompt engineering guide',
  url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview',
  quote: {
    en: 'Claude performs best when prompts are explicit, structured, and grounded with examples where needed.',
    uk: 'Claude найкраще працює з явними, структурованими промптами й прикладами там, де вони потрібні.',
  },
};

const fableGuide: PromptCitation = {
  label: 'Prompting Claude Fable 5',
  url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/prompting-claude-fable-5',
  quote: {
    en: 'Fable 5 responds better to concise intent and appropriate effort guidance than behavior over-prescription.',
    uk: 'Fable 5 краще реагує на стислий намір і доречні effort-підказки, ніж на надмірний поведінковий стиринг.',
  },
};

const citations = [promptingGuide] as const;
const fableCitations = [fableGuide] as const;

const allModelGuidance = (en: string, uk: string): Record<PromptModel, Record<Lang, string>> => ({
  'haiku-4-5': { en, uk },
  'sonnet-4-6': { en, uk },
  'fable-5': { en, uk },
  'opus-4-8': { en, uk },
});

function rule(
  id: string,
  severity: PromptSeverity,
  title: Record<Lang, string>,
  triggerSummary: Record<Lang, string>,
  recommendation: Record<Lang, string>,
  explainer: Record<Lang, string>,
  options: Pick<PromptLintRule, 'appliesTo' | 'citations' | 'modelGuidance'> = {
    appliesTo: {},
    citations,
    modelGuidance: allModelGuidance(recommendation.en, recommendation.uk),
  },
): PromptLintRule {
  return { id, severity, title, triggerSummary, recommendation, explainer, ...options };
}

export const PROMPT_LINT_RULES: readonly PromptLintRule[] = [
  rule(
    'structure-sections',
    'suggestion',
    { en: 'Add explicit sections', uk: 'Додайте явні секції' },
    { en: 'Long prompt with no section markers.', uk: 'Довгий промпт без маркерів секцій.' },
    { en: 'Use <context>, <task>, and <output_format> or clear headings.', uk: 'Використайте <context>, <task>, <output_format> або чіткі заголовки.' },
    { en: 'Structure helps the model separate source material, task, and expected output.', uk: 'Структура допомагає моделі розділити матеріали, задачу та очікуваний вивід.' },
  ),
  rule(
    'multishot-examples',
    'issue',
    { en: 'Add multishot examples', uk: 'Додайте кілька прикладів' },
    { en: 'Format-sensitive task without examples.', uk: 'Задача, чутлива до формату, без прикладів.' },
    { en: 'Add 3–5 diverse examples in <example> tags.', uk: 'Додайте 3–5 різноманітних прикладів у тегах <example>.' },
    { en: 'Examples are the most reliable way to steer exact output shape.', uk: 'Приклади найнадійніше керують точною формою відповіді.' },
  ),
  rule(
    'long-context-ordering',
    'issue',
    { en: 'Move long context before instructions', uk: 'Перенесіть довгий контекст перед інструкціями' },
    { en: 'Large pasted context appears after the task.', uk: 'Великий вставлений контекст стоїть після задачі.' },
    { en: 'Put documents first, then the query at the end.', uk: 'Розмістіть документи спершу, а запит — наприкінці.' },
    { en: 'Long-context prompts are easier to ground when evidence is loaded before the ask.', uk: 'У довгому контексті легше заземлити відповідь, коли докази йдуть перед запитом.' },
  ),
  rule(
    'negative-instructions',
    'suggestion',
    { en: 'Rewrite negative instructions', uk: 'Перепишіть негативні інструкції' },
    { en: 'High density of do-not/never instructions.', uk: 'Висока щільність інструкцій «не роби/ніколи».' },
    { en: 'Say what to do instead of only what to avoid.', uk: 'Скажіть, що робити, а не лише чого уникати.' },
    { en: 'Positive behavioral targets are easier to follow than dense prohibitions.', uk: 'Позитивні цілі поведінки легше виконати, ніж щільні заборони.' },
  ),
  rule(
    'constraint-without-rationale',
    'suggestion',
    { en: 'Explain hard constraints', uk: 'Поясніть жорсткі обмеження' },
    { en: 'ALWAYS/NEVER/MUST without nearby rationale.', uk: 'ALWAYS/NEVER/MUST або українські аналоги без пояснення.' },
    { en: 'Add because/so that language explaining why the rule matters.', uk: 'Додайте «бо/щоб/тому що» з поясненням важливості правила.' },
    { en: 'Rationale improves compliance with unusual constraints.', uk: 'Причина покращує виконання незвичних обмежень.' },
  ),
  rule(
    'missing-output-format',
    'suggestion',
    { en: 'Specify output format', uk: 'Вкажіть формат виводу' },
    { en: 'Prompt does not state the desired output format.', uk: 'Промпт не задає бажаний формат відповіді.' },
    { en: 'Name the format: JSON, table, markdown, bullets, or exact fields.', uk: 'Назвіть формат: JSON, таблиця, markdown, списки або точні поля.' },
    { en: 'Explicit output contracts reduce unusable responses.', uk: 'Явний контракт відповіді зменшує ризик непридатного виводу.' },
  ),
  rule(
    'vague-qualifiers',
    'suggestion',
    { en: 'Replace vague quality words', uk: 'Замініть розмиті критерії якості' },
    { en: 'Vague words such as better/professional without criteria.', uk: 'Розмиті слова на кшталт «краще/професійно» без критеріїв.' },
    { en: 'Use measurable criteria, rubrics, examples, or constraints.', uk: 'Використайте вимірювані критерії, рубрики, приклади або обмеження.' },
    { en: 'Measurable targets make subjective editing requests actionable.', uk: 'Вимірювані цілі роблять субʼєктивні прохання дієвими.' },
  ),
  rule(
    'missing-context-intent',
    'suggestion',
    { en: 'Add context and intent', uk: 'Додайте контекст і намір' },
    { en: 'Task-only prompt lacks audience, goal, or purpose.', uk: 'Задача без аудиторії, цілі або причини.' },
    { en: 'Use “I am working on X for Y because Z.”', uk: 'Використайте патерн «Я працюю над X для Y, щоб Z».' },
    { en: 'Audience and purpose help choose tone, depth, and trade-offs.', uk: 'Аудиторія й мета допомагають вибрати тон, глибину й компроміси.' },
  ),
  rule(
    'reasoning-echo',
    'issue',
    { en: 'Avoid chain-of-thought echo requests', uk: 'Уникайте запитів на відтворення chain-of-thought' },
    { en: 'Prompt asks to reveal/transcribe hidden reasoning.', uk: 'Промпт просить розкрити або відтворити приховані міркування.' },
    { en: 'Ask for a concise rationale or summarized thinking instead.', uk: 'Попросіть стислий rationale або summarized thinking замість прихованих міркувань.' },
    { en: 'Echoing hidden reasoning can trigger reasoning-extraction safeguards.', uk: 'Відтворення прихованих міркувань може зачепити reasoning-extraction запобіжники.' },
    { appliesTo: { surfaces: ['api', 'claude-code'] }, citations: fableCitations, modelGuidance: allModelGuidance('Ask for summarized rationale, not hidden chain of thought.', 'Просіть підсумкове обґрунтування, не прихований chain-of-thought.') },
  ),
  rule(
    'fable-overprescription',
    'info',
    { en: 'Simplify Fable behavior steering', uk: 'Спростіть поведінковий стиринг Fable' },
    { en: 'Repeated always/never/must behavior steering.', uk: 'Повторюваний поведінковий стиринг always/never/must.' },
    { en: 'Prefer a short instruction describing the desired behavior.', uk: 'Надайте коротку інструкцію з бажаною поведінкою.' },
    { en: 'Fable is more reliable with concise intent than enumerated behavior laws.', uk: 'Fable надійніший зі стислим наміром, ніж з переліком законів поведінки.' },
    { appliesTo: { models: ['fable-5'] }, citations: fableCitations, modelGuidance: allModelGuidance('Fable-specific: reduce behavior enumeration.', 'Специфічно для Fable: скоротіть перелік поведінок.') },
  ),
  rule(
    'caps-emphasis',
    'suggestion',
    { en: 'Normalize all-caps emphasis', uk: 'Нормалізуйте капсові наголоси' },
    { en: 'Excessive CRITICAL/MUST/NEVER style emphasis.', uk: 'Надмірні CRITICAL/MUST/NEVER або українські капс-наголоси.' },
    { en: 'Use calm wording and one explicit priority statement.', uk: 'Використайте спокійний тон і один явний пріоритет.' },
    { en: 'Aggressive emphasis can overtrigger modern Claude models.', uk: 'Агресивні наголоси можуть спричинити overtriggering у сучасних Claude.' },
    { appliesTo: {}, citations: fableCitations, modelGuidance: allModelGuidance('Normalize tone; do not stack all-caps directives.', 'Нормалізуйте тон; не нашаровуйте капсові директиви.') },
  ),
  rule(
    'fable-effort-guidance',
    'info',
    { en: 'Set effort on supported surfaces', uk: 'Задайте effort для підтримуваних поверхонь' },
    { en: 'Complex work on API/Claude Code can benefit from effort guidance.', uk: 'Складна робота в API/Claude Code може виграти від effort-підказки.' },
    { en: 'Use high as a floor; xhigh for hard agentic/coding work. max is API-only — Claude Code tops out at xhigh. Never set effort for Haiku.', uk: 'high — мінімум; xhigh для складної агентної/кодової роботи. max — лише в API (у Claude Code стеля — xhigh). Ніколи не задавайте effort для Haiku.' },
    { en: 'Effort levels differ by surface: API supports low|medium|high|xhigh|max; Claude Code settings.json effortLevel caps at xhigh. Irrelevant in claude.ai.', uk: 'Рівні effort залежать від поверхні: API — low|medium|high|xhigh|max; у Claude Code settings.json effortLevel стеля — xhigh. У claude.ai нерелевантно.' },
    { appliesTo: { surfaces: ['api', 'claude-code'], models: ['sonnet-4-6', 'fable-5', 'opus-4-8'] }, citations: fableCitations, modelGuidance: allModelGuidance('No effort for Haiku; use high/xhigh for supported complex work (max is API-only, not Claude Code).', 'Без effort для Haiku; high/xhigh для підтримуваної складної роботи (max — лише в API, не в Claude Code).') },
  ),
  rule(
    'prompt-bloat',
    'info',
    { en: 'Trim prompt bloat', uk: 'Скоротіть зайвий обсяг промпта' },
    { en: 'Very long prompt appears repetitive or boilerplate-heavy.', uk: 'Дуже довгий промпт виглядає повторюваним або перевантаженим шаблонами.' },
    { en: 'Keep durable constraints, remove repeated boilerplate, and move reusable policy to system or harness context.', uk: 'Залиште сталі обмеження, приберіть повтори, а багаторазову політику перенесіть у system/harness.' },
    { en: 'The concept asks for local token-range feedback; bloat detection turns that estimate into an actionable rule.', uk: 'Концепція вимагає локальної оцінки токенів; це правило робить її дієвою.' },
  ),
] as const;

export const OFFICIAL_PROMPT_SNIPPETS: readonly OfficialSnippet[] = [
  {
    id: 'anti-overplanning',
    title: { en: 'Anti-overplanning', uk: 'Проти надпланування' },
    placement: 'system-prompt',
    purpose: { en: 'Discourage unnecessary planning loops.', uk: 'Стримує зайві цикли планування.' },
    snippet: 'Prefer the smallest plan that lets you act safely; update it only when new facts change the path.',
    citations,
  },
  {
    id: 'anti-overengineering',
    title: { en: 'Anti-overengineering', uk: 'Проти overengineering' },
    placement: 'system-prompt',
    purpose: { en: 'Keep implementations simple.', uk: 'Тримає реалізацію простою.' },
    snippet: 'Choose the simplest implementation that satisfies the stated constraints and tests.',
    citations,
  },
  {
    id: 'brevity',
    title: { en: 'Brevity', uk: 'Стислість' },
    placement: 'user-message',
    purpose: { en: 'Request concise output.', uk: 'Просить стислий вивід.' },
    snippet: 'Answer in the fewest words that preserve the key decision, evidence, and next step.',
    citations,
  },
  {
    id: 'checkpoint',
    title: { en: 'Checkpoint', uk: 'Контрольна точка' },
    placement: 'harness',
    purpose: { en: 'Force progress checks in agent loops.', uk: 'Змушує перевіряти прогрес в агентних циклах.' },
    snippet: 'After each major step, summarize what changed, what was verified, and the next action.',
    citations,
  },
  {
    id: 'grounded-progress',
    title: { en: 'Grounded progress', uk: 'Заземлений прогрес' },
    placement: 'harness',
    purpose: { en: 'Report only verified progress.', uk: 'Повідомляє лише перевірений прогрес.' },
    snippet: 'Do not claim success until a command, test, or observable artifact verifies it.',
    citations,
  },
  {
    id: 'autonomy',
    title: { en: 'Autonomy', uk: 'Автономність' },
    placement: 'system-prompt',
    purpose: { en: 'Permit safe independent action.', uk: 'Дозволяє безпечну самостійну дію.' },
    snippet: 'When the next step is reversible and within scope, take it without asking.',
    citations,
  },
  {
    id: 'boundaries',
    title: { en: 'Boundaries', uk: 'Межі' },
    placement: 'system-prompt',
    purpose: { en: 'Clarify what not to modify.', uk: 'Уточнює, що не змінювати.' },
    snippet: 'Stay within the requested scope; if required information is missing, state the blocker instead of guessing.',
    citations,
  },
] as const;

export function getPromptLintRule(ruleId: string): PromptLintRule | undefined {
  return PROMPT_LINT_RULES.find((ruleItem) => ruleItem.id === ruleId);
}
