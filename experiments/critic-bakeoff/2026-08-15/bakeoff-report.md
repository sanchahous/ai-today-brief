# Vision critic model bake-off

Prompt: production `buildImageCriticPrompt` (policy `weekly-semantic-story-v5.1`).
Ground truth: Owner review of the visual-compiler-v6 targeted A/B, transcribed from the owner's annotated contact sheet 2026-08-14 and confirmed in chat.
10 images, 3 samples per model per image.

**Read both columns together.** A model that fails everything scores a perfect
`reject` recall and would still block the weekly release outright. `ship` accuracy is
the counterweight. Images labelled `defect` are reported but not scored.

| Model | Rejected the bad | Kept the good | Named flaw caught | Insufficient | Worst spread | Errors | Cost |
|---|---:|---:|---:|---:|---:|---:|---:|
| `google/gemini-2.5-flash` | 6/6 | 0/1 | 0/2 | 0 | 10 | 0 | $0.0894 |
| `anthropic/claude-sonnet-5` | 6/6 | 0/1 | 1/2 | 0 | 10 | 0 | $0.7612 |
| `google/gemini-3.1-pro-preview` | 5/6 | 0/1 | 0/2 | 0 | 38 | 0 | $1.0714 |

## Per image

| Model | Image | Owner | Critic | Agrees | Valid | Median | Spread | Blockers |
|---|---|---|---|---|---:|---:|---:|---|
| `google/gemini-2.5-flash` | 1-current | defect | fail | — | 3/3 | 55 | 0 | off_news, ambiguous_visual_story, opaque_abstraction, missing_consequence |
| `google/gemini-2.5-flash` | 1-compiler | reject | fail | yes | 3/3 | 5 | 10 | off_news, missing_context, missing_mechanism, missing_consequence, opaque_abstraction |
| `google/gemini-2.5-flash` | 2-current | ship | fail | **NO** | 3/3 | 55 | 0 | off_news, opaque_abstraction, missing_context, missing_mechanism, missing_consequence |
| `google/gemini-2.5-flash` | 2-compiler | reject | fail | yes | 3/3 | 35 | 0 | opaque_abstraction, off_news, missing_context, missing_mechanism, missing_consequence, ambiguous_visual_story |
| `google/gemini-2.5-flash` | 4-current | reject | fail | yes | 3/3 | 65 | 10 | off_news, opaque_abstraction, missing_mechanism, missing_consequence, missing_context |
| `google/gemini-2.5-flash` | 4-compiler | reject | fail | yes | 3/3 | 65 | 0 | off_news, opaque_abstraction, missing_context, missing_mechanism, missing_consequence |
| `google/gemini-2.5-flash` | 6-current | reject | fail | yes | 3/3 | 35 | 0 | readable_text, off_news, missing_mechanism, missing_context, opaque_abstraction, ambiguous_visual_story |
| `google/gemini-2.5-flash` | 6-compiler | defect | fail | — | 3/3 | 55 | 5 | opaque_abstraction, off_news |
| `google/gemini-2.5-flash` | 7-current | defect | fail | — | 3/3 | 65 | 5 | ambiguous_visual_story, off_news, opaque_abstraction |
| `google/gemini-2.5-flash` | 7-compiler | reject | fail | yes | 3/3 | 35 | 0 | off_news, opaque_abstraction, missing_context, missing_mechanism, missing_consequence |
| `anthropic/claude-sonnet-5` | 1-current | defect | fail | — | 3/3 | 15 | 0 | off_news, missing_context, missing_mechanism, missing_consequence, opaque_abstraction, ambiguous_visual_story |
| `anthropic/claude-sonnet-5` | 1-compiler | reject | fail | yes | 3/3 | 7 | 1 | off_news, wrong_subject, missing_context, missing_mechanism, missing_consequence, ambiguous_visual_story, opaque_abstraction |
| `anthropic/claude-sonnet-5` | 2-current | ship | fail | **NO** | 3/3 | 25 | 5 | off_news, missing_context, missing_mechanism, missing_consequence, opaque_abstraction, off_metaphor, ambiguous_visual_story |
| `anthropic/claude-sonnet-5` | 2-compiler | reject | fail | yes | 3/3 | 15 | 0 | off_news, opaque_abstraction, missing_context, missing_mechanism, missing_consequence, ambiguous_visual_story |
| `anthropic/claude-sonnet-5` | 4-current | reject | fail | yes | 2/3 | 25 | 4 | off_news, missing_context, missing_mechanism, missing_consequence, opaque_abstraction, ambiguous_visual_story |
| `anthropic/claude-sonnet-5` | 4-compiler | reject | fail | yes | 3/3 | 25 | 10 | off_news, opaque_abstraction, missing_context, missing_mechanism, missing_consequence, ambiguous_visual_story |
| `anthropic/claude-sonnet-5` | 6-current | reject | fail | yes | 3/3 | 22 | 10 | readable_text, missing_mechanism, off_news, opaque_abstraction, missing_context |
| `anthropic/claude-sonnet-5` | 6-compiler | defect | fail | — | 3/3 | 33 | 4 | opaque_abstraction, missing_context, missing_mechanism, ambiguous_visual_story, off_news |
| `anthropic/claude-sonnet-5` | 7-current | defect | fail | — | 2/3 | 37.5 | 5 | readable_text, banned_cliche, off_news, missing_mechanism, missing_context |
| `anthropic/claude-sonnet-5` | 7-compiler | reject | fail | yes | 3/3 | 20 | 10 | readable_text, off_news, missing_context, missing_mechanism, missing_consequence, opaque_abstraction, off_metaphor, ui_chrome |
| `google/gemini-3.1-pro-preview` | 1-current | defect | fail | — | 3/3 | 25 | 10 | low_quality, prop_use_mismatch, off_news, missing_consequence, opaque_abstraction, missing_context |
| `google/gemini-3.1-pro-preview` | 1-compiler | reject | fail | yes | 3/3 | 15 | 10 | off_news, missing_context, missing_mechanism, missing_consequence, off_metaphor, prop_use_mismatch, semantic_evidence_missing |
| `google/gemini-3.1-pro-preview` | 2-current | ship | fail | **NO** | 3/3 | 40 | 15 | readable_text, prop_use_mismatch, ambiguous_visual_story, low_quality |
| `google/gemini-3.1-pro-preview` | 2-compiler | reject | fail | yes | 3/3 | 15 | 0 | ui_chrome, opaque_abstraction, off_news, collage_panels, missing_context |
| `google/gemini-3.1-pro-preview` | 4-current | reject | fail | yes | 3/3 | 45 | 15 | ambiguous_visual_story, missing_consequence, off_news |
| `google/gemini-3.1-pro-preview` | 4-compiler | reject | pass | **NO** | 3/3 | 88 | 38 | off_news, missing_context |
| `google/gemini-3.1-pro-preview` | 6-current | reject | fail | yes | 3/3 | 20 | 20 | readable_text, missing_mechanism, low_quality |
| `google/gemini-3.1-pro-preview` | 6-compiler | defect | fail | — | 3/3 | 30 | 10 | collage_panels, opaque_abstraction, off_news, missing_mechanism, missing_context |
| `google/gemini-3.1-pro-preview` | 7-current | defect | fail | — | 3/3 | 45 | 5 | low_quality, prop_use_mismatch, missing_mechanism, ambiguous_visual_story |
| `google/gemini-3.1-pro-preview` | 7-compiler | reject | fail | yes | 3/3 | 30 | 30 | ui_chrome, ambiguous_visual_story, brand_unsafe, off_news, readable_text, missing_context, missing_mechanism, missing_consequence |

## Owner verdicts used

- `1-current` **defect** — owner: 'наче непогано, можна було би придумати щось краще для передачі сенсу' — acceptable but not endorsed
- `1-compiler` **reject** — owner: 'машинка для шиття і сорочка тут слабо передають контекст новини. Недопрацьовано'
- `2-current` **ship** — owner: 'Сподобалось! Дуже вдало, нарідкість дуже вдало!' — the only image in the reviewed corpus the owner endorsed outright
- `2-compiler` **reject** — owner: 'Просто крива діаграма. Невдало!'
- `4-current` **reject** — owner: 'задум і суть дуже слабкі. Просто ганяти кубики по виробничій лінії цього недостатньо'
- `4-compiler` **reject** — owner: 'задум і суть дуже слабкі, але передано трохи краще'
- `6-current` **reject** — owner: 'Невдало!'
- `6-compiler` **defect** — owner: 'непогана діаграма, але стрілка поламана. Все інше добре' — concept accepted, one named blocking flaw
- `7-current` **defect** — owner: 'задум непогано, але лупа вийшла відвʼязаною від зображення — крізь неї мали би бачити щось'
- `7-compiler` **reject** — owner: 'Слабенько'

verdict 'ship' means the owner would publish it. 'defect' means the concept works but a named flaw blocks it. 'reject' means unusable. Only 'ship' and 'reject' are scored; 'defect' is reported but not counted, because reasonable critics may disagree on whether a named flaw is blocking.

No model is switched automatically. This report is evidence for an owner decision.

