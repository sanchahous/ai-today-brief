# ATB Orchestration Bench (AOB) — protocol v1

The signature benchmark of AI Today Brief: every notable release of a coding
model or agent tool gets run through the **same end-to-end delivery epic**, and
the scored result becomes content (news item + the living guide page).

The unit under test is not "can it write a function" — it is **orchestrated
delivery**: planning, memory, token economy, code, self-review, tests, design
and honest tech-debt accounting, with as little human help as possible.

## The fixed epic

> **"Standup Tracker"** — a small but complete product slice, built "під ключ"
> from a one-page spec in a fixed reference repo.

- Track **W (web)**: Next.js App Router + TypeScript strict + Tailwind.
  Features: team CRUD (local storage or SQLite), daily standup entries,
  a dashboard page with 2 analytics widgets (streaks, blockers-per-week),
  responsive layout per the included design spec.
- Track **M (mobile)**: same product as an Expo/React Native app. Run only
  for tools that claim mobile competence; Track W is the default.

The epic spec, design spec and reference repo are **versioned**: any change
bumps the protocol version and old scores are not comparable.

- Reference repo: <https://github.com/sanchahous/aob-reference>
- Protocol v1 pinned commit: `624e6ef9d6d3b507b2d9ec30f1bdfa67385edc65`
- Agent-facing brief: `EPIC.md` + `design-spec.md` inside the repo
  (duplicated as `epic-spec.md` in this folder for the editorial record).

## Rules (reproducibility)

1. Same starting commit of the reference repo, same epic spec, same budget.
2. Fresh session; the tool's own memory/rules/skills facilities are allowed
   and encouraged — configuring them is part of the test (that IS
   orchestration), but the configuration must be written down in the run log.
3. **Mid-run session restart is mandatory** (after the planning phase):
   long-term memory is scored by how much context survives.
4. Human interventions are allowed but every one is logged and costs points.
5. Token budget: hard cap recorded before the run (default: $25 equivalent).
   Running out = run ends, score what exists.
6. Record exact model ids, tool versions, date, and publish the run log.

## Scoring — 10 dimensions × 0–5

| # | Dimension | What 5 looks like |
|---|---|---|
| 1 | Planning & decomposition | Epic → coherent task graph with dependencies; plan survives contact with reality |
| 2 | Long-term memory | After the forced restart, the agent resumes with full context, no re-explaining |
| 3 | Token economy | Епік закрито в межах ≤50% бюджету без втрати якості |
| 4 | Code quality | typecheck/lint clean; idiomatic for the stack; no dead code |
| 5 | Self-review & critique | Finds its own bugs before the human does; meaningful review notes |
| 6 | Tests | Unit tests on logic + Playwright happy-path e2e, all green, honest coverage |
| 7 | Design fidelity | UI matches the design spec without pixel-pushing by the human |
| 8 | Tech-debt honesty | Accurate debt log: what was cut, why, with concrete follow-ups |
| 9 | Autonomy | Human interventions: 0–1 → 5; each extra intervention −1 |
| 10 | Time to done | Wall-clock vs the rolling median of all runs |

**AOB score = sum (max 50).** Dimensions also published individually — the
profile matters more than the total (a 46 that fails memory is a different
tool than a 46 that fails design).

## Output of every run

1. `runs/YYYY-MM-DD-<tool>.md` from the template below.
2. The living guide results table gets a row (tool, version, date, score,
   profile, cost, link to run log).
3. If the run accompanied a release news item, the item links to the guide.

## Run log template

```markdown
# AOB run — <tool + version> — YYYY-MM-DD
Protocol: v1 · Track: W · Budget cap: $25 · Reference repo commit: <sha>
Model id(s): … · Orchestration config: <rules/skills/memory used>

## Scores
| Dim | Score | Evidence (1–2 lines each) |
|---|---|---|
| Planning | /5 | |
| Memory | /5 | |
| Tokens | /5 | spent $X of $25 |
| Code | /5 | |
| Self-review | /5 | |
| Tests | /5 | unit N green, e2e M green |
| Design | /5 | |
| Tech debt | /5 | |
| Autonomy | /5 | interventions: N (list) |
| Time | /5 | Xh Ym |
**Total: /50**

## Interventions log
1. …

## Verdict (2–4 sentences, goes on the site as editor's take)
…
```
