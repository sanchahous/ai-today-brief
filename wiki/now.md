# Now — поточний операційний стан

Summary: над чим іде робота **прямо зараз**, що чекає на власника, що щойно відвантажено.
Живий файл — оновлювати при кожній зміні стану, не рідше раз на тиждень.
Sources: `git log` (live check 2026-08-02), `gh pr list` (live check 2026-08-02),
`docs/OWNER-CHECKLIST.md`, `docs/audit/2026-07-01-seo-organic-audit.md`, `.env.example`
Last updated: 2026-08-02

---

## Стан репозиторію

- `main` = `c4abe06` — *fix: stop the weekly master pipeline from quietly overspending (#163)*.
  (source: git log live check 2026-08-02)
- Робоча гілка цієї сесії: `claude/agentic-workflow-architecture-9a1871` (worktree).
- Відкритий PR: **#157** — `dependabot/npm-patch-minor` (12 залежностей), від 2026-07-30.
  (source: `gh pr list` live check 2026-08-02)

## Щойно відвантажено (останні 5 PR)

| PR | Що |
|---|---|
| #163 | Weekly master pipeline більше не перевитрачає бюджет мовчки |
| #162 | Weekly Content Studio v2 |
| #161 | Weekly-дайджести рахуються за **завершеними** тижнями |
| #160 | Ручне створення weekly-дайджесту |
| #159 | Meta business domain verification meta-тег |

(source: git log live check 2026-08-02)

## Активна робота

1. **Реструктуризація бази знань під agentic workflow** — цей PR. Створено скелет
   `raw/` · `wiki/` · `artifacts/`, переписано `CLAUDE.md`/`AGENTS.md`, додано `.mcp.json` і
   `npm run wiki:lint`. **Перенесення `docs/**` у `wiki/**` ще НЕ виконано** — план у
   [decisions/2026-08-02-knowledge-base-restructure](decisions/2026-08-02-knowledge-base-restructure.md).
2. **Weekly Content Studio v2 — розкатка.** Прапорець `WEEKLY_CONTENT_STUDIO_V2` у `.env.example`
   стоїть `off`; передбачений шлях `off → shadow (три історичні випуски) → production`.
   (source: `.env.example`)

## Чекає на власника (не код)

| # | Дія | Чому блокер |
|---|---|---|
| 1 | **5–10 якісних дофолов за місяць** + Request indexing для 10 топ-сторінок у GSC | єдиний реальний важіль проти 232 неіндексованих сторінок (source: `docs/audit/2026-07-01-seo-organic-audit.md` §4) |
| 2 | **Активувати IndexNow**: згенерувати ключ → `INDEXNOW_KEY` у Vercel + pipeline → Bing WMT → `npm run indexnow:backfill` | Bing живить пошук ChatGPT/Copilot = прямий AEO-виграш (там само §3) |
| 3 | **Звірити GA4-property** (540467725 vs документована 540206735): measurement ID, GSC-link, key event, retention 14 міс | інакше всі цифри конверсій недостовірні (там само §6) |
| 4 | **Фікс воронки розсилки** (41 показів → 8 стартів → 1 підписка) | утримання ≈ 0, зростання протікає (там само §5) |
| 5 | Перевірити білінг Gemini / вибір провайдера картинок | впливає на якість банерів і на бюджет `(needs verification)` |

## Найближчі 3 дії в коді

1. Домержити або закрити **#157** (dependabot) — тримає lockfile у дрейфі.
2. Виконати міграцію `docs/** → wiki/**` (кроки 2–6 плану) окремим PR.
3. Перевести `WEEKLY_CONTENT_STUDIO_V2` у `shadow` на трьох історичних випусках і зняти
   вартісні метрики перед `production`.

## Related pages

- [overview](overview.md) — бізнес-контекст і жорсткі обмеження
- [index](index.md) — карта бази знань
- [open-questions](open-questions.md) — невирішені питання
- [log](log.md) — журнал операцій
