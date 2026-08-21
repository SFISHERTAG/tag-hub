# Angular migration — execution plan and per-feature runbook

**Companion to Epic 10 in `docs/epics.md`.** That epic says *what* the migration is and why.
This says how it gets executed, in what order, and — the part currently missing — how it
becomes estimable.

---

## 1. Where this actually stands (measured, not asserted)

| | Count |
|---|---|
| Angular files in `web/src` | 54 |
| **Angular components** | **0** |
| Next pages | 33 |
| Next `.tsx` components | 114 |
| Next API routes | 25 |
| `use server` action files | 13 |
| Epic 10 stories done | 0 of 7 (10.1 and 10.3 In Progress) |

Everything in `web/src` today is plumbing: config validation, three route guards, the HTTP
layer and interceptors, session/role/api-result models, RBAC services. **Not one screen has
moved.** That was the correct order — 10.1 is deliberately feature-free, and the constraints
it makes enforceable were free to fix at twelve files and expensive after fifteen features.
But it means the visible work is entirely ahead.

### The multiplier that makes this bigger than "port 33 pages"

Epic 10 states it and it is the single most important fact here: **39 exported Server Actions
across 21 files have no HTTP equivalent**, and **24 of 25 data-reading pages import `lib/`
directly inside a React Server Component**. An Angular SPA can do neither — it talks HTTP.

So the unit of work is not a screen. It is *an endpoint that does not exist yet, plus the
screen that consumes it, plus the deletion of the Next page it replaces.* Roughly double the
surface a page count suggests.

---

## 2. The plan's first job is to make this estimable, not to estimate it

No feature has gone end to end, so there is no per-feature cost, so any date is arithmetic on
a guess. Fix that before planning around it.

**Story 10.4 is the calibration story.** It is the first that ships real screens (shared M3
primitives, portfolio, bug reports). Run it as a measured pass and record four numbers in its
story doc:

1. Endpoints built, and hours on them
2. Screens ported, and hours on them
3. Hours on the shared primitives — one-time cost, not repeated
4. Defects found after the gate passed

Subtract (3) as one-time. What remains is the per-feature cost, and multiplying it across 10.5,
10.6 and 10.7 is a defensible estimate. **Do not commit to a completion date before 10.4's
numbers exist.** Every estimate offered before then is invented, including any produced by an
agent that sounds confident.

### Order, and why

| Story | Why here |
|---|---|
| 10.1 Contract hardening | Free now, expensive later. Finish it. |
| 10.2 Real session wiring | Highest risk, and the only genuinely **net-new** work — the Google Identity Services button has no Next implementation to port. New work estimates worse than porting; get its uncertainty out of the way early. |
| 10.3 Shell and navigation | Everything after it renders inside it. |
| **10.4 Primitives + portfolio + bug reports** | **Calibration.** First real screens. Measure here. |
| 10.5 → 10.7 | Now estimable. Parallelisable, under §4's rules. |

---

## 3. Per-feature runbook

Every feature story from 10.4 onward runs these steps in this order. Deviating is what
produces a screen that exists in two places and a defect fixed twice.

1. **Inventory the feature's server surface.** List every Server Action and every direct
   `lib/` import in the Next pages being replaced. That list *is* the endpoint spec.
2. **Build the endpoints in `app/api/**` first.** Next stays the API host serving the Angular
   bundle same-origin — `hub_session` is httpOnly SameSite=lax and only survives that topology.
3. **Re-check authorisation server-side in every endpoint.** A guard decides what renders; the
   API decides what is reachable. Route guards are cosmetic and say so in their own comments.
4. **Port the screens**, consuming only those endpoints. No `lib/` import reaches the browser.
5. **Run the gate**: `ng build --configuration production`, `ng test --watch=false`, `ng lint`,
   plus `npm run check:functions` if the story touched `functions/**`.
6. **Delete the replaced Next pages in the same commit** and point the route at Angular. A
   screen exists in exactly one place, or it will drift.
7. **Update the story's Status and Tasks in that same commit.** The pre-commit hook enforces it.
8. **Record the four calibration numbers** in the story doc.

**Definition of done for a feature is step 6, not step 5.** A passing Angular screen with the
Next page still present is not progress; it is two implementations of one feature.

---

## 4. Rules that exist because these failures already happened

**One story, one worktree, explicit file ownership.** `hotpath/context.md` records ten parallel
sessions on one tree building the same feature twice. This repo hit a smaller version of it on
2026-08-20: two agents on `onboarding-intake-wizard-scaffold` while main moved 18 commits
underneath, producing a 110-conflict merge. That is survivable at two agents and will not be at
fifteen feature stories. Any story touching a shared module (auth, session, a shared type) runs
in its own worktree with a deliberate merge step, or runs serialised.

**Rebase on main before starting a story, and before merging it.** The 18-commit divergence was
avoidable and cost more than the feature work in that merge.

**Never trust a doc's claim about code without checking the code.** On 2026-08-20 Epic 10 was
read as saying `MockRbacService` is provided unconditionally and both guards fail open in
production. `app.config.ts` already reads
`isDevMode() ? MockRbacService : HttpRbacService`, and both guards deny by default. The epic
text was stale, and repeating it produced a false security claim. Any doc statement that
asserts current code behaviour is either verified at point of use or rewritten to say when it
was true.

**Prefer a check over a promise.** The stale claim above would have been caught by a test
pinning the production provider. Where a doc asserts a security property, add the assertion.

---

## 5. Immediate next actions

0. ~~**Fix Node on the dev machines.**~~ **Done 2026-08-20 (Story 11.1).** Angular CLI
   requires Node `v22.22.3` / `v24.15.0` / `v26.0.0`; the machine ran `v24.14.0`, one patch
   short, so `ng build`, `ng test` and `ng lint` all refused to start and `web/**` changes
   were landing with their own gate never executing. Now on `24.19.0`, pinned in `.nvmrc`
   with both `package.json` files declaring the supported range.

   **What running the gate immediately found:** four lint errors
   (`no-non-null-assertion`) in `app.config.spec.ts` — code committed the previous hour as
   verified, because the only verification available at the time was a typecheck. The gate
   caught them on its first execution. Full gate now green: production build clean, lint
   clean, 118 tests across 13 files, and the provider-pinning spec confirmed to genuinely
   execute by injecting a failure and watching exactly one file go red.
1. **Correct Epic 10's 10.2 paragraph** — it describes a fixed fail-open as current.
2. **Add a spec pinning the production RBAC provider**, so the property is enforced rather than
   described. Nothing in `web/src` currently tests it.
3. **Finish 10.1**, then **10.2** — highest risk and the only net-new work.
4. **Run 10.4 as the calibration story** and record its four numbers.
5. **Only then** put a date on the migration.

---

## 6. What would move the date more than effort will

- **10.2's net-new work.** Porting is predictable; building the Identity Services button is not.
- **Collisions.** Rework from parallel sessions is invisible in a plan and expensive in reality.
- **Endpoint count, not screen count.** If the 39-action figure grows as features are inventoried
  in step 1, the estimate moves with it. Track the real number per story.
- **Scope added mid-migration.** Every new feature built in Next during the migration is a
  feature that must then be migrated. Feature work and migration work compete for the same
  people; decide that explicitly rather than discovering it.
