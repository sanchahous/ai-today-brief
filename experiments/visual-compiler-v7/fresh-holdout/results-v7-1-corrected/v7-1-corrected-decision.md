# Visual Compiler v7.1 — render-mode-aware gate correction

No images were regenerated. This report reuses the frozen unseen A/B pixels and changes only two invalid evaluator assumptions:

1. A literal deterministic diagram does not need an editorial-analogy mapping.
2. Code-generated approved labels are checked deterministically, not by vision OCR.

| Metric | Exact current | Router-selected v7.1 |
|---|---:|---:|
| Production/safety pass | 1/7 | 4/7 |
| Previous reported selected pass | — | 2/7 |
| Average weighted score | 64.2 | 72.5 |
| Expected image calls | 7 | 1 |
| Estimated image cost | $0.105 | $0.015 |
| Selected serialized duration | — | 263.9s |
| Fallback safety pass | — | 1/2 |

Blinded preference: selected **4**, current **2**, ties **1**.
Correctly recovered without rendering: **#1, #6**.

## Decision

**CONTINUE WITH TARGETED REPAIR. Do not regenerate the passing deterministic stories.**

| # | Story | Route | Previous → corrected | Score | Preference | Remaining failed gates |
|---:|---|---|---:|---:|---|---|
| 1 | The Shift to Harness-Level Agent Loops in Software Engineering | `deterministic_compiler` | ✕ → ✓ | 79.8 | **selected** | none |
| 2 | Gemini faces community critique regarding model performance consistency | `source_led_fallback` | ✓ → ✓ | 66.5 | **current** | none |
| 3 | Git-Lazy-Mount: Mount Repositories on Demand for MicroVM Coding Agents | `deterministic_compiler` | ✓ → ✓ | 83.5 | **selected** | none |
| 4 | Managing AI-Driven Distraction and Rediscovering Deep Work | `current_art_director` | ✕ → ✕ | 76.5 | **tie** | current_role_evidence_or_card_gate |
| 5 | Claude Usage Thresholds: Insights from High-Volume Token Consumption | `source_led_fallback` | ✕ → ✕ | 35.0 | **current** | misleading |
| 6 | TikZ Editor: WYSIWYG Interface for LaTeX Vector Graphics | `deterministic_compiler` | ✕ → ✓ | 86.5 | **selected** | none |
| 7 | GPT-5 Aids Immunologists in Solving T-Cell Mystery | `deterministic_compiler` | ✕ → ✕ | 79.8 | **selected** | source_context, role_evidence |

Remaining real repair targets are the current causal scene for deep work, the Claude source-led fallback, and the generic science flow for GPT-5/T-cell research. Gemini fallback is safe but aesthetically weaker than current.
