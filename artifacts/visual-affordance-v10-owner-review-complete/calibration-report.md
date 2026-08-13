# Visual Affordance v10 — owner calibration report

Calibration: `owner-review-v7-v8-2026-08-13-v1`.
Owner-reviewed stories: **9**.
Strong production references: **2**.
Local-repair references: **2**.
Full proposition replans: **3**.

## Owner policy

- Automated production acceptance is disabled.
- Pairwise vision criticism is ranking support only.
- Labels cannot carry required visual evidence.
- Owner acceptance remains mandatory.

## Preferred affordances

- `cinematic_domain_scene`: 3
- `deterministic_technical_hybrid`: 2
- `one_to_one_physical_analogy`: 2
- `controlled_comparison`: 1
- `causal_process_sequence`: 1

## Overall owner verdicts

- `reject`: 3
- `production_ready`: 2
- `local_repair`: 2
- `major_rework`: 1
- `acceptable`: 1

## Repair classes

- `replan_proposition`: 3
- `none`: 2
- `edit_local_region`: 2
- `regenerate_scene`: 1
- `recompose_geometry`: 1

## Gold examples

| Story | Preferred affordance | Owner verdict | Expected repair | Tag-derived repair | Match |
|---|---|---|---|---|---:|
| GPT-5 Aids Immunologists in Solving T-Cell Mystery | `cinematic_domain_scene` | `production_ready` | `none` | `replan_proposition` | ✓ |
| Claude Usage Thresholds: Insights from High-Volume Token Consumption | `deterministic_technical_hybrid` | `reject` | `replan_proposition` | `replan_proposition` | ✓ |
| Managing AI-Driven Distraction and Rediscovering Deep Work | `cinematic_domain_scene` | `major_rework` | `regenerate_scene` | `regenerate_scene` | ✓ |
| Gemini faces community critique regarding model performance consistency | `controlled_comparison` | `reject` | `replan_proposition` | `replan_proposition` | ✓ |
| Why frontier Anthropic models are performing worse on strict tool calling schemas | `one_to_one_physical_analogy` | `acceptable` | `edit_local_region` | `replan_proposition` | diagnostic |
| Leveraging the Mistral AI Platform Beyond Standard Chatbot Integrations | `cinematic_domain_scene` | `production_ready` | `none` | `replan_proposition` | ✓ |
| Agentic testing playbook: How fuzzing and property testing empower autonomous coding | `causal_process_sequence` | `reject` | `replan_proposition` | `replan_proposition` | ✓ |
| Optimizing Token Caching to Avoid Unexpected Large Language Model Costs | `deterministic_technical_hybrid` | `local_repair` | `recompose_geometry` | `replan_proposition` | diagnostic |
| Cutting Claude Code Token Costs with Optical Context Compression | `one_to_one_physical_analogy` | `local_repair` | `edit_local_region` | `replan_proposition` | diagnostic |

## Positive references

- **GPT-5 Aids Immunologists in Solving T-Cell Mystery** → `cinematic_domain_scene`.
- **Leveraging the Mistral AI Platform Beyond Standard Chatbot Integrations** → `cinematic_domain_scene`.

## Local repair references

- **Optimizing Token Caching to Avoid Unexpected Large Language Model Costs** → `recompose_geometry`; preserve the concept and repair only the defect.
- **Cutting Claude Code Token Costs with Optical Context Compression** → `edit_local_region`; preserve the concept and repair only the defect.

## Replan references

- **Claude Usage Thresholds: Insights from High-Volume Token Consumption** → Long agent sessions need cache, split and monitoring controls before they reach hidden operational limits.
- **Gemini faces community critique regarding model performance consistency** → The same coding task run through the same model twice produces two visibly different code artifacts.
- **Agentic testing playbook: How fuzzing and property testing empower autonomous coding** → Fuzzing creates edge cases, exposes a failure, drives a patch and verifies the repaired result.
