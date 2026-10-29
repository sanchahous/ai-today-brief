# ATB-91

Summary: Пакет виправлень редизайну: заголовок банера статті, картка «Ранковий бриф» у вузькому sidebar, блок поширення, літеральні `<br>` у markdown-тілі, відмова від портретних обкладинок і оновлення блоків тіла статті.
Sources: live check у Playwright 2026-10-29; `src/app/globals.css`; `src/lib/markdown.ts`; `pipeline/card-image.ts`; `pipeline/scripts/regenerate-card-image.ts`
Last updated: 2026-10-29

---

Task: atb-91

## Status

```verbatim
- **ATB-91:** Виправлено заголовок банера (container queries, cover, стек на мобільному, світлий ink на темному scrim), картку «Ранковий бриф» у sidebar, вирівнювання й іконки share-блоку, літеральні `<br>` у markdown (`normalizeMarkdownBreaks`), вимкнено Pollinations-fallback для обкладинок за замовчуванням, оновлено блоки тіла статті. Регенерацію банерів у проді запущено 2026-10-29 за рішенням власника: 8 з 35 готово, 27 чекають на скидання денної квоти Cloudflare (див. нижче).
```

DONE (PR відкрито; 27 обкладинок чекають на скидання квоти Cloudflare).

## Change

- Банер статті: `.banner-hero*` у `globals.css` на container queries, `object-fit: cover`, на мобільному копія стекається під артом; текст поверх завжди темного scrim має фіксований світлий ink (у Day-темі `--text` майже чорний і зливався зі scrim).
- Sidebar «Ранковий бриф» (`newsletter-band`): container queries, картка не ламається у вузькій колонці `/news`.
- `ItemShareBar` + `icons.tsx`: вирівнювання блоку й іконки X/LinkedIn.
- `normalizeMarkdownBreaks` у `src/lib/markdown.ts` і `pipeline/summarize.ts`: літеральний `<br>` в LLM-markdown більше не робить гігантський `<h3>`.
- `pipeline/card-image.ts`: щабель Pollinations повністю видалено (функція, `allowPollinations`, значення провайдера; у проді 0 рядків `card_image_url` з pollinations) — драбина закінчується на null → duotone (портретні обкладинки); `regenerate-card-image.ts` отримав `--slugs`, `--slugs-file`, `--apply` (`regenerate-card-image-args.ts`); [card-images](../marketing/card-images.md) оновлено.
- Тіло статті: `src/components/editorial/*` (callout, takeaways, key-facts, when-grid, action-list, data-table, code-figure, нові code-panel, section-divider, section-label), `story-body`, `markdown-body`, `.reading-copy`, ds-catalog.

## Known, pre-existing

- Dev-оверлей Next «1 Issue» — hydration mismatch `tabindex="-1"` на `h1`: `RouteFocusMain` (AH-6.3) у StrictMode повторно виконує ефект і ставить `tabindex` до пізньої гідрації. Відтворюється на `/uk/about`, тобто не від цієї задачі; лише dev. (source: Playwright console 2026-10-29)

## Production repair log (2026-10-29)

Регенерацію обкладинок запущено в проді скриптом `regenerate-card-image.ts --slugs-file … --apply` за схваленням власника (35 slug-ів).

- Перший прохід: **8 з 35** перегенеровано, далі кожна спроба падала (klein → HTTP 429, schnell → HTTP 400). Лишилось **27** (`failed1.txt`).
- Діагностика (прямі виклики API, 2026-10-29 ~16:00 UTC): 429 = **код 4006, вичерпано денну безкоштовну квоту Workers AI (10 000 neurons, скидання 00:00 UTC)**, а не per-minute ліміт; klein і schnell ділять один пул. 400 на schnell = у тілі запиту був `seed`, якого strict-схема `flux-1-schnell` не приймає (код 5006) — spillover не працював ніколи.
- Повторний прохід 2026-10-29 16:09 UTC після фіксу: **0 з 27** (квота ще вичерпана; скрипт зупинився після першого 429, решту 26 пропустив без викликів). 27 обкладинок залишаються зі старими зображеннями до скидання квоти (00:00 UTC) або переходу на Workers Paid.
- Додатково знайдено: scene-директор через Gemini повертав цілий brief-JSON (див. нижче) — виправлено.

## Cloudflare / scene fixes (2026-10-29)

- `pipeline/card-image.ts`: 4006 класифікується як денна квота (без retry, без марного schnell, latch `cloudflareQuotaExhausted`, батч-цикли зупиняються); справжній per-minute 429 — максимум 2 retry із `Retry-After` (cap 20 с); schnell більше не отримує `seed`, prompt ≤ 2048 символів.
- Scene: Gemini-адаптер без схеми використовував повну bilingual-brief schema й відповідав на запит сцени цілим brief-JSON (~4,5k символів, ~30 с); `cleanSceneText` не знаходив ключа, і обрізаний JSON потрапляв у FLUX-prompt. Тепер директор просить `{"scene": ...}`, Gemini прив'язано до schema з одним полем, а невідомий JSON дає порожній рядок → keyword-fallback. Це не просто логування, а реальний баг. Після фіксу сцена ~220 символів, відповідь за 4–12 с.
- Що має зробити власник: Workers Paid план (або `CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell`), інакше free-пул (~7 klein-обкладинок/день) вичерпується продом і регенерацією.

## Next task

None from ATB-91.
