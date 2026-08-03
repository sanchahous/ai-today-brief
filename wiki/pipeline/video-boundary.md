# Video pipeline boundary

Summary: Межа відповідальності video-pipeline відносно основного брифу.
Sources: migrated from `docs/` (git history via `git log --follow`); none (analysis) where unmarked
Last updated: 2026-08-02


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
- exposes or exports a versioned video input manifest;
- stores video production status and the resulting YouTube ID/URL;
- renders the YouTube embed or link on the public site.

### `ai-today-brief-video`

- accepts an approved digest manifest;
- obtains or imports the HeyGen avatar narration;
- downloads and validates story imagery;
- composes and renders the digest with Remotion;
- uploads the finished video to YouTube;
- returns a result manifest to the website.

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
render inputs and manifest so a video can be reproduced. If preserving exact
masters or paid HeyGen clips becomes important, store them in inexpensive
object storage rather than in either Git repository.
