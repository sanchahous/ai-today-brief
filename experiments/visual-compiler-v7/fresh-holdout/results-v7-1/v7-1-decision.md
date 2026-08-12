# Visual Compiler v7.1 — router-selected unseen A/B decision

Stories: **7**.

| Metric | Exact current | Router-selected v7.1 |
|---|---:|---:|
| Production/safety pass | 1/7 | 2/7 |
| Average weighted score | 64.2 | 72.5 |
| Estimated image calls | 7 | 1 |
| Estimated image cost | $0.105 | $0.015 |
| Serialized render duration | 978.3s | 263.9s |
| Generated-text-free selected pixels | — | 7/7 |

Estimated image-cost reduction: **86%**.
Estimated serialized render-time reduction: **73%**.
Fallback safety pass: **1/2**.
Blinded preference relative to current: selected **4**, current **2**, ties **1**.

## Automated decision

**HOLD. Keep the current production pipeline and inspect failed routes before any shadow rollout.**

| # | Story | Route | Eligible | Selected pass | Score current → selected | Preference | Safety |
|---:|---|---|---:|---:|---:|---|---|
| 1 | The Shift to Harness-Level Agent Loops in Software Engineering | `deterministic_compiler` | ✓ | ✕ | 42.5 → 79.8 | **selected** | clean |
| 2 | Gemini faces community critique regarding model performance consistency | `source_led_fallback` | ✕ | ✓ | 85.5 → 66.5 | **current** | clean |
| 3 | Git-Lazy-Mount: Mount Repositories on Demand for MicroVM Coding Agents | `deterministic_compiler` | ✓ | ✓ | 43.0 → 83.5 | **selected** | clean |
| 4 | Managing AI-Driven Distraction and Rediscovering Deep Work | `current_art_director` | ✓ | ✕ | 76.5 → 76.5 | **tie** | clean |
| 5 | Claude Usage Thresholds: Insights from High-Volume Token Consumption | `source_led_fallback` | ✕ | ✕ | 74.0 → 35.0 | **current** | review |
| 6 | TikZ Editor: WYSIWYG Interface for LaTeX Vector Graphics | `deterministic_compiler` | ✓ | ✕ | 65.0 → 86.5 | **selected** | clean |
| 7 | GPT-5 Aids Immunologists in Solving T-Cell Mystery | `deterministic_compiler` | ✓ | ✕ | 63.0 → 79.8 | **selected** | clean |

Fallback cards are judged as safe editorial placeholders: they must preserve certainty and avoid unsupported assertions, but they are not required to invent mechanism or outcome evidence.
