# AI Today Brief

Щоденний курований AI/engineering-бриф (`aitodaybrief.com`) плюс evergreen концепт-хаби.
EN — основна мова, UK — вторинна. Next.js 16 (App Router) на Vercel, дані й pipeline
`fetch → rank → summarize → publish` — на Supabase.

Бізнес-контекст, ринок, обмеження й «що НЕ спрацювало» — [wiki/overview.md](wiki/overview.md).
Поточний стан робіт — [wiki/now.md](wiki/now.md).

## Чотири зони репозиторію

| Зона | Шлях | Правило |
|---|---|---|
| **Код** | `src/` `pipeline/` `supabase/` `e2e/` `scripts/` `public/` | правила — `.cursor/rules/00-core.mdc` |
| **Сирі джерела** | [`raw/`](raw/README.md) | **immutable** — ніколи не редагувати |
| **База знань** | [`wiki/`](wiki/index.md) | markdown із обов'язковими джерелами |
| **Деліверабли** | [`artifacts/`](artifacts/README.md) | згенеровані, безпечно перегенерувати |

Контракт для AI-агентів (Claude Code, Claude Projects, Codex/Cursor) — [`CLAUDE.md`](CLAUDE.md)
та [`AGENTS.md`](AGENTS.md).

## Розробка

```bash
npm ci
npm run dev
```

Основні команди:

| Команда | Що робить |
|---|---|
| `npm run pr:check` | **обов'язково перед пушем**: coverage + typecheck + lint + e2e-check + build |
| `npm test` / `npm run test:coverage` | Vitest (гейт ≥70% на logic-модулях) |
| `npm run e2e` | Playwright (спершу одноразово `npm run e2e:install`) |
| `npm run pipeline` / `npm run pipeline:dry` | прогін щоденного pipeline |
| `npm run wiki:lint` | перевірка бази знань: формат сторінок, посилання, сирітство |

**Ніколи не пушити в `main`** — тільки feature-гілка + PR (`.cursor/rules/pr-gate.mdc`).

## Документація

- [wiki/index.md](wiki/index.md) — карта всієї бази знань
- `docs/` — історичні документи, які мігрують у `wiki/` за
  [ADR 2026-08-02](wiki/decisions/2026-08-02-knowledge-base-restructure.md)
- `.cursor/rules/` — інженерні правила (читати `00-core.mdc` першим)
