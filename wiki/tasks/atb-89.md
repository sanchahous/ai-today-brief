# ATB-89

Summary: Заборона AI-портретів людей у daily news-card промптах і сценах; регенерація обкладинки Liquid AI d1 edge-моделей; інвентаризація дублікатів того ж файлу в проді.
Sources: [PR #443](https://github.com/sanchahous/ai-today-brief/pull/443); `pipeline/card-image.ts`; live Supabase check 2026-10-27
Last updated: 2026-10-27

---

Task: atb-89

## Status

```verbatim
- **ATB-89:** Daily news cards більше не пропускають portrait/headshot сцени до FLUX; обкладинку `liquid-ai-releases-open-d1-decision-models-for-sub-10ms-edge-inference` перегенеровано в проді. Інші опубліковані slug з byte-identical JPEG не знайдено (див. Duplicate portrait audit).
```

DONE. PR: [#443](https://github.com/sanchahous/ai-today-brief/pull/443).

## Change

- `prepareNewsCardScene` + art-director instruction + `buildPrompt` / `negativePrompt`: unconditional ban on human portraits for news.
- `regenerateCardImageForSlug` + `pipeline/scripts/regenerate-card-image.ts` for one-off editorial repairs.
- Production repair: slug `liquid-ai-releases-open-d1-decision-models-for-sub-10ms-edge-inference` (Liquid AI open d1 decision models for edge inference).

## Duplicate portrait audit (published `card_image_url`, 2026-10-27)

Full-corpus scan: SHA-256 of stored JPEG bytes vs the pre-repair d1 cover — **no other slug** shared the identical file. Perceptual aHash (8×8, Hamming ≤ 10) over all non-rejected items with a card — **no close matches** besides the target itself. Mass regeneration **not** performed; owner decision required if visually similar (non-identical) portraits are spotted later.

## Local gates

- `PORT=3100 npm run pr:check` — exit 0 (2026-10-27); Vitest includes `pipeline/card-image.test.ts` 92/92; `build:ci` skipped (pipeline-only diff).
- `PORT=3100 npm run e2e:affected` — exit 0; skipped (no UI-affecting paths).

## Production repair log (2026-10-27)

- Slug: `liquid-ai-releases-open-d1-decision-models-for-sub-10ms-edge-inference`
- `card_image_url`: `…/liquid-ai-releases-open-d1-decision-models-for-sub-10ms-edge-inference.jpg?v=26fb55ed66` (was `v=038d923818`)
- Command: `npx tsx --env-file=.env.local pipeline/scripts/regenerate-card-image.ts --slug liquid-ai-releases-open-d1-decision-models-for-sub-10ms-edge-inference`

## Next task

None from ATB-89. Optional follow-up: owner review of older cards for visually similar FLUX portrait drift (not byte-identical).
