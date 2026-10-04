# E2E локально — порт і паралельні checkout-и

Summary: як `PORT` і `E2E_BASE_URL` узгоджують Playwright, `e2e:affected` і `next start`, щоб
паралельні копії репозиторію не тестували чужий білд.
Sources: `playwright.config.ts`, `scripts/e2e-affected.ts`, `scripts/e2e-server-url.ts`, `.github/workflows/e2e.yml`, [PR #401](https://github.com/sanchahous/ai-today-brief/pull/401)
Last updated: 2026-10-04

---

## Змінні

| Змінна | За замовчуванням | Хто читає |
|---|---|---|
| `PORT` | `3000` | `next dev`, `next start`, `playwright.config.ts` (`webServer`), `scripts/e2e-affected.ts` (`serverIsUp`) |
| `E2E_BASE_URL` | (не задано) | Playwright `baseURL`; коли задано — **вимикає** вбудований `webServer` (зовнішній сервер) |

Спільна логіка — `scripts/e2e-server-url.ts`: `resolveE2ePort()` і `resolveE2eBaseUrl()`.
`E2E_BASE_URL` має пріоритет над `PORT`.

**Cookie consent:** Playwright сідає `localStorage` через
`consentStorageState()` у `scripts/e2e-server-url.ts` з origin = поточний `baseURL` (порт входить у origin).
Статичний `e2e/consent-state.json` лишається лише для legacy QA-скриптів у `artifacts/` на
`:3000`; конфіг і `a11y-layout-matrix` читають TS-хелпер.

## Типові сценарії

**Один checkout (як раніше):** нічого не задавати — усе на `http://127.0.0.1:3000`.

**Два checkout-и одночасно (оркестратор, діапазон 3100–3199):**

```bash
PORT=3101 npm run e2e:affected
PORT=3101 npx playwright test
```

Playwright передає `PORT` у `npm run start`; `reuseExistingServer` перевіряє лише свій порт.

**Сервер уже запущений вручну:**

```bash
DS_CATALOG=1 PORT=3101 npm run build:ci && npm run start
E2E_BASE_URL=http://127.0.0.1:3101 npx playwright test
```

Або `SKIP_BUILD=1` для `e2e:affected`, якщо білд уже є і сервер слухає на тому ж `PORT`.

## CI

На PR GitHub Actions не ганяє весь набір: `npx tsx scripts/e2e-affected.ts --ci-plan` вибирає
спеки за змінами, далі `playwright test --project=chromium`. Повна матриця на трьох рушіях —
лише `push` у `main` і ручний запуск. Деталі й компроміс —
[github-actions-cost §8](github-actions-cost.md#8-e2e-на-pr--точковий-вибір-спеків-2026-10-04).
Те саме, що в CI, локально: `E2E_AFFECTED_FILES="src/components/site-footer.tsx" npm run e2e:affected -- --dry-run`.

## Пов'язані сторінки

- [github-actions-cost](github-actions-cost.md) — профіль CI e2e
- [local-mock-database](local-mock-database.md) — `dev:mock` (окремий mock + Next на `:3000`)
