# Visual Compiler v7.2 — targeted unseen A/B decision

| Metric | Exact current | Router-selected v7.2 |
|---|---:|---:|
| Production/safety pass | 0/7 | 7/7 |
| Average weighted score | 56.6 | 82.9 |
| Estimated image calls | 7 | 3 |
| Estimated image cost | $0.105 | $0.045 |
| Selected render duration | — | 6.5s |
| Reported-signal safety pass | — | 2/2 |

Blinded preference: selected **6**, current **1**, ties **0**; selected preference excluding ties **86%**.

## Automated decision

**PASS TO OWNER-BLINDED REVIEW. Production replacement remains disabled.**

| # | Story | Treatment | Pass | Score current → selected | Preference | Failed gates |
|---:|---|---|---:|---:|---|---|
| 1 | The Shift to Harness-Level Agent Loops in Software Engineering | `reuse_router_selection` | ✓ | 44.0 → 82.0 | **selected** | none |
| 2 | Gemini faces community critique regarding model performance consistency | `reported_consistency_signal` | ✓ | 85.5 → 77.3 | **current** | none |
| 3 | Git-Lazy-Mount: Mount Repositories on Demand for MicroVM Coding Agents | `reuse_router_selection` | ✓ | 43.0 → 83.5 | **selected** | none |
| 4 | Managing AI-Driven Distraction and Rediscovering Deep Work | `human_behavior_split` | ✓ | 67.0 → 85.3 | **selected** | none |
| 5 | Claude Usage Thresholds: Insights from High-Volume Token Consumption | `reported_usage_signal` | ✓ | 50.5 → 83.5 | **selected** | none |
| 6 | TikZ Editor: WYSIWYG Interface for LaTeX Vector Graphics | `reuse_router_selection` | ✓ | 65.0 → 86.5 | **selected** | none |
| 7 | GPT-5 Aids Immunologists in Solving T-Cell Mystery | `science_reasoning_flow` | ✓ | 41.5 → 82.5 | **selected** | none |
