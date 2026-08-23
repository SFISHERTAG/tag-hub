# Hot Path Dev Protocol — TODO

**Status:** Deferred 2026-08-23. Document this so it doesn't get lost when TAG work winds down.

---

## What This Is

Hot Path is the core product/boilerplate that TAG is a remix/prototype of. The extraction hasn't happened yet. When it does, development needs a protocol to prevent the two from tangling.

**See also:** [project_hotpath_product_extraction.md](/Users/home/.claude/projects/-Users-home-projects-TAG/memory/project_hotpath_product_extraction.md)

---

## What Should Be Decided

1. **Extraction sequencing** — how to cleanly separate Hot Path product from TAG-specific code without losing either?

2. **Parallel development** — can they be worked on simultaneously, or must extraction complete first?

3. **Session/model assignment** — should Hot Path use different session types or model tiers than TAG remix work? (See 2026-08-23 session consolidation for why this matters: Haiku/Sonnet/Opus for different task complexity.)

4. **Boundary enforcement** — which directories, concerns, and modules belong to core product vs. TAG-specific remix? How are violations caught?

5. **Dependency management** — if TAG changes shared code, does it feed back to Hot Path automatically? Via PR? Via manual sync?

6. **Module isolation** — does the `no-restricted-imports` ESLint zone pattern (currently enforcing integration module isolation in TAG) apply to Hot Path / remix boundary?

---

## Context for Future Work

- TAG currently uses concurrent sessions (6+ running, multiple models) — avoid that on Hot Path extraction
- Collision zones in shared files (`docs/epics.md`, `docs/data-model.md`) happen when work isn't coordinated upfront
- Multi-session merge sequences require explicit order (happy-ritchie → handoff-review → ghl-multi) to avoid rebase conflicts
- Document conflicts BEFORE merging, not after (see MERGE_CONFLICTS_IDENTIFIED.md)

---

## When to Do This

- After TAG stabilizes or enters maintenance mode
- Before scaling to multiple teams or geographies (extraction becomes harder as users multiply)
- When a second product wants to use Hot Path (extraction forces the boundary)

---

## Owner

Sam. Make the decision on scope and sequencing when the time comes.
