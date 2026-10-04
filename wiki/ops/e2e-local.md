# E2E локально — порт і паралельні checkout-и

Summary: як `PORT` і `E2E_BASE_URL` узгоджують Playwright, `e2e:affected` і `next start`, щоб
паралельні копії репозиторію не тестували чужий білд.
Sources: `playwright.config.ts`, `scripts/e2e-affected.ts`, `scripts/e2e-server-url.ts`, [PR #401](https://github.com/sanchahous/ai-today-brief/pull/401)
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

За broad-зміни (наприклад, `globals.css`) `e2e:affected` без `SKIP_BUILD=1` потребує
свіжого сервера: якщо за `baseURL` уже є відповідь, команда завершується з помилкою
до rebuild. Вона не завершує сторонні процеси. Зупиніть власний тестовий сервер і
повторіть команду; `SKIP_BUILD=1` застосовуйте лише після перевірки актуальності білда.
(source: `scripts/e2e-affected.ts`; [PR #412](https://github.com/sanchahous/ai-today-brief/pull/412))

## Пов'язані сторінки

- [github-actions-cost](github-actions-cost.md) — профіль CI e2e
- [local-mock-database](local-mock-database.md) — `dev:mock` (окремий mock + Next на `:3000`)
