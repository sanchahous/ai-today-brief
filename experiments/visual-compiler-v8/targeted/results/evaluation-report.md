# Visual Compiler v8 targeted specialized evaluation

Stories: **4**; judge: `google/gemini-2.5-flash`; two blinded vision calls per story.

| Metric | Current | V8 specialized |
|---|---:|---:|
| Pixel semantic pass | 1/4 (25%) | 4/4 (100%) |
| Production pass | 0/4 (0%) | 4/4 (100%) |
| Average weighted score | 3.1 | 5.7 |

Blinded preference: V8 **4**, current **0**, ties **0**.
V8 preference excluding ties: **100%**.
Vision calls: 8; tokens: 11436; reported cost: $0.0121.

| # | Story | Treatment | Current P/Prod/Score | V8 P/Prod/Score | Preferred | Reason |
|---:|---|---|---|---|---|---|
| 2 | Gemini faces community critique regarding model performance consistency | `observed_variability` | ✕/✕/0.6 | ✓/✓/0.8 | **v8** | Card Y is significantly better because it directly addresses all the visual requirements and uses the approved overlay labels. The visual representation of 'same task' leading to 'divergent outputs' is explicit and instantly understandable, aligning perfectly with the 'observed_variability' role. Card X, while aesthetically pleasing, relies on a metaphor that is less direct and doesn't fulfill the specific requirements for showing repeated tasks and divergent outputs, nor does it use the required labels. Card Y's instant meaning is much higher due to its literal depiction of the problem. |
| 4 | Managing AI-Driven Distraction and Rediscovering Deep Work | `focused_cognition` | ✕/✕/5.0 | ✓/✓/8.6 | **v8** | Card X is strongly preferred because it directly addresses all the requirements and avoids all forbidden implications. It clearly shows a person actively engaged in problem-solving with AI providing bounded assistance, aligning perfectly with 'AI as sparring partner' and 'active thinking'. Card Y, while visually appealing in its own right, completely misses the AI interaction aspect, making it misleading and ungrounded for the given headline and summary. The instant meaning and central claim grounding are significantly higher in Card X. |
| 5 | Claude Usage Thresholds: Insights from High-Volume Token Consumption | `operational_threshold` | ✓/✕/4.5 | ✓/✓/8.6 | **v8** | Card Y is significantly better because it directly addresses all the requirements. It clearly visualizes 'high-volume token stream approaches a visible operating boundary' and 'interruption risk' without claiming an exact limit. The labels are correctly applied and supported by the visual. Card X, while visually interesting, fails to convey the core claims of 'thresholds' and 'anecdotal signals' and is misleading by implying a physical, manual process for AI token consumption. It also lacks the required labels. |
| 7 | GPT-5 Aids Immunologists in Solving T-Cell Mystery | `observed_variability` | ✕/✕/2.3 | ✓/✓/4.7 | **v8** | Card X perfectly fulfills all the requirements. It directly addresses the 'observed_variability' role by visually demonstrating the 'SAME TASK' leading to 'DIVERGENT OUTPUTS' and explicitly uses the approved overlay labels. It grounds the central claim about consistency concerns without being misleading. Card Y, while aesthetically pleasing, completely misses the core requirement of illustrating 'observed_variability' and the specific source grounding about consistency debate, making it misleading for the intended purpose. Card X's instant meaning is high because it directly visualizes the requested concept, and its originality comes from its clear, abstract representation of a complex issue |
