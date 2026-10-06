# AH-7.5

Summary: Фінальна документація та звірка wiki-статусів редизайну After Hours: статус реалізації в after-hours-redesign, токени 3.0.0 і changelog в design-system-tokens, Tension v3 в production в after-hours-tension, фінальні статуси G01–G20 у gap-plan, статус «очікує G7» в after-hours-redesign-epic.
Sources: [after-hours-redesign-epic §AH-7.5](../product/after-hours-redesign-epic.md); [after-hours-redesign](../product/after-hours-redesign.md); [design-system-tokens](../architecture/design-system-tokens.md); [after-hours-tension](../product/after-hours-tension.md); [gap-plan](../audits/2026-09-26-design-system-gap-plan.md); [PR #441](https://github.com/sanchahous/ai-today-brief/pull/441)
Last updated: 2026-10-06

---

Task: ah-7.5

## Status

DONE. PR: [#441](https://github.com/sanchahous/ai-today-brief/pull/441). Наступна дія: запуск 28-денного релізного моніторингу AH-7.4 та рішення власника за підсумками G7.

### epic-5.3

```verbatim
| AH-7.5 | Документація й статуси wiki | S | агент | AH-7.3 | G01 (фінал) |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))

## Updates

- 2026-10-06: AH-7.5 wiki-документація й фіналізація статусів (ATB-62, PR #441).
  - `wiki/product/after-hours-redesign.md`: оновлено Summary, Sources, статус переведено в «реалізовано в production» із детальним описом переносу за фазами 0–6 та PR #367–#438.
  - `wiki/architecture/design-system-tokens.md`: зафіксовано реліз v3.0.0, SemVer, правила governance, changelog для v3.0.0 із посиланням на PR #438.
  - `wiki/product/after-hours-tension.md`: статус переведено в «перенесено в production» (Tension v3 впроваджено після G5 у межах фази 6, PR #432–#434).
  - `wiki/audits/2026-09-26-design-system-gap-plan.md`: додано Розділ 11 із фінальною таблицею розривів G01–G20 (19 done, 1 waived — G19 за рішенням власника 2026-09-29).
  - `wiki/product/after-hours-redesign-epic.md`: оновлено статус у шапці та примітку до G7 — «очікує G7» (остаточне закриття епіку — після 28-денного моніторингу AH-7.4 та рішення власника); таблицю §14 синхронізовано з актуальними статусами G01–G20.
  - Жодних рутинних правок статусів у спільних файлах `now.md`, `index.md`, `log.md` не робилося (контракт ATB-67).

## AC evidence

| AC | Evidence |
|---|---|
| `npm run wiki:check` зелений | Виконано перевірку лінкера та project-sync, помилок немає. |
| Жодна сторінка не називає прототип «production-ready» без проходження acceptance (G01) | Усі згадки прототипу After Hours розмежовують вихідні артефакти як концепт і перенесення в production за результатами проходження acceptance фази 7 (AH-7.1 / PR #436). |

