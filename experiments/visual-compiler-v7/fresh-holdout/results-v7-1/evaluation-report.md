# Visual Compiler v5 fresh source-grounded A/B evaluation

Stories: **7**; judge: `google/gemini-2.5-flash`; two blinded vision calls per story.
Eligible compiler claims before rendering: **5/7**.

| Metric | Current | Compiler v5 |
|---|---:|---:|
| Pixel role-evidence pass | 1/7 (14%) | 2/7 (29%) |
| Visual headline-paired pass | 1/7 (14%) | 1/7 (14%) |
| Production pass incl. claim gate | 1/7 (14%) | 1/7 (14%) |
| Average weighted score | 64.2 | 68.5 |
| Generated-text-free pixels | 5/7 | 7/7 |

Blinded preference: compiler **4**, current **3**, ties **0**.
Compiler preference excluding ties: **57%**.
Vision calls: 14; tokens: 22262; reported cost $0.0234.

| # | Story | Role | Mapping | Claim | Current P/V/Prod/Score | Compiler P/V/Prod/Score | Preferred | Reason |
|---:|---|---|---|---:|---|---|---|---|
| 1 | The Shift to Harness-Level Agent Loops in Software Engineering | `architecture_transformation` | `literal` | ✓ | ✕/✕/✕/42.5 | ✕/✕/✕/79.8 | **compiler** | Card Y directly addresses the 'architecture_transformation' role by visually representing the shift from manual prompting to an outer harness loop orchestrating agent sessions. The visual elements clearly depict the 'supported layers/components/stages and the visible structural transformation'. Card X uses an unclear analogy that does not convey the core message or the required architectural transformation, making it misleading and diff |
| 2 | Gemini faces community critique regarding model performance consistency | `uncertainty_announcement` | `literal` | ✕ | ✕/✕/✕/85.5 | ✕/✕/✕/66.5 | **current** | CARD Y is preferred because its visual analogy is much stronger and more immediately impactful in conveying the concept of 'performance consistency' and 'critique' than CARD X's abstract graph. The side-by-side comparison of consistent vs. inconsistent output in CARD Y makes the central claim instantly understandable and memorable. While CARD X is not misleading, its visual is generic and less engaging. CARD Y's originality and visual b |
| 3 | Git-Lazy-Mount: Mount Repositories on Demand for MicroVM Coding Agents | `capability_access` | `literal` | ✓ | ✕/✕/✕/43.0 | ✓/✓/✓/83.5 | **compiler** | Card X is significantly better because it uses abstract, modern iconography that directly relates to the technical concepts in the headline: a Git repository, a MicroVM, and the idea of on-demand access leading to speed. The visual flow from repository to document to speed gauge clearly communicates the 'mount on demand' and 'cutting startup delays to zero' aspects. Card Y, on the other hand, uses a literal and outdated visual analogy ( |
| 4 | Managing AI-Driven Distraction and Rediscovering Deep Work | `causal_mechanism` | `editorial_analogy` | ✓ | ✕/✕/✕/76.5 | ✕/✕/✕/48.5 | **current** | Card X effectively uses a visual metaphor to convey the core message of the article: engaging with complex problems (deep work) versus potentially over-relying on AI. The split image clearly illustrates two different modes of interaction with tasks, aligning with the 'sparring partner' versus 'offloading' concept. It directly addresses the 'causal_mechanism' role by showing engagement. Card Y, on the other hand, fails to visually repres |
| 5 | Claude Usage Thresholds: Insights from High-Volume Token Consumption | `uncertainty_announcement` | `literal` | ✕ | ✕/✕/✕/74.0 | ✕/✕/✕/35.0 | **current** | Card Y is significantly better because its image provides a clear and intuitive analogy for 'token consumption' and 'high-volume spend' which is the core of the story. The coins spilling out directly represent tokens being used up. Card X's abstract graph is too generic and doesn't convey the specific meaning of token consumption or thresholds effectively, making it misleading by not grounding the central claim visually. The 'workshop'  |
| 6 | TikZ Editor: WYSIWYG Interface for LaTeX Vector Graphics | `capability_access` | `literal` | ✓ | ✕/✕/✕/65.0 | ✓/✕/✕/86.5 | **compiler** | Card Y is preferred because it more clearly and directly illustrates the 'capability_access' and 'EXPLANATORY ROLE TO TEST' requirement. The visual flow from 'Visual Interface' to 'TikZ Code' via the 'TikZ Editor' explicitly shows the access path and the bounded capability. While Card X provides a good analogy for visual creation, Card Y's abstract representation is more precise in explaining the mechanism of the editor's function as a  |
| 7 | GPT-5 Aids Immunologists in Solving T-Cell Mystery | `capability_access` | `literal` | ✓ | ✓/✓/✓/63.0 | ✕/✕/✕/79.8 | **compiler** | Card Y is preferred because its visual representation is a more direct and intuitive analogy for 'GPT-5 Aids Immunologists in Solving T-Cell Mystery'. The icons clearly represent the components (GPT-5, Immunology, T-Cell Behavior) and the action (solving/fixing leading to a successful outcome). The tags further reinforce the key elements, making the central claim immediately understandable. Card X's image is more abstract and less direc |

## Failure diagnosis

- #1: current: context, role-evidence, outcome, relation, consistency, analogy-map, headline-pair, grounding, thumbnail, misleading | compiler: analogy-map
- #2: claim: visual_driver_supported; outcome_supported; certainty_preserved; visually_testable | current: context, role-evidence, outcome, relation, direction/state, unsupported-specifics, generated-text, consistency, analogy-map | compiler: context
- #3: current: context, role-evidence, outcome, relation, unsupported-specifics, consistency, analogy-map, headline-pair, grounding, thumbnail, misleading
- #4: current: context, role-evidence, outcome, relation, direction/state, consistency, analogy-map | compiler: context, role-evidence, outcome, relation, direction/state, consistency, analogy-map, headline-pair, grounding, overlay, thumbnail, misleading
- #5: claim: certainty_preserved | current: context, role-evidence, outcome, relation, direction/state, unsupported-specifics, generated-text, consistency, analogy-map | compiler: context, outcome, relation, grounding, misleading
- #6: current: context, role-evidence, outcome, relation, unsupported-specifics, consistency, analogy-map | compiler: labels
- #7: compiler: context, role-evidence, analogy-map
