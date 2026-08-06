# Now — поточний операційний стан

Summary: над чим іде робота **прямо зараз**, що чекає на власника, що щойно відвантажено.
Живий файл — оновлювати при кожній зміні стану, не рідше раз на тиждень.
Sources: `git log` / `gh pr list` (live check 2026-08-04), Supabase preflight live check 2026-08-04,
`wiki/ops/owner-checklist.md`, `wiki/audits/2026-07-01-seo-organic.md`, `.env.example`,
owner session 2026-08-06 (editorial quality feedback)
Last updated: 2026-08-06

---

## Стан репозиторію

- Гілка `feat/weekly-editorial-voice` (з `main`, 2026-08-06): PR1 з семи запланованих у
  повному перегляді редакційної якості weekly-дайджесту (власник забракував увесь контент як
  «машинний» — див. [editorial-voice](pipeline/editorial-voice.md)). PR1 = новий модуль
  `editorial-voice.ts` (голос, exemplars, contrast-pairs, banned-phrases), переписані
  EN/UK майстер-промпти, нові поля `editorsView`/`discussionQuestion`, детермінований
  `detectTemplateLeaks` гейт, `weekly-master-v5`. Ще не змержено, ще не запущено shadow-прогін.
  PR2–7 (рендеринг, критик-рубрика, кут подачі, ілюстрації-репортажі, відеосценарій,
  соц-голос) — заплановані, не почато.
- `main` tip (звідки відгалужено PR1): draft-revision constraint + video-guidance routing
  fixes (#188, включає #186/#187). Гайд редакції — [ops/weekly-admin-runbook](ops/weekly-admin-runbook.md).
  (source: `git log` / live work 2026-08-06)

## Щойно відвантажено (останні 8 PR)

| PR | Що |
|---|---|
| #179 | Dependabot npm-patch-minor (12 deps; без pdfkit) — next 16.2.12, react 19.2.8, … |
| #178 | Harden Dependabot automerge + pdfkit ignore + secrets docs |
| #177 | Weekly digest revision stability (`input_hash` / no-op Save / restore) |
| #176 | Ребренд favicon / app icons / header-footer logo; expand-on-focus search |
| #175 | Ілюстрації без впеченого тексту (FLUX.2 prompt policy v5-no-text) |
| #174 | Persist illustration prompts + сильніші scene briefs |
| #173 | Stop weekly admin 5s auto-refresh blink |
| #172 | Stale weekly admin previews після visual regen |

(source: `gh pr list --state merged` live check 2026-08-04)

## Vercel Fluid CPU (2026-08-04)

Hobby-план був на **3h58m з 4h** включеного Fluid Active CPU (99.8% — проєкт `ai-today-brief`).
Корінь: `generation-worker.ts` еagerly імпортував `sharp`/`pdfkit`/`pdfjs-dist`/canvas на
кожному 5-хвилинному `pg_cron`-опитуванні `/api/internal/weekly/generate`, навіть при порожній
черзі; плюс `<Link>` prefetch самостійно бомбардував найважчий route (`/admin/weekly/[id]`) з
таб-навігації. Фікс на гілці `fix/vercel-fluid-cpu-cost` (деталі —
[pipeline/weekly-digest](pipeline/weekly-digest.md#fluid-cpu--вартість-2026-08-04)); RPC
output-overwrite checkpoint-баг editorial_master вже полагоджено і застосовано в прод-Supabase.
(source: live check Vercel dashboard 2026-08-04)

## Активна робота

1. **Редакційний перегляд якості weekly-дайджесту (7 PR, гілка `feat/weekly-editorial-voice`).**
   Власник заблокував реліз до кардинального покращення якості контенту — див.
   [editorial-voice](pipeline/editorial-voice.md) і план у `wiki/log.md` 2026-08-06. PR1
   (voice-модуль + промпти) готовий локально, тести/typecheck зелені, ще не змержено.
   **Це перекриває пункт нижче за пріоритетом:** trial release `ai-weekly-2026-07-27` у
   поточному вигляді (старий регістр) свідомо НЕ проштовхується, доки PR1–3 не landed і
   не пройдено shadow-верифікацію.
2. **Редакція `ai-weekly-2026-07-27`.** Packs v3 уже ready — **Approve 3/3** на Research
   (succeeded ≠ approved), далі `editorial_master` → Master quality. Гайд:
   [ops/weekly-admin-runbook](ops/weekly-admin-runbook.md). Призупинено до п.1.
3. **Weekly Content Studio v2 — розкатка.** `WEEKLY_CONTENT_STUDIO_V2=off` у `.env.example`;
   шлях `off → shadow (три історичні) → production` ще не пройдений; тепер природно
   збігається з shadow-верифікацією п.1.
   (source: `.env.example`)
4. **Опційно:** окремий `pdfkit` 0.19 після `npm run weekly:pdf:sample` / PDF smoke.

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

1. PR1–5 закомічені й запушені на PR [#189](https://github.com/sanchahous/ai-today-brief/pull/189)
   (одна гілка `feat/weekly-editorial-voice`, комітяться туди послідовно).
2. **Обидві live-перевірки виконано 2026-08-06 (з дозволу власника):**
   - **PR3 critic shadow-прогін — PASSED.** Новий критик проти `ai-weekly-2026-07-27` дав
     73/100 (voice 68, naturalness 70) замість старих 93/100, і сам процитував рівно ті
     фрази, на які скаржився власник. Живий прогін заодно знайшов і виправив реальний баг:
     критик вигадував власні коди issues, які не співпадали з revise-логікою — тепер
     закритий словник із 6 кодів.
   - **PR5 klein dry-run — виконано, 9 зображень надіслано власнику.** Технічно
     фотореалістичний репортажний стиль тримається добре; помічена (не власником — мною)
     потенційна проблема: композиції по трьох історіях занадто схожі одна на одну.
     Остаточна оцінка стилю — за власником.
3. PR6–7 (відеосценарій, соц-голос) — код продовжується.

## Related pages

- [overview](overview.md) — бізнес-контекст і жорсткі обмеження
- [pipeline/editorial-voice](pipeline/editorial-voice.md) — редакційний голос, чому старий контент бракований
- [pipeline/weekly-digest](pipeline/weekly-digest.md) — Content Studio v2 + revision stability
- [ops/weekly-admin-runbook](ops/weekly-admin-runbook.md) — як вести випуск у адмінці
- [ops/owner-checklist](ops/owner-checklist.md) — env / Dependabot secrets
- [index](index.md) — карта бази знань
- [open-questions](open-questions.md) — невирішені питання
- [log](log.md) — журнал операцій
