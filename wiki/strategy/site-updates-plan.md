# Site Updates & Improvement Plan

Summary: План оновлень сайту: workstreams A–E і трихвильова послідовність.
Sources: migrated from `docs/` (git history via `git log --follow`); none (analysis) where unmarked
Last updated: 2026-06-13


> **Складено 2026-06-13** на основі `wiki/strategy/ai-trends-research.md` + глибокого
> ultracode-ресерчу 5 паралельних агентів (codebase/product audit · SEO/AEO/schema audit
> · deep research: agents-memory-MCP · models-video-tools · competitors-prompts-money).
> Кожен пункт має **Effort** (S/M/L), **Impact** (High/Med/Low) і **Where** (реальний
> шлях/маршрут/таблиця). Джерела — у §7.

---

## 0. TL;DR

**Головний висновок ресерчу:** двигун продукту, схема даних і двомовний SEO-каркас —
**реальні й міцні** (24 брифи / 123 живих айтеми, 26 concept-хабів з body+FAQ, JSON-LD
скрізь, EN/UK hreflang, FTS-пошук, Telegram-рев'ю). Прогалини сконцентровані у **трьох**
місцях, і всі три збігаються з тим, на що робить ставку стратегія:

1. **Широта контент-поверхонь.** Немає browsable model-comparison, prompt-бібліотеки,
   tool-directory, deals-сторінки; `creative-ai` і `career-and-money` категорії тонкі
   (бо fetch-шар тягне **лише dev-новини** — немає creative/video/deals джерел).
2. **AEO entity-linking.** Каркас сильний, але айтеми не лінкуються схемою до concept-хабів
   (`Article.about/mentions`), немає FAQ-схеми на айтемах, немає `SoftwareApplication`
   для моделей (а це #1 traffic-ставка), `dateModified` захардкоджений, немає `llms.txt`.
3. **Два «фантомні» механізми, яких немає в коді:** редакційний гейт §3 (Практична
   цінність + Унікальність ніде не рахуються) та `editor_take` (колонка + рендер є,
   рядків 0, не в LLM-схемі). Concept-хаби (двигун topical-authority) наповнюються
   **вручну, без cron**.

**8 ходів Хвилі 1 (цей тиждень → 2 тижні):** [W1-1] concept-хаби пам'яті/оркестрації +
[W1-2] cron на concept-backfill · [W1-3] AEO entity-linking (`Article.about`→concept +
FAQ-схема на айтемах + реальний `dateModified`) · [W1-4] model-comparison сторінка +
`SoftwareApplication` · [W1-5] prompt-бібліотека + Prompt-of-the-Day→weekly-hub ·
[W1-6] agent-config порівняння (AGENTS.md/CLAUDE.md/Cursor/SKILL.md) · [W1-7] `llms.txt`
+ answer-first блоки · [W1-8] полагодити orphaned guides + concept↔concept лінки.

---

## 1. Поточний стан (grounded)

**Живі дані (prod `ai-news-scrapper`, станом на 06-13):** 24 опубліковані брифи
(2026-05-26 → 06-13), 123 айтеми. Fill-rate айтемів: `body_md` 103/123, `takeaways`
124/124, `facts` 42, `when_to_use` 57, `citations` 23, `action_items` 18, `impact_level`
20, `community_reactions` 7, `code_snippet` 13, `image` 55. **`editor_take` 0/123**,
**video/youtube 0** (`video_script_*` колонки існують, не генеруються).

| Поверхня | Стан | Нота |
|---|---|---|
| Home / Daily brief / Brief item / Category / News+FTS-пошук | **REAL** | айтем рендерить NewsArticle JSON-LD, related, canonical-redirect |
| Concepts (26 хабів) + concept↔item junction (135 лінків) | **REAL** | але **7/26** fact-verified; concept↔concept лінки слабкі |
| Guides | **PARTIAL** | **лише 2 гайди**; один («ATB Orchestration Bench») — «No scored runs yet» |
| Tools («AI Toolbox») | **PARTIAL** | **лише 1 інструмент** (prompt-optimizer), хоча копі — множина |
| Prompt Optimizer (prompt-lint, 13 правил, privacy-first) | **REAL** | сильний, недооцінений актив; конкурент PromptPerfect закривається ~09.2026 |
| Subscribe (Beehiiv) / Advertise / Author / About / Legal / RSS / sitemaps / Telegram-рев'ю | **REAL** | бізнес-таблиці порожні: `subscribers`, `social_posts`, `sponsors` = 0 |
| Редакційний гейт §3 (Практична цінність + Унікальність) | **НЕ В КОДІ** | живі гейти: `rank.ts` engagement + `select.ts` diversity + людина в Telegram |
| `editor_take` (E-E-A-T verdict, рекламується author-сторінкою) | **НЕ В КОДІ** | колонка+рендер є, 0 рядків, немає в summarize-схемі |

**Пайплайн (підтверджено):** `fetch → rank(6 сигналів) → select → exact-dedup(30d) →
semantic-dedup(Gemini embeddings) → enrich → summarize(Gemini→OpenRouter) →
verify→revise→re-verify→auto-drop → publish(DRAFT) → store-embeddings → Telegram-рев'ю →
людина ✅ → сайт`. LLM-робота: **Gemini primary + OpenRouter fallback** (Anthropic у
пайплайні не використовується). Concept-**контент** генерується поза пайплайном
(`concept-backfill.ts`, **без npm-скрипта і без cron** — лише вручну); пайплайн лише
**лінкує** айтеми до існуючих concepts.

---

## 2. Ключова теза плану

> Не треба перебудовувати двигун. Треба **(A)** конвертувати швидкоплинні факти у
> **підтримувані, повторно-оновлювані authority-поверхні** (comparison/directory/library),
> **(B)** дотягнути **AEO entity-graph** там, де концентрується трафік-ставка, і
> **(C)** добудувати два механізми, які стратегія вже припускає (редакційний гейт +
> `editor_take`), та **увімкнути cron там, де authority-двигун зараз стоїть вручну**.

---

## 3. Воркстріми

### WS-A — Authority-поверхні контенту (найбільша прогалина)

| ID | Що | Чому (тренд/ресерч) | Eff | Imp | Where |
|----|----|--------------------|:---:|:---:|-------|
| A1 | **Concept-хаби кластера агентів/пам'яті** (6–8): tiered memory (in-context/vector/persistent), context poisoning (OWASP ASI06), multi-agent orchestration, MCP, MCP vs A2A vs AGNTCY, multi-model shared context, browser/computer-use | #1 зростаючий тренд; defensible niche; реюз concept-інфри | **S** | **High** | seed рядки `concepts` + `concept-backfill` + `src/lib/category-meta.ts` subtopics |
| A2 | **Model-comparison сторінка** (SWE-bench Verified/Pro, GPQA, ARC-AGI-2, $/1M, context, license, best-for) — date-stamped, «verified to {date}» | rec #1; «друга хвиля порівнянь» після Fable 5; AEO answer-box | **M** | **High** | new `src/app/[lang]/models/` + `src/content/models.ts` або таблиця `models`; рендер реюз guide-layout |
| A3 | **Prompt-бібліотека** (copy-paste) за dev-кластерами: code review, security audit, DB/schema, research/investigate, UI-layout test, video-gen; кожен — copy-button + model-tag + expected output + «Lint this» → у наш optimizer | «промпти із застосуванням» + «трендові промпти»; PromptPerfect-вакансія | **M** | **High** | new `src/app/[lang]/prompts/` + `src/content/prompts.ts`; lint через `src/lib/prompt-lint.ts` |
| A4 | **Tool/service directory («Fresh Tools»)** — link + price + «for what» + category; seed з MCP-registry для MCP-серверів | топ-share формат конкурентів (§2.2); `tools-and-releases` | **M** | **High** | extend `src/content/tools.ts` або `tools` таблиця + `tools/directory` route |
| A5 | **Agent-config порівняння** (AGENTS.md vs CLAUDE.md vs .cursorrules vs SKILL.md): scope/format/@imports/local-override/size-limit/хто читає + copy-paste стартери + `@AGENTS.md`/symlink рецепт; + subagent-setup хаб | «наша ніша»; rec #5/#6; Princeton-дані (редундантність б'є на ~23% cost) | **S** | **High** | `src/content/guides.ts` + `vibe-coding` concept-рядки + (опц.) interactive «Compare Configs» сторінка |
| A6 | **Creative-AI/video серія + Sora-replacement хаб** + AI-video pricing-таблиця ($/sec, native-audio, best-for) | trend #8; вікно міграції з Sora до 24.09.2026; `creative-ai` зараз порожня | **M** | **Med** | + creative/video джерела у `pipeline/sources/feeds.ts`; curated хаб; rank-niche tweak щоб dev-фільтр не дропав |
| A7 | **LLM deals / free-credits сторінка** (free tiers: Gemini/OpenRouter; sign-up credits; OSS-програми: «Claude for Open Source»; batch −50%, prompt-caching −90%) — date-stamped, «verify live» дисклеймер на промокоди | `tools-and-releases` промо; rec #14 | **M** | **Med** | `deals` таблиця + `src/app/[lang]/deals/`; легка curation (daily-джерела не несуть цін) |
| A8 | **Career/micro-SaaS playbook** контент-тип: «workflow + realistic timeline/income» (micro-SaaS 12–24 міс; freelancing $500–2K/міс за 90 днів); чесний кут проти slop | `career-and-money` найтонша; FTP-enforcement робить чесність конкурентною перевагою | **S/M** | **Med** | редакційний seeding + опц. structured playbook-компонент |
| A9 | **Interactive comparison-віджети:** LLM-Gateway (LiteLLM/OpenRouter/Portkey/Helicone/Vercel) + Agent-Memory tool matrix + token-cost калькулятор (6,900 vs 26,000 tok/query) | high-intent + affiliate-friendly | **M** | **Med** | компоненти у `src/components/tools/` + дані у `src/content/` |

### WS-B — AEO / Schema / Structured data

| ID | Що | Чому | Eff | Imp | Where |
|----|----|------|:---:|:---:|-------|
| B1 | **Реальний `dateModified`** на `NewsArticle` + видиме «Updated {date}» коли ≠ publish | freshness — топ-AEO-сигнал; стале = 3× втрата цитувань | **S** | **High** | `src/app/[lang]/[brief]/[item]/page.tsx:136-137`; `src/lib/items.ts` (+`updatedAt`) |
| B2 | **`Article.about` + `mentions`** → concept-хаб `@id` (+ стабільний `@id` на concept `CollectionPage`/`DefinedTerm`) | cross-reference «verification loop», що його винагороджують AI-движки; підсилює topical-graph | **M** | **High** | item page (реюз `toolLinks`→concept slugs :93-100); `concepts/[slug]/page.tsx:55-86` |
| B3 | **FAQ/Q&A схема на айтемах** з наявних `whyItMatters`/`takeaways`/`whenToUse`/`whenNotToUse` | виводить айтеми на «3–4 типи схеми → 2× цитувань» наявним контентом | **M** | **High** | item page (дані вже в `BriefItemDetail`, `src/lib/items.ts:46-53`) |
| B4 | **`SoftwareApplication`/`Product` + benchmark `PropertyValue`** на моделях у comparison/айтемах | прямо обслуговує #1 traffic-ставку; робить benchmark-таблиці citation-ready | **M** | **High** | new helper `src/lib/schema.ts`; consume у A2 + item/concept |
| B5 | **`/llms.txt`** (бренд, value-prop, hub/news/concepts/guides/RSS URLs, EN+UK) | low-effort AEO discoverability для AI-native аудиторії (сигнал, не доставка) | **S** | **Med** | new `src/app/llms.txt/route.ts` (дзеркало `rss.xml` патерну) |
| B6 | **Єдиний entity-graph:** один `Organization @id` + один editor `Person @id`, реюз (не передекларація) на всіх Article/About/Author/concept | entity-consolidation → сильніший knowledge-graph/E-E-A-T | **M** | **Med** | extract → `src/lib/schema.ts`; вжити всюди |
| B7 | **Answer-first 40–60-слівний блок** (реюз `summary`/TL;DR) як перший елемент + `speakable`/`abstract` | AEO-движки лифтять короткий топ-відповідь вербатим | **S** | **Med** | item page (promote `summary` :247) |
| B8 | **Полагодити orphaned guides + тонкі concept↔concept лінки** | density кластера = сигнал «повного покриття» для AI | **M** | **Med** | `guides/[slug]`, `concepts/[slug]`, `ConceptOtherChips`, `src/content/guides` |
| B9 | **OG/Twitter-картки** на brief/category/concept/news/trust + глобальний `twitter:card=summary_large_image`; author/`dateModified`/`mainEntityOfPage` на concept `TechArticle` | консистентні Discover/social-картки; concept до guide-рівня E-E-A-T | **S** | **Low** | global `src/app/layout.tsx:12-23` + per-route `generateMetadata` |

### WS-C — Пайплайн і редакційна якість

| ID | Що | Чому | Eff | Imp | Where |
|----|----|------|:---:|:---:|-------|
| C1 | **Cron на `concept-backfill`** (+ npm-скрипт) — двигун topical-authority зараз вручну | concept-хаби = AEO-ставка; 19/26 ще не fact-verified | **S** | **High** | `.github/workflows/` (за зразком `weekly-digest.yml`) + `package.json` |
| C2 | **Імплементувати редакційний гейт §3** (Практична цінність + Унікальність scoring) між summarize і publish; cut <60% | головний механізм відбору стратегії, якого немає в коді; підніме якість публікацій | **M** | **High** | new scoring-модуль; wire у `pipeline/run-daily.ts` (~:402) перед publish |
| C3 | **Creative/video/deals fetch-джерела** | прибирає dev-only bias, що тримає `creative-ai`/deals порожніми | **M** | **Med** | `pipeline/sources/feeds.ts` + (опц.) новий source-модуль |
| C4 | **Наповнити `editor_take`** у review-flow (E-E-A-T verdict) | активує вже-збудований диференціатор; дешевий trust-сигнал | **S** | **Med** | edit-поле у Telegram/review-шляху; колонка+`StoryBody` рендер вже є |
| C5 | **Doc-drift фікси (housekeeping):** README RPC `match_published_item`→`match_relevant_item`; «4 джерела»→Bluesky 5-те; порядок кроків README; прибрати dead `shouldUseOpenRouter` | точність документації для майбутніх змін | **XS** | **Low** | `pipeline/README.md`, `pipeline/schedule.ts:137` |

### WS-D — Growth і монетизація

| ID | Що | Чому | Eff | Imp | Where |
|----|----|------|:---:|:---:|-------|
| D1 | **Prompt/Skill-of-the-Day → weekly SEO-hub roll-up** (за 24 год) | The Neuron core-loop: ефемерний контент → compounding indexed-сторінка; найвищий-leverage borrow | **S** | **High** | контент-механіка + roll-up шаблон (`src/content/prompts.ts` + weekly hub route) |
| D2 | **Free tools як top-of-funnel** — prompt-optimizer/linter *є* lead-magnet; додати email-capture «save results / get prompt pack» | безкоштовна утиліта ранжується й конвертить краще за gated-PDF | **S** | **High** | `tools/prompt-optimizer/page.tsx` + `api/subscribe` |
| D3 | **beehiiv Recommendation Network + Boosts** | verified: учасники ростуть **2.75×** швидше | **S/M** | **High** | beehiiv-конфіг (`src/lib/beehiiv-config.ts`) |
| D4 | **Refer-to-unlock / referral-milestones** (Ben's Bites «$80/yr, free if you refer») | перетворює підписників на acquisition | **M** | **Med** | beehiiv referral + gate |
| D5 | **LemonSqueezy Pro-tier** (prompt-packs + advanced workflow-guides + agent-configs/skills + certificate); + one-off digital products | дефенсивно-нішевий paid-tier; LemonSqueezy обходить Stripe-UA-блок + EU VAT | **L** | **Med** | new checkout-флоу; `lemonsqueezy` ENV |
| D6 | **MCP-served prompt-бібліотека** — віддати library як MCP-сервер у Claude/Cursor | sticky on-brand distribution; майже ніхто в news-ніші не робить | **L** | **Med** | new MCP-server пакет |
| D7 | **Free email mini-course** (Rundown 5-day fundamentals) як lead-magnet | captures email, гріє до paid | **S/M** | **Med** | beehiiv automation + контент |

### WS-E — Корекції стратегії і каденс

- **E1 (зроблено):** Grok 4 → **Grok 4.3** у `AI-TRENDS-RESEARCH-STRATEGY.md`. ✅
- **E2:** датувати всі adoption-числа (MCP «41% у проді» не «78%»; «15,926 repos» не «7,800») — цитувати зі snapshot-датою. Vendor-числа (Mem0, Klarna $60M, 47–80% cost-cut) подавати як claims; citation-safe якорі — **OWASP ASI06, Princeton AGENTS.md study, LoCoMo/LongMemEval/BEAM benchmarks**.
- **E3:** щотижневий реврю ваг (наст. 2026-06-20) — додати «верифікувати швидкоплинні факти (video pricing, model leaderboard) перед публікацією».

---

## 4. Пріоритезований roadmap

**Хвиля 1 — Authority + AEO core (цей тиждень → 2 тижні).** Максимальний leverage,
переважно реюз наявної інфри, розблоковує решту.
`A1` concept-хаби пам'яті/оркестрації · `C1` cron на concept-backfill *(енейблер для A1)* ·
`B1`+`B2`+`B3` AEO entity-linking на айтемах · `A2`+`B4` model-comparison + SoftwareApplication ·
`A3`+`A5` prompt-бібліотека + agent-config порівняння · `D1` Prompt-of-the-Day→weekly-hub ·
`B5`+`B7` llms.txt + answer-first · `B8` orphaned guides.

**Хвиля 2 — Breadth + якість пайплайну (тижні 3–6).**
`A4` tool-directory + Fresh-Tools digest · `A6` creative/video хаб + `C3` video-джерела ·
`A7` deals-сторінка · `C2` редакційний гейт §3 · `C4` editor_take · `A9` gateway/memory
порівняння + token-калькулятор · `B6` entity-graph consolidation · `D2`+`D3` email-capture
+ beehiiv-network · `B9`+`C5` housekeeping.

**Хвиля 3 — Монетизація + distribution (тижні 7+).**
`D5` LemonSqueezy Pro-tier · `D4` refer-to-unlock · `D6` MCP-served library · `D7`
mini-course · `A8` career-playbook · multi-edition network · MCP-server directory як окремий
продукт · framework-selector quiz · context-poisoning checklist lead-magnet.

```
Залежності:  C1 ─enable─▶ A1 ─feed─▶ D1
             B6 ─base──▶ B2,B4        A2 ─needs─▶ B4
             C3 ─unblock─▶ A6,A7      A3 ─reuses─▶ prompt-lint(REAL)
```

---

## 5. Quick wins (XS/S — можна цього тижня)

1. **C1** — cron на `concept-backfill` (XS-S): кілька рядків workflow, вмикає весь
   topical-authority двигун. *Найбільший ROI на одиницю зусиль.*
2. **B1** — реальний `dateModified` (S): зупиняє 3× citation-decay.
3. **B5** — `/llms.txt` (S): дзеркало `rss.xml` route.
4. **A5** — agent-config порівняння guide (S): чистий контент, version-controlled, точно в нішу.
5. **C5** — doc-drift фікси (XS): README RPC-назва, Bluesky 5-те джерело.
6. **C4** — `editor_take` у review-flow (S): активує вже-збудований E-E-A-T-актив.

---

## 6. Ризики й guardrails

- **Slop-ризик (monetization-кластер):** «$300/день» = FTC-enforcement-зона. Тримати
  чесні income-bands, outcome/specialist-кут. Це і є наша перевага проти slop-сайтів.
- **Vendor-числа:** датувати; benchmark/OWASP/Princeton — citation-safe, vendor-blogs — claims.
- **Швидкоплинні факти:** model-leaderboard і video-pricing міняються щотижня → зробити
  їх **date-stamped підтримуваними поверхнями** (A2/A6), не one-off постами; верифікувати
  перед публікацією (E3).
- **Платежі:** лише **LemonSqueezy** (Stripe UA-blocked) — стосується D5.
- **Next.js 16:** перед кодом нових route читати `node_modules/next/dist/docs/`
  (див. `AGENTS.md`); усі нові поверхні — двомовні EN/UK з hreflang+canonical за наявним патерном.
- **Перед push:** `npm run pr:check` на feature-branch (`pr-gate.mdc`).
- **Fetch-фільтр:** creative/video джерела (C3) можуть потрапити під dev-демоут у `rank.ts`
  (`sourceTrust`/clickbait) — потрібен niche-fit tweak, інакше A6 лишиться тонким.

---

## 7. Джерела (за стрімами)

**Codebase/pipeline audit:** внутрішній — `pipeline/{rank,select,topics,run-daily,
concept-link,concept-backfill}.ts`, `src/lib/*`, `supabase/migrations/*`, prod-fill-rates.

**SEO/AEO 2026:** [CXL AEO Guide](https://cxl.com/blog/answer-engine-optimization-aeo-the-comprehensive-guide/) · [Frase AEO](https://www.frase.io/blog/what-is-answer-engine-optimization-the-complete-guide-to-getting-cited-by-ai) · [SEJ — Google drops FAQ rich results](https://www.searchenginejournal.com/google-drops-faq-rich-results-from-search/574429/) · [State of llms.txt 2026](https://presenc.ai/research/state-of-llms-txt-2026) · [Schema → AI citations 2026](https://www.soar.sh/blog/schema-markup-ai-citations-2026) · [Topical authority clusters](https://www.digitalapplied.com/blog/internal-linking-strategy-topical-authority-playbook-2026)

**Agents/Memory/MCP:** [Mem0 — State of Agent Memory 2026](https://mem0.ai/blog/state-of-ai-agent-memory-2026) · [Anthropic — Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) · [Redis — Context poisoning](https://redis.io/blog/context-poisoning-agent-reasoning/) · [WorkOS — ASI06](https://workos.com/blog/ai-agent-memory-poisoning) · [MCP Adoption Stats 2026](https://www.digitalapplied.com/blog/mcp-adoption-statistics-2026-model-context-protocol) · [LF — A2A 150+ orgs](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year) · [morphllm — AGENTS.md spec](https://www.morphllm.com/agents-md-guide) · [Velsof — multi-LLM patterns](https://www.velsof.com/ai-automation/multi-llm-orchestration-patterns/) · [Claude Code — subagents](https://code.claude.com/docs/en/sub-agents)

**Models/Video/Tools:** [Vellum — Fable 5 & Mythos 5](https://www.vellum.ai/blog/claude-fable-5-and-mythos-5-benchmarks-explained) · [LLM-Stats leaderboard](https://llm-stats.com/) · [morphllm — best coding model](https://www.morphllm.com/best-ai-model-for-coding) · [Fliki — Sora alternatives](https://fliki.ai/blog/best-sora-alternatives) · [FluxNote — AI video pricing](https://fluxnote.io/guides/ai-video-model-pricing-comparison-2026) · [Klymentiev — free AI API credits](https://klymentiev.com/blog/free-ai-api-credits) · [OpenRouter — prompt caching](https://openrouter.ai/docs/guides/best-practices/prompt-caching)

**Competitors/Prompts/Money:** [Readless — Rundown review](https://www.readless.app/blog/the-rundown-ai-newsletter-review-2026) · [Rundown University](https://www.rundown.ai/ai-university) · [The Neuron — Skill-of-the-Day digest](https://www.theneuron.ai/explainer-articles/the-neurons-ai-skill-of-the-day-digest-april-2026-week-1/) · [Ben's Bites operating model](https://ailearngo.com/case/ben-tossell-bens-bites) · [beehiiv — State of Newsletters 2026](https://www.beehiiv.com/blog/beehiiv-the-state-of-newsletters-2026) · [Braintrust — prompt tools 2026](https://www.braintrust.dev/articles/best-prompt-engineering-tools-2026)

> **Застереження.** Зовнішні числа верифікувати перед публічним цитуванням; внутрішні
> факти — з коду й prod-БД. Цей план — робочий беклог, не контракт: пункти переглядати
> разом зі щотижневим реврю стратегії (§E3).
