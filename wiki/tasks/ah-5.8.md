# AH-5.8

Summary: Реалізацію заблоковано середовищем: цільові тести та pr:check завершуються spawn EPERM до перевірки коду. Зміни інтерфейсу ще не внесено.
Sources: перенос зі спільних списків, ATB-67, PR #405; локальні перевірки 2026-10-05; [PR #426](https://github.com/sanchahous/ai-today-brief/pull/426)
Last updated: 2026-10-05

---

Task: ah-5.8

## Status

BLOCKED — обов’язкові перевірки не можуть запустити дочірні процеси. Код маршрутів і компонентів не змінено. (source: локальні команди нижче, 2026-10-05)

PR: https://github.com/sanchahous/ai-today-brief/pull/426

## Перевірки та AC

- `npx --no-install vitest run src/lib/concept-meta.test.ts src/components/concept-hub-body.test.ts` — exit 1: Vite не завантажив конфігурацію через `spawn EPERM` у `externalize-deps` / `optimizeSafeRealPathSync`; тести не виконано. (source: локальний запуск 2026-10-05)
- `npm run pr:check` — exit 1 на першому кроці `design:raw:check`: esbuild `ensureServiceIsRunning` отримав `spawn EPERM`. Решта гейту не виконана; правила не послаблено. (source: локальний запуск 2026-10-05)
- ISR, SEO compare, DefinedTermSet, карта, клавіатурні фільтри й таби, порожній стан та QA-матриця — AC ще не підтверджено; реалізація не почата через блокування перевірок. Preview, знімки й CI не перевірялися. (source: локальний diff 2026-10-05; [картка задачі](../product/after-hours-redesign-epic.md#ah-58--concepts-хаб-і-сторінка-концепту))
- Дані містять зв’язки матеріал–концепт, але явного джерела ребер концепт–концепт у переглянутій схемі немає; `getConceptHub` зараз формує `others` із перших 12 інших записів. Це не доказ семантичних зв’язків для карти. (source: `src/lib/database.types.ts`, `supabase/migrations/021_concept_item_junction.sql`, `src/lib/concepts.ts`)

## Handoff

Потрібне середовище, де дозволений запуск дочірніх процесів Node/Vite/esbuild. Після усунення обмеження продовжити цю саму задачу: реалізація, цільові тести, SEO/QA та `npm run pr:check`. Сервери не запускалися; commit/push не виконувалися. Підписів людських гейтів немає. (source: локальна сесія 2026-10-05; [PR #426](https://github.com/sanchahous/ai-today-brief/pull/426))

## Log

- 2026-10-05: прочитано контракт і залежності, перевірено початкову реалізацію; два незалежні запуски перевірок зупинилися на `spawn EPERM`. Наступна робота — продовжити AH-5.8 після відновлення запуску перевірок. (source: локальні команди вище)

## Історичний запис

### epic-5.3

```verbatim
| AH-5.8 | Concepts: хаб і сторінка | L | агент | AH-5.1, AH-2.6 | routes `concepts`, `concept` |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
