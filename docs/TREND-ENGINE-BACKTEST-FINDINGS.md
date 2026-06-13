# Trend-engine — backtest findings & "compress the data clock"

> **Складено 2026-06-13** за результатами 3-агентного workflow. Питання, що його запустило:
> *чи можна виконати L1-крок (інструментацію під trend-двигун) зараз, не чекаючи 6–12 тижнів
> накопичення власних даних — узявши те, що вже доступно на історичних/ринкових даних?*
>
> **Відповідь: так, здебільшого.** Доказ нижче — на **реальних** даних (prod `ai-news-scrapper`,
> 2150 статей, read-only) і реальному коді (`pipeline/rank.ts`). Доповнює `MASTER-ROADMAP.md` (L1/L2)
> та `INSTRUMENTATION-PR-PLAN.md` (переформульовує PR-I1).

---

## 0. TL;DR

«6–12 тижнів» — це **три різні потреби в даних** із різною (un)backfillability. Дві з трьох
закриваються **зараз**, третя — підмінюється ринковим проксі:

| Потреба | Backfill зараз? | Як (доведено/спроєктовано) |
|---|---|---|
| **Score-телеметрія** (composite + 6 компонент на всіх статтях) | ✅ **Доведено** | Перерахунок через `rank.ts` ретроактивно: **8.37% → 100%** покриття, шкала нормалізована в **[0,1]** (max 0.687 vs застарілий max 2.394) |
| **Rising / acceleration** (2-га похідна) | ⚠️ **Свою — ні; зовнішню — так** | Власний time-series невідновлюваний (1 знімок/статтю). **GDELT DOC 2.0** (free, є історія) дає ринкову acceleration **ретроактивно** |
| **Reward** («що виграло») | ⚠️ **Свій — ні; ринковий проксі — так** | First-party reward потребує трафіку (нема). Ринковий проксі (cross-source + newsletter pickup + sustained) доступний зараз і **менш упереджений**, ніж сирий HN |

**Головний результат бектесту:** для роботи продукту (вибрати топ-~10 у бриф) **trend-index б'є
сирий composite**: **Precision@10 = 1.00 проти 0.50**, P@20 0.65 проти 0.25, P@30 0.467 проти 0.167.

**Що лишається справді forward-looking:** лише *уточнення* reward власною аудиторією. На це **не
блокуємось** — стартуємо з ринкового проксі, замінюємо пізніше.

---

## 1. Track 1 — Backtest на реальних prod-даних (доказ)

Прогнано офлайн на 2150 статтях (увесь `articles`), `nowMs = max(fetched_at)` (recency/velocity
**as-of fetch-time**, не «сьогодні»), реальними `rankCandidates`/`scoreComponents`/`compositeScore`.

- **Покриття:** stored `composite_score` 180/2150 (8.37%) → перерахунок **2150/2150 (100%)**.
- **Шкала:** перерахована min 0.108 / median 0.163 / p90 0.223 / **max 0.687** — уся в [0,1].
  Застаріла stored: median 0.937 / **max 2.394** (ненормалізована). Підтверджує потребу `score_version`.
- **Reward-проксі (для бектесту):** «виграв» = engagement top-quartile (≥4) **АБО** breadth ≥ 2 →
  571/2105 (27.1%) winners.
- **Бектест (trend-index re-weights crossSource .28 / breadth .20 / velocity .24 / recency .12 / novelty .10 / inbrief .06):**

  | Метрика | Raw composite | Trend-index |
  |---|---|---|
  | **Precision@10** | 0.500 | **1.000** |
  | Precision@20 | 0.250 | **0.650** |
  | Precision@30 | 0.167 | **0.467** |

  Сирий composite «спливає» 3 zero-engagement офіційними постами (NVIDIA/MiniMax/OpenAI Academy)
  у топ-10 через recency+authority+velocity-floor; trend-index дає **10/10 winners** у топ-10.

- **Чесний нюанс:** на *усьому* наборі/глибше за топ сирий composite краще трекає *магнітуду*
  engagement (Spearman). Але робота продукту — топ-~10, де trend-index виграє однозначно.

### 1.1 Критичний імплементаційний нюанс для PR-I1
Backfill velocity/recency **обов'язково стампити as-of `fetched_at`**, не `now()` — інакше старі
рядки колапсують у recency≈0. PR-I1 має персистити **`scored_as_of` timestamp** поряд із компонентами.

### 1.2 Підтверджені обмеження (rigorous)
1. **Acceleration невідновлювана з власних даних** — `url` unique → 1 знімок/статтю. (→ GDELT, §2.)
2. **Novelty-vs-archive обмежена** — у `articles` **немає embedding-колонки** (embeddings лише на 125
   published `brief_item_embeddings`). Novelty тут — title-Jaccard проксі, не справжня відстань.
3. **Cross-source майже мертвий у даних** — лише **5 рядків** `mentions_count>1`; кластеризація по
   заголовках відновлює лише 6 кластерів breadth≥2. Тобто 0.22 ваги cross-source **голодна на дані**
   (проблема fetch/clustering, не формули) → C3 (джерела) + полагодити кластеризацію.

---

## 2. Track 2 — Зовнішні сигнали (заміна власному time-series)

**Стек (найдешевший надійний для соло, <$10/міс):**
- **GDELT DOC 2.0 API — PRIMARY, free.** Per-entity news-volume timeline (`timelinevol`), 15-хв
  refresh, **має історію** → найкращий безкоштовний проксі *velocity/acceleration* ретроактивно.
  Дезамбіг назв («Grok»/«Qwen»/«Sora» + co-terms).
- **arXiv API — SECONDARY, free.** Research-velocity по під-темах (agents, MCP, video, memory) — сильний
  для технічних сутностей, де дослідження випереджає покриття. Weekly.
- **Google Trends — TERTIARY, monthly, via DataForSEO** (~кілька $/міс). **Не** pytrends (ToS-ризик),
  **не** Exploding Topics API ($1k/міс).
- **Composite:** `rising_index = 0.5·z(GDELT) + 0.25·z(arXiv) + 0.25·z(Trends)`; lifecycle decay-flags
  як пріори.

**Lifecycle-флаги (станом на 2026-06, з джерелами в transcript):**
- **Surge (вага ↑):** MCP, agent memory / context engineering, Claude Code, Qwen, Ollama, пост-Sora
  відео (Veo / Kling / Seedance), Gemini 3.x, LangGraph.
- **Decay (вага ↓):** **Sora (shutdown бер.2026)**, vibe-coding (peaked), AutoGen (maintenance), Pika
  (fading), DeepSeek (плато відносно GLM/Kimi).
- **Mature/flat (не «rising»):** generic «AI coding», GPT-5.x.

---

## 3. Track 3 — Ринковий reward-проксі (валідовано)

Перевірено на ~19 реальних історіях квіт.–черв. 2026 (winners/partials/no).

**Композиція проксі-лейбла (НЕ сирі апвоути):**
`reward ≈ 0.40·cross_source_spread + 0.25·newsletter_lead_pickup + 0.20·sustained_multiday_arc + 0.15·capped_HN`

**Чому сирий HN (де-факто сигнал пайплайну, 73% корпусу) небезпечний як reward:**
1. **False positives** — Cursor Composer 2.5: гучно на HN, нішево в ринку.
2. **False negatives** — DeepSeek V4 (6+ HN-тредів попри «тихий запуск»); Uber AI-budget scoop (бізнес-історія, HN її проґавив би).
3. **Population/topic bias** — HN недооцінює business / policy / video / enterprise (саме кластер Sora-shutdown / Anthropic-policy / Uber, що виграв *широкий* ринок).
4. **Gameability** — пік одного треда чутливий до часу доби/заголовка/бригадинга; distinct-submission count + cross-source стійкіші.

**Надійність:** добре для bootstrap/калібрування *зараз*; це проксі-від-проксі для платної аудиторії
сайту — тримати niche-relevance override, multi-source agreement як confidence-вагу, і
переходити на first-party reward у міру накопичення. Лаговий (3–7 днів) → калібрує ранкер, не керує real-time.

---

## 4. Переформульований L1-план (що з цього будуємо)

### PR-I1 — Persist + **backfill** score telemetry `[S→M]` · міграція 032
Розширено проти `INSTRUMENTATION-PR-PLAN`: **бекфілити історію, не лише писати наперед.**
- Міграція: 6 `score_*` компонент + `score_version` + `cluster_id` + **`scored_as_of`** (новий — §1.1).
- `rank.ts`: `SCORE_VERSION`, `scored` (pre-cap), `memberUrls`/`clusterId`.
- `db.ts`/`run-daily.ts`: персистити всі члени всіх кластерів, незалежно від publish.
- **Backfill-скрипт:** одноразово ре-скорити 2150 статей **as-of їх `fetched_at`** → 100% покриття + [0,1]
  одразу (доведено в Track 1; основа скрипта — row→`Candidate` + `rankCandidates(items, 0, fetchedAtMs)`).
- Done: ≥95% (тут 100%) покриття; 0 рядків v2 зі score>1.0001; `scored_as_of` заповнено.

### Trend-index v0 (L2) — тепер data-grounded
- **Acceleration:** з **GDELT** (бо власний time-series мертвий) — нова таблиця `entity_trend_signals`.
- **Reward для калібрування:** ринковий проксі §3 (cross-source + newsletter + sustained), не сирий HN.
- **Novelty:** короткостроково — title-Jaccard; повноцінно — ембедити архів статей (не лише published).
- **Cross-source:** полагодити кластеризацію / додати джерела (C3) — сигнал є в коді, голодний на дані.

### Що НЕ робимо зараз
First-party reward (PR-I3 beacon) лишається forward-looking — стартуємо з ринкового проксі, не блокуємось.

---

## 5. Артефакти workflow
- Backtest-скрипт + дані — у `/tmp/backfill/` (не комічено; **жодних записів у prod**, лише SELECT).
  Reusable-ядро для PR-I1: `rankCandidates(items, 0, maxFetchedAtMs)`.
- Зовнішні джерела й lifecycle-флаги, валідаційна таблиця історій — у transcript сесії (з посиланнями).
