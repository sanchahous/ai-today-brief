# AH-2.5: зворотний зв'язок і data-стани — реалізація й докази

Summary: Notice, Spinner, ErrorState і StaleNotice у каталозі разом із наявними Toast і Skeleton. Ланцюг loading, partial/stale, ready, empty, recoverable і terminal. Окремий візуальний підпис очікується.
Sources: `src/components/ui/notice.tsx`; `spinner.tsx`; `error-state.tsx`; `stale-notice.tsx`; `src/lib/ui/feedback-copy.ts`; `e2e/feedback-states.spec.ts`; `artifacts/after-hours/qa/ah-2.5-evidence.json`; `artifacts/after-hours/qa/measure-loading-cls.mjs`; картка [AH-2.5](after-hours-redesign-epic.md#ah-25--зворотний-звязок-notice-toast-skeleton-spinner-emptystate-errorstate-stalenotice)
Last updated: 2026-10-01

---

## Стан

#390 змерджено в `56a9cf8` о 11:20 UTC. Окремого текстового підпису не було. Push цього коміту: Playwright [run 36854771692](https://github.com/sanchahous/ai-today-brief/actions/runs/36854771692), deps integrity, migration drift і Vercel — success. Sonar на самому push не запускався; Sonar PR #390 був success до merge. PR Playwright [run 36853557144](https://github.com/sanchahous/ai-today-brief/actions/runs/36853557144) після merge теж success. Падіння Weekly generation worker — `workflow_dispatch`, не CI цього merge. Merge не закриває UK Home/Article/Weekly, Preview CLS, H1/legacy AC AH-1.5 і G1. (source: `gh pr view 390`; `gh run list --commit 56a9cf8` 2026-10-01)

Реалізовано в [PR #391](https://github.com/sanchahous/ai-today-brief/pull/391) на `feat/ah-2.5-feedback-states`. Окремий візуальний підпис очікується. Merge не виконувався.

## Реалізація

Toast і `useToast` не дубльовано. Skeleton лишився єдиним: shimmer лише під час loading, у `prefers-reduced-motion` кільце Spinner і shimmer статичні. Нових кольорових токенів немає: Notice бере наявні `--warning`, `--error`, `--success`, `--accent` і `--text`. Контраст-гейт лишається 222 пари. (source: `src/components/ui/toast.tsx`; `skeleton.tsx`; `spinner.tsx`; `notice.tsx`; `scripts/check-design-tokens.ts`)

Notice має тон info, warning, error, success: іконка й текст, не лише колір. Помилка — `role=alert`, решта — `role=status`. ErrorState з «Спробувати ще» ставить `aria-busy` на час повтору і пише результат у окремий polite status. Термінальна помилка кнопки не має. StaleNotice форматує вік через `Intl.RelativeTimeFormat` і кількість через `Intl.PluralRules`: приклад «Оновлено 3 години тому» і «Показано останні 100 матеріалів» — вхідні значення каталогу, не живий архів. (source: `src/lib/ui/feedback-copy.ts`; `error-state.tsx`; `stale-notice.tsx`)

## Перевірки

- `e2e/feedback-states.spec.ts` проти `http://localhost:3108`: 7 тестів у Chromium, Firefox і WebKit, разом 21 passed. Ланцюг із шести кроків видимий. Toast «Saved» з'являється в `[role=status]`. Retry на 1,6 с має `aria-busy`, потім «Example recovered.». Заміна skeleton у каталозі тримає ширину й висоту блоку в межах 1 px. Фокус кнопки повтору з вимкненими transitions збігається з `--focus`. UK 390 і Day 1440: scoped axe 0. Reduced motion: тривалість анімації кільця `0s` або `0.001ms`. (source: прогін 2026-10-01; `e2e/feedback-states.spec.ts`)
- Спокійний каталог у `e2e/ui-components.spec.ts`, light і dark: 0 порушень axe. (source: той самий прогін)
- Лабораторна заміна skeleton з `loading.tsx` на контент, viewport 1440×900: skeleton видно на кожному переході; рахований CLS 0 на home/news/uk і 0,0178 на `/en` → `/en/category/agents-and-mcp`. На 390×900 усі п'ять переходів — 0. Поріг 0,05 не перевищено. Це не field CrUX і не закриває Preview CLS AH-1.5. (source: `artifacts/_local/ah-2-5-loading-cls-1440.json`; `ah-2-5-loading-cls-390.json`; `measure-loading-cls.mjs`; localhost:3108, `.env.local`, 2026-10-01)

## Візуальний review

[Локальна галерея](../../artifacts/after-hours/qa/ah-2.5-review.html): 8 знімків секції і 4 стани (готовий матеріал і повтор). PNG у git-ignored `artifacts/_local/ah-2-5-catalog`. SHA-256 файлу manifest — `28868e5af98e7da95d4f46d72b2c7cce705e72a4c5fc7fa5a6a81945d776b44f`. Знімки з next dev на localhost і реальних `.env.local`. Окремий підпис очікується. Публічний full-page report і G1 цією задачею не закриваються. (source: `capture-catalog-ah-2.5.mjs`; manifest 2026-10-01)

Production на 2026-10-01 після деплою #390: RSS `Wed, 30 Sep 2026`, `/en/news` Updated September 30, 2026, перший `lastmod` sitemap `2026-10-01`. Це той самий baseline, не старіший. (source: HTTP aitodaybrief.com 2026-10-01)

Наступна задача за нумерацією — **AH-2.6** після інтеграції цього PR. (source: [епік §5.3](after-hours-redesign-epic.md#53-зведена-таблиця-задач))

## Related pages

- [after-hours-redesign-epic](after-hours-redesign-epic.md) — картка й AC
- [after-hours-epic-handoff](after-hours-epic-handoff.md) — актуальний порядок
- [after-hours-ah-2-4-validation](after-hours-ah-2-4-validation.md) — попередня задача, змерджена в #390
- [design-system-tokens](../architecture/design-system-tokens.md) — нових токенів ця задача не додає
