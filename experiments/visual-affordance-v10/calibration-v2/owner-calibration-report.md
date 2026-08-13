# Visual Affordance Router v10 — owner calibration

Owner-reviewed pairs: **9**.
Strong approves: **2**; acceptable: **1**; local repairs: **2**; major rework: **1**; rejected: **3**.
Positive references retained: **3**.

The automated critic remains a pairwise ranker only. Production acceptance requires explicit owner approval.

| Case | Expected grammar | Preferred | Readiness | Positive reference | Owner reason tags |
|---|---|---|---|---:|---|
| Why frontier Anthropic models are performing worse on strict tool calling schemas | `one_to_one_physical_analogy` | `current` | `acceptable` | ✓ | `strong_intuitive_analogy` |
| Leveraging the Mistral AI Platform Beyond Standard Chatbot Integrations | `cinematic_domain_scene` | `current` | `strong_approve` | ✓ | `production_ready`, `domain_context_success` |
| Agentic testing playbook: How fuzzing and property testing empower autonomous coding | `causal_process_sequence` | `none` | `reject` | ✕ | `weak_visual_thesis`, `labels_help_but_do_not_rescue`, `weak_context` |
| Optimizing Token Caching to Avoid Unexpected Large Language Model Costs | `deterministic_technical_hybrid` | `compiler` | `local_repair` | ✕ | `good_concept_bad_execution`, `broken_arrow`, `local_repair` |
| Cutting Claude Code Token Costs with Optical Context Compression | `one_to_one_physical_analogy` | `current` | `local_repair` | ✕ | `good_concept_bad_execution`, `disconnected_prop`, `local_repair` |
| GPT-5 Aids Immunologists in Solving T-Cell Mystery | `cinematic_domain_scene` | `v8` | `strong_approve` | ✓ | `production_ready`, `domain_context_success` |
| Claude Usage Thresholds: Insights from High-Volume Token Consumption | `causal_process_sequence` | `none` | `reject` | ✕ | `generic_diagram`, `ambiguous_diagram`, `weak_visual_thesis`, `labels_carry_claim` |
| Managing AI-Driven Distraction and Rediscovering Deep Work | `cinematic_domain_scene` | `v8` | `major_rework` | ✕ | `good_concept_bad_execution`, `anatomy_error`, `unclear_causal_source`, `major_rework` |
| Gemini faces community critique regarding model performance consistency | `controlled_comparison` | `none` | `reject` | ✕ | `ambiguous_diagram`, `weak_visual_thesis`, `labels_carry_claim` |

## Promotion policy

- Hide all labels during the first semantic test.
- Generated scenes must pass anatomy, object-integrity and physical-causality gates.
- Diagrams must pass geometry, invariant and arrow-validity gates.
- Physical analogies must pass a one-to-one source mapping gate.
- A weighted score never overrides a hard blocker.
- Owner review is the only production acceptance source until calibration expands.
