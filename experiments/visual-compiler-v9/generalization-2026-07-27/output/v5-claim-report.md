# Visual Compiler v5 fresh-holdout claim gate

Stories: **7**.
Initial clean pass: **4/7**.
Claims repaired once: **3/7**.
Final eligible claims: **4/7**.
LLM calls: 8; tokens: 20580; reported cost: $0.0201.

| # | Story | Role | Certainty | Direction/target | Mapping | Render mode | Initial | Final | Repair/issues |
|---:|---|---|---|---|---|---|---:|---:|---|
| 1 | Isolation Is a System Property, Not a Prompt | `policy_control` | `observed` | n/a | `literal` | `deterministic_literal` | ✓ | ✓ | none |
| 2 | Cryptanalysis Becomes an Agent Workflow | `capability_access` | `claimed` | n/a | `literal` | `deterministic_literal` | ✕ | ✕ | The certainty label 'claimed' is not supported by the source, which uses 'reports'.; The 'visible_outcome' is not supported by the source. The source states that Claude Mythos Preview found improved attacks, and CryptanalysisBench was released. The outcome 'a docum |
| 3 | Make the Evidence Chain Part of the Agent | `architecture_transformation` | `expected` | n/a | `literal` | `deterministic_literal` | ✕ | ✕ | certainty_preserved |
| 4 | Aurora Puts Multi-Provider Routing Behind One Gateway | `capability_access` | `observed` | n/a | `literal` | `deterministic_literal` | ✓ | ✓ | none |
| 5 | Nemotron 3 Ultra Targets Agentic RTL Workflows | `quantitative_result` | `reported` | decrease / competing open models | `literal` | `deterministic_literal` | ✓ | ✓ | none |
| 6 | Shared Claude Links Deserve a Data-Exposure Audit | `policy_control` | `reported` | n/a | `literal` | `deterministic_literal` | ✓ | ✓ | none |
| 7 | Modernization Agents Shift the Bottleneck to Verification | `causal_mechanism` | `expected` | n/a | `literal` | `deterministic_literal` | ✕ | ✕ | Certainty mismatch |

## Role distribution

- `architecture_transformation`: 1
- `capability_access`: 2
- `causal_mechanism`: 1
- `policy_control`: 2
- `quantitative_result`: 1

## Ineligible fallback

A claim that still fails after one repair must not be rendered as a factual compiler visual. Production behavior is a branded source-led fallback with the approved headline and no explanatory assertion.
