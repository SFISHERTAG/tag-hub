# BMAD Legendarium Framework

**Purpose:** Explain the hierarchical structure and workflow for drafting, tracking, and shipping work in the TAG Hub project using the BMAD (Big Moves, Architecture, Decisions) system.

**Status:** Framework documentation  
**Last updated:** 2026-08-23

---

## Terminology: The Four Layers

The TAG legendarium is organized in a strict hierarchy:

### 1. **Legendarium** (Top Level)
The complete collection of all portfolio epics for the TAG Hub product. It represents the entire product roadmap from inception to feature completeness.

- **Captures:** The full scope of work to ship the TAG Hub
- **Lives in:** `docs/epics.md` (summary table) + individual epic docs
- **Horizon:** Multi-quarter; contains 17 epics as of 2026-08-23

### 2. **Portfolio**
A major product initiative with clear business value. In the TAG context, each portfolio typically covers a key user need or operational domain.

Examples:
- **CSM Portfolio and Impersonation** (Epic 3) — one view across all clients
- **Angular Migration** (Epic 10) — frontend rewrite with zero disruption
- **Lifecycle Handoff** (Epic 13) — prospect-to-client automation

A portfolio is **not** a single task — it is a **collection of epics** that work together to ship a cohesive capability.

### 3. **Epic** (Portfolio → Story layer)
A scoped piece of work lasting 2–8 weeks, representing one architectural concern or feature area.

Each epic has:
- **A single, measurable goal:** "a user logs in carrying a role and location set" (Epic 1)
- **5–15 stories:** smaller units that collectively achieve the goal
- **A story status table:** tracked in `docs/epics.md` and authoritative in each story doc
- **Architecture constraints or decisions** that all its stories inherit

Examples from TAG:
- **Epic 1 — Foundation and access:** Auth, roles, tenant scoping
- **Epic 2 — Closer workspace:** The daily working surface for a sales rep
- **Epic 10 — Angular migration:** Rewrite the frontend without a cutover

### 4. **Story** (Epic → Implementation layer)
A single implementable unit of work, 3–10 days, that ships exactly one feature, refactoring, or gate.

Each story has:
- **A narrative:** "As X, I want Y, so that Z" (user story format)
- **Acceptance criteria:** 1–10 concrete, testable requirements
- **Context:** Why it matters, what depends on it, or what it unblocks
- **Tasks:** A checklist of implementation steps
- **Status:** Draft → Ready → In Progress → Review → In Review → Done
- **Implementation notes:** Which files changed, what tests were added
- **A doc file:** `docs/stories/{epic}.{number}-{slug}.md`

---

## The Verification Gate: Status Binding to Implementation

A story's **Status** is not optional decoration—it is a contract enforced by a pre-commit hook.

### Status Values

| Status | Meaning | Gate |
|--------|---------|------|
| **Draft** | Written but not ready to start | None; no commits should reference this story |
| **Ready** | Accepted; can start whenever a developer takes it | None; but signal upstream when you begin |
| **In Progress** | Active work; PRs being developed | Story's `Status:` line can stay as-is; Tasks checklist updates as work advances |
| **In Review** | Code submitted; waiting on review or feedback | Tasks may be complete but story not yet shipped |
| **Done** | Shipped; code merged, story doc closed | **Mandatory:** All Tasks are checked. Status, referenced files, and Tasks list must all be in sync. The pre-commit hook (`scripts/check-story-status.mjs`) verifies this. |

### The Pre-Commit Hook: `check-story-status.mjs`

Every commit that touches a story's referenced files must also:

1. **Stage the story doc** if any of its files changed
2. **Keep Status and Tasks synchronized**—if a story's Status is Done, all Tasks must be `[x]`; if any Task is unchecked, Status cannot be Done
3. **Not bypass with `--no-verify`** to skip a real fix—if the hook rejects a commit, the right response is to update the story doc, not to force-push around the check

Run it manually:
```bash
npm run check:story-status
```

Or let git invoke it on `git commit`.

---

## The Workflow: From Draft to Done

### Phase 1: Ideation & Drafting

**Owner:** Product lead, architect, or experienced engineer  
**Input:** Product goal, constraint, or previous story's output  
**Output:** Story doc in `Draft` status

1. **Create the file:** `docs/stories/{epic}.{number}-{slug}.md`
2. **Write the story narrative** (2–3 sentences: user, intent, benefit)
3. **Add context** (why this matters, what it unblocks, risks)
4. **List acceptance criteria** (1–10 testable requirements; these are the gate)
5. **Sketch tasks** (as checkboxes; these will be refined)
6. **Leave tasks unchecked**—nothing is done yet
7. **Set Status to `Draft`**
8. **Commit:** "Story {number}: {title} (Draft)"

### Phase 2: Acceptance & Readiness

**Owner:** Tech lead or architect (not the implementer)  
**Input:** Draft story doc  
**Output:** Story doc in `Ready` status

1. **Review for clarity:** Can a developer reading this start work without asking what it means?
2. **Verify acceptance criteria are testable:** Each one is a check a human or test can pass/fail
3. **Check prerequisites:** Are there blockers? Do dependent stories exist? Are they Ready?
4. **Identify risks:** Are there unknowns that might grow the scope?
5. **If all checks pass:** Update `Status: Ready`
6. **If gaps exist:** Document them as Context and leave Status as `Draft` with a reason

### Phase 3: Implementation

**Owner:** Assigned developer  
**Input:** Ready story doc  
**Output:** Code + updated story doc

1. **Create or enter a branch/worktree:** One story per git worktree if it touches shared modules (auth, types, core); otherwise feature branch off `main`
2. **Update Status to `In Progress`**
3. **Begin implementing:** Check off tasks as you complete them
4. **Commit incrementally:** Git messages can reference the story, but don't close it yet
5. **Run the gate:** `ng build --configuration production && ng lint && ng test --watch=false` (frontend) or equivalent backend tests
6. **Update the story doc** with:
   - Completed tasks checked off
   - Any implementation notes that differ from the Context
   - Calibration numbers (if this is a calibration story like 10.4)
7. **Open a PR** with a link to the story doc

### Phase 4: Review

**Owner:** Code reviewer (separate from implementer if possible)  
**Input:** PR + story doc with tasks mostly checked  
**Output:** Approved PR or feedback

Review gates:
- All **acceptance criteria** are demonstrated (human test or automated)
- **Tests pass** (unit, integration, or acceptance-level)
- **No regressions** in existing features
- **Lint and type checks pass**
- **Story doc is updated** and included in the commit

**If issues found:** Update the branch and story doc together; do not close the story until all acceptance criteria pass.

### Phase 5: Merge & Close

**Owner:** Implementer or tech lead  
**Input:** Approved PR  
**Output:** Merged commit; story closed

1. **Merge the PR** (rebase + squash, or merge commit per project preference)
2. **Final commit** updates the story doc:
   - Set `Status: Done`
   - Ensure all Tasks are `[x]`
   - Add completion date if capturing it
3. **Push to `main`**

The pre-commit hook validates:
- Story doc is staged
- All Tasks are checked
- Status is "Done"
- No contradictions

If all pass: ✅ story is closed.

---

## Layering & Dependency

### How Layers Connect

```
Legendarium (all work)
  ↓
Portfolio (grouped by initiative)
  ↓
Epic (2–8 week chunk; N stories)
  ↓
Story (3–10 day unit; 1 feature or gate)
  ↓
Implementation (code, tests, docs)
```

### Blockers & Prerequisites

Stories declare dependencies in their Context:

```markdown
## Context

Story 10.4 cannot start until:
- Story 11.5 completes (endpoint inventory must be known)
- Story 10.3 merges (shell + nav must exist)
- Endpoint contract is approved (defines HTTP shapes)
```

The `docs/epics.md` table shows:
- **Status:** Current state of each story
- **Blocker:** What is holding it back (if not just "not started")

### Verification at Story Boundaries

A story is not **done** until:

1. **Code compiles & tests pass** — `ng build`, `npm run lint`, `npm run test` all succeed
2. **All acceptance criteria are met** — each one is explicitly verified (not assumed)
3. **Story doc is complete** — Status is Done, all Tasks are checked, implementation notes are added
4. **Dependent stories are unblocked** — if this story was a prerequisite, downstream work can now start
5. **Pre-commit hook passes** — the story doc and code are in sync

---

## Epics in the TAG Legendarium

### Foundation & Access (Epic 1)
8 stories. **Goal:** Users sign in, carry roles, and cannot reach tenants they are not entitled to.  
**Status:** Mostly done; one story (1.2) blocked on GHL consolidation, one (1.6) has remaining work.

### Closer Workspace (Epic 2)
8 stories. **Goal:** The daily working surface for a closer.  
**Status:** Core complete; three stories (2.5, 2.7, 2.8) are Ready but not started.

### CSM Portfolio & Impersonation (Epic 3)
6 stories. **Goal:** One view across clients + enter a client to work in it.  
**Status:** Impersonation stories done; Phase 2 of portfolio stories awaits Angular calibration.

### Client Owner Dashboard (Epic 4)
6 stories. **Goal:** Tax advisors see performance without GoHighLevel.  
**Status:** Four stories done; 4.2 blocked on missing Meta credentials in environment.

### Onboarding & Campaign Launch (Epic 5)
10 stories. **Goal:** Onboarding runs in the Hub.  
**Status:** Eight done or ready; 5.6 held for live Meta verification; 5.10 is prerequisite to Epic 13.

### Acquisition Loop (Epic 6)
5 stories. **Goal:** Outcomes flow back to Meta so the algorithm learns.  
**Status:** Four done; 6.1 is a manual audit prerequisite for 6.2–6.3 deploy.

### Command Surface & Configurability (Epic 7)
8 stories. **Goal:** Executive view + role-scoped dashboards.  
**Status:** Three in progress; 7.4 and 7.7 are high-priority ("not optional").

### Operational Instrumentation (Epic 8)
4 stories. **Goal:** Error logs, health signals, drift monitoring.  
**Status:** All draft. This is the post-launch observability epic.

### Client Channel (Epic 9)
5 stories. **Goal:** Slack integration for CSM workload visibility.  
**Status:** All draft. Depends on 7.4 shipping first (visibility allowlist).

### Angular Migration (Epic 10)
8 stories. **Goal:** Frontend runs on Angular + Material Design 3 without cutover.  
**Status:** 10.1 done (contracts); 10.2 in progress (auth surface); 10.3 in review (shell); 10.4–10.8 draft.  
**Critical path:** 10.4 is the calibration story; 10.5–10.7 estimate from its numbers.

### Migration Readiness (Epic 11)
7 stories. **Goal:** Epic 10 is executable and estimable.  
**Status:** 11.1 done (Node gate); 11.3–11.5 in progress; 11.6 ready (courses split); 11.2/11.4/11.7 draft.

### Knowledge Base (Epic 12)
5 stories. **Goal:** CSM manual readable in the Hub.  
**Status:** All ready; code shipped but browser verification gate not run.

### Lifecycle Handoff (Epic 13)
6 stories. **Goal:** Prospects auto-become tracked clients; stalling clients are visible.  
**Status:** All draft; merged with Epic 5 on 2026-08-22; sequencing is 13.1 → 13.3 → 13.5 → 13.6.

### Firestore Exit (Epic 14)
10 stories. **Goal:** Move all data to Postgres; Firebase keeps Auth only.  
**Status:** Decided 2026-08-23; 11.6 was the pilot; 14.1 (repo seam) is the blocking step.

### No Hats (Epic 15)
13 stories. **Goal:** A person is their grants, not one role at a time.  
**Status:** Decided 2026-08-23 from `docs/ROLES_AND_GRANTS_PLAN.md`; live bug: execs cannot access their other roles.

### Account Settings (Epic 16)
3 stories. **Goal:** Users configure their own account.  
**Status:** 16.1 blocked on 7.8 (uid→GHL user mapping); 16.3 blocked on notification subsystem.

### End-to-End Campaign Orchestration (Epic 17)
7 stories. **Goal:** Intake → live Meta campaign with KPI scaling, fully automated.  
**Status:** Design phase (17.1) blocked on 10.4 landing; implementation stories 17.2–17.7 blocked on 17.1.

---

## Rules & Constraints

### 1. Story Status is Source of Truth

- `docs/epics.md` is a summary table; it can get stale
- **Each story's own `Status:` line is authoritative**
- When a table disagrees with a story doc, the story doc wins (see Story 11.3)

### 2. Tasks Must Stay Synchronized with Status

- A story with `Status: Done` must have all Tasks `[x]`
- A story with unchecked tasks cannot be marked Done
- The pre-commit hook enforces this; do not bypass it

### 3. One Story, One Implementation Location

- A screen or feature exists in exactly one place (Angular or Next, not both)
- When a feature ships, the old implementation is deleted in the same commit
- This prevents defect fixes landing twice

### 4. Gates Run Before a Story Closes

- Frontend: `ng build --configuration production && ng lint && ng test --watch=false`
- Backend: `npm run build && npm run lint && npm run test --watch=false` (from `functions/`)
- If the gate fails, the story stays in Review until it passes

### 5. Epics Inherit Architecture from Their Portfolio

All stories in an epic inherit:
- The epic's stated goal
- Architectural decisions made in parent epics
- Constraints from the product architecture (`docs/data-model.md`, `docs/architecture.md`)

Stories do not re-decide inherited constraints; they operate within them.

### 6. Blockers Are Named, Not Silent

If a story cannot start:
- Name the blocker in the story doc's Context
- Update `docs/epics.md` to show the blocker
- Track who is working on it

Examples:
- Epic 1, Story 1.2: "Blocked — GHL account consolidation"
- Epic 4, Story 4.2: "Blocked — Meta credentials not present in this environment"

### 7. Calibration Numbers Are Non-Negotiable

For migration epics (like Epic 10), a calibration story:
- Records actual hours per unit of work (e.g., hours per endpoint)
- Allows downstream stories to estimate from measured data instead of guesses
- Must complete before later estimates are committed

Example: Story 10.4 measures hours per endpoint, hours per screen, one-time primitive cost, and post-gate defects. Stories 10.5–10.7 then scale these numbers.

---

## Decision Record: How Decisions Flow into Stories

### Architecture Decisions (ADs)

Major decisions that affect multiple stories live in an Architecture spine (`ARCHITECTURE-SPINE.md` at epic or initiative level).

Each AD:
- **Binds:** What it decides (e.g., "All color flows from M3 tokens")
- **Prevents:** What would diverge without it (e.g., "raw hex hardcoding in per-component styles")
- **Rule:** The enforcement mechanism (e.g., "No component `.scss` may declare a hex color")

Stories then:
- **Inherit** the AD (it is read-only for that story)
- **Implement** the rule (e.g., "Use only `mat.theme()` overrides")
- **Test** compliance (e.g., linter checks for `!important` or deep selectors)

### Decisions Within a Story

Smaller design choices live in the story's own Context or Decisions section.

Example (Story 10.2):
```markdown
## Decisions

Taken here, so an implementer does not rediscover them:

1. **One payload shape.** Every endpoint returns the same `SessionPayload`, 
   and the client replaces the whole Session object, never merges.
```

These decisions are binding on that story and any story that depends on it.

---

## Appendix: Example Story Structure

```markdown
# Story 10.4 — Shared M3 primitives, portfolio and bug reports

**Epic:** 10 — Angular migration
**Status:** Draft

## Story

As any signed-in user, I want the first real screens in Angular, built on shared
Material 3 primitives that every later feature reuses rather than reinvents.

## Context

[Explains why this story matters, what it unblocks, risks, dependencies]

## Decisions

[Design decisions made to unblock implementation]

## Acceptance criteria

1. `shared/ui/` holds the primitives: page shell, empty state, error state, loading state, data table, confirm dialog. ✓ (completed)
2. No component `.scss` declares a raw hex colour. ✓
3. `features/portfolio/` lists tenants and enters one. (in progress)
4. [more criteria]

## Tasks

- [x] Task completed
- [ ] Task not yet started
- [ ] Another task

## Dev notes

[Implementation guidance, any surprises from the design phase]

## Implementation

[After completion: files changed, tests added, how acceptance criteria were verified]
```

---

## Next Steps for Legendarium Drafting

When drafting new stories for the legendarium:

1. **Identify the epic** it belongs to (use existing structure; create a new epic only for a major new portfolio)
2. **Name the story** clearly: `{epic}.{number}-{slug}` (e.g., `10.4-shared-m3-primitives`)
3. **Write the narrative:** 2–3 sentences, user story format
4. **List acceptance criteria:** 1–10 testable items; be precise (not "it works", but "show X when Y")
5. **Add context:** Why it matters, what blocks it, what it unblocks
6. **Sketch tasks:** Checkboxes that break the work into steps
7. **Set Status to Draft**
8. **Route to tech lead** for acceptance into Ready status
9. **Commit the doc** (don't stage code yet; this is the spec)

The specification is the deliverable *before* the code. The spec and code are verified together before a story closes.
