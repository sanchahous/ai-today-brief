# Visual Compiler v7 unseen route-aware A/B evaluation

Stories: **7**; judge: `google/gemini-2.5-flash`; two blinded vision calls per story.
Eligible explanatory claims before routing: **5/7**.

| Metric | Current | V7 selected |
|---|---:|---:|
| Pixel role-evidence pass | 1/7 (14%) | 3/7 (43%) |
| Visual headline-paired pass | 1/7 (14%) | 3/7 (43%) |
| Route-safe pass | 1/7 (14%) | 5/7 (71%) |
| Production pass incl. claim gate | 1/7 (14%) | 4/7 (57%) |
| Average weighted score | 63.8 | 71.0 |
| Generated-text-free pixels | 4/7 | 7/7 |

Blinded preference: V7 **4**, current **2**, ties **1**.
V7 preference excluding ties: **67%**.
Vision calls: 14; tokens: 22802; reported cost $0.0242.

| # | Story | Role | Route | Claim | Current P/V/Prod/Score | V7 P/V/Prod/Score | Preferred | Reason |
|---:|---|---|---|---:|---|---|---|---|
| 1 | The Shift to Harness-Level Agent Loops in Software Engineering | `architecture_transformation` | `deterministic_compiler` | ✓ | ✕/✕/✕/28.5 | ✓/✓/✓/79.8 | **compiler** | Card Y is significantly better because it directly visualizes the core concept of the headline and summary: the shift in software engineering workflows. It uses abstract but clear diagrams to represent 'manual prompting' evolving into 'outer harness loops' and 'agent sessions', fulfilling the 'architecture_transformation' requirement. Card X, on the other hand, uses a completely unrelated image of a manufacturing process, which is misle |
| 2 | Gemini faces community critique regarding model performance consistency | `uncertainty_announcement` | `source_led_fallback` | ✕ | ✕/✕/✕/85.5 | ✕/✕/✓/58.0 | **current** | Card Y is preferred because its visual analogy is much stronger and more immediately understandable than Card X's generic graph. The image of wrenches struggling with a bolt clearly conveys 'critique' and 'inconsistency' in a 'coding environment' (tools), making the central meaning instantly clear and grounded in the headline. Card X's graph is too abstract and doesn't add specific meaning beyond a vague sense of fluctuation, which is l |
| 3 | Git-Lazy-Mount: Mount Repositories on Demand for MicroVM Coding Agents | `capability_access` | `deterministic_compiler` | ✓ | ✕/✕/✕/58.5 | ✓/✓/✓/85.0 | **compiler** | Card X is superior because it directly illustrates the core concepts of the headline: Git Repository, MicroVM, and On-Demand Access, with a clear visual flow that implies efficiency and speed. The icons are abstract enough to represent the concepts without being overly literal, and the speedometer with a checkmark effectively conveys the benefit of reduced startup delays. Card Y's analogy of a key card and a safe is less direct and intr |
| 4 | Managing AI-Driven Distraction and Rediscovering Deep Work | `causal_mechanism` | `current_art_director` | ✓ | ✕/✕/✕/77.5 | ✕/✕/✕/77.5 | **tie** | Both cards are identical. The image effectively conveys the idea of 'deep work' and 'personal problem-solving' through the visual of a hand actively engaging with a complex mechanical system. This aligns well with the story's message about using LLMs as sparring partners rather than offloading all cognitive load, thus preventing cognitive atrophy. The visual is clear, relevant, and supports the causal mechanism of active engagement lead |
| 5 | Claude Usage Thresholds: Insights from High-Volume Token Consumption | `uncertainty_announcement` | `source_led_fallback` | ✕ | ✕/✕/✕/80.0 | ✕/✕/✕/36.0 | **current** | Card Y is significantly better because it provides a clear and intuitive editorial analogy that directly relates to the headline and summary's core concept of 'token consumption' and 'token burn rate'. The image of 'burning' coins is a strong visual metaphor for the 'high-volume token consumption' and 'monitoring token spend' discussed. Card X, on the other hand, is an abstract graph that conveys no specific meaning and fails to add any |
| 6 | TikZ Editor: WYSIWYG Interface for LaTeX Vector Graphics | `capability_access` | `deterministic_compiler` | ✓ | ✕/✕/✕/41.5 | ✓/✓/✓/83.5 | **compiler** | Card Y is significantly better because it directly and clearly illustrates the core functionality described in the headline and summary: a WYSIWYG interface for generating TikZ code. The visual flow from a visual input to a diagram and then to code is intuitive and accurate. Card X, while visually appealing, is misleading as it shows a printer and a generic document, which does not convey the 'WYSIWYG Interface' or the 'LaTeX Vector Gra |
| 7 | GPT-5 Aids Immunologists in Solving T-Cell Mystery | `capability_access` | `deterministic_compiler` | ✓ | ✓/✓/✓/75.3 | ✕/✕/✕/77.5 | **compiler** | Card Y is preferred because it more clearly and directly communicates the 'capability_access' role to test. The explicit labels 'GPT-5', 'Immunology', and 'T-Cell Behavior' along with the 'wrench' (tool/aid) and 'checkmark' (solving/success) icons provide a very clear and grounded visual analogy for the AI's role in solving the mystery. While Card X is visually appealing and original, its abstract nature makes the connection to 'capabil |

## Failure diagnosis

- #1: current: context, role-evidence, outcome, relation, analogy-map, headline-pair, grounding, misleading
- #2: claim: visual_driver_supported; outcome_supported; certainty_preserved; visually_testable | current: context, role-evidence, outcome, relation, direction/state, unsupported-specifics, consistency, analogy-map | compiler: context
- #3: current: context, outcome, unsupported-specifics, generated-text, analogy-map, headline-pair, grounding, misleading
- #4: current: context, role-evidence, outcome, relation, direction/state, consistency, analogy-map | compiler: context, role-evidence, outcome, relation, direction/state, consistency, analogy-map
- #5: claim: certainty_preserved | current: context, role-evidence, outcome, relation, direction/state, unsupported-specifics, generated-text, consistency, analogy-map, labels, overlay | compiler: context, outcome, relation, analogy-map, grounding, misleading
- #6: current: context, role-evidence, outcome, relation, direction/state, contradiction, unsupported-specifics, generated-text, consistency, analogy-map, grounding, misleading
- #7: compiler: context, role-evidence, analogy-map
