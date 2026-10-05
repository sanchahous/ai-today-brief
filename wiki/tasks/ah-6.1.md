# AH-6.1

Summary: Tension v3 motion runtime — WAAPI жести через `data-gesture`, `MotionProvider` у layout; legacy `Reveal` видалено.
Sources: `artifacts/after-hours/tension.js`, `tension.css`, `tokens.json`; [after-hours-tension](../product/after-hours-tension.md); [PR #432](https://github.com/sanchahous/ai-today-brief/pull/432)
Last updated: 2026-10-05

---

Task: ah-6.1

## Status

### epic-5.3

```verbatim
| AH-6.1 | Motion runtime і жести | M | агент | G5 | Tension v3 |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405); реалізація [PR #432](https://github.com/sanchahous/ai-today-brief/pull/432))

## Updates

- 2026-10-05: Реалізовано AH-6.1 (ATB-54, PR #432).
  - `src/lib/motion/*` — spring m=1/k=240/c=24 (33 кадри), budget 32 cap, gestures, runtime.
  - `src/components/motion/motion-provider.tsx` — IntersectionObserver на `[data-gesture]`, press/confirm, cancel on route/pagehide/hidden tab; D13 — лише `prefers-reduced-motion`.
  - `src/app/globals.css` — Tension tokens, `data-tension-motion`; видалено `.reveal`.
  - Міграція `<Reveal>` → `data-gesture` у home, news, subscribe, advertise, concepts та спільних компонентах; `reveal.tsx` видалено.
  - `e2e/motion-runtime.spec.ts` — no-JS (5 шаблонів), reduced motion, budget/peak ≤ 32.
  - **Наступна задача епіку — AH-6.2 (The Resolve).**
