# Now — поточний операційний стан

Summary: над чим іде робота **прямо зараз**, що чекає на власника, що щойно відвантажено.
Живий файл — оновлювати при кожній зміні стану, не рідше раз на тиждень.
Sources: `git log` (live check 2026-08-03), `gh pr list` (live check 2026-08-03),
`wiki/ops/owner-checklist.md`, `wiki/audits/2026-07-01-seo-organic.md`, `.env.example`
Last updated: 2026-08-03

---

## Стан репозиторію

- `main` = `50b35d3` — *chore: adopt agentic knowledge-base architecture (#165)*.
  (source: git log live check 2026-08-03)
- Робоча гілка: `chore/migrate-docs-to-wiki` — міграція `docs/** → wiki/**` (кроки 2–8 ADR).
- Відкритий PR: **#157** — `dependabot/npm-patch-minor` (12 залежностей), від 2026-07-30.
  (source: `gh pr list` live check 2026-08-03)

## Щойно відвантажено (останні 5 PR)

| PR | Що |
|---|---|
| #165 | Agentic knowledge-base architecture (`raw/` · `wiki/` · `artifacts/`) |
| #163 | Weekly master pipeline більше не перевитрачає бюджет мовчки |
| #162 | Weekly Content Studio v2 |
| #161 | Weekly-дайджести рахуються за **завершеними** тижнями |
| #160 | Ручне створення weekly-дайджесту |

(source: git log live check 2026-08-03)

## Активна робота

1. **Міграція `docs/** → wiki/**`** — ця гілка. Кроки 2–8
   [ADR 2026-08-02](decisions/2026-08-02-knowledge-base-restructure.md): `git mv` усіх 39 md + SQL/прототипи/бренд-кіт,
   переписані посилання, шапки сторінок, `wiki:lint`.
2. **Weekly Content Studio v2 — розкатка.** Прапорець `WEEKLY_CONTENT_STUDIO_V2` у `.env.example`
   стоїть `off`; передбачений шлях `off → shadow (три історичні випуски) → production`.
   (source: `.env.example`)

## Чекає на власника (не код)

| # | Дія | Чому блокер |
|---|---|---|
| 1 | **5–10 якісних дофолов за місяць** + Request indexing для 10 топ-сторінок у GSC | єдиний реальний важіль проти 232 неіндексованих сторінок (source: `wiki/audits/2026-07-01-seo-organic.md` §4) |
| 2 | **Активувати IndexNow**: згенерувати ключ → `INDEXNOW_KEY` у Vercel + pipeline → Bing WMT → `npm run indexnow:backfill` | Bing живить пошук ChatGPT/Copilot = прямий AEO-виграш (там само §3) |
| 3 | **Звірити GA4-property** (540467725 vs документована 540206735): measurement ID, GSC-link, key event, retention 14 міс | інакше всі цифри конверсій недостовірні (там само §6) |
| 4 | **Фікс воронки розсилки** (41 показів → 8 стартів → 1 підписка) | утримання ≈ 0, зростання протікає (там само §5) |
| 5 | Перевірити білінг Gemini / вибір провайдера картинок | впливає на якість банерів і на бюджет `(needs verification)` |

## Найближчі 3 дії в коді

1. Домержити PR міграції `docs → wiki`.
2. Домержити або закрити **#157** (dependabot) — тримає lockfile у дрейфі.
3. Перевести `WEEKLY_CONTENT_STUDIO_V2` у `shadow` на трьох історичних випусках і зняти
   вартісні метрики перед `production`.

## Related pages

- [overview](overview.md) — бізнес-контекст і жорсткі обмеження
- [index](index.md) — карта бази знань
- [open-questions](open-questions.md) — невирішені питання
- [log](log.md) — журнал операцій
