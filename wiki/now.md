# Now — поточний операційний стан

Summary: над чим іде робота **прямо зараз**, що чекає на власника, що щойно відвантажено.
Живий файл — оновлювати при кожній зміні стану, не рідше раз на тиждень.
Sources: `git log` / `gh pr list` (live check 2026-08-04), Supabase preflight live check 2026-08-04,
`wiki/ops/owner-checklist.md`, `wiki/audits/2026-07-01-seo-organic.md`, `.env.example`
Last updated: 2026-08-04

---

## Стан репозиторію

- `main` = `4521de7` — *Fix weekly digest Save wiping approved artifacts across revisions (#177)*.
  (source: git log live check 2026-08-04)
- Активна інфра: `chore/dependabot-infra-safe` — automerge без approve + ignore `pdfkit` minor/major;
  Dependabot secrets `SCRAPPER_BASE_*` скопійовано (раніше e2e #164 падав на порожніх env).
- Відкриті PR: **#164** (dependabot npm-patch-minor; recreate після інфра-мерджу).
  (source: `gh pr list` live check 2026-08-04)
- Міграція `docs/** → wiki/**` **закрита** (#166). Папки `docs/` у git немає.

## Щойно відвантажено (останні 8 PR)

| PR | Що |
|---|---|
| #177 | Weekly digest revision stability (`input_hash` / no-op Save / restore) |
| #176 | Ребренд favicon / app icons / header-footer logo; expand-on-focus search |
| #175 | Ілюстрації без впеченого тексту (FLUX.2 prompt policy v5-no-text) |
| #174 | Persist illustration prompts + сильніші scene briefs |
| #173 | Stop weekly admin 5s auto-refresh blink |
| #172 | Stale weekly admin previews після visual regen |
| #171 | FLUX.2 multipart Node fetch — klein більше не spillover на schnell |
| #170 | Generation jobs на відповідних workspace tabs |

(source: `gh pr list --state merged` live check 2026-08-04)

Раніше в серпні: #169 FLUX.2 + costs ledger · #168 social LLM · #167 writer-model · #166 docs→wiki ·
#165 agentic KB · #163 spend gate · #162 Content Studio v2 · #161 completed weeks ·
#160 manual weekly create.

## Активна робота

1. **Dependabot #164 + інфра.** Automerge без `gh pr review --approve` (GITHUB_TOKEN не може
   апрувити); `pdfkit` minor/major винесено з групового bump; recreate після мерджу інфри.
2. **Редакція `ai-weekly-2026-07-27`.** `artifact_stale = 0`; лишились PDF approve, video
   pipeline (override-eligible), ~6 social variants. (source: Supabase live check 2026-08-04)
3. **Weekly Content Studio v2 — розкатка.** `WEEKLY_CONTENT_STUDIO_V2=off` у `.env.example`;
   шлях `off → shadow (три історичні) → production` ще не пройдений.
   (source: `.env.example`)

## Чекає на власника (не код)

| # | Дія | Чому блокер |
|---|---|---|
| 1 | **5–10 якісних дофолов за місяць** + Request indexing для 10 топ-сторінок у GSC | єдиний реальний важіль проти 232 неіндексованих сторінок (source: `wiki/audits/2026-07-01-seo-organic.md` §4) |
| 2 | **Активувати IndexNow**: ключ → `INDEXNOW_KEY` у Vercel + pipeline → Bing WMT → `npm run indexnow:backfill` | Bing → ChatGPT/Copilot AEO (там само §3) |
| 3 | **Звірити GA4-property** (540467725 vs документована 540206735) | інакше конверсії недостовірні (там само §6) |
| 4 | **Фікс воронки розсилки** (41 показів → 8 стартів → 1 підписка) | утримання ≈ 0 (там само §5) |
| 5 | Апрув PDF + social variants на `ai-weekly-2026-07-27`; вирішити video override vs повний video pipeline | блокує trial release (source: preflight live check 2026-08-04) |
| 6 | Перевести `WEEKLY_CONTENT_STUDIO_V2` у `shadow` на 3 історичних випусках і зняти витрати з `/admin/costs` | критерій `production` ще відкритий ([open-questions](open-questions.md) #4) |

## Найближчі 3 дії в коді

1. Змерджити інфра Dependabot (automerge + pdfkit ignore) і `@dependabot recreate` на **#164**.
2. Окремий PR `pdfkit` 0.19 після `npm run weekly:pdf:sample` / PDF smoke.
3. Staging: прогнати no-op Save + Restore на тест-випуску після міграції #177.

## Related pages

- [overview](overview.md) — бізнес-контекст і жорсткі обмеження
- [pipeline/weekly-digest](pipeline/weekly-digest.md) — Content Studio v2 + revision stability
- [ops/owner-checklist](ops/owner-checklist.md) — env / Dependabot secrets
- [index](index.md) — карта бази знань
- [open-questions](open-questions.md) — невирішені питання
- [log](log.md) — журнал операцій
