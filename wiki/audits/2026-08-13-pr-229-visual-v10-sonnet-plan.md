# PR #229 Visual Affordance V10 — review і план змін для Sonnet

Summary: технічний + функціональний review PR #229 і покроковий план, який модель рівня Sonnet 5 має виконати, щоб weekly-ілюстрації стабільно передавали суть новини за 3–5 секунд, дешевше і без вигаданих фактів.
Sources: GitHub PR #229 (`experiment/visual-affordance-router-v10-20260813`), `src/lib/weekly-digest/visual-*.ts`, `scripts/visual-affordance-v10-targeted-*.ts`, `experiments/visual-affordance-v10/**`, `experiments/visual-compiler-v7|v9/**`, `artifacts/visual-affordance-v10-owner-review-complete/**`, production `pipeline/card-image.ts` + `src/lib/content-sim/`, Claude workflow `wf_40755980-8f7` (ліміт обірвав structured output; 138 знахідок витягнуто з agent transcripts 2026-08-13), другий прохід із ручною верифікацією ключових заявок у коді 2026-08-13.
Last updated: 2026-08-13

---

Це **executor spec**, не есе. Кожен таск має файл, функцію, точну зміну, тести і критерій «готово». Не імпровізуй нову архітектуру поверх цього плану. Не мерджи PR #229 «як є».

Гілка цього review: `review/pr-229-sonnet-plan` (від `origin/experiment/visual-affordance-router-v10-20260813`). Production код на `main` не чіпати, поки не закінчено W0–W4 і owner не дав окремий вердикт на W5.

**Статус доказовості (читай перед тим, як щось оскаржувати).** Знахідки прийшли з двох джерел:
8-вимірного Opus-прогону (`wf_40755980-8f7`, перерваний spend-лімітом — фаза adversarial-верифікації
**не відпрацювала**) і другого, ручного проходу. Верифіковано безпосередньо в коді й позначено
точними рядками: маніпуляції evaluator (`:374`, `:406-412`, `:483`), `TARGET_RANKS` + throw,
відсутність `markerUnits`, `LOGIC_INCLUDE`, тести, що закріплюють обхід eligibility, стале
artifacts-дерево (порівняння git blob), тексти трьох історій із `render-manifest.json`, цифри
holdout-ів і 190 с/виклик зі звітів, а також візуальний огляд усіх шести `-v10/-v8` карток.
Слабше верифіковані (позначай як `(needs verification)` перед тим, як покладатись): точні
геометричні пороги при нестандартних розмірах, оцінки ширини гліфів у `pill()`, оцінка CI-хвилин.
Якщо під час виконання якийсь пункт не відтворюється — це не привід ігнорувати сусідні; допиши
спростування новим записом у [log](../log.md), не редагуючи цю сторінку мовчки.

## 0. Вердикт

**Не мерджити PR #229 у `main` без cleanup.** Три причини:

1. **Це не алгоритм, а три ручні сцени.** `selectAffordanceTreatmentV10` має рівно три `kind`, SVG сцени захардкожені, нематч → `null`, єдиний renderer кидає. Для більшості реальних weekly stories функціонал не працює. (source: `visual-affordance-treatment-v10.ts:70-168`, `scripts/visual-affordance-v10-targeted-render.ts:371-372`)
   **Виміряно, не оцінено:** на 14 реальних історіях із двох закомічених holdout-ів PR treatment
   отримують **4**, і лише **1** з них — і eligible, і правильно змаршрутизований. На свіжому
   7-історійному holdout: «Source-eligible generic claims: 4/7», «Pre-registered specialized
   matches: **0**», а repair-раунд полагодив **0 із 3** відхилених claims, витративши LLM-виклики.
   (source: `experiments/visual-compiler-v9/generalization-2026-07-27/output/v9-routing-report.md`,
   `.../v5-claim-report.md`)
2. **Цифра «V10 3/3 integrity, 3–0 preference» не є доказом якості.** n=3 історії, ті самі, що owner уже відхилив; суддя бачить `V10 observation:` і rubric з `expectedEvidence` кандидата; `generated_text` для V10 force-false. Пакет `artifacts/visual-affordance-v10-owner-review-complete/` несе **v3** report (1/3 integrity), хоча PR body посилається на V6. (source: `scripts/visual-affordance-v10-targeted-evaluate.ts:404-485`, `artifacts/.../evaluation-report.md` vs `experiments/.../targeted-v6-.../evaluation-report.md`)
   **Четверта, окрема витік-точка:** навіть «blind»-стадії прямо сказано
   *«Do not flag controlled deterministic labels or intentional, legible code-artifact typography
   as generated text»* — тобто перша стадія знає про існування детермінованого рендера і не є
   intent-blind, попри те що всі звіти називають її «image-only and intent-blind».
   (source: `scripts/visual-affordance-v10-targeted-evaluate.ts:374`)
   Той самий промпт каже судді «labels are hidden», але у детермінованих сценах підписи
   (`BOUNDED 1/2/3`, лістинги коду) впечені **в растр**, а не в overlay — тобто контракт
   `labelsHiddenDuringSemanticTest: true` фізично не виконується, і це видно у самих
   `*-v10-pixels.jpg`. (source: візуальна перевірка pixels-only файлів 2026-08-13)
3. **Repo tax.** 367 файлів, +66 883 рядки, ~88 MB PNG/JPG, 67 one-shot workflows з `contents: write` + `git push` + платні секрети. Жоден `visual-*.ts` не імпортується production worker-ом. (source: `gh pr view 229`, `.github/workflows/visual-*.yml`)

> ⚠️ Conflict: [now](../now.md) і V6 `evaluation-report.md` кажуть 3/3 hard integrity.
> `artifacts/visual-affordance-v10-owner-review-complete/evaluation-report.md` — це v3 (1/3).
> Evaluator свідомо вимикає `generated_text` для V10. Див. W4 і
> [open-questions](../open-questions.md) §8.

**Що варто зберегти з експерименту:** claim IR (`visual-auto-claim-v5.ts`), grammar signals (`visual-affordance-router-v10.ts`), integrity vocabulary (`visual-integrity-v10.ts`), parametric SVG зародки (`visual-generic-svg-v6.ts`), budget object `WEEKLY_VISUAL_POLICY`, правило «немає automated production pass».

**Що викинути:** три захардкожені treatment SVG як «систему»; v5–v9 мертві модулі після появи канонічного v11; 67 workflows; бінарні PNG в git.

## 1. Структурна проблема (одна)

Роутер планує шість grammar, а renderer вміє намалювати лише дві детерміновані сцени + один FLUX prompt. Сцена не бере сутностей новини — два Gemini-consistency сюжети дадуть **байт-ідентичні** картинки. Тому «стабільність на будь-якій новині» неможлива, поки `selectAffordanceTreatmentV10` не стане **total function**, а сцена — **parametric SceneSpec**, а не `sameSystemOutputVariabilityScene(width, height)`.

**Чому так вийшло — механізм уже написаний, але не підключений.** `validateVisualPropositionV10`
(`visual-affordance-router-v10.ts:468-570`) вміє гейтити машинно-згенеровану специфікацію сцени:
`coreClaim`, `contextAnchor`, `visibleAction`, `visibleOutcome`, `mappings`, `invariants`,
`states`, `diagramNodes/Edges`, 16 issue-кодів. Його **не викликає жоден модуль і жоден скрипт**
(перевірено `git grep`). Оскільки валідатора немає в шляху, єдиним способом «пройти гейт» стало
намалювати сцену руками — звідси три захардкожені treatment і регекси-костилі поверх них.
`VisualV11SceneSpec` нижче — це фактично те саме, що вже описує `VisualPropositionV10`, тому
**переноси й підключай наявний валідатор**, а не пиши третій паралельний контракт. Заодно
виправ у ньому дефект: `unmapped_semantic_prop` (`:511`) звіряє `semanticProps[].id` з
`mappings[].visibleElement` — два вільнотекстові поля без спільного контракту, тож гейт
проходить лише коли автор вручну однаково слугіфікував обидва боки; порожній `semanticProps: []`
проходить вакуумно.

Цільовий пайплайн v11 (єдиний, який будувати):

```
approved story
  → extractVisualClaim (fail-closed на вигадані specifics)
  → selectGrammar (завжди renderable; ніколи null)
  → compileSceneSpec (токени з новини: actors, objects, action, outcome)
  → render:
       deterministic SVG, якщо grammar diagrammatic І spec повністю bound
       інакше 1× FLUX cinematic з subject-first prompt зі spec
  → labels / headline живуть у card chrome (Satori), НЕ в пікселях як носій claim
  → existing content-sim critic + mapped integrity blockers
  → завжди щось шипається (SVG або поточний FLUX v5.1 або duotone)
```

## 2. Функціональний review трьох V6 картинок

Перевірено пікселі з `experiments/visual-affordance-v10/targeted-v6-owner-outcome-repair/results/images/*-v10-pixels.jpg` (без overlay pills). Картка в продакшені завжди стоїть під headline — це плюс, але **картинка все одно має пройти headline-substitution test**. (source: [card-images](../marketing/card-images.md), owner policy v5.1)

| Story | 3–5 с без підписів | Headline-substitution | Правда джерела | Вердикт |
|---|---|---|---|---|
| Gemini consistency | Читається як «один вхід → одна модель → два різні виходи». Це добре. | Під іншим headline про A/B двох моделей теж «зайде» — зелений vs помаранчевий код виглядає як два продукти. | Вигаданий JS (`function solve(task)`, `needsRetry`, `fallback`) подається як output двох прогонів. Джерело цього коду не публікувало. Додатково: зелена/бурштинова рамка + крапки виносять вердикт «run B гірший», що `forbiddenImplications` цього ж treatment прямо забороняє, а джерело каже лише «community debates reliability». І сам фрейм суперечить джерелу: воно порівнює Gemini **з альтернативами** (*«reliability in coding environments compared to alternatives»*), а картка стверджує «одна модель, два прогони». | Інтуїція **частково** ок; editorial **fail** |
| Claude usage thresholds | Читається як pipeline cache → split → 3 бокси → gauge. Без слів «token / session / limit» це generic devops diagram. | Підійде майже під будь-який «розбий велике на частини» headline. | **Звірено з approved story — фабрикація підтверджена.** Джерело: *«Users pushing the limits of Claude's context window and rate limits are reporting anecdotal signals from Anthropic regarding usage patterns. This highlights the importance of monitoring token spend.»* `sourceGrounding` у коді: *«The source recommends operational controls…: cache stable context, split long runs and monitor token burn»* — **CACHE і SPLIT джерело не рекомендує**, дві третини намальованого рецепту вигадані. Плюс `BOUNDED 1/2/3` (точна кількість), зелений MONITOR (невиміряний результат) і різка рожева межа при «anecdotal» у джерелі. | Інтуїція **слабка** без pills; specifics **fabrication** |
| Deep Work | Людина + дошка + промінь. За 3–5 с: «людина працює з AI-підказкою». | Підійде під багато «human-in-the-loop / copilot» новин. Hint card і finish marker покращують mechanism vs V8, але puzzle board не є deep work / distraction. | Prompt вимагає no-text; V6 pixels все ще мають геометричну картку. Ризик extra fingers (vision). Промінь має бути device → hint card, не laser по дошці. | Найближче до 3–5 с; **не unique** до цієї новини |

V8 baseline на Gemini — два окремі чіпи й два графіки. Це **інша, слабша метафора** (два системи), тому 0/3 integrity проти V10 частково strawman: V8 малює «два моделі», а rubric вимагає «одна система, два прогони». (source: v8-pixels vs `forbiddenImplications` treatment)

**Висновок функціоналу:** навіть «переможні» V6 картинки не гарантують, що довільна новина отримає зрозумілий і правдивий кадр. Вони доводять лише: *для трьох підігнаних сюжетів ручний SVG/prompt кращий за непідігнаний V8 під V10-рубрику*.

## 3. Негативні обмеження для Sonnet (не порушувати)

1. Не чіпати production `pipeline/card-image.ts` policy `weekly-semantic-story-v5.1` у W0–W4. W5 — лише feature-flag shadow path.
2. Не додавати нові one-shot GitHub workflows. Максимум **один** `workflow_dispatch` harness.
3. Не комітити нові PNG/JPG в git. Артефакти → `artifacts/_local/` (gitignored) або Actions artifacts.
4. Не пекти англійський claim-text у пікселі. Card headline уже є. Pills — optional chrome, не evidence.
5. Не вигадувати код, числа, назви функцій, точні thresholds, яких немає в approved story.
6. Не вимикати `generated_text` / `readable_text` «бо це ж наш SVG».
7. Не оцінювати кандидата його ж `expectedEvidence`.
8. Українські історії: або нуль baked text, або overlay з `lang`. Regex-роутер англійською — дефект.
9. `select*` ніколи не кидає і не повертає «нічого» для валідної published story.
10. Не розмножувати v12/v13 файли поруч із v5–v10. Канон — **один** пакет `visual-v11-*.ts`.

## 4. Хвилі виконання

Роби строго по хвилях. Не починай W5, поки W1+W2+W4 не зелені. W0 можна паралельно з W1.

| Хвиля | Мета | Готово, коли |
|---|---|---|
| **W0 Hygiene** | PR не отруює `main` | 67 `visual-*.yml` видалені або зведені до 1 dispatch-only; бінарники прибрані з git; `experiments/` або в gitignore, або зона в `CLAUDE.md`; complete-пакет більше не видає v3 за v6 |
| **W1 Stability** | Будь-яка новина дає картинку | 14/14 holdout stories → non-null renderable spec; coverage test зелений; UK headline не ламає шлях |
| **W2 Meaning** | 3–5 с + правда | Немає fabricated code/numbers; pixels проходять headline-substitution і label-strip; critic бачить mechanism/outcome без pills |
| **W3 Cost** | Дешево і передбачувано | Один cost model; `withinBudget` реально ріже; diagram = 0 FLUX; cinematic = ≤1 FLUX + ≤1 vision; duration constants з вимірів |
| **W4 Eval you can trust** | Цифри не зманіпульовані | Holdout ≥12, включно з owner-preferred-V8; no rubric leak; no arm-tagged observations; no text-gate waiver; rubric version freeze |
| **W5 Production** | Shadow у worker | Flag `WEEKLY_VISUAL_V11=shadow`; adapter у `generation-worker.ts`; fallback на v5.1/duotone; admin показує grammar/renderMode; 0 throw на unmatched |

Acceptance кожної хвилі — команди в §6.

---

## 5. Канонічні таски (дедуп 138 знахідок)

Попередній Opus-прохід дав 138 findings (30 blocker / 63 high) по 7 вимірах; 8-й (repo-hygiene) не встиг повернути schema. Нижче — **канонічний backlog**. Не реалізуй 138 пунктів окремо.

### W0 — hygiene / merge gate

#### T0.1 Видалити one-shot workflows

- **Файли:** усі `.github/workflows/visual-*.yml` (67 шт.).
- **Зміна:** `git rm` усі 67. Якщо owner хоче один harness — залиш лише `visual-v11-holdout.yml` з `on: workflow_dispatch` (без `push:`), `permissions: contents: read`, без `git push`, без `CLOUDFLARE_API_TOKEN` поки W5.
- **Доказ дефекту:** більшість має `on.push.branches: experiment/...` + `contents: write` + `git push origin HEAD:experiment/...`. Після merge в `main` вони лишаються `workflow_dispatch` з платними секретами. (source: `.github/workflows/visual-affordance-v10-targeted.yml`)
- **Тест:** `rg "visual-" .github/workflows` → 0 або 1 файл.
- **Готово:** PR diff не додає 67 YAML.

#### T0.2 Прибрати бінарники з git

- **Файли:** `experiments/**/*.png`, `experiments/**/*.jpg`, дубль `artifacts/visual-affordance-v10-owner-review-complete/{cards,images,rows,assets}/*`.
- **Зміна:** `git rm --cached` бінарники; залиш `*.md` / `*.json` / `*.csv` reports. Додай `experiments/**/*.png` і `experiments/**/*.jpg` у `.gitignore`. Contact sheets для owner — `artifacts/_local/visual-v10/` (вже gitignored) + коротка README зі SHA архіву.
- **Не** роби `git filter-branch` / force-push — owner обрав інший шлях (рішення 2026-08-13).
- ⚠️ **`git rm` у follow-up коміті достатньо лише при squash-merge.** При звичайному merge-коміті всі 88 МБ блобів усе одно входять в історію `main` назавжди, бо merge приносить усю історію гілки. Owner обрав **squash-merge** (репо вже так мержить — PR #189, `e5d8df5`). Перевір спосіб мержу перед тим, як вважати W0 закритою.
- **Готово:** `git ls-files '*.png' '*.jpg' | rg 'experiments|visual-affordance'` порожній.

#### T0.3 Чесний owner-complete пакет

- **Файли:** `artifacts/visual-affordance-v10-owner-review-complete/README.md`, `evaluation-report.md`.
- **Зміна:** README має сказати, який саме run всередині (v3, 1/3 integrity), і лінкнути V6 як окремий path. Або замінити вміст на V6 reports **без** повторного коміту тих самих JPG, якщо вони вже в `experiments/.../targeted-v6-...`.
- **Готово:** жоден README не називає v3-файл «V6 3/3».

#### T0.4 Зона `experiments/`

- **Файли:** `CLAUDE.md` (Where things live), за бажанням `wiki/_meta/project-sync.json`.
- **Зміна:** або задокументуй `experiments/` як ephemeral (не production, не wiki knowledge), або перенеси reports у `artifacts/visual-experiments/` і видали top-level zone.
- **Готово:** `CLAUDE.md` більше не суперечить дереву.

#### T0.5 Coverage gate нічого не каже про цей PR

- **Факт:** `vitest.config.ts` `LOGIC_INCLUDE` **не** містить `src/lib/weekly-digest/**`. Наслідок у два боки: нові тести не роздувають 70% gate (добре), **але** й покриття всіх 18 нових модулів не вимірюється взагалі. Тому заява PR «`pr:check` passed: 1,248 tests, coverage» — це про **кількість** тестів, а не доказ покриття жодного рядка, який PR додає.
- **Зміна:** не мовчати про це. У W0 достатньо один раз прогнати `npx vitest run --coverage --coverage.include='src/lib/weekly-digest/visual-*.ts'` і записати реальні числа сюди та в PR body. Постійно додавати visual-v11 у `LOGIC_INCLUDE` — тільки коли модуль стане production-path (W5), тоді ціль ~80% на новий код.
- **Готово:** у PR body і в цій сторінці є фактичне число покриття `visual-*.ts`, а не «coverage passed».

#### T0.6 `scripts/sharp-namespace.d.ts`

- Перевір, чи це глобально послаблює `sharp` типи. Якщо workaround — обмеж `export {}` + локальний module augmentation, не `any` на весь Sharp.

---

### W1 — stability / generalization (найважливіша хвиля)

#### T1.1 `selectAffordanceTreatmentV10` → total function

- **Файл:** `src/lib/weekly-digest/visual-affordance-treatment-v10.ts` (канон після rename: `visual-v11-treatment.ts`).
- **Зараз:** рядки 85 і 109–112 стріляють `directComparison` / `directSessionWorkflow` **навіть при `eligible: false`**. Рядок 168: `return null`. Renderer: throw.
- **Зміна:**
  1. Перший рядок функції: `if (!input.eligible) { return genericFallback(input); }` — **не** `null`. Fallback не малює вигаданий механізм; лише literal context scene або FLUX v5.1 subject-first.
  2. Прибери standalone regex-тригери. Regex може лише **підсилити** вже обрану grammar, не обходити audit.
  3. Фінальна гілка ніколи не `null`: `generic_compiled` → `renderGenericVisualSvgV6` (або v11 parametric) **або** `renderMode: 'generated_source_cinematic'` з prompt із claim, не з трьох шаблонів.
- **Тести:**
  - `returns renderable treatment when eligible is false`
  - `does not emit controlled_session_workflow for ineligible story`
  - `never returns null for 14 holdout fixtures`
  - `UK headline without English keywords still returns cinematic fallback`
- **Готово:** `select*(fixture)` для кожного запису в `experiments/visual-compiler-v7/fresh-holdout/output/v7-routed-claims.json` ≠ `null`.

#### T1.2 Закрити dead grammars

- **Файл:** `visual-affordance-router-v10.ts` `GRAMMAR_DEFAULTS` + `planVisualAffordancesV10`.
- **Зараз:** шість grammar; renderer v10 малює лише `controlled_comparison` і `causal_process_sequence` (детерміновано) + `cinematic_domain_scene` (FLUX). `deterministic_technical_hybrid`, `one_to_one_physical_analogy`, `source_led_fallback` — тупики. Будь-яка історія з метрикою йде в hybrid і далі в `null`.
- **Зміна (обери одне, не обидва):**
  - **A (рекомендовано):** скоротити публічні grammar до тих, що мають renderer: `diagram_comparison`, `diagram_process`, `diagram_quantity`, `cinematic_domain`. `source_led_fallback` = cinematic/duotone, не окремий kind.
  - **B:** додати parametric renderer на кожну grammar (довше; не починай, якщо A закриває 14/14).
- **Тест:** жоден `plan.candidates[0].grammar` не вказує на kind без renderer. `hasExactMetric === true` → `diagram_quantity` SVG, не `null`.

#### T1.3 SceneSpec замість hardcoded SVG

- **Новий файл:** `src/lib/weekly-digest/visual-v11-scene-spec.ts`.
- **Інтерфейс (зафіксуй так):**

```ts
export type VisualV11RenderMode = 'deterministic_svg' | 'generated_cinematic';

export interface VisualV11SceneSpec {
  storyId: string;
  grammar: 'diagram_comparison' | 'diagram_process' | 'diagram_quantity' | 'cinematic_domain';
  renderMode: VisualV11RenderMode;
  contextAnchor: string;      // visible, from source
  visibleAction: string;
  visibleOutcome: string;
  actors: string[];           // max 2
  objects: string[];          // max 4, from source nouns
  labels: string[];           // max 3, optional chrome; must not carry claim
  forbiddenSpecifics: string[];
  expectedImageCalls: 0 | 1;
}
```

- SVG функції мають сигнатуру `renderDiagram(spec, w, h)`, не `sameSystemOutputVariabilityScene(w, h)`.
- Заборонено хардкодити `function solve(task)`, `BOUNDED 1`, `CACHE`. Текст у SVG — лише з `spec.objects` / нейтральні геометричні mark-и.
- **Тест:** дві різні Gemini-подібні історії → SVG strings **не** equal. Snapshot structural: `data-left-panel`, `data-right-a`, `data-right-b` присутні; `<text>` не містить `function ` / `needsRetry`.

#### T1.4 Keyword misroute

- **Зараз:** `directSessionWorkflow` = `(token|session|threshold|...) && (cache|split|monitor|limit|...)`. Історія про multi-provider API gateway з словом `routing`/`cache` може стати Claude-session diagram.
- **Зміна:** signals лишаються; treatment обирає grammar **тільки** з `plan.candidates[0]` після eligibility. Додай negative test: fixture «Aurora gateway / provider routing» не стає `controlled_session_workflow`.
- **Файл тестів:** `visual-v11-treatment.routing.test.ts`.

#### T1.5 Coverage regression

- **Новий тест:** `visual-v11-coverage.test.ts`.
- Завантаж закомічені JSON claims (не live LLM). Assert:
  - 14/14 non-null
  - grammar ∈ renderable set
  - `expectedImageCalls` ∈ {0,1}
  - для `eligible: false` — `renderMode` cinematic або generic, і `forbiddenSpecifics` не порожній
- Це **гейтовий** тест хвилі. Без нього W1 не done.

#### T1.6 Український шлях

- `sourceText().toLowerCase()` + англійські `\bcache\b` не бачать «кеш» / «поріг».
- **Зміна:** не перекладати regex на UK. Для `lang === 'uk'` (додай поле в `HoldoutStoryInput` або бери з worker) **завжди** йди через claim semantics, не через EN keyword lists. Labels, якщо є, рендеряться окремим overlay з UK рядків зі story, не EN pills `CACHE`.
- **Тест:** title/summary українською без EN keywords → non-null cinematic spec.

#### T1.7 Чотири баги коректності в claim/signal шарі

Це не «покращення», а дефекти — кожен змінює обрану grammar або бреше про статус новини.
Виправляй їх у тому ж PR, що й T1.1, інакше total function просто стабільно помилятиметься.

1. **`inferRole` — `\b` звʼязується лише з першою гілкою альтернації.**
   `visual-auto-claim-v5.ts:268,274,277` мають вигляд `/\b(lower|compiler?|…|strip|prune|…)\b/`,
   де межі слова діють тільки на крайні гілки. Наслідок: підрядок `strip` у «**Strip**e»
   класифікує історію як `architecture_transformation`, `tops?` у «lap**tops**» — як
   `benchmark_comparison` з примусовою вимогою метрики. «Stack Overflow», «multiplayer»,
   «pruned», «compacted» падають так само. **Фікс:** обгорнути кожну альтернацію у `(?:…)`.
   **Тест:** `inferRole` на «OpenAI partners with Stripe» ≠ `architecture_transformation`.
2. **`guardedCertainty` (`:237`) завжди повертає source-inferred certainty**, а не лише понижує.
   Слово `aims`/`plans` будь-де в блобі (включно з `takeaway`) робить `inferSourceCertainty`
   → `expected` ще до гілки `released`. Далі `guardCoreClaim` переписує claim на
   «is expected to …», `outcome_kind` стає `uncertainty` — і картка позначає **уже випущену**
   модель як «очікується». Це пряма інверсія власного контракту модуля
   («Never turn expected into available»). **Фікс:** гвардія односторонньою (спрацьовує лише
   коли запит assertivніший за джерело) + звузити `inferSourceCertainty` до title+summary.
3. **`hasExactMetric` / `requiresTemporalSequence` сканують `practical`/`takeaway`.**
   `visual-affordance-router-v10.ts:63,84`. Порада «Budget about 2 hours for the first run»
   вмикає метрику і піднімає `deterministic_technical_hybrid` (пріоритет 96) над
   `cinematic_domain_scene` (92) — тобто перемикає фікстуру `gpt5-tcell-discovery`, яку owner
   оцінив `strong_approve`, на граматику, яку він назвав «sterile». Одне слово `cache`/`split`/
   `failure` так само вмикає process-граматику. **Фікс:** скоуп title+summary; для метрики
   вимагати підтвердження `claim.quantitativeFacts`; для послідовності — ≥2 різні процесні
   сигнали.
4. **Null-safety.** `parseAutoVisualClaimV5:517` викликає `story.summary.slice` — порожній
   `summary_en` (або UK-only item) дає `TypeError` і валить `story_image` job непрозорим стеком
   замість деградації. **Фікс:** нормалізувати всі поля (`?? ''` / `?? null`) на вході обох
   парсерів; тест із `summary: null`.

---

### W2 — правда, інтуїція 3–5 с, якість кадру

#### T2.1 Заборона fabricated evidence

- **Видалити** `linearCodeArtifact` / `branchingCodeArtifact` літерали. Замінити на абстрактні структури (лінійний ланцюг vs гілка) **без** monospace source.
- **Видалити** фіксовані `BOUNDED ${index+1}` підписи. Три сесії — лише якщо claim має `quantitativeFacts` зі значенням 3.
- Gauge не малює «зелену безпеку», якщо джерело не стверджує, що стан безпечний. Нейтральний meter або жодного meter.
- `sourceGrounding` і `expectedEvidence` формуються з `autoClaim.claim.coreClaim` + approved `practical`/`takeaway`, не з шаблонного рядка про cache/split/monitor.
- **Тест:** SVG не match `/function\s+\w+\(/`, `/BOUNDED\s+\d/`, `/needsRetry/`.

#### T2.2 Labels не несуть claim

- Pills `SAME TASK / RUN A / RUN B` можна лишити як chrome **лише** якщо пікселі без pills все ще показують one-input-two-outputs (стрілки + дві різні структури). Це вже майже так на Gemini V6 — тоді pills optional.
- `CACHE / SPLIT / MONITOR` — **прибрати з пікселів**. Якщо без них діаграма не читається за 3–5 с, сцена погана, не «додай текст».
- Overlay path: `renderAffordanceOverlaySvgV10` лишається окремим шаром для admin debug, не для production raster.
- **Тест:** `includeOverlays: false` → critic/fixture checklist `core_action_visible` все ще true на структурних `data-*` атрибутах.

#### T2.3 Headline-substitution gate

- Додай чисту функцію `failsHeadlineSubstitution(spec, otherHeadline): boolean` — евристика: якщо `spec.objects` і `spec.actors` не містять жодного token з title/summary, сцена generic.
- Інтеграція в W4 evaluator і пізніше в content-sim adapter.
- **Фікстурі:** Deep Work spec повинна містити distraction/deep-work/hint tokens, не лише «grid/tiles».

#### T2.4 Cinematic prompt (Deep Work і будь-яка human story)

- Замінити `affordanceImagePromptV10` шаблон «logic board puzzle» на prompt, зібраний зі `SceneSpec`:
  - 1 людина (якщо `humanAgencyCentral`)
  - 1 AI object з claim
  - 1 bounded action з `visibleAction`
  - 1 visible outcome
  - negative: extra hands, readable text, generic gear workshop
- Не копіюй 12 речень про amber route / cyan cone як універсальний prompt. Це overfitting на одну новину.
- **Тест:** prompt для Deep Work містить bounded-hint/distraction; prompt для Mistral-workshop історії **не** містить logic-board puzzle.

#### T2.5 Production no-text policy

- Не супереч `pipeline/card-image.ts` `v5-no-text`. Детермінований SVG може мати геометричні mark-и; **не** може мати monospace code і EN claim words.
- Map: V11 `generated_text` ↔ content-sim `readable_text`.
- **Зроби правило структурним, а не документальним:** після побудови SVG кидати, якщо при
  `includeOverlays === false` буфер містить `<text`. Зараз саме через відсутність такої
  перевірки «pixels-only» файли, які подавалися судді як labels-stripped, усе одно містять
  `BOUNDED 1/2/3` і повні лістинги коду.

#### T2.6 Геометрія стрілок зламана механічно (не питання смаку)

- **Дефект:** у жодному з пʼяти `<marker>` немає `markerUnits` (перевірено:
  `grep -rc markerUnits src/lib/weekly-digest/` = 0). За SVG-специфікацією дефолт —
  `strokeWidth`, тому `markerWidth="12"` при `stroke-width="7"` дає вістря шириною
  **84 user units** на канві 1280×720 (≈7% ширини картки), а `refX="10"` масштабується до 70,
  тобто вістря залазить на ~14 px усередину цілі. Це механічна причина owner-тегу
  `broken_arrow` на `token-caching-cost-reduction`.
  (source: `visual-affordance-treatment-v10.ts:187`, `visual-generic-svg-v5.ts:59`,
  `visual-generic-svg-v6.ts:64`, `visual-generic-svg.ts:101-102`)
- **Другий дефект того ж кореня:** три dispatch-стрілки в `controlledSessionWorkflowScene:344`
  мають довжину `width*0.0073` ≈ **9,3 px** при 84-px вістрі — рендеряться як трикутники поверх
  карток, а не як стрілки. Саме вони мали показувати «cache→split ділить потік на три сесії».
- **Фікс:** `markerUnits="userSpaceOnUse"` + перерахований `markerWidth/refX` у всіх пʼяти;
  dispatch-хребет посунути так, щоб кожна гілка була ≥ `width*0.10`.
- **Тест:** SVG містить `markerUnits="userSpaceOnUse"`; жоден виклик `arrow()` не дає пробіг
  коротший за 60 user units.

#### T2.7 Абсолютні пікселі ламають сцену на менших розмірах

- `streamBlocks` (`:288`) використовує фіксовані 25 px блок + 8 px gap: при height 480 стек
  закінчується на y=422 при дні панелі 408, при height 360 (мінімум самої функції) — виходить
  за канву. `codeArtifactLine` (`:230`) має фіксовані 25 px рядок і 15 px шрифт, тому нижче
  ~560 px чотири рядки коду зливаються — гине єдиний сигнал, на якому тримається весь
  `same_system_output_variability`.
- **Фікс:** усі висоти/кеглі — від висоти власного боксу; у v11 render-модулі ввести
  `s = width / 1280` і множити кожен літерал.
- **Тест:** рендер 640×360 — жоден `<rect>` не виходить за свою панель; жодні два рядки
  `data-code-artifact` не перетинаються по y.

---

### W3 — витрати

Поточні орієнтири (source: `visual-render-policy.ts`, `visual-compiler.ts:1-19`, V6 report $0.0148 vision-only, production 2×3 FLUX+vision):

| Режим | Image calls | Vision | Реалістичний час |
|---|---:|---:|---|
| Production v5.1 сьогодні | до 6 FLUX | до 6 | хвилини; був 300s timeout |
| V10 deterministic | 0 | 2 у eval | секунди SVG |
| V10 cinematic (Deep Work) | 1 | 2 | ~190s FLUX за власним виміром PR |
| `generated_single` у policy | **2** (баг vs назва) | `maxVisionCalls=2` | |
| `generated_identity_action_pair` | 3 | 2 | найдорожчий |

`withinBudget` рахується і **ніде не ріже render**. `imageCallDurationMs: 9_000` проти ~190s — budget бреше.

> **Головне про вартість: важіль не в доларах.** Production сьогодні коштує $0.36–1.02 на випуск,
> тобто **$19–53 на рік** — це стеля економії від усього PR. Оптимізувати тут нема чого.
> Реальний важіль — час воркера: власний вимір PR дає **1326,6 с на 7 image calls (≈190 с/виклик)**
> проти **5,9 с** у компілятора, а дедлайн майстра — 95 хв (`generation-worker.ts:1011`,
> `95 * 60_000`). Шість історій × 2 раунди × 3 рендери зʼїдають 19–38 хв цього бюджету.
> Тому критерій приймання детермінованого маршруту формулюй як **p95 `story_image` < 120 с**,
> а не як суму в доларах. (source:
> `experiments/visual-compiler-v7/fresh-holdout/results/render-report.md`,
> `experiments/visual-compiler-v6/targeted-ab/results/render-report.md`)

Дві константи цін теж хибні й тягнуть за собою хибні проєкції: `visionCallUsd: 0.01` проти
виміряних у власному `evaluation.json` **$0.00247/виклик** (4× завищення), а `imageCallUsd: 0.015`
вірна лише для одного щабля провайдерної драбини — для schnell це ~30× завищення, для
`gemini-3-pro-image` ~9× заниження. Замість приватних констант передавай
`estimateCloudflareImageCostUsd` з `pipeline/card-image.ts` і
`contentSimVisionCriticEstimatedUsd()` з `src/lib/content-sim/config.ts`, а де є — reported
`usage.cost` (як уже робить `pipeline/providers/vision.ts:144`).

#### T3.1 Один cost model

- Видалити роздвоєння `imageCallsFor` vs `planVisualExecution`. Єдине джерело: `spec.expectedImageCalls` або `plan.renderUnits.filter(u => u.assetRequest).length`.
- `generated_single` → 1 call, не 2.
- `withinBudget === false` → примусово `deterministic_svg` або skip extra FLUX. Не advisory.

#### T3.2 Чесні duration constants

- `imageCallDurationMs: 190_000` (або виміряй ще раз і постав виміряне).
- `budget.maxDurationMs` для Actions worker: узгодити з fenced job (не 60s). Production story_image уже в GitHub Actions — не повертай на Vercel 300s path.
- Ledger: кожен FLUX/vision call через існуючий `recordGenerationCost` / `generation_cost_events`. Experiment script зараз не пише ledger.

#### T3.3 Цільовий бюджет на сторі

- Diagram: $0 image, ≤1 cheap vision optional.
- Cinematic: ≤1 FLUX (`flux-2-klein-9b`) + ≤1 vision.
- Заборонено 3-call identity pair як default.
- На 6 stories/week: верхня межа ≈ 6×($0.015+$0.01) якщо всі cinematic; з diagram mix — менше. Не оптимізуй, ламаючи W1.

---

### W4 — чесна оцінка

Без цього будь-який «V11 виграв 12–0» знову буде фейком.

#### T4.1 Полагодити evaluator (обов'язково перед будь-яким новим A/B)

Файл: `scripts/visual-affordance-v10-targeted-evaluate.ts` → rename `scripts/visual-v11-holdout-evaluate.ts`.

1. Видалити блок рядків 479–485 (`generatedTextPresent = false` для v10).
2. У `evaluateCards` прибрати `TARGET VISUAL GRAMMAR`, `OWNER-GROUNDED REQUIRED EVIDENCE`, `FORBIDDEN IMPLICATIONS`, `APPROVED LABELS`. Рубрика = source story + «чи пікселі показують одну дію і один наслідок».
3. Спостереження інжектити як `CARD X observation` / `CARD Y observation`, ніколи `V8 observation` / `V10 observation`.
4. `combinedObservation`: `beamPurposeClear`, `inputInvariantPreserved`, `systemInvariantPreserved` брати з **blind** stage, не з informed card verdict.
5. `TARGET_RANKS` з env, default = усі ranks у claims JSON. Не `throw` якщо ≠3.
6. **Прибрати з blind-промпта (`:374`) речення** *«Do not flag controlled deterministic labels
   or intentional, legible code-artifact typography as generated text»*. Перша стадія не має
   знати, що детермінований рендер узагалі існує. Якщо виняток для типографіки потрібен —
   це окреме поле спостереження (`legible_label_text_present`) на card-стадії, а не занулення
   hard-блокера.
7. **Не коерсити зіпсовану відповідь судді в нульовий вердикт.** Обрізаний JSON зараз дає
   all-false + score 0 — підпис, невідрізнимий від реального провалу гілки, і жодного варнінгу.
   Валідуй наявність усіх ключів на `X` і `Y` до нормалізації, кидай у retry, підніми
   `max_tokens` до 4000, врахуй `finish_reason`.
8. **Провенанс.** Раунди v5 і v6, які дали заголовкові числа, не мають ні run-id, ні workflow;
   при цьому тека `targeted/` містить прогін `31706401550`, **новіший** за v2/v3/v4 — тобто
   імпліцитна хронологія ledger хибна. Перезапусти фінальний раунд з CI і поклади
   `source-run.txt` поруч зі звітом.

#### T4.2 Holdout protocol

- N ≥ 12 stories: 7 v7-holdout **плюс** історії, де owner preferred V8 / `production_ready` cinematic (T-cell, Mistral з calibration report).
- Не відбирати лише owner-reject.
- Position swap: кожна пара двічі (X/Y flipped), disagreement → tie.
- Другий суддя (інша модель) на 30% sample — не blocker першого прогону, але запиши TODO в report.
- Freeze rubric file `visual-v11-acceptance.frozen.ts` з `criteriaVersion`. Зміна рубрики = bump version, не тихий edit `expectedEvidence` під нову картинку.
- **Додай третю гілку — production `pipeline/card-image.ts` з `main`.** Поточний «V8 baseline» —
  це не продакшн, а застарілий експериментальний компілятор, скачаний як готовий JPEG з
  CI-прогону `31629283372` (`provider: 'reused'`, нуль ремонтів, тоді як V10 отримав шість
  раундів ручного доведення). Тому PR **не містить жодного доказу, що V10 кращий за те, що
  працює сьогодні** — а саме це питання вирішує promotion. Три baseline-JPEG закомітити в
  `experiments/visual-affordance-v10/baseline-v8/` (3 файли, не bulk), бо після 30 днів
  retention їх уже не перескачати і числа стануть невідтворюваними.
- **Виміряй шум судді, перш ніж вірити різниці.** Перескорювання **тих самих** заморожених
  V8-пікселів у шести раундах дало 58.0 / 52.5 / 47.0 / 46.0 / 42.5 — розкид 15,5 пункта при
  заявленій перевазі ~33. Один виклик на порівняння не відділяє ефект від шуму: 3 семпли при
  temperature 0.3, медіана числових, мажоритарка булевих, поле `dispersion` у звіті, моделі
  на pinned dated id з `provider: { allow_fallbacks: false }`.
- **«Зрозуміло за 3–5 секунд» вимірюй до розкриття.** Зараз `instant_meaning` — 45% ваги —
  ставиться після того, як судді показали історію, граматику, required evidence і список
  лейблів; це перевірка розуміння підказки, а не картинки. Замість цього: у blind-стадії
  показати **320-px** мініатюру (реальний розмір у стрічці; зараз судять 720 px) і попросити
  `guessed_headline`, далі рахувати схожість із реальним title. Той самий виклик дає
  `labelsCarryClaim` механічно: pixels-only + три заголовки (правильний і два чужі) — не вгадав,
  отже сенс несуть слова.
- **Порахуй згоду з людиною.** Єдиний людський датасет у PR суперечить судді: owner тегнув
  `labels_carry_claim` як причину відхилення, суддя ту саму концепцію пропускає. Додай
  `scripts/visual-judge-agreement.ts` (join `calibration-v2/owner-calibration.json` ↔
  `evaluation.json` за story id → Cohen's kappa + confusion matrix) і не дозволяй звіту писати
  слово «preference» при kappa < 0.6.

#### T4.3 Мінімальні пороги для owner promotion

Не автоматичний pass. Для рекомендації «можна shadow»:

- Coverage: 100% stories produce an image (W1).
- Holdout: V11 ≥ baseline по `headline_pair` **без** waiver; integrity не гірший.
- Human sample: owner дивиться 6 blinded pairs (3 win, 3 fail-risk).
- Жоден holdout image не містить вигаданого коду/числа.

---

### W5 — production integration (після W1–W4)

Не починати, доки coverage 14/14 і evaluator чесний.

#### T5.1 Feature flag

- Env `WEEKLY_VISUAL_V11=off|shadow|on`. Default `off`.
- `shadow`: рендерить v11 **поряд** з v5.1, не замінює primary artifact, пише metadata `visual_v11`.
- Прецедент: `WEEKLY_CONTENT_STUDIO_V2`.

#### T5.2 Worker adapter

- Файл: `src/lib/content-sim/adapters/weekly-image.ts` + `generation-worker.ts` story_image path.
- **Ніколи** не `throw` на unmatched grammar — це спалює durable attempt. Fallback: існуючий concept-jury FLUX v5.1, далі duotone.
- SVG raster: `sharp` уже в worker image. Шрифти: **не** `DejaVu Sans Mono`. Або геометричні mark-и без тексту, або bundled font, або Satori overlay як зараз для OG.
- Timeout: лишайся на Actions fenced job; не додавай sequential art-director + FLUX + vision в один Vercel invoke.

#### T5.3 Gate vocabulary

- Мапа `VISUAL_INTEGRITY_BLOCKERS_V10` → `IMAGE_CRITIC_BLOCKER_CODES`. Не два паралельні critic UI.
- `source_led_fallback` allow-list, яка дропає `core_action_missing`, **не** портити в prod. Fallback теж має показати дію або чесно йти в FLUX.

#### T5.4 Admin Visuals

- Показати `grammar`, `renderMode`, `expectedImageCalls`, eligibility reasons.
- Owner approve як зараз; v11 variant — ще один tile, не заміна трьох concept lenses без окремого рішення.
- Data contract: `HoldoutStoryInput` vs revision item — адаптер полів `why` / `practical` / `takeaway` / `research` з worker payload, не з holdout JSON.

#### T5.5 Identical-pixels bug у проді

Поки SceneSpec не bound до story tokens, **заборонено** вмикати deterministic SVG у проді: усі «consistency» новини тижня виглядатимуть як один кадр.

---

## 6. Порядок роботи для Sonnet (чеклист)

Копіюй цей список у сесію виконання. Один PR на хвилю, не «все одразу».

**W0 PR (`chore/visual-v11-hygiene`):**

1. `git rm` 67 workflows (або 66 + 1 dispatch-only).
2. `git rm` png/jpg under `experiments/` і duplicate complete binaries; оновити `.gitignore`.
3. Виправити README complete-пакета (v3 vs v6).
4. Короткий запис у `CLAUDE.md` про `experiments/`.
5. `npm run pr:check` — має лишатись зелений (workflows не в gate).

**W1 PR (`feat/visual-v11-total-router`):**

1. Створити `visual-v11-scene-spec.ts`, `visual-v11-treatment.ts`, `visual-v11-render-svg.ts`.
2. Портнути корисне з router/generic-svg-v6; **не** копіювати три v10 scene functions as-is.
3. Total function + eligibility first + coverage test 14/14.
4. Routing negative tests (gateway ≠ session workflow; UK fallback).
5. `npx vitest src/lib/weekly-digest/visual-v11-*.test.ts`.

**W2 PR (`feat/visual-v11-honest-scenes`):**

1. Прибрати code listings / BOUNDED n / safe gauge.
2. Parametric comparison/process/quantity diagrams.
3. Cinematic prompt compiler зі spec.
4. Overlay optional; label-strip fixtures.
5. Snapshot SVG structural tests.

**W3 PR (`feat/visual-v11-cost-gate`):**

1. Уніфікувати imageCalls; `generated_single = 1`.
2. `withinBudget` enforce.
3. Чесні duration constants.
4. Тест: over-budget plan → svg fallback, 0 extra image calls.

**W4 PR (`feat/visual-v11-honest-eval`):**

1. Новий evaluator без waiver/leak.
2. Holdout ≥12 env-driven.
3. Frozen criteria version.
4. Запуск **лише** `workflow_dispatch` / локально; артефакти в `_local/`.
5. Report: coverage, integrity, substitution, cost. Без «100% preference» як headline, якщо n малий.

**W5 PR (`feat/visual-v11-shadow-worker`) — тільки після owner OK на W4 report:**

1. Flag + adapter + fallback.
2. Admin tile.
3. Map blockers.
4. `pr:check`.
5. Shadow на одному weekly, не cutover.

## 7. Файли: keep / fold / delete

**Keep і скласти в v11:**

- `visual-auto-claim-v5.ts` (claim parse/validate) — виправити eligibility UX, не викидати
- `visual-affordance-router-v10.ts` (signals) — як `extractVisualV11Signals`
- `visual-integrity-v10.ts` — як mapper у content-sim, після виправлення fallback allow-list
- `visual-generic-svg-v6.ts` — база parametric SVG
- `visual-compiler.ts` `WEEKLY_VISUAL_POLICY` + format IR
- `visual-render-policy.ts` — після T3.1

**Delete after v11 exists (окремий chore PR):**

- `visual-role-router-v7.ts`, `visual-treatment-v7-2.ts`, `visual-specialized-svg-v7-2.ts`
- `visual-specialized-v8.ts`, `visual-hybrid-v6.ts`
- `visual-router-v9.ts`
- `visual-generic-svg.ts`, `visual-generic-svg-v5.ts` якщо v6/v11 покриває
- `visual-affordance-treatment-v10.ts` scene functions після порту
- усі `scripts/visual-compiler-v5|v6|v7|v8|v9-*.ts` one-shots
- 67 workflows (W0)

**Do not import from production until W5:** будь-який `visual-v11-*` лише через adapter + flag.

## 8. Тести, які обов'язково додати (імена)

1. `selectVisualV11Treatment never returns null for holdout fixtures`
2. `ineligible story does not receive mechanism diagram`
3. `metric story renders quantity diagram not null`
4. `gateway/cache story is not routed as session workflow`
5. `Ukrainian headline without English keywords still renders`
6. `two stories of same grammar produce different SVG`
7. `deterministic SVG contains no source-code listings`
8. `label-stripped SVG still exposes data-action and data-outcome hooks`
9. `generated_single imageCalls === 1`
10. `over-budget cinematic falls back to svg or single call`
11. `evaluator does not set generatedTextPresent false by arm`
12. `integrity fallback does not drop core_action_missing`
13. `inferRole does not classify "Stripe" as architecture_transformation`
14. `guardedCertainty never upgrades and never downgrades a released story to expected`
15. `claim parsing does not throw on null summary/why/takeaway`
16. `router grammar matches every OWNER_VISUAL_CALIBRATION_V10 expectedGrammar`
17. `deterministic svg contains markerUnits and no arrow shorter than 60 units`
18. `render at 640x360 keeps every rect inside its panel`
19. `sourceGrounding contains no content word absent from the story text`
20. `pixels-only buffer contains no <text> element`
21. `pairwiseRankingEligible is false for every anatomy blocker`
22. `decideVisualRenderPolicy imageCalls equals plan.execution.imageCalls for all formats`

Поточні тести, що **закріплюють баги**, треба переписати, не «підігнати»:

- будь-який test, що `eligible: false` усе ще дає `same_system_output_variability`
- тести, що очікують літерали `function solve(task)`
- тести, що `select* === null` як успіх для «unsupported story»

## 9. Що PR #229 уже довів (не викидати з голови)

Корисні уроки, не код:

- Одна видима дія + один наслідок читаються краще, ніж opaque tubes / dual_contrast backstage.
- «Одна система, два прогони» як grammar — правильна інтуїція для consistency-новин; реалізація через вигаданий код — ні.
- Owner calibration: cinematic_domain_scene часто preferred; labels не можуть бути єдиним evidence; automated production pass вимкнений — лишити.
- Deterministic SVG дешевший і стабільніший за 6× FLUX, **якщо** сцена parametric і правдива.
- Repair loop «підганяй картинку під того ж суддю 6 раундів» оптимізує eval, не продукт.

## 10. Related pages

- [now](../now.md)
- [marketing/card-images](../marketing/card-images.md)
- [pipeline/content-sim](../pipeline/content-sim.md)
- [pipeline/weekly-digest](../pipeline/weekly-digest.md)
- [ops/weekly-admin-runbook](../ops/weekly-admin-runbook.md)
