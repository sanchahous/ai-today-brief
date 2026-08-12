# Visual Compiler v5 fresh-holdout claim gate

Stories: **7**.
Initial clean pass: **1/7**.
Claims repaired once: **6/7**.
Final eligible claims: **1/7**.
LLM calls: 15; tokens: 25813; reported cost: $0.0247.

| # | Story | Role | Certainty | Direction/target | Mapping | Render mode | Initial | Final | Repair/issues |
|---:|---|---|---|---|---|---|---:|---:|---|
| 1 | Why frontier Anthropic models are performing worse on strict tool calling schemas | `causal_mechanism` | `reported` | n/a | `literal` | `deterministic_literal` | ✕ | ✕ | certainty_preserved |
| 2 | Leveraging the Mistral AI Platform Beyond Standard Chatbot Integrations | `uncertainty_announcement` | `reported` | n/a | `literal` | `deterministic_literal` | ✕ | ✕ | visual_driver_supported |
| 3 | Strix: Open-source AI penetration testing tool finds and patches vulnerabilities | `capability_access` | `observed` | n/a | `literal` | `deterministic_literal` | ✓ | ✓ | none |
| 4 | Agentic testing playbook: How fuzzing and property testing empower autonomous coding | `causal_mechanism` | `reported` | n/a | `literal` | `deterministic_literal` | ✕ | ✕ | none |
| 5 | Review-flow: Automate 80% of code reviews using Claude Code and Model Context Protocol | `capability_access` | `reported` | n/a | `literal` | `deterministic_literal` | ✕ | ✕ | certainty_preserved |
| 6 | Optimizing Token Caching to Avoid Unexpected Cloud Large Language Model Costs | `quantitative_result` | `reported` | decrease | `literal` | `deterministic_literal` | ✕ | ✕ | certainty_preserved |
| 7 | Cutting Claude Code Token Costs with Optical Context Compression | `causal_mechanism` | `reported` | n/a | `literal` | `deterministic_literal` | ✕ | ✕ | certainty_preserved |

## Role distribution

- `capability_access`: 2
- `causal_mechanism`: 3
- `quantitative_result`: 1
- `uncertainty_announcement`: 1

## Ineligible fallback

A claim that still fails after one repair must not be rendered as a factual compiler visual. Production behavior is a branded source-led fallback with the approved headline and no explanatory assertion.
