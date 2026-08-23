---
name: gpt-image-2-editorial
description: Build copy-ready 16:9 no-text image prompts for AI Today Brief news cards, daily covers, and weekly digest concepts using Prompt-as-Code templates adapted from awesome-gpt-image-2.
---

# GPT-Image-2 editorial prompts (AI Today Brief)

Use this skill when writing or repairing image prompts for AI Today Brief.
Do **not** install or follow the upstream `gpt-image-2-style-library` skill in
the product pipeline: it lock-in readable labels. This house skill inverts that.

Source templates: [freestylefly/awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2) (MIT).
Code: `pipeline/image-prompt-library/`. Policy: `weekly-semantic-story-v6`.

## Hard rules

- Aspect **16:9**, one finished image, not a moodboard.
- **No readable text** in pixels: no letters, numbers-as-type, logos, UI, captions, gibberish.
  Overlays add labels later (`src/lib/weekly-digest/visuals.ts`).
- Never paste planning phrases into the image prompt: `the story-specific anchor is`,
  `the visible cause is`, `the visible result is`, editorial advice, telemetry quotes.
- Weekly: three seats must use **three different templates** and three different subjects.

## Six blocks (order matters)

1. Subject and task
2. Composition and layout
3. Visual style and materials
4. Text and label requirements (always zero text)
5. Aspect ratio and output format (`16:9`)
6. Constraints and negatives

## Templates

| Seat | Template | Shows |
|---|---|---|
| `literal_context` | `realistic-photography` or `scene-storytelling` | Who/what/where changed. No mechanism allegory. |
| `mechanism` | `infographic-engine` (metric/process) or `concept-breakdown` | How it works, different visual language. |
| `consequence` | `scene-storytelling` or `illustration-editorial` | Stake / harm / uncertainty in another place. |

News cards (FLUX.2 klein): photography/illustration only — **never** `infographic-engine`.
Daily cover: `scene-storytelling` or `realistic-photography`, one shot.

## Collapse anti-pattern

Bad (live digest): two titles, one sun-printing frame, essence prose dumped as "arrows showing Teams should audit…".
Fix: different `subject` head noun, different `templateId`, canonical assembled from subject/action/setting only.

## Related

- `pipeline/image-prompt-library/NOTICE.md`
- `wiki/pipeline/image-prompt-library.md`
