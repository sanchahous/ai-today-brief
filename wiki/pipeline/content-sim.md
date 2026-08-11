# Content Simulation & Backtest

Summary: універсальний harness симуляції контенту (daily + weekly + images): generate →
critic → auto-repair ≤5 → pass або human review з escalation; weekly release гейтиться цим.
Sources: `src/lib/content-sim/`, `pipeline/providers/vision.ts`, `pipeline/scripts/content-sim.ts`,
`.github/workflows/content-sim.yml`, план Content Sim Backtest 2026-08-11
Last updated: 2026-08-11

---

## Навіщо

Зміни промптів, image policy і weekly master раніше перевірялись лише живим прод-прогоном.
Content Sim дає **офлайн / shadow** прогін на фікстурах і **обовʼязковий vision loop** для
weekly story images перед релізом.

## Архітектура

| Шар | Шлях | Роль |
|---|---|---|
| Ядро | `src/lib/content-sim/` | типи, `runRepairLoop`, escalation, deterministic image gates, vision critic parse |
| Vision I/O | `pipeline/providers/vision.ts` | `generateWithVision` (Gemini → OpenRouter); roles `weekly.image_critic` / `daily.image_critic` |
| Weekly images (prod) | `generation-worker.ts` → `adapters/weekly-image.ts` | FLUX generate + loop ≤5; metadata `content_sim` |
| CLI | `npm run content-sim` | `capture` / `run` / `gates` / `hypothesis` |
| Release gate | `preflight.ts` code `simulation_not_passed` | блок без pass або human override |
| Admin | Visuals ArtifactCard | escalation panel + Approve записує `human_override` |

Adapters: `weekly-master` (делегує `weekly:sandbox`), `weekly-image`, `daily-brief`, `daily-image`.
(source: `src/lib/content-sim/`, `pipeline/scripts/content-sim.ts`)

## Image loop

1. Deterministic (розмір / aspect / bytes) — безкоштовно.
2. Vision critic JSON (пороги: overall ≥ `CONTENT_SIM_SCORE_THRESHOLD`, default **80**).
3. Repair directive → новий seed / scene_override / prompt patches.
4. Максимум **`CONTENT_SIM_MAX_IMAGE_REPAIR=5`** спроб; spend cap `CONTENT_SIM_MAX_IMAGE_SPEND_USD`.
5. Fail → `needs_human_review` + escalation (blockers + suggested actions). Джоба **не** валиться.
(source: `src/lib/content-sim/loop.ts`, `config.ts`, `adapters/weekly-image.ts`)

Owner Approve на failed sim ставить `metadata.content_sim.human_override=true` і знімає
`simulation_not_passed`.
(source: `src/app/admin/(cms)/weekly/actions.ts`, `preflight.ts`)

## CLI

```bash
npm run content-sim -- capture --adapter weekly-master --digest <uuid>
npm run content-sim -- capture --adapter daily-brief --brief <slug>
npm run content-sim -- run --adapter weekly-image --fixture path/to/fixture.json
npm run content-sim -- gates --run artifacts/_local/content-sim/<run>
npm run content-sim -- hypothesis --baseline quality.json --run artifacts/_local/content-sim/<run>
```

Артефакти: `artifacts/_local/content-sim/` (gitignored). Фікстури daily: `raw/_local/content-sim/`.

## CI

`.github/workflows/content-sim.yml` — **не** частина `pr:check`. Запуск: `workflow_dispatch`
або label `run-content-sim` на PR.

## Env

Див. `.env.example` секцію Content simulation (`CONTENT_SIM_*`).
`CONTENT_SIM_IMAGE_LOOP=off` вимикає vision loop (один generate без critic).

## Related pages

- [weekly-sandbox](../ops/weekly-sandbox.md)
- [card-images](../marketing/card-images.md)
- [weekly-digest](weekly-digest.md)
- [weekly-master-engine](weekly-master-engine.md)
- [llm-providers](llm-providers.md)
