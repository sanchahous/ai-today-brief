# ATB-91

Summary: Пакет виправлень редизайну: заголовок банера статті, картка «Ранковий бриф» у вузькому sidebar, блок поширення, літеральні `<br>` у markdown-тілі, відмова від портретних обкладинок і оновлення блоків тіла статті.
Sources: live check у Playwright 2026-10-29; `src/app/globals.css`; `src/lib/markdown.ts`; `pipeline/card-image.ts`; `pipeline/scripts/regenerate-card-image.ts`
Last updated: 2026-10-29

---

Task: atb-91

## Status

```verbatim
- **ATB-91:** Виправлено заголовок банера (container queries, cover, стек на мобільному, світлий ink на темному scrim), картку «Ранковий бриф» у sidebar, вирівнювання й іконки share-блоку, літеральні `<br>` у markdown (`normalizeMarkdownBreaks`), вимкнено Pollinations-fallback для обкладинок за замовчуванням, оновлено блоки тіла статті. Регенерацію банерів у проді запущено 2026-10-29 за рішенням власника (скриптом `regenerate-card-image.ts --slugs/--apply`).
```

DONE (локальний коміт, без PR).

## Change

- Банер статті: `.banner-hero*` у `globals.css` на container queries, `object-fit: cover`, на мобільному копія стекається під артом; текст поверх завжди темного scrim має фіксований світлий ink (у Day-темі `--text` майже чорний і зливався зі scrim).
- Sidebar «Ранковий бриф» (`newsletter-band`): container queries, картка не ламається у вузькій колонці `/news`.
- `ItemShareBar` + `icons.tsx`: вирівнювання блоку й іконки X/LinkedIn.
- `normalizeMarkdownBreaks` у `src/lib/markdown.ts` і `pipeline/summarize.ts`: літеральний `<br>` в LLM-markdown більше не робить гігантський `<h3>`.
- `pipeline/card-image.ts`: Pollinations image fallback вимкнено за замовчуванням (портретні обкладинки); `regenerate-card-image.ts` отримав `--slugs`, `--slugs-file`, `--apply` (`regenerate-card-image-args.ts`); [card-images](../marketing/card-images.md) оновлено.
- Тіло статті: `src/components/editorial/*` (callout, takeaways, key-facts, when-grid, action-list, data-table, code-figure, нові code-panel, section-divider, section-label), `story-body`, `markdown-body`, `.reading-copy`, ds-catalog.

## Known, pre-existing

- Dev-оверлей Next «1 Issue» — hydration mismatch `tabindex="-1"` на `h1`: `RouteFocusMain` (AH-6.3) у StrictMode повторно виконує ефект і ставить `tabindex` до пізньої гідрації. Відтворюється на `/uk/about`, тобто не від цієї задачі; лише dev. (source: Playwright console 2026-10-29)

## Production repair log (2026-10-29)

Регенерацію обкладинок запущено в проді скриптом за схваленням власника; кількість і результат фіксує окремий лог запуску, не цей файл.

## Next task

None from ATB-91.
