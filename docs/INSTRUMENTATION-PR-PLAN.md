# Instrumentation PR — фундамент під trend-двигун (крок 1)

> **Складено 2026-06-13.** Реалізація кроку 1 з `docs/TREND-ENGINE-ANALYSIS.md §12`:
> «інструментуй енейблери майбутнього мозку». Це **не** trend-модель і **не** зміна ваг —
> шар запису даних, без якого жодна адаптивна модель неможлива. Grounded у
> `pipeline/{run-daily,rank,db,select}.ts`, `src/lib/analytics-client.ts`, prod-БД `ai-news-scrapper`.
>
> ⚠️ **Корекція (ground-truth 2026-06-13, див. `MASTER-ROADMAP.md §2`):** наступна вільна міграція —
> **032**, а не 031 (`031_item_canonical.sql` уже зайнято). Міграції нижче: **032 / 033 / 034**.
> `editor_take` — **не фантом**: зашитий (mig 027 + Telegram ✍️ + `items.ts`), просто 0/125 заповнено.

---

## 0. TL;DR

Три треки інструментації, кожен — **окремий PR**. Жоден не змінює `WEIGHTS`, відбір, публікацію
чи UI (крім невидимого beacon у T3). Усі — write-only телеметрія.

| PR | Трек | Що лагодить | Effort | Міграція |
|----|------|-------------|:---:|:---:|
| **#1** | Persist score + 6 компонент для **всіх** ранжованих статей + версія шкали | скор лише на **180/2150 (8.4%)**, лише lead-url, лише на publish; компоненти викидаються; **змішана шкала** (max 2.39) | **S** | 032 |
| **#2** | Append-only **time-series** знімків сигналів | `url` unique = 1 знімок → «прискорення» порахувати неможливо | **S** | 033 |
| **#3** | Перший-party **per-item reward** (view/scroll/expand/save/click) у БД | події лише в GA4, не joinable, ти не володієш рядками | **M** | 034 |

**Розблоковує:** бектест, калібрування ваг проти outcomes, виявлення «мертвих» 22% (cross-source), згодом bandit.

---

## 1. Чому це блокер

`composite_score` на 8.4% статей, `mentions_count≈1` (cross-source майже не пишеться), часового ряду
немає (`url` унікальний → ре-фетч перезаписує), per-item engagement лише в GA4. **Нема ні фіч для
тренування, ні reward, ні історії для трендів.** Цей пакет їх закриває — і нічого більше.

## 2. Non-goals
- **Не** чіпаємо `WEIGHTS` / формулу `rank.ts`.
- **Не** міняємо публікацію й Telegram-гейт.
- **Не** будуємо модель, **не** вмикаємо автопаблиш.
- **Не** чіпаємо рендер (T3 додає лише невидимий `sendBeacon`).

---

## 3. PR #1 — Persist score + components для ВСІХ статей `[S]` · міграція 032

**Проблема (grounded):** `run-daily.ts:512–514` будує `scoresByUrl` лише з lead-url, лише в гілці
publish; skip-прогони не пишуть нічого. `capPerSource(MAX_PER_SOURCE=3)` (`rank.ts:230`) ріже 4-ту+
історію джерела до запису. `ArticleScores = Map<url,{score,mentions}>` — 6 компонент викидаються.
Змішана шкала (max 2.39) без `score_version`.

**Зміни:**
- **Migration `032_article_score_telemetry.sql`** — `ALTER TABLE articles ADD COLUMN` score_velocity /
  score_cross_source / score_authority / score_recency / score_inbrief / score_breadth / score_version
  (smallint) / cluster_id (text) / scored_at (timestamptz). Коментар: v1 = pre-normalization (>1, виключити), v2 = [0,1].
- **`rank.ts`** — `export const SCORE_VERSION = 2`; `RankedEntry` += `memberUrls: string[]; clusterId`;
  `clusterId = sha1(memberUrls.sort().join('|')).slice(0,12)`; `RankResult` += `scored: RankedEntry[]` (ПЕРЕД capPerSource).
- **`db.ts`** — розширити `ArticleScores` 6 компонентами + version + clusterId; у `upsertArticles` писати їх.
- **`run-daily.ts`** — персистити **одразу після rank**, для всіх членів усіх кластерів (`ranking.scored`),
  незалежно від publish (`upsertArticles` ідемпотентний on `url`).

**Done:** ≥95% статей прогону мають non-null `composite_score`+6 компонент+`score_version`;
0 рядків `score_version=2 AND composite_score>1.0001`; стара частина — `v1`.

---

## 4. PR #2 — Time-series знімки сигналів `[S]` · міграція 033

**Проблема:** upsert on `url` → 1 знімок на статтю → прискорення (друга похідна, ядро trend-index)
порахувати неможливо.

**Зміни:**
- **Migration `033_signal_snapshots.sql`** — `CREATE TABLE article_signal_snapshots` (article_id FK,
  captured_at, run_cycle, hn_score, hn_comments, reddit_score, reddit_comments, mentions_count, age_hours,
  velocity, composite_score, score_version); index (article_id, captured_at); RLS on (лише service-role).
- **`db.ts`** — `insertSignalSnapshots(db, rows)`: append-insert, non-fatal.
- **`run-daily.ts`** — після rank: 1 рядок на член кластера за прогін (`run_cycle`). ~100–180 рядків/день.

**Done:** для історій у ≥2 циклах є ≥2 знімки; `(v2−v1)/(t2−t1)` рахується в SQL; retention 90 днів.

---

## 5. PR #3 — Per-item audience reward-сигнал `[M]` · міграція 034

**Проблема:** `trackEvent` шле лише в GA4 → не joinable до `brief_items`, семпл/латентність, чужі рядки.

**Варіант A (цільовий, durable) — first-party beacon:**
- **Migration `034_item_events.sql`** — `item_events` (brief_item_id FK, slug, event_type CHECK in
  view/post_expand/scroll_50/scroll_90/save_toggle/outbound_click/share/dwell, value, `session_hash`,
  lang, ua_class, ts); `item_metrics` rollup (views/expands/scroll50/scroll90/saves/outbound/shares/dwell_p50).
  RLS on (лише server-route, service role).
- **Route `src/app/api/ev/route.ts`** (за зразком `api/subscribe`, Next 16 docs-first): POST,
  валідація event_type, bot-фільтр (UA+rate-limit) → ua_class, `session_hash=sha256(ip+ua+yyyy-mm-dd+SALT)`
  (сирі ip/ua не зберігаються), insert через service-client.
- **`analytics-client.ts`** — `trackItemEvent(slug, type, params)`: GA4 **+** `navigator.sendBeacon('/api/ev')`, consent-gated.
  - **Корекція під реальний код:** `post_expand`/`save_toggle`/`share` уже шлють у GA4 (`post-card.tsx`) —
    додати лише beacon. `scroll_depth` сьогодні **page-level** (`use-scroll-depth.ts`), outbound-click
    **немає взагалі** → дозшити per-item.
- **Rollup** — cron (за зразком `weekly-digest.yml`) або RPC `refresh_item_metrics()` / materialized view.

**Варіант B (інтерим):** GA4 Data API → щоніч тягнути per-page в `item_metrics`. Швидко, але семпл/чужі дані.
**Рекомендація:** A — ціль; B — тимчасовий бекфіл.

**Guardrails:** PII-free (хеш); consent-gated; bot-фільтр+rate-limit; same-origin; `sendBeacon` не блокує UI.

**Done:** кожен item накопичує view/scroll/expand; `item_metrics ⨝ brief_items` дає reward-вектор; **0 PII**.

---

## 6. Послідовність, залежності, гігієна

```
PR#1 (032, S)  ──►  PR#2 (033, S)  ──►  PR#3 (034, M)
 чистий бекенд      чистий бекенд       +клієнт-beacon +route
```
- Кожен — окрема feature-гілка; `npm run pr:check`; **ніколи не в `main`**.
- Після кожної міграції — **регенерувати** `src/lib/database.types.ts` (інакше `as any`).
- T1/T2 — нульовий ризик для сайту. T3 — єдиний, що торкається клієнта.
- Next.js 16: перед новим route читати `node_modules/next/dist/docs/`.

## 7. Acceptance criteria (вимірювані)

| Трек | Критерій | Перевірка |
|------|----------|-----------|
| T1 | ≥95% статей скоряться + 6 компонент + version | `count(*) FILTER (WHERE composite_score IS NOT NULL)/count(*)` за останній день |
| T1 | 0 рядків v2 зі score>1 | `count(*) WHERE score_version=2 AND composite_score>1.0001` → 0 |
| T2 | ряд є | `GROUP BY article_id HAVING count(*)>=2` → не порожньо |
| T3 | reward joinable | `brief_items ⨝ item_metrics` дає метрики |
| T3 | PII-free | у `item_events` лише `session_hash` |

## 8. Що розблоковує (і чого досі НЕ робимо)

**Розблоковує:** бектест; калібрування ваг проти outcomes; видно «мертві» 22% cross-source; згодом bandit.
**Досі НЕ робимо** (після ~6–12 тижнів даних): зміна ваг, редакційний гейт як код (C2), будь-яка
«самонавчальність». Спершу — дані. Цей пакет = лише фундамент.
