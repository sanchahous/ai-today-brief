# AH-7.4

Summary: Реліз, моніторинг і оцінка після запуску After Hours v3: підготовлено реліз-нотатку та пофазовий план відкату (з окремим PR для токенів), датований звіт і протокол 28-денного моніторингу Vercel/GSC/CWV/GA4 проти baseline AH-0.6; запуск 28-денного вікна та проміжний перегляд на Дні 7 узгоджено власником.
Sources: [after-hours-redesign-epic §AH-7.4](../product/after-hours-redesign-epic.md); [after-hours-redesign §9](../product/after-hours-redesign.md); [redesign baseline](../analytics/2026-09-29-redesign-baseline.md); [singapore bot traffic](../analytics/2026-10-02-singapore-bot-traffic.md); [after-hours-release-and-rollback](../ops/after-hours-release-and-rollback.md); [after-hours-impact](../analytics/2026-10-06-after-hours-impact.md); [PR #440](https://github.com/sanchahous/ai-today-brief/pull/440)
Last updated: 2026-10-06

---

Task: ah-7.4

## Status

DONE. PR: [#440](https://github.com/sanchahous/ai-today-brief/pull/440). Підготовлено реліз-нотатку (що змінилось для читача), пофазовий план відкату (revert PR за фазами; токени — окремий PR) у `wiki/ops/after-hours-release-and-rollback.md` та артефакт 28-денного моніторингу у `wiki/analytics/2026-10-06-after-hours-impact.md`. Власник підтвердив запуск 28-денного календарного вікна спостереження (2026-10-06 … 2026-11-03) та обов'язковий перегляд проміжних даних на Дні 7 (2026-10-13). Оркестратору лишається commit та merge PR #440.

### epic-5.3

```verbatim
| AH-7.4 | Реліз, моніторинг, оцінка після запуску | S (+28 днів) | власник + агент | AH-7.3, AH-0.6 | оцінка §9 redesign |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))

## Updates

- 2026-10-06: AH-7.4 реліз, моніторинг і оцінка після запуску (ATB-61, PR #440).
  - Створено `wiki/ops/after-hours-release-and-rollback.md`: реліз-нотатка для читача (стиль, типографіка Fraunces/Inter/Georgia, новий знак D7, 2-рівневий хедер, SearchDialog, форми підписки, consent, toolbox, відсутність нескінченних анімацій); план відкату (Vercel Instant Rollback < 1 хв, зворотний пофазовий revert фази 7→1, виділений PR для відкату токенів із перевіркою контрасту, збереження БД за інваріантом I-7).
  - Створено `wiki/analytics/2026-10-06-after-hours-impact.md`: 28-денне вікно спостереження (2026-10-06 … 2026-11-03); зафіксовано чистий baseline AH-0.6 (з виключенням Сінгапур/Tencent ботів і headless-перевірок розробника); метрики моніторингу (Vercel 5xx/hydration errors, GSC індексація, CWV CrUX field p75, 5 продуктових воронок GA4, якісний фідбек); чекпоінти Днів 0, 7, 14, 21, 28; протокол рішення власника «зберегти / ітерувати».
  - Оновлено `wiki/index.md` з новими сторінками в розділах Analytics та Ops.
  - Власник підтвердив запуск 28-денного вікна спостереження та перегляд проміжних даних на Дні 7 (2026-10-13); параметри зафіксовано в артефактах моніторингу, задачу переведено в статус DONE.

## AC evidence

| AC | Evidence |
|---|---|
| Звіт `wiki/analytics/<дата>-after-hours-impact.md` з датованими цифрами й джерелами; інциденти — у `wiki/log.md` | Створено `wiki/analytics/2026-10-06-after-hours-impact.md` із зафіксованими числовими показниками baseline AH-0.6, методологією виключення ботів, матрицею 28-денного збору даних Vercel/GSC/CWV/GA4 та протоколом фіксації інцидентів у `wiki/log.md`. |
| Рішення власника «зберегти / ітерувати» записане | Зафіксовано у `wiki/analytics/2026-10-06-after-hours-impact.md` §7: власник підтвердив 28-денне вікно та перегляд даних на Дні 7 (2026-10-13); фінальний вибір «зберегти / ітерувати» заплановано за підсумками 28-денного зведення на Дні 28 (2026-11-03). |
