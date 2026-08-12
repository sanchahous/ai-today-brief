# Visual Compiler v8 targeted specialized evaluation

Stories: **4**; judge: `google/gemini-2.5-flash`; two blinded vision calls per story.

| Metric | Current | V8 specialized |
|---|---:|---:|
| Pixel semantic pass | 1/4 (25%) | 4/4 (100%) |
| Production pass | 0/4 (0%) | 4/4 (100%) |
| Average weighted score | 54.1 | 88.3 |

Blinded preference: V8 **4**, current **0**, ties **0**.
V8 preference excluding ties: **100%**.
Vision calls: 8; tokens: 11674; reported cost: $0.0123.

| # | Story | Treatment | Current P/Prod/Score | V8 P/Prod/Score | Preferred | Reason |
|---:|---|---|---|---|---|---|
| 2 | Gemini faces community critique regarding model performance consistency | `observed_variability` | ✕/✕/57.0 | ✓/✓/89.3 | **v8** | Card Y is significantly better because it directly fulfills all the visual requirements of the prompt. It explicitly shows 'the same coding task is visibly repeated' (input blocks), 'the repeated runs produce visibly divergent outputs' (different graphs), and uses the 'ONLY APPROVED OVERLAY LABELS FOR THE V8 TREATMENT' exactly as specified. The abstract nature of the visual in Y is also more appropriate for representing 'model performance consistency' than the literal, albeit metaphorical, image in X. Card X, while visually interesting, relies on a metaphor that is less direct and doesn't use the required labels, making the 'instant_meaning' much lower for the specific claim. |
| 4 | Managing AI-Driven Distraction and Rediscovering Deep Work | `focused_cognition` | ✕/✕/50.8 | ✓/✓/87.5 | **v8** | Card X clearly and directly addresses all the requirements. The visual of the laser beam as a 'bounded hint' from AI, combined with the person's active engagement and the explicit labels 'ACTIVE THINKING' and 'AI AS SPARRING PARTNER', makes the core claim instantly understandable and well-grounded. Card Y, while visually appealing as a workshop scene, completely misses the AI interaction aspect and therefore fails to convey the central message of the headline and summary. It is misleading because it doesn't show any AI involvement, which is central to the article's topic. |
| 5 | Claude Usage Thresholds: Insights from High-Volume Token Consumption | `operational_threshold` | ✓/✕/55.5 | ✓/✓/88.8 | **v8** | Card Y is significantly better because it directly and clearly illustrates the core claims of the headline and summary, especially with the approved overlay labels. The visual metaphor of data blocks approaching a threshold is instantly understandable and directly aligns with 'high-volume token consumption' and 'usage thresholds'. The 'ANECDOTAL SIGNALS' label is perfectly placed to indicate the reported nature of the threshold. Card X, while visually interesting, relies on a more abstract metaphor ('token burn' as forging coins) that doesn't as clearly convey 'usage thresholds' or 'anecdotal signals' without the labels, which are not present in the image. Card Y's visual is also more aligne |
| 7 | GPT-5 Aids Immunologists in Solving T-Cell Mystery | `scientific_discovery` | ✕/✕/53.0 | ✓/✓/87.5 | **v8** | Card X is significantly better because it directly addresses all the 'REQUIRED VISIBLE EVIDENCE' points. It shows multiple data strands converging through an AI analysis (the pyramid), leading to a clear hypothesis. The visual clearly implies a bottleneck being opened. The overlay labels are correctly applied and supported. Card Y, on the other hand, is misleading as it doesn't depict the core claim of data synthesis and hypothesis generation effectively, lacks the required overlay labels, and doesn't show a bottleneck opening. Card X's instant meaning is much higher due to its direct visual representation of the complex process described. |
