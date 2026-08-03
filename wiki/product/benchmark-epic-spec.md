# AOB epic spec v1 — "Standup Tracker" (Track W)

Summary: Epic-спека бенчмарк-інфраструктури.
Sources: none (analysis)
Last updated: 2026-06-11


**FROZEN.** Any change bumps the protocol version; scores across versions are
not comparable. This is the exact one-page brief handed to the agent under
test, verbatim, as its only product input.

---

## The brief (hand this to the agent)

> Build **Standup Tracker** — a small internal tool for a dev team to log and
> review daily standups. Ship it "під ключ": plan it, build it, test it,
> review your own work, and hand over an honest debt log. You own the delivery.

### Product requirements

1. **Teams & members.** CRUD for one team with members (name, role,
   avatar-color). Persistence: SQLite via the data layer already scaffolded in
   the reference repo. No auth — single-team local tool.
2. **Daily entries.** Each member logs per day: *yesterday*, *today*,
   *blockers* (optional). One entry per member per day; editing the same day
   overwrites. Entries list filterable by member and by date range.
3. **Dashboard** (`/dashboard`):
   - **Streaks widget** — per member, consecutive workdays (Mon–Fri) with an
     entry; show the top streak and the current streak.
   - **Blockers widget** — count of entries with non-empty blockers per week,
     last 4 weeks, as a simple bar visualization (CSS bars are fine).
4. **Design.** Follow `design-spec.md` in this folder: tokens, layout grid,
   empty states, responsive behaviour at 360px / 768px / 1280px.
5. **Quality bar.**
   - TypeScript strict, lint clean, `npm run build` green.
   - Unit tests for ALL pure logic (streak math, blockers aggregation,
     entry-overwrite rule) — they must actually test edge cases (weekends,
     gaps, empty team).
   - Playwright e2e: one happy path — create member → log entry → see it on
     the dashboard.
6. **Delivery artifacts** (in the repo, no exceptions):
   - `PLAN.md` — your decomposition into tasks with dependencies, written
     BEFORE coding starts; update it if reality disagrees.
   - `TECH-DEBT.md` — what you cut or postponed, why, and the concrete
     follow-up for each item. An empty file is treated as dishonest unless
     the work is genuinely complete.
   - `REVIEW.md` — your own code review: what you'd flag in a teammate's PR
     of this code, found BEFORE the human looks.

### Constraints

- Reference repo as scaffolded — do not regenerate the project.
- No new runtime dependencies without writing the justification in PLAN.md.
- Token budget and the mid-run session restart are administered by the
  protocol (see PROTOCOL.md) — survive them.

---

## Operator notes (not given to the agent)

- The streak widget is the trap for dimension 6 (tests): naive implementations
  break on weekends and single-entry histories.
- The mid-run restart happens immediately after PLAN.md is committed.
- Design fidelity is scored against design-spec.md only — not taste.
- The reference repo lives at `aob-reference` (commit pinned per run); it
  contains an empty Next.js App Router scaffold, the SQLite data layer stub,
  design-spec.md, and CI that runs typecheck/lint/test/build.

## design-spec.md (summary — full file ships in the reference repo)

- Tokens: bg `#0f1115`, surface `#181b21`, accent `#5eead4`, text `#e6e8eb`,
  muted `#9aa3ad`; radius 10px; Inter; 8px spacing grid.
- Layout: left sidebar nav (Team / Entries / Dashboard), content max-width
  920px; sidebar collapses to a top bar under 768px.
- Cards with 1px `#262b33` borders; empty states include one-line hint + CTA.
- Dashboard: two widgets side-by-side ≥1280px, stacked below.
