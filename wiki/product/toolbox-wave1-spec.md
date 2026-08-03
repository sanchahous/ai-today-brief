# AI Toolbox — Wave 1: settings.json Builder + CLAUDE.md/AGENTS.md Generator (Epic Spec)

Summary: Epic-спека хвилі 1 Toolbox: settings.json Builder і CLAUDE.md/AGENTS.md Generator.
Sources: none (analysis)
Last updated: 2026-06-15


Цей документ — decompose-ready epic-спека для **другої та третьої тулз** розділу «AI Toolbox» (Useful Tools) проєкту `ai-today-brief`. Стратегію, принципи та роадмеп задає [`wiki/product/useful-tools-concept.md`](./useful-tools-concept.md) (концепт v2, вердикт ринку: ship-with-fixes). Перша тулза хвилі — **Prompt Optimizer for Claude (Fable 5)** — уже відвантажена в `main` і слугує референс-архітектурою (`src/lib/prompt-lint.ts` / `prompt-lint-rules.ts`, `src/components/tools/rule-catalog.tsx`, `src/app/[lang]/tools/prompt-optimizer/page.tsx`). Ця спека описує **tool #2 (settings.json Builder)** та **tool #3 (CLAUDE.md/AGENTS.md Generator)**: обидві — повністю client-side, $0-собівартість, counts-only телеметрія, кожна рекомендація з інлайн-цитатою на офіційне джерело. Документ декомпозується автономним оркестратором (Hermes) у child-таски за DAG-ом у розділі «Декомпозиція місії».

> **House style (match `wiki/product/useful-tools-concept.md` exactly):** уся проза — українською; усі `code`, identifiers, schema-ключі, file paths, rule grammar і цитати — англійською/verbatim. Кожна суттєва рекомендація несе inline-цитату на ОФІЦІЙНЕ джерело (`code.claude.com/docs` / `docs.anthropic.com` / Anthropic eng blog) з точним URL. Framing: build / build-later / fold-in; severity-тіри (`critical`/`warning`/`info` або `issue`/`suggestion`/`info`), **без жодного єдиного «health score»**. Усе неперевірене марковане явно.

### Статус хвилі

| # | Тулза | Slug | Вердикт research | Статус |
|---|---|---|---|---|
| 1 | Prompt Optimizer for Claude (Fable 5) | `prompt-optimizer` | **build** | ✅ shipped у `main` (референс-архітектура) |
| 2 | Claude Code settings.json Builder | `settings-builder` | **build** | 📋 ця спека |
| 3 | CLAUDE.md / AGENTS.md Generator | `claude-md-generator` | **build** (lead-magnet/SEO-feeder) | 📋 ця спека |

---

## Спільна архітектура

Обидві тулзи — точна копія патерну `prompt-optimizer`: **дані-як-код + чисті pure-функції (lib, юніт-тести ≥80%) → client-компонент (`'use client'`) → SSG citable-каталог (server-component) → page.tsx (ISR, JSON-LD, hreflang)**. Логіка SEO-захисту verbatim з концепт-доку п.5: захисний актив — не віджет, а evergreen-каталог із цитатами, відрендерений **статичним HTML** (JS-only залишить краулерам порожню оболонку).

Конкретний file-by-file план спільного шару (те, що зачіпають **обидві** тулзи):

| Артефакт | Файл | Дія | Нотатка |
|---|---|---|---|
| Registry (slug union) | `src/content/tools.ts` | widen | Розширити string-literal union `ToolContent['slug']` до `'prompt-optimizer' \| 'settings-builder' \| 'claude-md-generator'`; додати два записи в `TOOLS` (bilingual `title`/`description`/`lede`, `status`, `lastVerified: '2026-06-15'`, `href: (lang) => …`). Тип **widen вручну** — це навмисний редагований union, не inferred. |
| Registry tests | `src/content/tools.test.ts` | extend | `getTool('settings-builder')` та `getTool('claude-md-generator')` повертають валідні записи з `en`+`uk` полями. |
| Page template | `src/app/[lang]/tools/<slug>/page.tsx` | create ×2 | Дзеркало `prompt-optimizer/page.tsx`: `export const revalidate = 86400`; `generateStaticParams()` над `LANGS` (`['en','uk']` — `src/lib/site.ts`); `generateMetadata()` з `canonical` + `alternates.languages` `{ en, uk, 'x-default': en }`; JSON-LD `@graph` через `breadcrumbJsonLd(crumbs, SITE_URL)` (`src/components/breadcrumbs.tsx`). |
| lib (data) | `src/lib/<tool>-rules.ts` | create ×2 | Чисті типізовані дані, кожен елемент із `Citation`/`CitationRef` (`label` + офіційний `url` + `quote: Partial<Record<Lang,string>>`) — дзеркало `PromptCitation` із `prompt-lint-rules.ts`. |
| lib (logic) | `src/lib/<tool>.ts` | create ×2 | Чисті генератор+валідатор, без DOM/React/I/O — дзеркало `prompt-lint.ts`. |
| lib tests | `src/lib/<tool>.test.ts` | create ×2 | Vitest, покриття `*-rules.ts` + `*.ts` ≥80%; data-integrity тест на домени цитат. |
| Client | `src/components/tools/<tool>-client.tsx` | create ×2 | `'use client'`; уся інтерактивність; споживає lib; нуль network-викликів. |
| SSG catalog | `src/components/tools/<tool>-catalog.tsx` | create ×2 | Server-component (без `'use client'`); рендерить дані з `*-rules.ts` як статичний HTML — citable AEO-актив. |
| Telemetry | `@/lib/analytics-client` (`trackEvent`) | reuse | Підпис `trackEvent(name: string, params: Params)`, де `Params = Record<string, string \| number \| boolean \| null \| undefined>` (`src/lib/analytics-client.ts`). **Структурно неможливо передати об'єкт** → counts/enums-only гарантовано типом. Нові event-нейми просто викликають наявний `trackEvent`. |
| i18n strings | strings-файл під `getStrings(lang)` (`src/lib/i18n.ts`) | extend | Додати `settingsBuilder`- і `claudeMdGenerator`-блоки, дзеркало наявного `promptOptimizer`-блоку. |
| Catalog freshness (CI) | CI-джоб хешування docs-сторінок (як для Prompt Optimizer guide, концепт-док п.5) | extend | Розширити список hash-таргетів офіційними сторінками, що живлять нові каталоги (`permissions`, `hooks`, `settings`, `memory`). Деталі — розділ «Глобальні ризики». |

**Спільні інваріанти телеметрії (обидві тулзи):** жоден emit-хелпер не приймає сирий текст користувача (rule-string / command / matcher / поля форми / шляхи / вставлений конфіг). Юніт-тест перевіряє parity з `PromptFinding.evidence` (лише counts/positions). Privacy-обіцянка рендериться в disclaimer-box під H1 кожної сторінки: «100% client-side, $0, ваш ввід ніколи не залишає браузер».

---

## 🔧 Tool #2 — Claude Code settings.json Builder

**slug:** `settings-builder` · **route:** `/[lang]/tools/settings-builder` · **status (registry):** `coming-soon` → `live` at ship · **lastVerified:** `2026-06-15` · **Effort:** дні · **Research-вердикт:** **build** (sharp wedge — див. нижче)

> Узгодження з house style: уся проза — українською; усі identifiers, schema-ключі, file paths, rule grammar і цитати — англійською/verbatim. Кожна суттєва рекомендація щодо `settings.json`/hooks несе inline-цитату на офіційне джерело (`code.claude.com/docs`). Жодного єдиного «health score». Усе неперевірене марковане явно.

---

### (a) Позиціонування & wedge

**Запит доведений, інтерактивних інструментів майже нема.** По запитах «claude code hooks», «claude code permissions», «claude code settings.json» SERP — це статті й GitHub-репи копі-пасту, без валідованого білдера (концепт-док, п.4: «по запитах "claude code hooks/permissions" лише статті, жодного інтерактивного інструмента»).

**Конкуренти існують, але всі тонкі по двох речах, які насправді важать** (з COMPETITION):

| Конкурент | Що вміє | Дірка (наш wedge) |
|---|---|---|
| **claude-settings.nl** | Візуальний client-side редактор, 3-tier scope, import/export, live JSON, presets (Python/JS/Git/Docker) | Permissions — «концептуальна порада», не справжній rule-builder з autocomplete/валідованими Bash-патернами; hooks — документація + селектор подій, **не** курована copy-paste бібліотека рецептів |
| **managed-settings.com / .net** | Toggle-білдер для `settings.json` + `managed-settings.json`, deny/allow/ask, real-time JSON, download обох форматів | Enterprise/admin-ухил (network, sandbox-домени); **нема hook-recipe бібліотеки**; permissions — тогли, не autocompleted rule-construction із safety-presets; не IC-dev workflow |
| **ccbuilder.dev** | Visual drag-and-drop canvas | Це project-scaffolding (orchestrators/subagents/skills/MCP); ноди «Tool Permission»/«Hook» є, але **нема доказів, що вони емітять валідні `settings.json`-правила**; явно нема recipe-бібліотеки |
| **Copy-paste hook repos/blogs** (karanb192/claude-code-hooks, dev.to «20+ recipes», ayautomate «15 best hooks») | Багато готових рецептів як статичні репи/пости | **Жодного інтерактивного білдера**: JSON редагуєш руками, event-нейми й matcher-и зводиш сам; нема UI/валідації/permissions-інтеграції/one-click merge |
| **Built-in `/config`, `/permissions`, `/hooks` + `/fewer-permission-prompts`** | In-CLI TUI покривають базу; `/fewer-permission-prompts` авто-пропонує allowlist | Reactive/per-machine; **нема курованої recipe-бібліотеки, нема shareable web-артефакту, нема education-on-hover по permission-синтаксису** |

**Wedge (verbatim з research-у):** НЕ конкуруємо самим JSON-редактором (там 2–3 тонкі тулзи). Вирішальна, майже незайнята ніша — **курована, тестована hook-recipe бібліотека як інтерактивний, валідований, one-click-mergeable шар**, зрощений із permissions-білдером, що має **Bash-pattern autocomplete + safety-presets** (`deny-rm-rf`, `protect-.env`, `deny-secrets`) і **inline education по permission-синтаксису**. Виграємо на: глибині рецептів (≈14–30 реально-тестованих рецептів: format-on-write, typecheck/test-gate, block-dangerous-bash, secret-scan, notify), **copy-merge у наявний конфіг без клобера**, і shareable-URL командної політики.

**E-E-A-T:** ми догфудимо ці конфіги щодня (концепт-док п.4) → миттєвий authority-сигнал; кожна рекомендація — з цитатою на `code.claude.com/docs`.

---

### (b) UX & фічі

Уся інтерактивна частина — у `src/components/tools/settings-builder-client.tsx` (`'use client'`), повністю client-side. Чотири панелі + живий вивід.

**1. Visual permissions-rule builder** (allow / deny / ask)

- Три колонки-кошики: **deny**, **ask**, **allow**. Над ними — постійний explainer-банер про порядок оцінки: *deny спрацьовує першим, потім ask, потім allow; специфічність правила НЕ змінює порядок* ([permissions](https://code.claude.com/docs/en/permissions)). Це підкреслено, бо інтуїція «специфічніше = виграє» — хибна.
- **Rule grammar input** з autocomplete і live-валідацією. Підтримувані форми: `Tool` (bare) та `Tool(specifier)`:
  - `Bash`, `Bash(npm run *)`, `Bash(git * main)` — wildcard `*` у будь-якій позиції ([permissions](https://code.claude.com/docs/en/permissions)).
  - `Read(./src/**)`, `Edit(/docs/*)` — gitignore-синтаксис з чотирма якорями: `//` (absolute), `~/` (home), `/` (project root), `./` (cwd) ([permissions](https://code.claude.com/docs/en/permissions)).
  - `WebFetch(domain:example.com)`, `WebFetch(domain:*.example.com)` — `domain:`-префікс, case-insensitive, `*`-wildcards ([permissions](https://code.claude.com/docs/en/permissions)).
  - `mcp__github__*`, `mcp__github__get_*` — MCP-нейминг `mcp__<server>__<tool>` ([permissions](https://code.claude.com/docs/en/permissions)). *⚠️ Уточнення:* нюанс «glob-free server segment» research-ем НЕ підтверджено остаточно (`stillUncertain`) — у білдері НЕ генеруємо `*` у server-сегменті й маркуємо це інлайн як обмеження.
  - `Agent(Explore)`, `Agent(ReviewAgent)`.
- **Education-on-hover** на кожному правилі: bare deny (`Bash`) **прибирає тул з контексту цілком**, scoped deny (`Bash(rm *)`) **блокує лише матч, лишаючи тул доступним** ([permissions](https://code.claude.com/docs/en/permissions)). Це чітко показуємо різними іконками (🚫 «removed from context» vs ⛔ «call blocked»).
- **Safety-presets** (one-click, додають у deny-кошик): `deny-rm-rf` (`Bash(rm -rf *)`), `protect-env` (`Edit(.env)`, `Edit(./**/.env)`), `deny-secrets` (`Read(.env)`, `Read(./**/secrets.json)`), `deny-force-push` (`Bash(git push -f *)`). Кожен пресет несе цитату й короткий «навіщо».
- **`defaultMode` селектор** (емітиться як **`permissions.defaultMode`** — nested-ключ усередині `permissions`-обʼєкта, НЕ top-level `defaultMode` і НЕ `permissions.mode`; офіційно: «Set the `defaultMode` in your settings files»): значення `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions`. Інлайн-попередження: `bypassPermissions` все одно промптить для критичних шляхів типу `rm -rf /`, а `dontAsk` авто-денить усе непреапрувлене ([permissions](https://code.claude.com/docs/en/permissions)).
- **`additionalDirectories`** редактор (список шляхів) з явним дисклеймером: додаткові директорії дають file-access, але **НЕ** вантажать повну конфігурацію (винятки — skills у `.claude/skills/`, plugin-settings, CLAUDE.md лише при `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`) ([settings](https://code.claude.com/docs/en/settings)).

**2. Citable hook-recipe library** (головний wedge)

- Сітка карток рецептів, фільтрована за **event** (`SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, `Notification`, `FileChanged`, …) і **тегом** (format / lint / safety / secret-scan / notify / context / audit). Кожна картка: назва, event, matcher, команда (read-only, з підсвіткою), use-case, **severity/caveat-банер** (security-нотатка verbatim з рецепта — напр. «Hooks execute arbitrary shell with user credentials») і **цитата на офіційний guide**.
- Кожна картка має кнопку **«Add to config»** → рецепт мерджиться у hooks-чернетку (порядок: event → масив matcher+hooks). Безпечні дефолти: рецепти типу `command`; для `prompt`/`agent`-based рецептів (Code-Quality-Review, Verify-Tests-&-Build) генеруємо `"type": "prompt"`/`"type": "agent"` skeleton із позначкою «EXPERIMENTAL — config may change» (verbatim caveat).
- Рецепти, що йдуть у бібліотеку (з HOOK RECIPES, дослівні caveat-и зберігаються):

| Recipe id | Event | Matcher | Теги |
|---|---|---|---|
| `format-on-write-prettier` | `PostToolUse` | `Edit\|Write` | format |
| `lint-ts-eslint` | `PostToolUse` | `Edit\|Write` | lint |
| `block-dangerous-bash` | `PreToolUse` | `Bash` | safety |
| `protect-sensitive-files` | `PreToolUse` | `Edit\|Write` | safety, secret-scan |
| `notify-permission-desktop` | `Notification` | `permission_prompt` | notify |
| `notify-stop-telegram` | `Stop` | `` (empty) | notify |
| `audit-bash-log` | `PostToolUse` | `Bash` | audit |
| `reinject-context-on-compact` | `SessionStart` | `compact` | context |
| `autoload-env-direnv` | `SessionStart` | `` (empty) | env |
| `enforce-conventional-commits` | `PreToolUse` | `Bash` | safety |
| `test-gate-on-stop` | `Stop` | `` (empty) | safety |
| `code-quality-review-prompt` | `Stop` | `` (empty) | quality (`type: prompt`) |
| `verify-tests-build-agent` | `Stop` | `` (empty) | quality (`type: agent`, EXPERIMENTAL) |
| `watch-env-reload-direnv` | `FileChanged` | `.env\|.envrc` | env |

- **Matcher-валідатор** інлайн пояснює синтаксис: букви/цифри/`_`/`|` — exact-string; будь-який інший символ перемикає у JavaScript-regex-режим (тобто `^Notebook`, `.`, `*` поза word-boundary → regex) ([hooks-guide](https://code.claude.com/docs/en/hooks-guide)).
- **Exit-code пам'ятка** на safety-рецептах: exit `0` = success (parse JSON output), exit `2` = blocking error (prevents action), інші коди = non-blocking error ([hooks](https://code.claude.com/docs/en/hooks)). Для `test-gate-on-stop` показуємо caveat про `stop_hook_active` (loop-guard). *⚠️ «блокує 8 разів поспіль» — НЕ підтверджено офіційно (`stillUncertain`); у тексті caveat-у пишемо нейтрально «can block repeated stops» без конкретного числа.*

**3. Live JSON preview**

- Права/нижня панель: повний `settings.json` рендериться в реальному часі з усіх чотирьох панелей. Підсвітка синтаксису; невалідні правила (з валідатора) показуються як inline-warning, але не клобрять решту виводу.
- Тогл **target-scope** (впливає на коментар-хедер і download-ім'я, не на структуру): User (`~/.claude/settings.json`), Shared project (`.claude/settings.json`), Local project (`.claude/settings.local.json`). Managed — окремо, з попередженням, що ключі типу `claudeMd`/`allowManagedHooksOnly` валідні лише в managed-scope.

**4. Copy / download settings.json + merge**

- **Copy** (весь JSON у буфер) і **Download** (`settings.json` / `settings.local.json` за scope). Жоден запис на FS користувача ми не робимо — лише завантаження файлу браузером (non-goal нижче).
- **Merge mode (key wedge):** користувач вставляє наявний `settings.json` → генератор робить deep-merge **без клобера**: `permissions.allow/deny/ask` і `additionalDirectories` об'єднуються як union із дедупом; `hooks[event]` масиви — append із дедупом по (matcher + command); скалярні ключі (`model`, `defaultShell`, …) — конфлікт показується як diff, користувач обирає.

**5. «Where does this go» hierarchy explainer** (SSG + інтерактивний акордеон)

Прецеденс рендериться як статична таблиця (precedence verbatim з research-у):

| Scope | Path | Precedence |
|---|---|---|
| Managed (enterprise) | `/Library/Application Support/ClaudeCode/`, `/etc/claude-code/`, `C:\Program Files\ClaudeCode\` (+ `managed-settings.d/`) | 1 (highest) — не переб'є ніщо, навіть CLI |
| Command line arguments | `--flag` (напр. `--model`, `--add-dir`) | 2 |
| Local project settings | `.claude/settings.local.json` (зазвичай gitignored) | 3 |
| Shared project settings | `.claude/settings.json` (комітиться для команди) | 4 |
| User settings | `~/.claude/settings.json` | 5 (lowest) |

Інлайн-нота: якщо тул задено на будь-якому рівні — жоден інший рівень не може його дозволити ([settings](https://code.claude.com/docs/en/settings)). Windows-шляхи нормалізуються в POSIX перед матчингом (`C:\Users\alice` → `/c/Users/alice`; для `.env` на C: → `//c/**/.env`) ([permissions](https://code.claude.com/docs/en/permissions)).

**Privacy-обіцянка** (рендериться в disclaimer-box під H1, як у prompt-optimizer): «100% client-side, $0, ваш конфіг ніколи не залишає браузер». Дзеркалить formula концепт-доку п.3.

---

### (c) Дані-як-код

Дзеркалимо `prompt-lint-rules.ts` / `prompt-lint.ts`: чисті дані + чисті генератор/валідатор-функції, юніт-тести ≥80%, споживаються клієнтом.

**`src/lib/settings-builder-rules.ts`** — типізовані дані (permission-шаблони + hook-рецепти). Цитати несуть `quote: Partial<Record<Lang,string>>`, як `PromptCitation`:

```ts
import type { Lang } from './site';

export type RuleEffect = 'allow' | 'deny' | 'ask';
export type PermissionMode =
  | 'default' | 'acceptEdits' | 'plan' | 'auto' | 'dontAsk' | 'bypassPermissions';
export type SettingsScope = 'user' | 'project' | 'local' | 'managed';
export type RuleTool =
  | 'Bash' | 'Read' | 'Edit' | 'Write' | 'WebFetch' | 'Agent' | 'MCP';
// Curated subset of the most common Claude Code hook events for the settings-builder UI.
// The official reference lists 30+ events (https://code.claude.com/docs/en/hooks); this tool
// focuses on the common session / tool-use / file / notification events. Subset is intentional.
export type HookEvent =
  | 'SessionStart' | 'SessionEnd' | 'UserPromptSubmit'
  | 'PreToolUse' | 'PostToolUse' | 'PostToolUseFailure' | 'PermissionRequest'
  | 'Stop' | 'StopFailure' | 'FileChanged' | 'ConfigChange'
  | 'PreCompact' | 'Notification' | 'SubagentStop' | 'CwdChanged';
export type HookType = 'command' | 'http' | 'mcp_tool' | 'prompt' | 'agent';
export type RecipeTag =
  | 'format' | 'lint' | 'safety' | 'secret-scan' | 'notify'
  | 'context' | 'audit' | 'env' | 'quality';
export type Severity = 'critical' | 'warning' | 'info'; // tier, NOT a score

export interface Citation {
  label: string;
  url: string; // official only: code.claude.com/docs/* | docs.anthropic.com/* | anthropic eng blog
  quote: Partial<Record<Lang, string>>;
}

/** Safety / starter permission rule templates (deny-rm-rf, protect-.env, …). */
export interface PermissionTemplate {
  id: string;                       // 'deny-rm-rf'
  effect: RuleEffect;
  tool: RuleTool;
  rule: string;                     // verbatim grammar, e.g. 'Bash(rm -rf *)'
  title: Record<Lang, string>;
  rationale: Record<Lang, string>; // "навіщо"
  severity: Severity;
  citations: readonly Citation[];
}

/** Curated, tested hook recipes — the wedge. */
export interface HookRecipe {
  id: string;                       // 'format-on-write-prettier'
  event: HookEvent;
  matcher: string;                  // '' allowed; 'Edit|Write'; '^Notebook'
  hookType: HookType;
  command?: string;                 // verbatim for type:'command'
  prompt?: string;                  // for type:'prompt'
  model?: string;                   // optional, prompt/agent recipes
  tags: readonly RecipeTag[];
  title: Record<Lang, string>;
  useCase: Record<Lang, string>;
  caveat: Record<Lang, string>;     // security/severity note, verbatim-faithful
  severity: Severity;
  experimental?: boolean;           // agent-based recipes
  citations: readonly Citation[];
}

/** Grammar reference rows for the SSG catalog (anchors, wildcards, domain:, mcp__). */
export interface GrammarRow {
  pattern: string;                  // 'Read(./src/**)'
  meaning: Record<Lang, string>;
  citations: readonly Citation[];
}

/** Precedence table rows for the hierarchy explainer (SSG). */
export interface ScopeRow {
  scope: SettingsScope | 'cli';
  path: string;
  precedence: number;               // 1..5 (1 = highest)
  note: Record<Lang, string>;
  citations: readonly Citation[];
}

export const PERMISSION_TEMPLATES: readonly PermissionTemplate[] = [/* … */];
export const HOOK_RECIPES: readonly HookRecipe[] = [/* … table above … */];
export const GRAMMAR_REFERENCE: readonly GrammarRow[] = [/* … */];
export const SCOPE_HIERARCHY: readonly ScopeRow[] = [/* … */];
export const PERMISSION_MODES: readonly PermissionMode[] = [
  'default', 'acceptEdits', 'plan', 'auto', 'dontAsk', 'bypassPermissions',
];

export function getRecipe(id: string): HookRecipe | undefined { /* … */ }
```

**`src/lib/settings-builder.ts`** — чистий генератор + валідатор (без DOM, без I/O), дзеркало `prompt-lint.ts`:

```ts
export interface BuilderState {
  scope: SettingsScope;
  mode?: PermissionMode;            // emitted as permissions.defaultMode (nested; NOT top-level, NOT permissions.mode)
  permissions: { allow: string[]; deny: string[]; ask: string[] };
  additionalDirectories: string[];
  hooks: { event: HookEvent; matcher: string; recipeId: string }[];
  scalars?: { model?: string; defaultShell?: 'bash' | 'powershell'; /* validated enums */ };
}

export interface RuleValidation {
  rule: string;
  ok: boolean;
  reasonId?: string;                // enum id only, e.g. 'unknown-tool' | 'bad-mcp-glob'
}

/** Validate a single permission rule against the supported grammar. Pure. */
export function validatePermissionRule(rule: string): RuleValidation { /* … */ }

/** Validate a hook matcher (exact-string vs regex-mode detection). Pure. */
export function validateMatcher(event: HookEvent, matcher: string): RuleValidation { /* … */ }

/** Build a valid settings.json object from state. Pure, deterministic. */
export function buildSettings(state: BuilderState): Record<string, unknown> { /* … */ }

/** Deep-merge generated settings INTO an existing parsed config, no clobber.
 *  Arrays (allow/deny/ask, additionalDirectories, hooks[event]) = dedup-union/append;
 *  scalar conflicts surfaced, never silently overwritten. Pure. */
export function mergeSettings(
  existing: Record<string, unknown>,
  generated: Record<string, unknown>,
): { merged: Record<string, unknown>; conflicts: string[] } { /* … */ }
```

Інваріанти, які гарантує генератор/валідатор (узгоджено з VERIFIED CORRECTIONS):
- режим завжди йде як **`permissions.defaultMode`** (nested усередині `permissions`-обʼєкта); НІКОЛИ не як top-level `defaultMode` і НІКОЛИ не як `permissions.mode` (офіц. джерело: [permissions](https://code.claude.com/docs/en/permissions) — «Set the `defaultMode` in your settings files»).
- `includeCoAuthoredBy` НЕ генерується — використовуємо `attribution` (object з `commit`/`pr`) як заміну deprecated-ключа (correction).
- `effortLevel` валідатор приймає лише `'low' | 'medium' | 'high' | 'xhigh'` — `'max'` НЕ існує в офіційній схемі (`xhigh` — найвищий рівень: [settings](https://code.claude.com/docs/en/settings)). Якщо `'max'` зʼявиться в майбутньому релізі — re-verify перед додаванням.
- `cleanupPeriodDays` — мінімум `1` (валідатор відкидає `0`/негативні).
- Permissions-масиви впорядковані стабільно; deny/ask/allow семантика лишається коректною незалежно від порядку UI-вводу.

---

### (d) SSG citable catalog

Серверний компонент `src/components/tools/settings-catalog.tsx` (дзеркало `rule-catalog.tsx`) — рендериться як **статичний HTML на сторінці** (це citable AEO-актив; JS-only каталог лишив би краулерам порожню оболонку — концепт-док п.5, SEO-обв'язка). Складається з трьох статичних секцій:

1. **Permission rule grammar reference** — таблиця з `GRAMMAR_REFERENCE`: кожен рядок = `pattern` (mono) + значення + цитата. Покриває чотири anchor-типи (`//`, `~/`, `/`, `./`), Bash-wildcards, `WebFetch(domain:*)`, `mcp__server__tool`, `Agent(Name)`, і різницю bare-deny vs scoped-deny.
2. **Hook recipe table** — повна таблиця з `HOOK_RECIPES` (id, event, matcher, use-case, severity-tier, caveat, цитата). Кожен рецепт як `<article>` зі статичним `<pre>`-блоком команди — це і є те, що цитуватимуть Perplexity/ChatGPT по «claude code hooks recipes».
3. **Scope hierarchy / precedence** — статична таблиця з `SCOPE_HIERARCHY` (та сама, що в п.b-5) + примітка «deny на будь-якому рівні не переб'ється».

Severity рендериться тірами (`critical`/`warning`/`info`), не числом — **без жодного aggregate score** (узгоджено з house style та концепт-доком п.5).

---

### (e) Telemetry

`trackEvent(name, props)` з `@/lib/analytics-client` — **тільки counts та enums, ніколи вміст конфіга/правил/команд** (дзеркало `PromptFinding.evidence`, що повертає лише counts/positions). `Params` за типом — `string | number | boolean | null | undefined`, тож структурно неможливо передати об'єкт конфіга.

| Event | Props (enums/counts only) |
|---|---|
| `tool_settings_view` | `{ lang }` |
| `tool_settings_recipe_add` | `{ recipe_id, event, tag }` — id рецепта (наш статичний enum), не команда |
| `tool_settings_recipe_remove` | `{ recipe_id }` |
| `tool_settings_preset_add` | `{ preset_id }` (напр. `deny-rm-rf`) |
| `tool_settings_rule_add` | `{ effect, tool }` — `deny`/`Bash`; **ніколи сам rule-string** |
| `tool_settings_rule_invalid` | `{ tool, reason_id }` — enum-причина, не текст правила |
| `tool_settings_mode_change` | `{ mode }` |
| `tool_settings_scope_change` | `{ scope }` |
| `tool_settings_merge` | `{ conflict_count }` (число), `{ had_existing: boolean }` |
| `tool_settings_export` | `{ scope, recipe_count, allow_count, deny_count, ask_count }` — самі лічильники |
| `tool_settings_copy` | `{ scope }` |

Заборонено в props: будь-який `rule`-string, `command`, `matcher`-текст, шляхи з `additionalDirectories`, вставлений existing-config. Юніт-тест перевіряє, що жоден emit-хелпер не приймає таких полів.

---

### (f) SEO / AEO

- **H1 (EN):** «Free Claude Code settings.json Builder — Permissions & Hooks» · **(UK):** «Безкоштовний білдер `settings.json` для Claude Code — permissions і hooks». Визначення в перших 300 словах; лінки на концепт-хаби й офіційні доки.
- **Target keywords** (з COMPETITION/SERP-аналізу): `claude code settings.json`, `claude code permissions`, `claude code hooks` / `claude code hooks recipes` / `claude code hooks examples`, `claude code settings.local.json`, `claude code permission rules`, `block dangerous bash claude code`, `format on save claude code hook`. Wedge-сторінки бере long-tail recipe/permission-запити, а НЕ generic «settings editor».
- **JSON-LD `@graph`** (дзеркало prompt-optimizer page.tsx):
  - `WebApplication` — `applicationCategory: 'DeveloperApplication'`, `operatingSystem: 'Web browser'`, `isAccessibleForFree: true`, `inLanguage: lang`, `publisher` Organization.
  - `TechArticle` — `dateModified = tool.lastVerified` (`2026-06-15`), `headline`, `mainEntityOfPage`, `isAccessibleForFree: true`.
  - `breadcrumbJsonLd(crumbs, SITE_URL)`.
- **Metadata:** `export const revalidate = 86400`; `generateStaticParams()` над `LANGS`; `generateMetadata()` з `canonical` + `hreflang` alternates (`en`, `uk`, `x-default → en`) — точно як у наявній page.tsx.
- **Registry:** розширити string-literal union у `ToolContent.slug` до `'prompt-optimizer' | 'settings-builder'` і додати запис у `TOOLS` (title/description/lede `Record<Lang>`, `lastVerified: '2026-06-15'`, `status`, `href: (lang) => `/${lang}/tools/settings-builder``).
- *Нота (як у концепт-доку п.5):* FAQPage-розмітку (якщо додамо) трактуємо лише як LLM-інгест-актив, не як SERP-rich-result.

---

### (g) Acceptance criteria (testable)

- [ ] `src/content/tools.ts`: `ToolContent.slug` union розширено до `'settings-builder'`; `getTool('settings-builder')` повертає валідний запис із title/description/lede для `en` і `uk`.
- [ ] `src/app/[lang]/tools/settings-builder/page.tsx`: `revalidate === 86400`; `generateStaticParams()` дає по запису на кожну з `LANGS`; `generateMetadata()` повертає `canonical` + три hreflang (`en`/`uk`/`x-default`); JSON-LD `@graph` містить рівно `WebApplication`, `TechArticle` (з `dateModified === tool.lastVerified`), `BreadcrumbList`.
- [ ] `buildSettings(state)` детермінований (однаковий вхід → байт-ідентичний вихід) і завжди продукує JSON, що парситься.
- [ ] `buildSettings` емітить режим як `permissions.defaultMode` (nested); НІКОЛИ як top-level `defaultMode` чи `permissions.mode`. (test)
- [ ] `buildSettings` не емітить `includeCoAuthoredBy`; для атрибуції використовує `attribution`. (test)
- [ ] `validatePermissionRule` приймає `Bash(npm run *)`, `Read(./src/**)`, `Edit(/docs/*)`, `WebFetch(domain:*.example.com)`, `mcp__github__get_*`, `Agent(Explore)`, bare `Bash`; відхиляє синтаксично невалідні з `reasonId` (enum). (test)
- [ ] `validateMatcher` коректно розрізняє exact-string (`Bash`, `Edit|Write`) vs regex-режим (`^Notebook`, `mcp__.*__write`), і приймає порожній matcher. (test)
- [ ] `effortLevel`-валідатор приймає лише `low|medium|high|xhigh` (відхиляє `max` та інші); `cleanupPeriodDays` відхиляє `< 1`. (test)
- [ ] `mergeSettings(existing, generated)` робить union/append із дедупом для `permissions.*`, `additionalDirectories`, `hooks[event]`, повертає `conflicts[]` для скалярних колізій, і **ніколи не клобрить** наявні значення мовчки. (test)
- [ ] Кожен запис у `HOOK_RECIPES`, `PERMISSION_TEMPLATES`, `GRAMMAR_REFERENCE`, `SCOPE_HIERARCHY` має ≥1 `Citation` з URL на `code.claude.com/docs`, `docs.anthropic.com` або Anthropic eng blog. (test: валідація доменів цитат)
- [ ] SSG-каталог (`settings-catalog.tsx`) рендериться як статичний HTML: усі recipe-рядки, grammar-рядки і scope-рядки присутні у server-output без JS (тест перевіряє, що рендер не залежить від `'use client'`).
- [ ] Телеметрія: жоден emit-хелпер не приймає `rule`/`command`/`matcher`/path/config-текст; props обмежені enums/counts. (test)
- [ ] Покриття юніт-тестами на `src/lib/settings-builder-rules.ts` + `src/lib/settings-builder.ts` **≥ 80%**.
- [ ] Privacy-disclaimer-box присутній під H1 і стверджує 100% client-side / $0 / конфіг не залишає браузер.

---

### (h) Non-goals

- **Жодного сервера / бекенду** — уся логіка client-side; нуль network-викликів зі сторінки тулзи.
- **Жодного акаунта / signup / paywall.**
- **Жодного запису у файлову систему користувача** — лише browser-download файлу та copy-to-clipboard; ми не торкаємось реального `~/.claude/` чи `.claude/`.
- **Це НЕ MCP-config builder** — генерація `.mcp.json` / `claude mcp add` поза скоупом (концепт-док: MCP-конфіг реалізується як фіча каталогу MCP-серверів у Фазі 3); тут лише permission-правила виду `mcp__server__tool`.
- **Не валідуємо semantics поведінки hooks у рантаймі** — лише синтаксис matcher-а/правила та структуру JSON; ми не виконуємо команди (за дизайном; security-caveat-и рецептів — verbatim з офіційного guide).
- **Не enterprise admin-консоль** — managed-scope підтримуємо як вихідний формат із попередженнями, але не дублюємо повний managed-only набір (`allowManagedHooksOnly`, sandbox-домени тощо) як first-class UI у першій хвилі; маркуємо як out-of-scope-for-now.
- **Без єдиного «health/security score»** конфіга — лише severity-тіри на окремих рекомендаціях (узгоджено з house style).

---

## 📝 Tool #3 — CLAUDE.md / AGENTS.md Generator

**Slug:** `claude-md-generator` · **Маршрут:** `/[lang]/tools/claude-md-generator` · **Effort:** 1–2 дні · **Вердикт research:** `build` (попит росте швидко, конкуренція фрагментована) — але з ясною поправкою нижче.

---

### (a) Позиціонування & wedge

**Чесний вердикт ринку: ніша CROWDED.** Існує 8+ безкоштовних інтерактивних генераторів; «encode best practices» — це вже table stakes (codewithclaude.net, [Keeborg](https://www.keeborg.com/generate/claude-md), [ClaudeForge](https://github.com/alirezarezvani/claudeforge) усі це роблять); навіть **dual output вже відвантажений** — ClaudeForge робить CLAUDE→AGENTS конвертацію (symlink/copy/inline-chain), а [exampleconfig.com](https://exampleconfig.com/tools/claude-md-generator) і [Apify-актори](https://apify.com/ianymu/claudemd-generator) дають парні CLAUDE.md+AGENTS.md. SERP по «claude.md generator» на першій сторінці — Medium-пости, GitHub, Apify, Keeborg, codewithclaude, mcpmarket, exampleconfig.

**Тому позиціонування — НЕ standalone-ставка, а lead-magnet / SEO-фідер для Tool #1 (Prompt Optimizer) і Tool #2 (settings.json Builder).** Внутрішні лінки в обидва боки; CTA «згенерував CLAUDE.md → перевір промпти / збери settings.json».

**Залишкові тонкі wedge-и (єдине, чим можна відрізнитись), у порядку сили:**

| Wedge | Чому виживає проти конкурентів | Severity |
|---|---|---|
| **Один source-of-truth + правильна проводка обох файлів** (symlink **АБО** `@AGENTS.md`-import у CLAUDE.md), плюс scoping-правила, яких AGENTS.md **не має** (user-level vs path-scoped `.claude/rules/`) | ClaudeForge — це CLI-**плагін**, не zero-install веб; form-only тулзи видають один файл або два неузгоджені. Проводка «одне джерело правди» + Claude-specific scoping — те, чого web-тулзи не покривають | core |
| **Вбудований best-practice linter входів** (signal-density, length-cap, фільтр «недискаверабельного-only», vague-детект) | codewithclaude/Keeborg генерують, але не **критикують** ваш ввід; це наш фірмовий детермінізм+цитати-стиль (як у Prompt Optimizer) | core |
| **Кожна секція з інлайн-цитатою на офіційне джерело** | Конкуренти подають best practices як аксіоми без атрибуції; наш E-E-A-T = цитата на [docs](https://docs.anthropic.com) на кожній рекомендації | differentiator |

**Чому dual output усе ж центральний (попри комодитизацію):** AGENTS.md — крос-тулзовий стандарт (запропонований OpenAI у серпні 2025, під егідою Linux Foundation Agentic AI Foundation), його читають **30+ агентів** (Claude Code, GitHub Copilot, Codex CLI, Cursor, Aider, Windsurf, Devin, Gemini CLI, Amazon Q) у **60 000+ репозиторіях** ([agents.md](https://agents.md/), [github.com/agentsmd/agents.md](https://github.com/agentsmd/agents.md)). CLAUDE.md — Claude-Code-specific і виразніший: підтримує `@path`-імпорти, lazy-loaded `.claude/rules/`, memory-tier scoping ([code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory)). Канонічний патерн: **AGENTS.md як універсальний baseline + CLAUDE.md як Claude-розширення** через symlink (`ln -s AGENTS.md CLAUDE.md`) або `@AGENTS.md`-import зверху CLAUDE.md ([code.claude.com/docs/en/memory#agents-md](https://code.claude.com/docs/en/memory#agents-md)). Наша тулза **емітить обидва з однієї моделі** і явно показує проводку — це і є «correct wiring», яке робить dual output реальним, а не косметичним.

> **Skeptic-note (позначено явно):** «60 000+ репо / 30+ агентів / 28.6% runtime reduction» — цифри з вторинних джерел ([morphllm](https://www.morphllm.com/agents-md-guide), [blog.buildbetter.ai](https://blog.buildbetter.ai/agents-md-complete-guide-for-engineering-teams-in-2026/)), НЕ з первинного бенчмарку Anthropic. На сторінці подаємо їх як «за даними екосистеми AGENTS.md» з лінком, а не як власний вимір. Не вигадувати точніших чисел.

---

### (b) UX & фічі

**Guided form (повністю client-side, $0, ввід не залишає браузер):**

1. **Project name + one-line domain** → секція *Project Overview* ([purpose: «describe domain, language, framework, versions so agents understand scope upfront»](https://code.claude.com/docs/en/memory)).
2. **Stack/мова/фреймворк** — пресет-дропдаун (див. нижче) + версії.
3. **Build / Test / Lint / Type-check commands** — окремі поля; це найвищий-ROI блок ([«provide exact, copy-paste-able commands»](https://code.claude.com/docs/en/memory#write-effective-instructions); анти-патерн — stale `npm test` коли проєкт перейшов на `pnpm`).
4. **Conventions** — formatting, naming, library prefs, «тільки те, що відрізняється від дефолтів мови/фреймворку» ([best practice: top-5 conventions + top-5 anti-patterns](https://blog.buildbetter.ai/agents-md-complete-guide-for-engineering-teams-in-2026/)).
5. **Do-not-touch / Security** — секрети (де лежать, не самі значення), «never commit», «never read» ([Security purpose](https://code.claude.com/docs/en/memory); анти-патерн — класти ключі в CLAUDE.md замість `.env`/`CLAUDE.local.md`).
6. **PR / commit rules** — branch naming, Conventional Commits, PR LOC-cap, merge strategy.
7. **(Optional toggles)** — *Architecture & Project Structure* (2–3-рівневе дерево), *Boundaries* (always / ask-first / never), *Testing Instructions*.

**Пресети мова/фреймворк** (заповнюють дефолтні build/test/lint-команди як стартові плейсхолдери, які користувач редагує): `node-next`, `node-vite`, `python-fastapi`, `python-uv`, `go`, `rust-cargo`, `generic`. Кожен пресет тегований цитатою на джерело best-practice, не на «офіційну команду фреймворку» (щоб не вгадувати — позначаємо плейсхолдери як **editable defaults, verify before use**).

**Section toggles** — увімкнути/вимкнути будь-яку з 9 секцій; ядро (Overview / Build&Test / Code Style / Security / Commit&PR) увімкнене за замовчуванням, *Architecture / Boundaries / Testing* — опційні (мапінг 1:1 на `sections[]` з research-інпуту).

**Live preview ОБОХ файлів side-by-side:**
- ліва панель — `AGENTS.md` (universal baseline, **zero** Claude-specific синтаксису — анти-патерн: писати в AGENTS.md `.cursorrules` MDC або CLAUDE.md `@imports`, що ламає інші тулзи);
- права панель — `CLAUDE.md` = `@AGENTS.md`-import зверху + Claude-only-доповнення (memory-tier, path-scoped rules);
- toggle проводки: **«symlink»** (`ln -s AGENTS.md CLAUDE.md`, коли Claude-доповнень нема) vs **«@import»** (коли є).

**«Де це покласти» explainer** (hierarchy + import) — статичний блок під формою, повна ієрархія завантаження ([code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory)):

| Рівень | Шлях | Призначення |
|---|---|---|
| Managed policy | macOS `/Library/Application Support/ClaudeCode/CLAUDE.md` · Linux/WSL `/etc/claude-code/CLAUDE.md` · Windows `C:\Program Files\ClaudeCode\CLAUDE.md` | org-wide, не оверрайдиться |
| User | `~/.claude/CLAUDE.md` | особисті преференси через усі проєкти |
| Project | `./CLAUDE.md` або `./.claude/CLAUDE.md` | team-shared, у git |
| Local | `./CLAUDE.local.md` (gitignored) | особисті per-project оверрайди |

Плюс `@path`-синтаксис ([code.claude.com/docs/en/memory#import-additional-files](https://code.claude.com/docs/en/memory#import-additional-files)): `@path`, `@~/path`; resolve відносно файлу-носія; рекурсія до 4 hops; **завантажуються при старті й їдять контекст** (не lazy); перший зовнішній import тригерить security-approval dialog. І `.claude/rules/` з YAML-frontmatter `paths: ["src/api/**/*.ts"]` — вантажиться лише при доступі до matching-файлів ([code.claude.com/docs/en/memory#organize-rules-with-claude-rules-](https://code.claude.com/docs/en/memory#organize-rules-with-claude-rules-)).

**Вбудований best-practice linter входів** (детермінований, як Prompt Optimizer — severity-tiered, БЕЗ єдиного «health score»):

| Lint-правило | Тригер | Рекомендація | Severity |
|---|---|---|---|
| `length-cap` | сумарно > 200 рядків | «тримати під 200 рядків; деталі → path-scoped `.claude/rules/` або `@docs/*.md`» ([memory#best-practices](https://code.claude.com/docs/en/memory)) | issue |
| `vague-guidance` | «format nicely / test properly / keep it clean» | замінити на конкретні команди/приклади ([memory#write-effective-instructions](https://code.claude.com/docs/en/memory#write-effective-instructions)) | issue |
| `missing-build-cmd` | секція Build/Test без жодної копіпейст-команди | додати exact команди | issue |
| `non-discoverable-only` | секція дублює `README`/`package.json` | використати `@README.md` / `@package.json`-import замість копії (DRY, уникає drift) | suggestion |
| `no-code-examples` | конвенції без жодного fenced-блоку | додати 1–2 приклади (commit-формат, request/response shape) ([«one example beats 10 rules»](https://blog.buildbetter.ai/agents-md-complete-guide-for-engineering-teams-in-2026/)) | suggestion |
| `missing-security` | нема секції Security | додати «де секрети / never commit / що валідувати» | suggestion |
| `secrets-inline` | у вводі схоже на ключ/токен/пароль | НІКОЛИ не класти в CLAUDE.md; → `.env` / `CLAUDE.local.md` (gitignored) | issue |
| `dense-prose` | абзаци без headers/bullets | структурувати markdown-заголовками й списками ([memory#write-effective-instructions](https://code.claude.com/docs/en/memory#write-effective-instructions)) | suggestion |

> linter працює над **полями форми**, не над завантаженим репо (див. Non-goals). Дисклеймер на виводі: «евристика, не вирок».

**Copy / Download:** кнопки `copy` і `download` для кожного файлу окремо + «download both» (видає `AGENTS.md` + `CLAUDE.md`); для symlink-режиму поряд показуємо команду `ln -s AGENTS.md CLAUDE.md` (copy-only, ми нічого не виконуємо).

---

### (c) Дані-як-код

Дзеркалимо `prompt-lint-rules.ts` / `prompt-lint.ts`.

**`src/lib/claude-md-rules.ts`** — чисті типізовані дані, кожен елемент тегований `CitationRef` (label + офіційний URL + bilingual quote, як `PromptCitation`):

```ts
import type { Lang } from './site';

export type StackPreset =
  | 'node-next' | 'node-vite' | 'python-fastapi' | 'python-uv'
  | 'go' | 'rust-cargo' | 'generic';
export type SectionId =
  | 'project-overview' | 'build-test' | 'code-style' | 'testing'
  | 'security' | 'commit-pr' | 'architecture' | 'boundaries';
export type WiringMode = 'symlink' | 'import';
export type LintSeverity = 'issue' | 'suggestion' | 'info';

export interface CitationRef {
  label: string;
  url: string;                         // docs.claude.com / docs.anthropic.com / Anthropic eng blog ONLY
  quote: Partial<Record<Lang, string>>;
}

export interface SectionTemplate {
  id: SectionId;
  heading: string;                     // verbatim markdown heading, e.g. "# Build & Test"
  title: Record<Lang, string>;         // UI label
  purpose: Record<Lang, string>;       // why this section exists
  optional: boolean;                   // toggle default
  exampleMarkdown: string;             // verbatim example body (English)
  citation: CitationRef;
}

export interface StackPresetData {
  id: StackPreset;
  label: Record<Lang, string>;
  // EDITABLE DEFAULTS — flagged unverified in UI, user must confirm
  defaults: { build?: string; test?: string; lint?: string; typecheck?: string; run?: string };
  citation: CitationRef;
}

export interface InputLintRule {
  id: string;                          // 'length-cap' | 'vague-guidance' | ...
  severity: LintSeverity;
  title: Record<Lang, string>;
  triggerSummary: Record<Lang, string>;
  recommendation: Record<Lang, string>;
  explainer: Record<Lang, string>;
  citation: CitationRef;
}

export const SECTION_TEMPLATES: readonly SectionTemplate[];
export const STACK_PRESETS: readonly StackPresetData[];
export const CLAUDE_MD_LINT_RULES: readonly InputLintRule[];
export const HIERARCHY_LEVELS: readonly { level: string; paths: Record<string,string>; note: Record<Lang,string>; citation: CitationRef }[];
export const IMPORT_FACTS: readonly { fact: Record<Lang,string>; citation: CitationRef }[]; // @path semantics, 4-hop, eager-load, security dialog
```

**`src/lib/claude-md.ts`** — чистий генератор: одна модель → обидва файли. Жодного I/O, жодного React; повністю юніт-тестований.

```ts
export interface GeneratorModel {
  projectName: string;
  domainOneLine: string;
  preset: StackPreset;
  commands: { build?: string; test?: string; lint?: string; typecheck?: string; run?: string };
  conventions: string[];
  doNotTouch: string[];
  security: { secretsLocation?: string; neverCommit: string[]; neverRead: string[] };
  prRules: { branchPattern?: string; commitFormat?: string; prLocCap?: number; mergeStrategy?: string };
  enabledSections: SectionId[];
  imports: string[];                   // e.g. ['@README.md', '@package.json']
  wiring: WiringMode;
}

export interface GeneratorOutput {
  agentsMd: string;                    // universal baseline, ZERO Claude-specific syntax
  claudeMd: string;                    // '@AGENTS.md' import (or symlink note) + Claude-only additions
  wiringCommand?: string;              // 'ln -s AGENTS.md CLAUDE.md' when wiring === 'symlink'
  lint: LintFinding[];                 // counts/positions only — see PromptFinding parity
}

export interface LintFinding {
  ruleId: string;
  severity: LintSeverity;
  evidence?: { count?: number; section?: SectionId };  // NEVER the field text
}

export function generate(model: GeneratorModel): GeneratorOutput;
export function lintModel(model: GeneratorModel): LintFinding[];
```

Інваріанти генератора (юніт-тести): (1) `agentsMd` не містить `@`-import-рядків і Claude-only-синтаксису; (2) `claudeMd` починається з `@AGENTS.md` коли `wiring==='import'` АБО видає `wiringCommand` коли `'symlink'`; (3) сумарна довжина прапориться `length-cap` коли > 200 рядків; (4) `lint` повертає лише counts/section — НІКОЛИ текст поля.

**`src/content/tools.ts`** — розширити string-literal union `slug` додаванням `'claude-md-generator'` (тип треба **widen** вручну, як зазначено в архітектурі) і додати запис у `TOOLS` із `lastVerified`, bilingual `title/description/lede`, `status:'live'`, `href`.

---

### (d) SSG citable catalog

Дзеркало `rule-catalog.tsx` — повний reference рендериться **статичним server-HTML** на сторінці (це citable AEO-актив; JS-only каталог лишає краулерам порожню оболонку). Компонент **`src/components/tools/claude-md-catalog.tsx`** (server component, без `'use client'`), рендерить із `claude-md-rules.ts`:

1. **Section reference** — усі 9 секцій (heading, purpose, приклад у fenced-блоці, цитата). Джерела purpose/example: дев'ять секцій з research-інпуту, кожна з [memory-docs](https://code.claude.com/docs/en/memory)-цитатою.
2. **Best-practice catalog** — згруповано, кожен пункт з інлайн-цитатою (length<200, concrete-commands, markdown-headers, code-examples, `@path`-imports, `.claude/rules/` path-scoping, AGENTS.md-as-source-of-truth, auto-memory, top-5 conventions/anti-patterns, HTML-comments для maintainer-нотаток).
3. **Anti-pattern catalog** (severity-tiered, як severity-картки Prompt Optimizer) — giant >300-line files, vague prose, README-duplication, stale build commands, conflicting rules across tiers, secrets-inline, tool-specific syntax в AGENTS.md, omitted security section.
4. **Hierarchy & import explainer** — таблиця рівнів (managed→user→project→local) + `@path`-семантика — як статичний HTML (а не лише в інтерактиві), щоб краулери індексували.

Кожна картка: `id` (mono), title, explainer, **`<strong>`trigger</strong> recommendation**, `CitationList` з лінком на офіційне джерело (точний URL).

---

### (e) Telemetry

`trackEvent(name, props)` з `@/lib/analytics-client` — **counts/enums ONLY, ніколи вміст файлів** (дзеркало `PromptFinding.evidence` — лише counts/positions). Події:

| Event | Props (enums/counts only) |
|---|---|
| `tool_claudemd_generate` | `{ preset: StackPreset, sectionsEnabled: number, wiring: 'symlink'\|'import', lintIssues: number, lintSuggestions: number }` |
| `tool_claudemd_export` | `{ format: 'agents'\|'claude'\|'both'\|'copy'\|'download', wiring: 'symlink'\|'import' }` |
| `tool_claudemd_preset` | `{ preset: StackPreset }` |
| `tool_claudemd_lint_fire` | `{ ruleId: string, severity: LintSeverity }` |

**Заборонено:** будь-яке поле з текстом проєкту, командами, конвенціями, назвами секретів. Тільки `ruleId`, enum-и, цілі лічильники. Privacy-обіцянка на сторінці (як у Prompt Optimizer): «100% client-side, $0, ваш ввід ніколи не залишає браузер; ми бачимо лише знеособлені лічильники».

---

### (f) SEO / AEO

- **H1 (EN):** `Free CLAUDE.md & AGENTS.md Generator` · **H1 (UK):** `Безкоштовний генератор CLAUDE.md та AGENTS.md`. Визначення обох файлів у перших 300 словах + інлайн-лінки на [agents.md](https://agents.md/) і [code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory).
- **Target keywords (long-tail, не generic):** `claude.md generator`, `agents.md generator`, `claude.md vs agents.md`, `how to write claude.md`, `claude.md best practices`, `agents.md example`. Generic «ai instructions generator» НЕ таргетимо (SERP насичена).
- **page.tsx** (дзеркало `prompt-optimizer/page.tsx`): `export const revalidate = 86400`; `generateStaticParams()` над `LANGS`; `generateMetadata()` з `canonical` + hreflang `alternates.languages` (`en` / `uk` / `x-default`→en).
- **JSON-LD `@graph`** (точно як reference): `WebApplication` (`applicationCategory:'DeveloperApplication'`, `isAccessibleForFree:true`, `inLanguage`, `operatingSystem:'Web browser'`, publisher Org) + `TechArticle` (`dateModified = tool.lastVerified`) + `breadcrumbJsonLd(crumbs, SITE_URL)`.
- **AEO-актив = SSG-каталог із (d)** — best-practice/anti-pattern reference з цитатами як статичний HTML; це те, що цитують Perplexity/ChatGPT. FAQPage-схема — лише для LLM-інгесту (Google прибрав rich results 2023; не продавати собі як SERP-фічу).
- Рендеримо `<Breadcrumbs/>` → uppercase-eyebrow → H1 → lede → privacy/disclaimer-бокс → `<ClaudeMdGeneratorClient/>` → `<ClaudeMdCatalog/>`.

---

### (g) Acceptance criteria (testable, tests ≥ 80%)

1. `src/lib/claude-md-rules.ts` і `src/lib/claude-md.ts` — чисті, без React/I/O; покриття обох ≥ 80% (Vitest, як `prompt-lint`).
2. `generate(model)` для кожного з 7 пресетів повертає обидва файли; **AGENTS.md не містить `@`-import-рядків і Claude-only-синтаксису** (assert).
3. `wiring==='import'` → `claudeMd` починається з `@AGENTS.md`; `wiring==='symlink'` → `wiringCommand === 'ln -s AGENTS.md CLAUDE.md'` і `claudeMd` без `@AGENTS.md` (assert обидва).
4. Кожен `SectionTemplate`, `StackPresetData`, `InputLintRule`, `HIERARCHY_LEVELS`-елемент має `citation.url`, що матчить `^https://(docs\.anthropic\.com|docs\.claude\.com|code\.claude\.com|www\.anthropic\.com)/` (data-integrity тест).
5. `lintModel`: довжина > 200 рядків → `length-cap` issue; «format nicely» → `vague-guidance` issue; інпут зі схожим-на-секрет → `secrets-inline` issue; чистий повний інпут → 0 issues.
6. `LintFinding`/телеметрія **ніколи** не містять тексту поля — тест перевіряє, що `evidence` має лише `count`/`section`-ключі (parity з `PromptFinding`).
7. `getTool('claude-md-generator')` повертає запис; `slug`-union widened (компілюється).
8. `page.tsx`: `generateStaticParams` → `LANGS`; `generateMetadata` дає canonical + 3 hreflang-alternates; JSON-LD `@graph` має рівно `WebApplication` + `TechArticle` (з `dateModified===lastVerified`) + breadcrumb.
9. SSG-каталог рендериться як server-HTML без `'use client'` (краулер бачить повний текст best-practice/anti-pattern reference у raw-HTML).
10. UK-prose повна; усі code/identifiers/paths/команди — verbatim English; неперевірені пресет-команди позначені «editable defaults, verify before use».

---

### (h) Non-goals

- **Жодного repo-scanning / upload / GitHub-інгесту.** Це навмисна відмова від комодитизованої фічі (Apify-актори/ClaudeForge її вже мають); ми — form-only, zero-install, ввід не залишає браузер. (Якщо колись додавати repo-paste → окрема Phase B з власною privacy-моделлю, як BYOK у Prompt Optimizer — НЕ в цьому MVP.)
- **Жодного сервера / backend / API-виклику.** 100% client-side; `$0` собівартість.
- **Жодного auto-commit / запису у файлову систему / виконання `ln -s`.** Видаємо текст + copy-команду; користувач сам кладе файли (тулза нічого не виконує).
- **Не вгадуємо «офіційні» команди фреймворків** — пресет-дефолти позначені як editable/unverified.
- **Не генеруємо tool-specific синтаксис в AGENTS.md** (жодних `.cursorrules` MDC / CLAUDE.md `@imports` у baseline — це зламало б інші 30+ агентів).
- **Не позиціонуємо як standalone-продукт** — це lead-magnet/SEO-фідер для Tools #1/#2.

---

**Файли, що створюються (absolute paths):**
- `D:\domains\ai-today-brief\src\lib\claude-md-rules.ts`
- `D:\domains\ai-today-brief\src\lib\claude-md.ts`
- `D:\domains\ai-today-brief\src\lib\claude-md.test.ts`
- `D:\domains\ai-today-brief\src\components\tools\claude-md-generator-client.tsx`
- `D:\domains\ai-today-brief\src\components\tools\claude-md-catalog.tsx`
- `D:\domains\ai-today-brief\src\app\[lang]\tools\claude-md-generator\page.tsx`

**Файли, що редагуються:**
- `D:\domains\ai-today-brief\src\content\tools.ts` (widen `slug`-union + додати запис)
- `D:\domains\ai-today-brief\src\content\tools.test.ts` (покрити новий slug)
- i18n strings-файл під `getStrings(lang)` (додати `claudeMdGenerator`-блок, дзеркало `promptOptimizer`)

---

## Декомпозиція місії (DAG)

Build order для Hermes. Кожен child-таск: short id · title · suggested Hermes profile · dependencies · 1-line acceptance. **T0 — спільний scaffold, від якого залежать обидві тулзи.** Далі дві паралельні гілки (`S*` = settings-builder, `C*` = claude-md-generator), що сходяться у фінальний reviewer+judge gate. Усі шляхи — у репо `ai-today-brief`.

| id | Title | Profile | Depends on | Acceptance (1-line) |
|---|---|---|---|---|
| **T0** | Shared scaffold: widen `slug` union у `src/content/tools.ts`, додати обидва TOOLS-записи (`settings-builder`, `claude-md-generator`), shared page-template helper, i18n-блоки, нові event-нейми (без логіки) | implementer | — | `getTool()` повертає обидва записи; `tools.test.ts` зелений; `npm run typecheck` чистий; i18n має обидва strings-блоки |
| **S1** | `settings-builder` lib + tests: `settings-builder-rules.ts` (PERMISSION_TEMPLATES / HOOK_RECIPES / GRAMMAR_REFERENCE / SCOPE_HIERARCHY з цитатами) + `settings-builder.ts` (`validatePermissionRule` / `validateMatcher` / `buildSettings` / `mergeSettings`) + `settings-builder.test.ts` | implementer | T0 | Усі lib-acceptance із §Tool2(g) проходять; покриття ≥80%; кожен data-запис має ≥1 офіційну цитату |
| **S2** | `settings-builder-client.tsx`: 4 панелі (permissions-builder, recipe-library, live JSON preview, merge) + copy/download + privacy-box | designer | S1 | Усі панелі рендеряться, мерджать через lib без клобера; нуль network-викликів; client споживає тільки `settings-builder.ts` |
| **S3** | `settings-catalog.tsx`: SSG citable-каталог (grammar / hook-recipe / scope-hierarchy) як статичний server-HTML | implementer | S1 | Рендер без `'use client'`; усі recipe/grammar/scope-рядки в raw-HTML; severity-тіри, без score |
| **S4** | `settings-builder/page.tsx` wiring: `revalidate=86400`, `generateStaticParams`/`generateMetadata`, JSON-LD `@graph`, lede+privacy, монтаж client+catalog | implementer | S2, S3 | Усі page-acceptance із §Tool2(g) проходять; 3 hreflang; `@graph` має рівно WebApplication+TechArticle+BreadcrumbList |
| **C1** | `claude-md-generator` lib + tests: `claude-md-rules.ts` (SECTION_TEMPLATES / STACK_PRESETS / CLAUDE_MD_LINT_RULES / HIERARCHY_LEVELS / IMPORT_FACTS з цитатами) + `claude-md.ts` (`generate` / `lintModel`) + `claude-md.test.ts` | implementer | T0 | Усі lib-acceptance із §Tool3(g) #1–6 проходять; покриття ≥80%; dual-output інваріанти зелені |
| **C2** | `claude-md-generator-client.tsx`: guided form, пресети, dual side-by-side preview, wiring-toggle, input-linter, copy/download both + privacy-box | designer | C1 | Форма генерує обидва файли через lib; symlink/import-toggle коректний; linter показує severity-тіри; нуль network |
| **C3** | `claude-md-catalog.tsx`: SSG citable-каталог (section / best-practice / anti-pattern / hierarchy+import) як статичний server-HTML | implementer | C1 | Рендер без `'use client'`; повний best-practice/anti-pattern reference у raw-HTML (acceptance §Tool3(g)#9) |
| **C4** | `claude-md-generator/page.tsx` wiring: `revalidate`, static-params/metadata, JSON-LD `@graph`, lede+privacy, монтаж client+catalog | implementer | C2, C3 | Page-acceptance §Tool3(g)#8 проходять; 3 hreflang; `@graph` повний |
| **X1** | CI freshness ritual: розширити docs-hash CI-джоб на `permissions`/`hooks`/`settings`/`memory`-сторінки, що живлять обидва каталоги (фейл при зміні) | implementer | S1, C1 | CI-джоб хешує всі 4+ docs-URL; навмисна зміна hash фейлить білд із вказівкою «re-verify catalog» |
| **R1** | Reviewer gate: data-integrity (усі цитати — офіційні домени), телеметрія counts/enums-only (обидві тулзи), house-style audit (UK-prose / EN-verbatim code / no health-score), non-goals compliance | reviewer | S4, C4, X1 | Усі global non-goals дотримані; жоден emit-хелпер не приймає сирий текст; усі цитати матчать домен-regex |
| **R2** | Docs+brand gate: фінальний judge — Anthropic brand-guideline check (nominative use, citation attribution), privacy-promise присутня під обома H1, lastVerified консистентний (`2026-06-15`) | docs | R1 | Brand-check пройдено; privacy-box на обох сторінках; `dateModified===lastVerified` в обох `@graph` |

Паралелізм: після **T0** гілки `S1→S2/S3→S4` і `C1→C2/C3→C4` біжать незалежно; **X1** стартує щойно готові обидва lib-шари; **R1→R2** — послідовний фінальний gate над усім.

---

## Глобальні Non-goals

(Restate crisply — урок: планувальники дрейфують назад до source-концепту замість epic-non-goals. Це обов'язкові межі для **обох** тулз цієї хвилі.)

- **Жодного сервера / backend / API-виклику зі сторінок тулз.** Уся логіка — client-side; `$0` собівартість; нуль network-запитів із віджета.
- **Жодного акаунта / signup / paywall / gating.** Миттєвий доступ.
- **Жодного запису у файлову систему користувача й жодного виконання команд.** Тільки browser-download та copy-to-clipboard; ми не торкаємось реальних `~/.claude/`, `.claude/`, не виконуємо `ln -s`, не запускаємо hooks.
- **Жодного repo-scanning / upload / GitHub-інгесту** (claude-md-generator — form-only; settings-builder — paste-only для merge). Ввід не залишає браузер.
- **Жодного єдиного «health/security score».** Лише severity-тіри (`critical`/`warning`/`info` або `issue`/`suggestion`/`info`) на окремих рекомендаціях — один скріншот хибної агрегованої оцінки вбиває довіру (концепт-док п.5).
- **Це НЕ MCP-config builder** (`.mcp.json` / `claude mcp add` — Фаза 3, каталог MCP-серверів) і **НЕ enterprise admin-консоль** (managed-scope — лише вихідний формат із попередженнями, не first-class UI).
- **Не вгадуємо** «офіційні» команди фреймворків чи неперевірені нюанси схеми — усе непідтверджене марковане явно (`editable defaults, verify before use`; `stillUncertain`).
- **claude-md-generator не позиціонується як standalone-продукт** — це lead-magnet/SEO-фідер для Tools #1/#2 (двосторонні internal links).
- **Жодних third-party скриптів на сторінках тулз** поза наявним аналітика-стеком; ніякого реклами-завантаження у віджет-флоу (узгоджено з privacy-обіцянкою).

---

## Глобальні ризики та застереження

| Ризик / застереження | Severity | Mitigation |
|---|---|---|
| **Schema-freshness** — `settings.json`-ключі, permission-граматика й hook-event-нейми змінюються між релізами Claude Code; статичний каталог тихо застаріває й починає брехати краулерам | **critical** | **CI hash-check ритуал** (task X1, дзеркало Prompt Optimizer guide, концепт-док п.5): CI-джоб хешує офіційні docs-сторінки, що живлять каталоги (`code.claude.com/docs/en/permissions`, `/hooks`, `/hooks-guide`, `/settings`, `/memory`); зміна hash → білд фейлиться з вимогою re-verify і bump `lastVerified`. Ручний «Last verified» сам по собі недостатній. |
| **Anthropic brand guidelines** — Anthropic у 2026 активніше захищає бренд; nominative use назв продуктів + цитування сніпетів з атрибуцією ймовірно ОК, але треба підтвердити перед лончем | **warning** | Одноразовий brand-guideline check перед launch (task R2, концепт-док п.5): nominative use, кожен цитований сніпет з явною атрибуцією на офіційне джерело, без implied endorsement. |
| **Privacy-обіцянка** — головна trust-обіцянка обох тулз; будь-який прихований network-виклик або текст-в-телеметрії її мовчки ламає | **critical** | 100% client-side (global non-goals); телеметрія структурно counts/enums-only (тип `Params` не приймає об'єктів); юніт-тест parity з `PromptFinding.evidence`; privacy-box під обома H1; нуль third-party скриптів. |
| **Mark-unverified discipline** — спокуса «дозаповнити» нюанси схеми/команд із пам'яті моделі замість офіційного джерела | **warning** | Усе непідтверджене явно марковане (`stillUncertain` — напр. glob-free MCP server-segment, «blocks N repeated stops»; `editable defaults, verify before use` — пресет-команди). Reviewer-gate (R1) валить будь-яку рекомендацію без офіційної цитати. |
| **Citation-domain drift** — випадкова цитата на вторинне джерело (блог, GitHub-реп) як «офіційну» | **warning** | Data-integrity тест: кожен `Citation.url` матчить `^https://(docs\.anthropic\.com|docs\.claude\.com|code\.claude\.com|www\.anthropic\.com)/`. Вторинні цифри (AGENTS.md-екосистема) подаються явно як «за даними екосистеми», не як офіційні (skeptic-note). |
| **Competitive window** — settings-builder має реальний wedge сьогодні, але recipe-бібліотека копіюється; claude-md-generator — у crowded-ніші | **info** | Ship швидко; моат = глибина+тестованість рецептів + freshness-ритуал + цитати-стиль (E-E-A-T), а не сам віджет (концепт-док п.1, п.5). |

---

Документ готовий до декомпозиції. Шлях призначення: `wiki/product/toolbox-wave1-spec.md` у репо `ai-today-brief`.

---

## Provenance / verification log

- **Складено:** 2026-06-15 багатоагентним workflow (research → adversarial verify → per-tool draft → synthesize) поверх референс-архітектури вже відвантаженого Prompt Optimizer (`main`).
- **Schema-basis:** офіційні docs `code.claude.com/docs/en/{settings,permissions,hooks,hooks-guide,memory}` (станом на 2026-06-15). Це актуальний домен docs — НЕ `docs.claude.com/en/docs/claude-code/*`.
- **Adversarial verify знайшов і виправлено:** (1) `includeCoAuthoredBy` deprecated → `attribution {commit,pr}`; (2) **режим = `permissions.defaultMode`** (nested), а НЕ top-level `defaultMode` і НЕ `permissions.mode` — підтверджено офіц. рядком «Set the `defaultMode` in your settings files» на `/en/permissions` (верифікатор спершу помилково запропонував `permissions.mode`; виправлено вручну проти першоджерела).
- **Свідомо не закодовано як факт (mark-unverified):** statusLine ANSI/OSC-8 деталі; точне число «blocks N repeated stops»; повний інвентар 50–100+ settings-ключів. Усі — `editable defaults, verify before use`; гейтяться freshness-ритуалом (X1) і reviewer-gate (R1). (Раніше тут був «glob-free MCP server-segment» — пре-mission review підтвердив його офіційно на `/en/permissions`, тож знято з невіреного.)
- **Pre-mission review (2026-06-15):** grounded 4-вимірний review + adversarial adjudication → вердикт **ship-with-fixes**; виправлено 2 підтверджені дефекти: (1) `effortLevel` без `max` (critical, schema); (2) `HookEvent` — коментар про навмисний 14-подієвий subset (warning). Решта знахідок відхилено як non-issues/post-ship polish.
- **Honest market verdict:** `settings-builder` = **build** (реальний wedge); `claude-md-generator` = ніша **crowded** → перепозиціоновано як lead-magnet/SEO-фідер, а не standalone-ставку.