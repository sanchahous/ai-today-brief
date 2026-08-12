# Visual Compiler v5 fresh source-grounded A/B evaluation

Stories: **7**; judge: `google/gemini-2.5-flash`; two blinded vision calls per story.
Eligible compiler claims before rendering: **5/7**.

| Metric | Current | Compiler v5 |
|---|---:|---:|
| Pixel role-evidence pass | 0/7 (0%) | 7/7 (100%) |
| Visual headline-paired pass | 0/7 (0%) | 5/7 (71%) |
| Production pass incl. claim gate | 0/7 (0%) | 3/7 (43%) |
| Average weighted score | 56.6 | 82.9 |
| Generated-text-free pixels | 5/7 | 7/7 |

Blinded preference: compiler **6**, current **1**, ties **0**.
Compiler preference excluding ties: **86%**.
Vision calls: 14; tokens: 22685; reported cost $0.0244.

| # | Story | Role | Mapping | Claim | Current P/V/Prod/Score | Compiler P/V/Prod/Score | Preferred | Reason |
|---:|---|---|---|---:|---|---|---|---|
| 1 | The Shift to Harness-Level Agent Loops in Software Engineering | `architecture_transformation` | `literal` | ✓ | ✕/✕/✕/44.0 | ✓/✓/✓/82.0 | **compiler** | Card Y is preferred because it directly addresses the 'architecture_transformation' requirement by visually representing the shift from manual prompting to agent loops. The diagram clearly illustrates the components and the structural transformation, making the central claim instantly understandable and grounded in the source. Card X uses an analogy that is not immediately intuitive for the technical subject matter, failing to convey th |
| 2 | Gemini faces community critique regarding model performance consistency | `uncertainty_announcement` | `literal` | ✕ | ✕/✕/✕/85.5 | ✓/✓/✕/77.3 | **current** | Card Y is preferred because its editorial analogy is more impactful and immediately understandable for the concept of 'model performance consistency' and 'inconsistencies'. The visual of the man comparing two different outputs from similar machines is a powerful and intuitive representation of the headline. While Card X is clear and accurate, Card Y's visual analogy is more engaging and memorable, leading to higher instant meaning and v |
| 3 | Git-Lazy-Mount: Mount Repositories on Demand for MicroVM Coding Agents | `capability_access` | `literal` | ✓ | ✕/✕/✕/43.0 | ✓/✓/✓/83.5 | **compiler** | Card X is significantly better because it uses abstract, modern iconography that directly relates to the technical concepts in the headline: a Git repository, a MicroVM, and the idea of on-demand access leading to speed. The visual flow from repository to document to speed gauge clearly communicates the 'mount on demand' and 'cutting startup delays to zero' aspects. Card Y, on the other hand, uses a literal and outdated visual analogy ( |
| 4 | Managing AI-Driven Distraction and Rediscovering Deep Work | `causal_mechanism` | `literal` | ✓ | ✕/✕/✕/67.0 | ✓/✕/✕/85.3 | **compiler** | Card Y is preferred because it more directly and clearly illustrates the 'causal_mechanism' required by the role. The visual analogy of 'offload' vs. 'sparring partner' with the 'keep thinking' label directly maps to the story's core message about how using AI can either erode or enhance problem-solving skills. The labels, while not exact numbers, are explanatory and directly support the visual narrative. Card X is more abstract and les |
| 5 | Claude Usage Thresholds: Insights from High-Volume Token Consumption | `uncertainty_announcement` | `literal` | ✕ | ✕/✕/✕/50.5 | ✓/✓/✕/83.5 | **compiler** | Card X clearly and directly visualizes the core concepts of the story: high token consumption, reported signals, and the need to monitor. The gauge with the warning sign effectively conveys the 'uncertainty_announcement' and the unconfirmed nature of the signals. Card Y's analogy is less direct and fails to communicate the nuances of 'thresholds,' 'signals,' or the 'uncertainty' aspect. Card X is more faithful to the source material and |
| 6 | TikZ Editor: WYSIWYG Interface for LaTeX Vector Graphics | `capability_access` | `literal` | ✓ | ✕/✕/✕/65.0 | ✓/✕/✕/86.5 | **compiler** | Card Y is preferred because it more clearly and directly illustrates the 'capability_access' and 'EXPLANATORY ROLE TO TEST' requirement. The visual flow from 'Visual Interface' to 'TikZ Code' via the 'TikZ Editor' explicitly shows the access path and the bounded capability. While Card X provides a good analogy for visual creation, Card Y's abstract representation is more precise in explaining the mechanism of the editor's function as a  |
| 7 | GPT-5 Aids Immunologists in Solving T-Cell Mystery | `capability_access` | `literal` | ✓ | ✕/✕/✕/41.5 | ✓/✓/✓/82.5 | **compiler** | Card Y is significantly better because it directly and clearly illustrates the headline's claim through a well-designed infographic. The visual analogy in Card X is abstract and does not intuitively convey the concept of AI aiding immunologists, making it misleading and difficult to understand. Card Y excels in headline_pair_understood, thumbnail_readable, and avoids being misleading, which are critical for a 'Today Brief visual editor  |

## Failure diagnosis

- #1: current: context, role-evidence, outcome, relation, unsupported-specifics, consistency, analogy-map, headline-pair, grounding, misleading
- #2: claim: visual_driver_supported; outcome_supported; certainty_preserved; visually_testable | current: context, role-evidence, outcome, relation, unsupported-specifics, generated-text, consistency, analogy-map
- #3: current: context, role-evidence, outcome, relation, unsupported-specifics, consistency, analogy-map, headline-pair, grounding, thumbnail, misleading
- #4: current: context, role-evidence, outcome, relation, direction/state, consistency, analogy-map | compiler: labels
- #5: claim: certainty_preserved | current: role-evidence, generated-text, headline-pair, grounding, certainty, thumbnail, misleading
- #6: current: context, role-evidence, outcome, relation, unsupported-specifics, consistency, analogy-map | compiler: labels
- #7: current: context, role-evidence, outcome, relation, unsupported-specifics, consistency, analogy-map, headline-pair, thumbnail, misleading
