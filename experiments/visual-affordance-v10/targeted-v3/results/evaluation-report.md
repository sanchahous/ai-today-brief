# Visual Affordance v10 targeted evaluation — owner review required

Stories: **3**; judge: `google/gemini-2.5-flash`; first-stage observation was image-only and intent-blind.

| Metric | V8 baseline | V10 candidate |
|---|---:|---:|
| Hard visual integrity pass | 0/3 (0%) | 1/3 (33%) |
| Headline-paired grounded pass | 0/3 (0%) | 3/3 (100%) |
| Average weighted score | 50.6 | 86.3 |

Blinded preference: V10 **3**, V8 **0**, ties **0**.
V10 preference excluding ties: **100%**.
Vision calls: 6; tokens: 12923; reported cost: $0.0149.

**No automated production pass is emitted. Every candidate requires owner approval.**

| # | Story | Treatment | V8 integrity/headline/score | V10 integrity/headline/score | Preferred | V10 blockers |
|---:|---|---|---|---|---|---|
| 2 | Gemini faces community critique regarding model performance consistency | `same_system_output_variability` | ✕/✕/57.8 | ✕/✓/87.5 | **v10** | input_invariant_broken, system_invariant_broken |
| 4 | Managing AI-Driven Distraction and Rediscovering Deep Work | `bounded_assistance` | ✕/✕/42.5 | ✕/✓/85.5 | **v10** | beam_purpose_unclear |
| 5 | Claude Usage Thresholds: Insights from High-Volume Token Consumption | `controlled_session_workflow` | ✕/✕/51.5 | ✓/✓/85.8 | **v10** | none |
