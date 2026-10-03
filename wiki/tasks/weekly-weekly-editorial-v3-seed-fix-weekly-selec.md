# weekly-weekly-editorial-v3-seed-fix-weekly-selec

Summary: Статусний фрагмент weekly-weekly-editorial-v3-seed-fix-weekly-selec. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: weekly-weekly-editorial-v3-seed-fix-weekly-selec

## Status

### now.md

```verbatim
- **Weekly відбір `weekly-editorial-v3` + seed-контент історій — гілка
  `fix/weekly-selection-and-seed-content` (2026-08-16), PR ще не відкрито.** Аудит власника
  на прод-прогоні `05cc4e6a-a709-44ca-b56a-382f21c40292` (тиждень 09–15.08) знайшов чотири
  реальні дефекти, усі підтверджені на живій БД до фіксу:
  (1) **свіжість вирішувала замість якості** — `editorialImpact` константа 35 для кожного з
  10 `high`, тож усередині тіру не розрізняла нічого, а найбільший розкид давала `recency`
  (1.4 → 5.0); bearblog-допис обходив IBM ALTK-Evolve просто за датою. Тепер вікно тижня —
  плато, різниця понеділок↔субота ≤ 1 бала (на тому ж пулі 4.4–4.9);
  (2) **`category_balance` видаляв, а не штрафував** — кап різав 68.1 і 67.4, лишаючи 63.9;
  `perDayCap` робив те саме тихо (обрані розкладались рівно 2+2+2+1 по днях). Замінено на
  штраф −5 категорія / −4 джерело / −3 день і greedy max-marginal вибір; у бектесті новина,
  яку кап видаляв, повертається в дайджест 7-ю позицією, заплативши 3 бала. `diversity_penalty`
  і `adjusted_score` тепер зберігаються по кожному кандидату;
  (3) **`evidence` міряв заповненість полів** — 17.2 однаково в Hacker News і в особистого
  блогу, бо authority брався з назви **фіду**. Новий `pipeline/source-authority.ts` рахує
  authority **видавця** (для агрегатора — за хостом призначення): розкид evidence 7.6 → 22.0
  замість 14.4 → 18.0. `corroboration` (0 у 21 з 22) додатково рахує незалежні хости цитат,
  не рахуючи тред HN/Reddit/X — 3/33 замість 1/22; бюджет компонента 15 → 13. Повне лікування
  (крос-джерельне звʼязування на `fetch`) лишається окремою роботою: `mentions_count ≈ 1`;
  (4) **контент-генерація**: з `WEEKLY_CONTENT_STUDIO_V2=off` composer писав заглушку
  `body = summary`, `takeaway = why_matters`, `practical = null` — у прод-дайджесті
  `6cbcf0b3-187d-4d7d-9eb9-66bdff1c72d4` це 7/7 історій із двома заповненими полями з пʼяти.
  Причина не в LLM: щоденний айтем **уже** мав `body_md` (305–1553 симв.), `takeaways`,
  `action_items`, `when_to_use` — composer просто не вибирав ці колонки. Новий
  `src/lib/weekly-digest/seed-content.ts` мапить їх; replay проти прод-даних дає 5/5
  заповнених полів без дублів. Модуль нічого не генерує — переносить уже схвалений текст,
  порожнє лишає порожнім.
  1419 тестів зелені, `wiki:check` чистий. **Фікси діють на нові дайджести** — наявні
  ревізії імутабельні, поточний випуск треба перескладати або дописувати руками.
  (source: прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-16 —
  `weekly_digest_selection_runs`, `weekly_digest_revision_items`, `articles.score_authority`;
  бектест `selectEditorialDigestItems` на реальному пулі 2026-08-16;
  [weekly-editorial-selection § Що змінила v3](pipeline/weekly-editorial-selection.md#що-змінила-v3-2026-08-16),
  [weekly-digest § Seed-контент історій](pipeline/weekly-digest.md#seed-контент-історій-2026-08-16))
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
