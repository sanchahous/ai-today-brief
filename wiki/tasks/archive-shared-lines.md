# Архів спільних рядків

Summary: Статусний фрагмент Архів спільних рядків. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: archive-shared-lines

## Status

### now-preamble

```verbatim
# Now — поточний операційний стан

Summary: над чим іде робота **прямо зараз**, що чекає на власника, що щойно відвантажено.
Живий файл — оновлювати при кожній зміні стану, не рідше раз на тиждень.
Sources: `git log` / `gh pr list`, owner sessions 2026-08-06…29, catalog 2026-08-30,
YouTube 120s + Supabase egress 2026-09-02,
SSG skip + local `build:ci` skip + ElevenLabs TTS 2026-09-03,
LinkedIn PDF skip on public promote 2026-09-03,
social URLs follow the published slug 2026-09-03,
weekly digest two-phase release (Ship / Publish video) 2026-09-03,
X self-reply is USE + compact `?s=` URL 2026-09-03,
LinkedIn comment is compact `?s=` + native article card on the post 2026-09-03
desktop nav surfaces Digests; homepage weekly card and SEO snippet updated 2026-09-03 (#360); redesign epic + code live check 2026-09-29; AH-0.1 G01–G20 status reconciliation + production live check 2026-09-29; AH-0.6 GA4 baseline 2026-09-29, повторна звірка PR / CWV / Admin-доступу й рішення власника щодо двох зайвих GA4-акаунтів 2026-09-30; AH-2.6 navigation consolidation 2026-10-01 (#392); AH-3.1 brand mark PR #393; AH-3.4 newsletter form and states 2026-10-02 (#395); AH-3.6 consent PR #396; AH-3.7 mark in generators PR #402; AH-3.8 brand-kit PR #403; per-PR owner signature removed 2026-10-02 (ATB-64, #397); Singapore bot diagnosis + Fast Origin Transfer check 2026-10-02
Last updated: 2026-10-02 (AH-3.8 PR #403)
desktop nav surfaces Digests; homepage weekly card and SEO snippet updated 2026-09-03 (#360); redesign epic + code live check 2026-09-29; AH-0.1 G01–G20 status reconciliation + production live check 2026-09-29; AH-0.6 GA4 baseline 2026-09-29, повторна звірка PR / CWV / Admin-доступу й рішення власника щодо двох зайвих GA4-акаунтів 2026-09-30; AH-2.6 navigation consolidation 2026-10-01 (#392); AH-3.1 brand mark PR #393; AH-3.4 newsletter form and states 2026-10-02 (#395); AH-3.5 footer PR #404; AH-3.6 consent PR #396; AH-3.7 mark in generators PR #402; per-PR owner signature removed 2026-10-02 (ATB-64, #397); Singapore bot diagnosis + Fast Origin Transfer check 2026-10-02
Last updated: 2026-10-02 (AH-3.4 PR #395; AH-3.5 PR #404; AH-3.6 PR #396; AH-3.7 PR #402)

---
```

### handoff-heading

```verbatim
## 1. Стан на 2026-10-02
```

### handoff-prompt

```verbatim
Продовж виконання епіку редизайну After Hours у репозиторії ai-today-brief.
1. Прочитай wiki/product/after-hours-epic-handoff.md і виконай розділ «Порядок старту сесії».
2. Підтягни origin/main і перевір актуальний стан у §1 цього handoff та §5.3 епіку.
   На 2026-10-01 AH-2.6 реалізовано в PR #392 на feat/ah-2.6-navigation.
   AH-2.5 реалізовано в PR #391 на feat/ah-2.5-feedback-states і очікує власного review.
   AH-3.5 реалізовано в PR #404 на feat/ah-3.5-footer; після інтеграції — AH-3.6 (Consent-картка).
   AH-3.6 реалізовано в PR #396 на feat/ah-3.6-consent-card; після інтеграції — AH-3.7.
   AH-3.7 реалізовано в PR #402 на feat/ah-3.7-mark-in-generators. Наступна задача — AH-3.8 (brand-kit).
   AH-3.1 реалізовано в PR #393 на feat/ah-3.1-brand-mark; після інтеграції — AH-3.2 (SearchDialog).
   UK Home/Article/Weekly, CLS, legacy QA та G1 лишаються відкритими.
   Для нової задачі — гілка feat/ah-<id>-<slug> від origin/main,
   Definition of Done §0.1, npm run pr:check перед push, PR у main.
   Окремий підпис власника на PR не потрібен: оркестратор мерджить після зелених перевірок
   (ATB-64, 2026-10-02). Гейти G1–G7 і далі зупиняють і питають власника.
3. Після PR онови §5.3 епіку, wiki/now.md, wiki/log.md і рядок «Наступна задача» в handoff.
4. У точках із розділу «Точки зупинки» зупинись і спитай мене. Нічого не вигадуй.
Відповідай мені українською.
```

### index-preamble

```verbatim
# Index — карта бази знань AI Today Brief

Summary: головний зміст усієї wiki. Кожен рядок — одна сторінка + один рядок опису. Точка входу
для будь-якого питання: спершу читаємо цей файл, потім релевантні сторінки.
Sources: інвентаризація репозиторію (live check 2026-08-04), follow-up critic-recovery 2026-08-10,
story-image / Visual Affordance / illustration B1-fix 2026-08-11…15, Social/PDF/Video 2026-08-17…19,
GA4 + SEO 2026-08-21, latest weekly revision is the working copy 2026-08-22,
Prompt-as-Code v6 2026-08-23, daily visual production workflow 2026-08-24,
first nightly daily visual QA 2026-08-25, weekly Video tab #441 2026-08-25,
консолідація відео-папок 2026-08-28, weekly topic slug + revision review 2026-08-29,
каталожний вибір OpenRouter 2026-08-30, YouTube 120s + Supabase egress 2026-09-02,
desktop nav Digests + homepage weekly card 2026-09-03 (#360), After Hours redesign concept 2026-09-05, design-system audit 2026-09-26, redesign epic 2026-09-29, GA4 / After Hours baseline 2026-09-30, повідомлення власника про кошик GA4 + HYPD і live tag check 2026-09-30, AH-2.6 navigation consolidation 2026-10-01 (#392), AH-3.4 newsletter form and states 2026-10-02 (#395), AH-3.5 footer redesign 2026-10-02 (#404), діагноз Singapore bot + Fast Origin Transfer 2026-10-02
Last updated: 2026-10-02
```

### index-handoff-row

```verbatim
| ✅ [product/after-hours-epic-handoff](product/after-hours-epic-handoff.md) | AH-3.5 у PR #404 (Footer redesign); AH-3.6 у PR #396; AH-3.1 у PR #393; AH-3.7 у PR #402; ATB-64 (#397); ATB-22/23/27 waiting; G1/UK/CLS/legacy відкриті | PR #404, #396, #393, #402; дозвіл власника 2026-10-02 |
```

### epic-last-updated

```verbatim
Last updated: 2026-10-02 (AH-3.8 PR #403)
```

### handoff-last-updated

```verbatim
Last updated: 2026-10-02 (AH-3.8 PR #403)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
