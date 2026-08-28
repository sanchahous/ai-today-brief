# Video pipeline boundary

Summary: Межа відповідальності video-pipeline відносно основного брифу.
Sources: `src/lib/weekly-digest/video-shoot-pack.ts`, `src/components/admin/weekly-workspace.tsx`,
owner session 2026-08-19, original ADR 2026-07-23, консолідація трьох відео-папок
(`E:\ATBvideobrief` + `ai-today-brief-video/wiki` → цей репозиторій) 2026-08-28
Last updated: 2026-08-28

⚠️ The manifest schema example below (`weekly-video-v1`) is the original ADR draft and is
**stale** — the live schema is `weekly-video-v3` (per-scene `revisionItemId`, WPS-validated
scene durations). See [weekly-digest § PR6](weekly-digest.md#editorial-voice-overhaul-2026-08-06)
for the current shape and `src/lib/weekly-digest/content-studio.ts`'s `WeeklyVideoScript`/
`WeeklyVideoScene` types for the authoritative contract. The ownership split and rendering
boundary decided here are unchanged except for **where the owner shoots**: the CMS Video tab
is the shooting package; `ai-today-brief-video` only assembles dropped clips.
(source: owner session 2026-08-19, `src/lib/weekly-digest/video-shoot-pack.ts`)

**Оновлення 2026-08-28 — консолідація трьох папок.** До цієї дати `ai-today-brief-video` встиг
обрости власною `wiki/` (27 сторінок), `raw/`, `scripts/`-нотатками і датованою `19-08-2026/`
папкою, закомміченими напряму в git — власник перестав розуміти, де що шукати («ходжу по
папках і хаотично шукаю дані»). Третя папка, `E:\ATBvideobrief` (без git, ручний робочий
простір, де власник фізично складає озвучку/кліпи/музику), додавала ще один шар. Усе знання й
усі сирі матеріали звели сюди — `ai-today-brief-video` лишився **тільки** Remotion-кодом
(`remotion/`, `scripts/`, `public/` як слоти для поточного рендеру, `output/`). Git-історію
цього репозиторію переписано (`git filter-repo`), щоб прибрати важкі медіа, які туди випадково
закомітились через прогалину в `.gitignore` (правило `public/avatar/` не покривало вкладені
датовані підпапки на кшталт `public/26-08-2026/avatar/`). Технічна документація рендерера
(композиції, render-runbook, аватар/motion-broll, тижневий чек-лист, редакційна планка) тепер
живе тут, під префіксом `video-`: [video-remotion-compositions](video-remotion-compositions.md),
[video-production-workflow](video-production-workflow.md), [video-script](video-script.md),
[video-avatar-and-voice](video-avatar-and-voice.md), [video-motion-broll](video-motion-broll.md),
[video-youtube-delivery](video-youtube-delivery.md),
[ops/video-render-runbook](../ops/video-render-runbook.md),
[ops/video-weekly-checklist](../ops/video-weekly-checklist.md),
[product/video-editorial-format](../product/video-editorial-format.md),
[research/2026-08-05-professional-ai-video-guide](../research/2026-08-05-professional-ai-video-guide.md).
Сирі матеріали (записи, кліпи, музика, бренд) — `raw/_local/video/` (gitignored). Опубліковані/
промастерені фінальні рендери — `artifacts/_local/video-masters/` (gitignored, надто важкі для
git, але варті збереження — YouTube перекодовує при заливці, тож не є canonical master).

**Git-конвенція в `ai-today-brief-video`** (перенесено з колишньої
`architecture/agentic-workflow.md` того репозиторію): `main` завжди має містити актуальний
стан; будь-яка інша гілка — тимчасова робоча копія під конкретну задачу, яка зливається назад,
а не лишається окремим форком. (source: рішення власника, сесія 2026-08-27)

Status: accepted and implemented

Decision date: 2026-07-23

## Decision

The Remotion project lives in a separate standalone workspace with its own local
Git history, named `ai-today-brief-video`. A separate GitHub remote is not
required during the prototype phase. The `ai-today-brief` repository remains
responsible for editorial selection, approval, public digest pages, and the
persisted YouTube reference.

Remotion dependencies, compositions, renders, avatar assets, and generated video
files must not be added to this web application.

## Why

- The website and the video renderer have different release and dependency
  cycles.
- Remotion adds a large rendering toolchain that is unnecessary in the Vercel
  web build.
- Video rendering is resource-intensive and should be scheduled, retried, and
  scaled independently.
- The editorial digest must be approved before a video job can begin.
- YouTube is the public distribution and embed target, while the website only
  needs video metadata and a stable URL.

## Ownership

### `ai-today-brief`

- selects and stores the approved Weekly Digest;
- writes and displays the **shooting package** on `/admin/weekly/[id]?tab=video`
  (Hailuo/Krea i2v prompts, HeyGen avatar scripts, Remotion slot paths);
- exposes or exports a versioned video input manifest;
- stores video production status and the resulting YouTube ID/URL;
- renders the YouTube embed or link on the public site.
(source: `src/lib/weekly-digest/video-shoot-pack.ts`, 2026-08-19)

### `ai-today-brief-video`

- accepts an approved digest manifest;
- **assembles** owner-dropped clips (`public/broll/`, `public/avatar/`) with Edge TTS and Remotion;
- does **not** own the shoot brief (no second copy of avatar scripts / i2v prompts as source of truth);
- uploads the finished video to YouTube;
- returns a result manifest to the website;
- **does not own any wiki/raw/artifacts of its own** (since 2026-08-28) — only `remotion/`,
  `scripts/`, `public/` (render-time slots), `output/` (gitignored). All knowledge, raw
  production materials, and instructions live in this repository.
(source: owner session 2026-08-19; консолідація 2026-08-28)

## Integration contract

The website should produce a versioned manifest rather than sharing database
tables or importing code between repositories.

```json
{
  "schemaVersion": "weekly-video-v1",
  "digestId": "uuid",
  "digestSlug": "ai-weekly-2026-07-20",
  "language": "en",
  "title": "The week in AI engineering",
  "intro": "A concise approved introduction",
  "stories": [
    {
      "rank": 1,
      "title": "Approved story title",
      "summary": "Approved narration copy",
      "whyItMatters": "Approved practical meaning",
      "imageUrl": "https://...",
      "sourceUrl": "https://..."
    }
  ]
}
```

The video pipeline should return:

```json
{
  "schemaVersion": "weekly-video-result-v1",
  "digestId": "uuid",
  "status": "published",
  "youtubeVideoId": "video-id",
  "youtubeUrl": "https://www.youtube.com/watch?v=video-id",
  "thumbnailUrl": "https://...",
  "durationSeconds": 420,
  "publishedAt": "2026-07-27T12:00:00Z"
}
```

The first implementation may exchange these manifests manually. A later
version can use a signed internal endpoint or a queue without changing the
payload contract.

## Extraction plan

Completed:

1. Created `E:\domains\ai-today-brief-video`.
2. Moved the Remotion prototype and existing render previews there.
3. Added an independent `package.json`, lockfile, ESLint rules, TypeScript
   config, `.gitignore`, environment example, README, and render scripts.
4. Initialized local Git with initial commit `3a7f282`.
5. Passed TypeScript and ESLint checks.
6. Rendered the 1110-frame demo to `output/atb-demo-uk.mp4`.
7. Removed all Remotion-only dependencies, scripts, config, source, and output
   from the website working tree.

Next:

1. Add manual Weekly Digest manifest import.
2. Replace the single-story Ukrainian prototype with an English weekly digest
   composition.
3. Add HeyGen avatar narration and story imagery.
4. After one or two successful weekly digests, automate YouTube upload.
5. Add the minimal YouTube metadata fields and public embed to the website.

## Media retention

YouTube is suitable for delivery and embedding, but it re-encodes uploads and
should not be treated as the canonical master archive. For the MVP, keep the
render inputs and manifest so a video can be reproduced.

**Implemented 2026-08-28:** published/mastered final renders are archived in
`ai-today-brief/artifacts/_local/video-masters/` (gitignored — too large for git, but worth
keeping since YouTube re-encodes on upload). Disposable/intermediate renders (L0 drafts,
`-live`/`-narrated` test passes) stay only in `ai-today-brief-video/output/` and are not
archived — they're reproducible from Remotion + the manifest.

## Related pages

- [weekly-digest](weekly-digest.md)
- [ops/weekly-admin-runbook](../ops/weekly-admin-runbook.md)
- [video-remotion-compositions](video-remotion-compositions.md)
- [video-production-workflow](video-production-workflow.md)
- [video-script](video-script.md)
- [video-avatar-and-voice](video-avatar-and-voice.md)
- [video-motion-broll](video-motion-broll.md)
- [video-youtube-delivery](video-youtube-delivery.md)
- [ops/video-render-runbook](../ops/video-render-runbook.md)
- [ops/video-weekly-checklist](../ops/video-weekly-checklist.md)
- [product/video-editorial-format](../product/video-editorial-format.md)
- [research/2026-08-05-professional-ai-video-guide](../research/2026-08-05-professional-ai-video-guide.md)
- [now](../now.md)
