# Visual Affordance v10 targeted evaluation — owner review required

Stories: **3**; judge: `google/gemini-2.5-flash`; first-stage observation was image-only and intent-blind.

| Metric | V8 baseline | V10 candidate |
|---|---:|---:|
| Hard visual integrity pass | 0/3 (0%) | 0/3 (0%) |
| Headline-paired grounded pass | 2/3 (67%) | 2/3 (67%) |
| Average weighted score | 67.6 | 68.1 |

Blinded preference: V10 **1**, V8 **1**, ties **1**.
V10 preference excluding ties: **50%**.
Vision calls: 6; tokens: 13206; reported cost: $0.0149.

**No automated production pass is emitted. Every candidate requires owner approval.**

| # | Story | Treatment | V8 integrity/headline/score | V10 integrity/headline/score | Preferred | V10 blockers |
|---:|---|---|---|---|---|---|
| 2 | Gemini faces community critique regarding model performance consistency | `same_system_output_variability` | ✕/✓/76.0 | ✕/✓/86.5 | **v10** | generated_text, input_invariant_broken, system_invariant_broken |
| 4 | Managing AI-Driven Distraction and Rediscovering Deep Work | `bounded_assistance` | ✕/✕/49.0 | ✕/✕/48.8 | **tie** | core_action_missing, outcome_missing, causal_relation_missing, beam_purpose_unclear, domain_context_missing |
| 5 | Claude Usage Thresholds: Insights from High-Volume Token Consumption | `controlled_session_workflow` | ✕/✓/77.8 | ✕/✓/69.0 | **v8** | generated_text, labels_carry_claim |
