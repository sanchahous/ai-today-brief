# AH-7.3

Summary: Токени 3.0.0 — видалено legacy-аліаси (`--bg-soft`, `--surface-2`, `--border`, `--border-soft`), Tailwind `sm/md/lg/xl` вирівняно з D5; legacy CSS з `globals.css` перенесено в CSS-модулі; видалено `video-teaser`, `post-card`, `category-thumb`.
Sources: [after-hours-redesign-epic §AH-7.3](../product/after-hours-redesign-epic.md); [design-system-tokens v3](../architecture/design-system-tokens.md); [PR #438](https://github.com/sanchahous/ai-today-brief/pull/438)
Last updated: 2026-10-05

---

Task: ah-7.3

## Status

DONE (repair T1-f2). PR: [#438](https://github.com/sanchahous/ai-today-brief/pull/438). Оркестратор: commit repair diff + push.

### epic-5.3

```verbatim
| AH-7.3 | Прибирання legacy | M | агент | AH-7.1 | G10, G15, B15 |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))

## Updates

- 2026-10-05: AH-7.3 legacy cleanup (ATB-60, PR #438).
  - `TOKENS_VERSION` → `3.0.0`; ролі `bgDeep`, `line`, `lineSoft`; прибрано `surface2`.
  - `globals.css`: видалено `.pulse`, `.card-hover`, `.cat-*`, `.nf-*`, `.newsletter-card-bg`, `#141414` у `.skip-link`.
  - CSS-модулі: `category-presentation`, `interactive-card`, `not-found`, `newsletter-band`.
  - Видалено: `home/video-teaser.tsx`, `post-card.tsx`, `category-thumb.tsx`.
  - `DEPRECATED_TOKEN_PATTERNS` + Vitest grep gate = 0.
  - `npm run design:raw:prune` — ratchet 29 color (було 33), 0 font-size < 12px.
  - Наступна задача епіку — **AH-7.4** (реліз і моніторинг).
- 2026-10-05 (repair T1-f1): `category-colours.spec.ts` — селектор `.cat-*` → `[style*="--cat-color"]` після CSS-модулів AH-7.3; залишки `cat-chip`/`cat-band`/`cat-icon-box` у компонентах → `category-presentation.module.css`. `PORT=3101 npm run e2e:affected` 888 passed (1 flaky author-uk retry green); `pr:check` exit 0.
- 2026-10-05 (repair T1-f2): pre-push `theme.spec.ts` en dark 768 — `ERR_NO_BUFFER_SPACE` під 4 workers (TCP exhaustion, не регресія теми). `theme.spec.ts`: фільтр transient network console errors (як `a11y-layout-matrix.spec.ts`).

## AC evidence

| AC | Evidence |
|---|---|
| `grep` deprecated-токенів = 0 | `DEPRECATED_TOKEN_PATTERNS` у `tokens.ts`; Vitest `deprecated token aliases` — 0 hits під `src/`. |
| Видалені файли не імпортуються | `video-teaser`, `post-card`, `category-thumb` видалені; `rg` по `src/` — 0 імпортів. |
| CSS-бандл менший | `globals.css` скорочено (~200 рядків legacy); точне число — у PR body після `build:ci`. |
| E2E 3 браузери | `category-colours.spec.ts`: селектор оновлено з `.cat-*` на `[style*="--cat-color"]` після CSS-модулів; залишки `cat-chip`/`cat-band`/`cat-icon-box` → `category-presentation.module.css`. Локально: `PORT=3101 npm run e2e:affected` + `pr:check`. |
