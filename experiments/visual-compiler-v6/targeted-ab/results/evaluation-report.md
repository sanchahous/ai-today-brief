# Visual Compiler v6 targeted source-grounded A/B evaluation

Stories: **5**; judge: `google/gemini-2.5-flash`; two blinded vision calls per story.
Eligible compiler claims before rendering: **5/5**.

| Metric | Current | Compiler v6 |
|---|---:|---:|
| Pixel role-evidence pass | 2/5 (40%) | 1/5 (20%) |
| Visual headline-paired pass | 2/5 (40%) | 1/5 (20%) |
| Production pass incl. claim gate | 2/5 (40%) | 1/5 (20%) |
| Average weighted score | 77.2 | 60.2 |
| Generated-text-free pixels | 4/5 | 5/5 |

Blinded preference: compiler **2**, current **3**, ties **0**.
Compiler preference excluding ties: **40%**.
Vision calls: 10; tokens: 16195; reported cost $0.0170.

| # | Story | Role | Mapping | Claim | Current P/V/Prod/Score | Compiler P/V/Prod/Score | Preferred | Reason |
|---:|---|---|---|---:|---|---|---|---|
| 1 | Why frontier Anthropic models are performing worse on strict tool calling schemas | `causal_mechanism` | `editorial_analogy` | ✓ | ✕/✕/✕/80.3 | ✕/✕/✕/48.5 | **current** | Card X uses a strong, intuitive visual analogy of a key not fitting a lock, which directly maps to the headline's 'strict tool calling schemas' and the summary's 'emitting made-up keys'. This makes the central claim immediately understandable and grounded. Card Y's sewing machine image is less relevant, and its abstract labels do not enhance understanding, making it misleading and less effective at conveying the causal mechanism. |
| 2 | Leveraging the Mistral AI Platform Beyond Standard Chatbot Integrations | `uncertainty_announcement` | `literal` | ✓ | ✓/✓/✓/86.8 | ✕/✕/✕/43.0 | **current** | Card X is significantly better because it uses a strong, clear, and creative visual analogy that directly supports the headline's theme of 'leveraging the platform beyond standard chatbot integrations' and the company's specific initiatives (Forge, Les Ministraux, European identity). The image is engaging, instantly understandable, and maintains the required uncertainty for future plans through the visual metaphor rather than explicit l |
| 4 | Agentic testing playbook: How fuzzing and property testing empower autonomous coding | `causal_mechanism` | `editorial_analogy` | ✓ | ✕/✕/✕/72.3 | ✕/✕/✕/76.5 | **compiler** | Card X's visual analogy is stronger for the 'causal_mechanism' role. The blocks in Card X, especially the pile, better represent the 'code review' bottleneck and the robot's action of 'automated testing' on them. The labels in Card X, while not exact, help to clarify the analogy without being misleading. Card Y is also good, but the 'testing' aspect is less explicit, and the machine at the end is a bit ambiguous in its function compared |
| 6 | Optimizing Token Caching to Avoid Unexpected Cloud Large Language Model Costs | `quantitative_result` | `literal` | ✓ | ✕/✕/✕/67.0 | ✓/✓/✓/85.5 | **compiler** | Card Y is preferred because it adheres strictly to the fidelity rules. It accurately represents the 'up to 90%' cost reduction without upgrading certainty or inventing causes. The visual is clear, directly supports the claim, and is readable at thumbnail size. Card X, while attempting an analogy, misrepresents the 'up to' certainty as a definitive '90% Waste' and introduces an unstated cause, making it misleading and failing on certaint |
| 7 | Cutting Claude Code Token Costs with Optical Context Compression | `causal_mechanism` | `editorial_analogy` | ✓ | ✓/✓/✓/79.8 | ✕/✕/✕/47.5 | **current** | Card X clearly illustrates the concept of 'compression' and 'optical context' through the use of a press, a stack of papers, and a magnifying glass. This directly aligns with the headline's claim of 'Cutting Claude Code Token Costs with Optical Context Compression'. The visual analogy is strong and immediately understandable. Card Y, on the other hand, uses a less intuitive analogy of placing a small map on a larger one, which does not  |

## Failure diagnosis

- #1: current: context, role-evidence, outcome, relation, direction/state, consistency, analogy-map | compiler: context, role-evidence, outcome, relation, direction/state, consistency, analogy-map, headline-pair, grounding, labels, overlay, thumbnail, misleading
- #2: compiler: context, analogy-map, headline-pair, thumbnail
- #4: current: context, analogy-map | compiler: context, analogy-map, labels
- #6: current: context, role-evidence, relation, unsupported-specifics, generated-text, consistency, analogy-map, certainty, labels, overlay, misleading
- #7: compiler: context, role-evidence, outcome, relation, consistency, analogy-map, headline-pair, grounding, overlay, thumbnail, misleading
