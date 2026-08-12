# Visual Compiler v5 fresh-holdout claim gate

Stories: **7**.
Initial clean pass: **5/7**.
Claims repaired once: **2/7**.
Final eligible claims: **5/7**.
LLM calls: 6; tokens: 16620; reported cost: $0.0170.

| # | Story | Role | Certainty | Direction/target | Mapping | Render mode | Initial | Final | Repair/issues |
|---:|---|---|---|---|---|---|---:|---:|---|
| 1 | The Shift to Harness-Level Agent Loops in Software Engineering | `architecture_transformation` | `observed` | n/a | `literal` | `deterministic_literal` | ✓ | ✓ | none |
| 2 | Gemini faces community critique regarding model performance consistency | `uncertainty_announcement` | `observed` | neutral / alternatives | `literal` | `deterministic_literal` | ✕ | ✕ | announcement_certainty_not_guarded; plan_compile_failed; visual_driver_supported; outcome_supported; certainty_preserved; visually_testable |
| 3 | Git-Lazy-Mount: Mount Repositories on Demand for MicroVM Coding Agents | `capability_access` | `observed` | n/a | `literal` | `deterministic_literal` | ✓ | ✓ | none |
| 4 | Managing AI-Driven Distraction and Rediscovering Deep Work | `causal_mechanism` | `observed` | n/a | `editorial_analogy` | `generated_identity_action_pair` | ✓ | ✓ | none |
| 5 | Claude Usage Thresholds: Insights from High-Volume Token Consumption | `uncertainty_announcement` | `observed` | n/a | `literal` | `deterministic_literal` | ✕ | ✕ | announcement_certainty_not_guarded; plan_compile_failed; certainty_preserved |
| 6 | TikZ Editor: WYSIWYG Interface for LaTeX Vector Graphics | `capability_access` | `observed` | n/a | `literal` | `deterministic_literal` | ✓ | ✓ | none |
| 7 | GPT-5 Aids Immunologists in Solving T-Cell Mystery | `capability_access` | `observed` | n/a | `literal` | `deterministic_literal` | ✓ | ✓ | none |

## Role distribution

- `architecture_transformation`: 1
- `capability_access`: 3
- `causal_mechanism`: 1
- `uncertainty_announcement`: 2

## Ineligible fallback

A claim that still fails after one repair must not be rendered as a factual compiler visual. Production behavior is a branded source-led fallback with the approved headline and no explanatory assertion.
