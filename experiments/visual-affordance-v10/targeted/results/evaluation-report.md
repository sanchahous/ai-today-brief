# Visual Affordance v10 targeted evaluation — owner review required

Stories: **3**; judge: `google/gemini-2.5-flash`; first-stage observation was image-only and intent-blind.

| Metric | V8 baseline | V10 candidate |
|---|---:|---:|
| Hard visual integrity pass | 0/3 (0%) | 3/3 (100%) |
| Headline-paired grounded pass | 0/3 (0%) | 3/3 (100%) |
| Average weighted score | 53.3 | 87.0 |

Blinded preference: V10 **3**, V8 **0**, ties **0**.
V10 preference excluding ties: **100%**.
Vision calls: 7; tokens: 13745; reported cost: $0.0156.

**No automated production pass is emitted. Every candidate requires owner approval.**

| # | Story | Treatment | V8 integrity/headline/score | V10 integrity/headline/score | Preferred | V10 blockers |
|---:|---|---|---|---|---|---|
| 2 | Gemini faces community critique regarding model performance consistency | `same_system_output_variability` | ✕/✕/57.0 | ✓/✓/87.5 | **v10** | none |
| 4 | Managing AI-Driven Distraction and Rediscovering Deep Work | `bounded_assistance` | ✕/✕/46.0 | ✓/✓/86.0 | **v10** | none |
| 5 | Claude Usage Thresholds: Insights from High-Volume Token Consumption | `controlled_session_workflow` | ✕/✕/57.0 | ✓/✓/87.5 | **v10** | none |
