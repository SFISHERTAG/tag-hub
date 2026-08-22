# Roles, grants and dashboards: the combined plan

**Status:** design and fix plan, reviewed, not implemented.
**Sources merged:** the no-hats design (three iterations, six adversarial reviews, read against
`origin/main` @ `f55143b`) and *Fix plan: branch review findings (2026-08-22)*, which targets branch
`claude/product-polish-assessment-d53e4e` @ `35fa08c`.

---

## 1. Read this first: the two halves are on different branches, and they collide

These documents were written independently, against different trees, and they overlap on the claims
write path. Merging them without reconciling that would have produced the same duplicate-build
failure this repo has already hit three times today.

### 1.1 The branch divergence

`claude/product-polish-assessment-d53e4e` is **9 commits ahead of `origin/main` and 0 behind**. It is
current and unmerged. It carries Stories 7.6 and 7.7, a metric registry, a scope guard, and the
cockpit theme work.

Files the fix plan assumes exist, checked against `origin/main`:

| File | On `main`? |
|---|---|
| `lib/auth/grants.ts` | **No** — only on the branch |
| `lib/sources/metric-source.ts` | **No** — only on the branch |
| `lib/dashboard/metrics.ts` | Yes |
| `lib/dashboard/scope.ts` | Yes |

### 1.2 What the no-hats design proposes to build that already exists

**This is the important part.** The no-hats design's Story A says "create `lib/auth/grants.ts`
(predicates, `GLOBAL_ROLES`)". That file already exists on the branch and already exports:

```
ScopeLevel, SCOPE_LEVELS          CLAIMS_BYTE_LIMIT = 1000
GrantValidationError              GrantInput, GrantClaim
normaliseGrants                   assertWithinClaimLimit
assertTeamUidsExist
```

Consequences that change the no-hats plan:

- **The claim-size preflight is already built.** No-hats §3 proposes measuring bytes and rejecting
  over budget. `assertWithinClaimLimit` does it. Note the two disagree on the number: the branch uses
  `CLAIMS_BYTE_LIMIT = 1000`, the design argued for a 900-byte budget because `functions/src/auth.ts`
  spreads existing claims while `setUserClaims` does not. **Reconcile to 900 and cite the reason, or
  document why 1000 is safe.**
- **`GrantValidationError` already exists**, and fix-plan 2.3 says only one of the three admin routes
  catches it. The no-hats admin work must not invent a second error type.
- **Scope and team are already written to the claim** (commit `35fa08c`, Story 7.7). No-hats treats
  `scope` as something to resolve per location; that resolution now has real data to read.
- **`ScopeLevel` is already defined four times** (fix-plan 5.1). No-hats adds per-location scope
  resolution on top. Consolidate first, then extend.

### 1.3 The sequencing consequence

**Land the branch before starting no-hats Story A.** Not because the branch is more important, but
because no-hats Story A creates a file that would conflict, and no-hats Story B builds per-location
scope on `ScopeLevel` definitions the fix plan is consolidating. Doing it in the other order means
resolving the same collision by hand in a merge.

Two findings appear in both documents and should be fixed once, in the fix plan, not twice:

| Finding | Fix plan | No-hats |
|---|---|---|
| `mergeGrants` loses admin-set scope/team on re-provision | 2.1 (worst finding) | Defect 2 area, §8 |
| `setCustomUserClaims` replaces all claims | 2.7 (decide, do not silently change) | §4 |
| `availableFor` advertises roles the adapter always rejects | 3.2 | Story A2, "registry truth" |
| `functions/` code is not covered by any gate | implied by 2.1's "run check:functions" | §10, and it is worse than implied |

---
## 2. The problem, and the live bug underneath it

Sometimes a CEO only needs CEO things. Sometimes the CEO is also the sales manager and one of the
closers. Sometimes the CSD is a working CSM. Closers need the tenants they are assigned to. A
salesperson must never see a ROAS widget; a CEO may hold sales widgets. Everyone should be able to
build their own dashboard tabs, and a new hire should get sensible prebuilt ones.

None of that works today, and the reason is sharper than "the model is wrong".

**Every client founder in production holds five roles and can reach exactly one of them, forever.**

- `functions/src/auth.ts:52-60` `clientOwnerGrants()` issues five grants to every provisioned
  founder: `client_owner`, `client_manager`, `client_closer`, `client_setter_manager`,
  `client_setter`.
- `switchRole` exists only in the `RbacService` interface, its three implementations, and specs. It
  is **never called from any component**. `web/src/app/layout/shell/shell.html` has zero references.
- So `resolveSession` is always called with `requestedRole === undefined`, and `currentRole` is
  permanently `availableRoles[0]` (`lib/auth/session.ts:185-187`).

The code even anticipates it. `functions/src/auth.ts:43-45` says `client_owner` is listed first
because "with no hat cookie set — exactly a new user's state — the app falls back to the first
available role. Reorder this and the founder's first ever screen is the setter view." The fallback
was designed. The UI to leave it never shipped.

A CEO who also closes already **has** the closer role. They cannot get to it.

---

## 3. The model

**The hat is replaced by the grant.**

A person is a set of `RoleGrant`s (`lib/auth/session.ts:25-36` — already the right shape). The grant
is the only object that carries a role and a set of locations *jointly*. Every authorization question
is therefore one of exactly two forms:

- **Reachability** — "may this person touch tenant Y at all?" Answered by the union of grants.
- **Entitlement** — "may this person read this thing at tenant Y?" Answered by finding a **single
  grant** `g` where `g.role` is in the allowed set **and** `g` covers Y.

That second rule is the whole design. It is called the **single-grant conjunction**, and product
decision 6 falls out of it with no allowlist to maintain: a salesperson holds no grant whose role is
in `spend_roas`'s `availableFor`, so they cannot reach ROAS at any tenant. A CEO who also closes
holds `client_owner` at their own tenant, so they can.

There is no active role, no role cookie, no `Session.currentRole`, and no object anywhere that holds
a role without also holding the locations it applies to.

**Why the old code accidentally worked:** `currentRole` pinned role and location to the same grant.
This design makes that coupling explicit and mandatory instead of accidental and unstated. That is
also why a naive "just union everything" fix is dangerous — see §5.

---

## 4. The claim shape does not change

```jsonc
{
  "roles": [
    { "role": "client_owner",   "locations": ["<locId>"], "scope": "tenancy" },
    { "role": "client_manager", "locations": ["<locId>"], "scope": "team" }
  ]
}
```

Same keys, same types, same meanings. `locations: []` means **no locations**, never "all".

This is the single most important decision in the document, and it exists to defuse rollback.
`parseRoleGrants` (`lib/auth/session.ts:90-121`) filters on `isRole(r.role) && Array.isArray(r.locations)`.
Any redesign that retypes `locations` — for instance a `tenancy: {all:true}` discriminant — drops
every entry, `roleGrants.length === 0`, and `resolveSession` returns `null`, which every gate reads
as signed out. **A rollback would sign out 100% of migrated users.** The second design proposed
exactly that and the migration reviewer caught it.

**Global reach comes from the role, not the claim.** `GLOBAL_ROLES = [TAG_EXEC, TAG_CSD, ADMIN]`,
byte-equivalent to the three hardcoded copies already live at `session.ts:196-202`, `session.ts:287-292`
and `api-session.ts:77-83`. This matters because `app/api/admin/users/_locations.ts:24` returns `[]`
for a blank admin textarea, and `lib/auth/groups.ts` `validateLocations([])` is a no-op. Today that
fails closed. Any design expressing the wildcard as `locations: []` would turn an ordinary admin
typo into "reaches every tenant".

**Size.** Firebase caps claims near 1000 bytes; budget 900. The founder claim issued today is 417
bytes. Three grants at one tenant is 251. A closer at three tenants is 140. Roughly 12
single-location grants fit. Beyond that the writer compacts same-role grants, then truncates to a
prefix and sets a `grantsTruncated` flag with the authoritative set in Firestore — degrading to
**fewer** grants, which fails closed, and which an old parser ignores entirely.

---

## 5. Per-location entitlement, and the leak it prevents

This is the part that took three attempts.

Union the locations and union the widget entitlement independently, and you get this:

1. U is CEO of firm X and also closes for firm Y. Grants: `client_owner@X`, `client_closer@Y`.
2. The union makes `ownsLocation(U, Y)` true. Correct — they do work there.
3. U puts a ROAS tile on a tab pinned to Y. Validation checks the **global** union, where
   `spend_roas` is entitled by the `client_owner@X` grant. Accepted.
4. The read resolves `locationId = Y` and calls `getDashboardAdRoas(Y)`.
5. **U reads firm Y's ad spend, revenue and ROAS**, holding only a `self`-scoped closer role there.

The five tenant-scoped widget endpoints under `app/api/dashboard/widgets/` take no scope filter at
all, so nothing downstream catches it.

**The fix is structural.** A `LocationContext` is minted per location:

```
grantCovers(g, L)  = GLOBAL_ROLES.includes(g.role) || g.locations.includes(L)
rolesAt(session,L) = { g.role : grantCovers(g, L) }
canUseWidgetAt(ctx, w) = availableFor(w) ∩ ctx.roles ≠ ∅
```

Because `ctx.roles` is *defined as* `rolesAt`, the set intersection is logically identical to the
single-grant conjunction. A consumer that trusts `ctx.roles` cannot widen it.

Traced against the exploit: `grantCovers(client_owner@X, Y)` is false, so `rolesAt(U,Y) = {client_closer}`,
which intersects `spend_roas`'s `availableFor` (`lib/dashboard/widget-definitions.ts:72`) to empty.
403.

**One trap worth recording.** The second design had a separate admission branch for global-role
holders that assigned *all* held roles, reintroducing the leak for a TAG CS Director who also owns a
client firm — the case `functions/src/auth.ts:73` explicitly anticipates. The design named that
hazard one sentence later to justify pinning impersonation, then committed it. The fix was to
**delete the branch**, not repair it: `grantCovers` already returns true for a global grant at every
location, so the ordinary path handles it. A repaired branch would compute the same value and invite
someone to simplify it back.

---

## 6. Dashboards

**One dashboard per person.** Tabs may hold widgets from any role held. `dashboard_configs` is keyed
`(uid, role)` today; it becomes tabs keyed on uid alone, and existing per-role layouts **fold into
tabs** rather than being discarded. A founder with three saved role layouts ends with three tabs.

**A tab may pin to a tenant.** That is what makes §4 enforceable — a tenant-scoped widget needs a
location, and the tab is where it comes from. Tenant tab titles are stored and user-editable; the
tenant *name* renders live from `getTenant`, so templates store `Owner`, not `{tenant} Owner`.

**Drag and drop is reorder-only.** `@angular/cdk` ^22.1.2 is already a dependency; nothing uses it
yet. Reordering today is `move(index, delta)` — up/down buttons, one step at a time.

The data question had to be forced. `WidgetPlacement` stores `position: {x, y}` **and**
`size: {cols, rows}`, but `dashboard-shell.html` renders with CSS grid auto-flow and span classes, so
`position` **is written and never read**. Array order decides placement. Below the breakpoint every
tile collapses to one column regardless of saved `cols`, so a 2D arrangement cannot be represented on
a phone at all.

**Decision: delete `position`, commit to ordered reflow.** Storing coordinates nothing honours is
what produced the current confusion. Reorder-only drag with `moveItemInArray`, a whole-tab PUT
re-validated per placement, keyboard reorder for accessibility, and the arrow buttons retained on the
picker. A security reviewer confirmed this cannot place an unentitled widget: even a cross-tab drag
is caught, because the destination tab carries its own `locationId` and each placement is re-checked
against it.

**Templates.** One per role. Granting a role adds its template as a new tab; existing tabs are never
modified. Idempotent on grant → revoke → re-grant.

---

## 7. Audit

Five sites write `actorRole: session.currentRole`. With no active role there is no obvious value.

**`actorRole` is written and never read.** `getAuditEvents` filters on `actorId`/`action`
(`lib/audit/store.ts:55-56`), `daysSinceLastAction` on `action` (`:64`), nothing displays it, and
`lib/onboarding/campaign-launch.ts:183` already writes the literal `"system"`.

Replacement: record the role of the grant that **authorised** the action. Strictly more accurate than
whichever hat happened to be active, and no schema change.

---

## 8. The sequence

Three techniques make the compile break tractable:

- **`currentRole` is deleted last, not first.** Story A adds `grants` beside it; each story removes
  readers; by the end its deletion is a pure removal. Deleting it first is a ~30-site rewrite and is
  the shape that failed review.
- **Every tenant-scoped gate goes per-location in one story, before anything widens.** An earlier
  split shipped union reachability while `canConfigureFollowUp` was still location-blind, leaving a
  cross-tenant **write** escalation live for a story's duration.
- **`hasAnyRole` is renamed, not just retyped**, so the compiler forces the *right* conversion at
  tenant-scoped sites rather than any conversion.

| # | Story | What a signed-in user experiences |
|---|---|---|
| 0 | Migration ledger (`008`), backfill 001-007, `docs/data-model.md` | Nothing |
| A | Grants on the session; `lib/auth/grants.ts`; reduced `SessionPayload`; delete dead `switchRole` and `POST /api/session/role` | Nothing. The deleted switcher had no caller |
| A2 | Registry truth: `scope` on both registries, the `kpi_summary` split, sales roles on pipeline/day-view, widget-parity check | **Salesperson/ROAS rule ships.** A closing manager stops seeing spend keys; `tag_sales` gets widgets for the first time |
| B | `location-context.ts` as the single tenant-scoped authority; convert every tenant-scoped gate together; `?locationId=` required | **The cross-tenant leak is closed here** |
| C | Union reachability; `Session.locations` → `reachableLocations` | A person granted at two tenants sees both in the portfolio for the first time |
| D | `hasAnyRoleAnywhere` at the remaining location-free gates | **The live bug is fixed.** A founder reaches all five grants. Nav items appear that never appeared |
| F | `validateLocations(locations, role)` rejects `[]` for non-global and non-`[]` for global | A blank locations textarea gets a 400 instead of a silently useless grant |
| G | Tables and fold (`009`), hand-applied; catch-to-empty replaced with a typed 503 | A transient DB error stops silently deleting layouts |
| H | Cut over to tabs; `?tab=` replaces `?locationId=`; per-tab entitlement | **One dashboard, one tab per old layout, arrangements preserved** |
| I | Grant store, reconciler, templates, admin add/remove | **A new role appears as a new tab.** An admin assigning a role stops silently revoking the others |
| J | Drag and drop | Ships last, deliberately: purely presentational, must not block a security fix |
| K | Delete `currentRole`, `availableRoles` and their mirrors | Nothing. Nothing has read them since D |
| M | Retire `ROLE_COOKIE` from the clear loop and delete the constant | Nothing |
| L | Drop `dashboard_configs` (`010`), only after H has been live long enough to trust | Nothing |

**There is no migration runner.** `docs/RESWEEP_DEPLOY_RUNBOOK.md` says so outright and
`cloudbuild.yaml` has no SQL step. Migrations are hand-applied via psql and nothing tracks what has
been applied — migration 006 already failed once on a clean sequential deploy. Story 0 adds a
`schema_migrations` ledger because this design adds three more migrations to a pile nobody is
counting.

---

## 9. Open findings against this design

The third design closed all three named defects — verified by tracing the predicate, not by reading
the prose. Reviewers then found ~22 new issues in the machinery it had to specify in detail. They are
implementation-level, not model-level, and are listed here as the implementation checklist.

**Security (4 high, 2 medium, 2 low)**
- A group move never revokes a global-role grant.
- The tab schema cannot distinguish a book tab from an unadopted tenant tab, and three rules key off
  that distinction.
- `validateLocations` rule 1 makes `{tag_csm, []}` unwritable, forcing admins to over-grant CSMs.
- One unresolvable tab 403s the whole-config PUT, so a single revoke makes the dashboard read-only.
- `freshnessByLocation` discloses per-tenant activity for locations the caller no longer reaches.
- `POST /api/dashboard/tabs` is a third writer of `location_id` with no specified validation.

**Migration (1 critical, 5 high, 8 medium)**
- **Critical, and it is not a design flaw:** the fixture enforcing the grant-ordering fix runs in no
  gate. See §10.
- The canonical merge rule lets an add silently revoke locations.
- The absent-document seed is specified for one of the two writers, and the runbook deploys the other
  first.
- Monotonic `revoked_at` converts a 60-second flap into permanent dormancy.
- Story B removes the client's only location source four stories before its replacement.
- The reconciler can hard-fail the dashboard, and it runs on every read.

**Completeness:** 34 of 36 earlier gaps closed and both contradictions gone, but at least four
stories do not compile in the order given. The per-site designs are right; the story table does not
carry them. Re-cut A/A2/B/C against a dependency graph before writing story docs.

---

## 10. The functions CI gap

Worth separating because it is real today, independent of this design, and cheap.

The grant-ordering fix depends on two writers agreeing — `lib/auth/grant-store.ts` and
`functions/src/auth.ts#mergeGrants` — enforced by a shared ordered fixture. **Half of that fixture
would never run:**

- `vitest.config.mts` excludes `functions/**` outright.
- `.github/workflows/ci.yml` has three jobs (`contracts`, `next`, `angular`) and no functions job.
- `npm run check:functions` is `build && lint`. No test.
- `functions/tsconfig.json` excludes `**/*.test.ts`, so the build does not even typecheck them.
- `functions/package.json` declares `"test": "vitest run"` but lists no `vitest` dependency; it
  resolves only from the root's hoisted `node_modules/.bin`.

So a functions-side `mergeGrants` that drifts back to sorting ships green. This is CLAUDE.md's own
recorded failure repeating verbatim: *"Story 1.8 landed functions-side auth code against a green root
gate that proved nothing about it."*

**Fix:** add a `functions` CI job running build, lint and `vitest run`; add `vitest` to
`functions/devDependencies`; extend `check:functions` to include the tests.

Also still open from the same family: `npm run lint` is absent from the Next CI job behind a comment
citing 47 pre-existing errors. Those were cleared — lint is 0 errors — so the comment is stale and
the line can go in.

---

## 11. What this does not solve

- **Deliberate narrowing.** Nobody can currently narrow their view anyway, because there is no
  switcher. Tabs replace it better, but "show me exactly what a closer sees" is not a feature here.
- **Support "view as".** Never existed. Tenant-level impersonation is separate and untouched.
- **The claim ceiling.** Raised well beyond any real customer, not removed. The overflow path
  degrades safely rather than eliminating the limit.
- **Two `requireApiRole` copies.** `app/api/admin/_lib/http.ts:149` and
  `app/api/dashboard/_lib/http.ts:149` are byte-identical duplicates. Both get edited; deduplicating
  them is separate cleanup.
- **Whether any of this works.** Nothing here has been implemented or run.


---

# Part B — Fix plan: branch review findings (2026-08-22)

Verbatim from the review of `claude/product-polish-assessment-d53e4e` (9 commits,
`55a7475..35fa08c`), preserved here because the original was an uncommitted file in a worktree.

Every finding was verified against the code with quoted lines. Re-read each cited site before
changing it; if the code has moved, re-verify the mechanism rather than pattern-matching the
description. Work the streams in order. Nothing here is user-reachable yet (no route reads a metric),
so fix before wiring, not after.

Ground rules, non-negotiable:
- Red-green: write the failing test that captures the finding FIRST, watch it
  fail, then fix. Several findings exist because a test pinned the happy path
  only (e.g. one 'showed' fixture).
- Do not weaken the guards to make fixes easy. Fail-closed stays fail-closed.
- Story discipline: these touch Story 7.6/7.7 files. Stage the story doc with
  the code in the same commit; the pre-commit hook enforces it. Add dated
  repair notes to `docs/stories/7.6-*.md` / `7.7-*.md` for what you change.
- Gates per CLAUDE.md: root `tsc --noEmit` + lint + vitest; `npm run
  check:functions` if functions/ is touched; full Angular gate if web/ is
  touched. Only green output counts.
- One commit per stream (or tighter). No `--no-verify`.

## Stream 1 — Metric semantics (lib/sources/metric-source.ts, lib/dashboard/metrics.ts)
Every registered metric currently computes a number that does not match its
name. Fix the semantics, not the labels.

1.1 `readOpportunities` fetches `{ status: "all" }` and `SourceRow` drops
status, so `pipeline_open_value` sums won/lost/abandoned monetaryValue and
`pipeline_by_stage` buckets dead deals. Add `status` to what the adapter can
filter on (either query with `status: "open"` for these metrics, or carry
status on SourceRow and filter in the metric via the query — prefer pushing it
into the SourceQuery so the recording-fake test can assert it, consistent with
the push-down principle in test/metric-scope.test.ts).

1.2 Silent truncation: `getOpportunities` caps at limit 100 and ignores
`meta.nextPageUrl` (declared in SearchResponse, never read). Implement
pagination in lib/ghl/opportunities.ts (follow nextPageUrl), or make the
adapter fail loudly on a full page rather than sum a clipped set. Silent
truncation is the confidently-wrong-number failure this registry exists to
prevent — do not leave it as a comment.

1.3 Stock vs flow: `pipeline_open_value` is a point-in-time stock, but the
opportunities dataset goes through `withinPeriod` on `createdAt`, so an open
deal created before period.from vanishes. Decide per metric whether the period
applies (open value: no period filter on createdAt; by-stage: same). The
adapter needs a way for a metric to say "current state" vs "events in period"
— add it to SourceQuery rather than special-casing a dataset.

1.4 `appointments_booked` counts every calendar event including cancelled /
noshow / invalid (readAppointments emits value:1 for all, status only in the
bucket which the scalar discards). Filter to statuses that mean "booked"
(decide: new+confirmed+showed?) and pin it with fixtures for cancelled and
noshow — the current test uses a single 'showed' fixture and catches nothing.

1.5 Ad spend window: `readAdSpend` reduces the period to a day count;
`lib/meta/ads.ts timeRange()` anchors at `new Date()`, so any historical
period returns the trailing window mislabeled as the requested one, and the
ad_spend branch skips withinPeriod so nothing can catch it. Two options:
teach lib/meta/ads.ts a real since/until range (Meta insights supports
time_range), or make readAdSpend REFUSE a period that is not "trailing N days
ending now" with a typed error, same refuse-don't-guess stance as
UnsupportedScopeError. Do not ship the mislabel.

1.6 Shared ad accounts: readAdSpend fetches per location with no dedup by
metaAdAccountId — two tenants sharing an account double the reported spend.
Dedup by account id across the queried locations. Also stop paying for the
trailing-7-day insights call (`spend7d`) this path discards.

1.7 NaN dates: `at: Date.parse(...)` with no validity check; NaN rows are
silently dropped by withinPeriod. Guard the parse: an unparseable date is a
loud error or a counted-and-logged exclusion, never a silent drop (repo error
contract: no error-as-empty).

## Stream 2 — Claims write path (lib/auth, functions/src/auth.ts, app/api/admin)

2.1 WORST FINDING: `functions/src/auth.ts` mergeGrants replaces a matched
grant with `{ ...grant }` and the functions-side RoleGrant type has NO team
field — re-provisioning (documented retry path) silently deletes admin-set
scope/team. Add scope/team to the functions RoleGrant type and make
mergeGrants preserve the existing grant's scope/team when the incoming grant
does not carry them. Note CLAUDE.md: functions/ must stay in sync with
lib/auth/session.ts claim shape — the file header says so. Test in
functions/ workspace; run `npm run check:functions`.

2.2 `lib/auth/admin.ts` userExists callback: bare `catch { return false }`
conflates transient Admin SDK failures with 'user does not exist', so an
outage blocks valid team writes with a message naming real uids as missing.
Rethrow unless `error.code === 'auth/user-not-found'` (copy the pattern from
functions/src/auth.ts ensureUser). While there: replace N getUser calls with
one `getUsers([{uid},...])` batch — it returns notFound directly.

2.3 Group routes: setUserClaims now throws GrantValidationError but only
app/api/admin/users/[uid]/role/route.ts catches it. groups/[groupId]/route.ts
and groups/[groupId]/members/route.ts surface it as a masked 500, and the
per-member Promise.all can partially write before a sibling rejects. Catch →
400 in both routes (share a helper with the role route), and validate ONCE
before the fan-out (normaliseGrants + size check are pure — run them on the
grant before mapping members) so identical-grant failures cannot be partial.

2.4 Ordering: `assignIndividualRole` runs `detachFromCurrentGroup` BEFORE
setUserClaims validation, so a rejected grant ('nothing was written') has
already removed the user from their group. Validate first (call the pure
normaliseGrants/assertWithinClaimLimit before detaching, or move detach after
setUserClaims succeeds). Add a test proving a failed validation leaves group
membership untouched.

2.5 Ghost team member: user-row seeds the team control from stored claim uids
but options come from the live directory — a deleted account becomes an
invisible, undeselectable value that 400s every save. In user-row, render a
chip/option for stored uids missing from peers() (labeled 'unknown user
<uid>') so it can be deselected; or drop-and-warn on reset(). Spec it.

2.6 `readScope` in the role route treats `''` as "clear" — for any
nonconforming caller that is a silent destructive clear where every other bad
value 400s. Delete the `''` branch; let it fall through to the 400. Then
simplify the Angular side: FormControl<ScopeLevel | null> with
[value]="null" for 'Role default', removing the '' sentinel and both
translations (finding: three encodings of one concept).

2.7 Decide (do not silently change): setUserClaims writes `{roles: grants}`
and setCustomUserClaims REPLACES all claims, wiping legacy keys
(scripts/create-user.mjs writes `{...customClaims, role}` and its users show
role:null in the directory, which reads only `claims.roles`). Either preserve
unknown claim keys read-modify-write style, or migrate: make user-directory
parse the legacy shape too (via parseRoleGrants — see 4.2), and update
create-user.mjs to write the roles-array shape. Pick one, document in the
story doc.

## Stream 3 — Boundary hardening (the 7.6 guarantee)

3.1 SourceQuery is unbranded+exported, requireTenancyScope checks only uids,
and the ad_spend path (getTenant → getAdSpend) has NO access check — unlike
opportunities/appointments which pass through ghl()'s requireLocationAccess.
Any server code can hand-write a query and read another tenant's spend. Brand
SourceQuery the way ScopeFilter is branded (unique symbol, scopedQuery as the
only minter, unsafeQueryForTests escape hatch mirroring unsafeScopeForTests),
and update the canary in test/metric-scope.test.ts (it hand-writes a query —
route it through the test constructor). This closes the bypass at the type
layer, same mechanism 7.6 already established.

3.2 availableFor mismatch: all three metrics advertise to CLIENT_CLOSER
(self) and CLIENT_MANAGER (team), whom the adapter always rejects. Until
Story 7.8 lands the uid mapping, narrow availableFor to the tenancy-default
roles (TAG_EXEC, TAG_CSM) with a comment naming 7.8 as what restores the
rest — an advertised widget that always errors is worse than an absent one.
Add a registry test asserting every metric's availableFor roles resolve (via
DEFAULT_SCOPE_BY_ROLE) to a scope the adapter accepts, so the mismatch cannot
recur when roles or datasets change.

3.3 The file-level `/* eslint-disable import/no-restricted-paths */` in
app/api/clients/_lib/client-record.ts and
app/api/clients/[clientId]/creatives/route.ts suppresses EVERY zone in those
files (all zones live under one rule id). Scope the disable to the specific
import lines (eslint-disable-next-line) so future violations still fire.

## Stream 4 — UI + theme

4.1 Material overlays (mat-select panels, mat-menu, mat-dialog) render
borderless on the new 1.06–1.26:1 fills; _theme.scss's own comment says any
surface on these tiers must draw a border. Fix once in _theme.scss via M3
token overrides for overlay containers (per CLAUDE.md: token overrides, no
::ng-deep, no !important; verify the token names against the installed
Material version's docs). Verify in the browser at mobile width: open the
role select and a dialog, screenshot.

4.2 hud-gauge: (a) at fraction 0 the round linecap renders a dot at the start
angle — draw nothing at zero (e.g. [attr.visibility] or skip the value circle
when fraction()===0); (b) the readout and aria-label print the RAW value, so
NaN renders 'NaN%' — display the clamped/sanitized value or an explicit
placeholder. Extend the spec: assert the readout text for NaN and the
no-value-circle-at-zero case (current tests only read stroke-dasharray).

4.3 Department dial lost the scoreTone red/amber/green signal (the removed
tile had tone: scoreTone(avg); HudGauge is always gold). Add an optional
tone/status input to HudGauge that switches the arc's token (still zero raw
hex — map tones to --mat-sys-* tokens in scss classes), and pass
scoreTone(summary.avgHealthScore) from the department widget. Also delete the
now-dead 'caution' member of the tile tone union and its scss rule.

## Stream 5 — Consolidation (single commit, mechanical)

5.1 ScopeLevel is defined 4x (grants.ts, scope.ts, session.ts inline
predicate, web model). Canonical home: lib/auth/grants.ts exports ScopeLevel,
SCOPE_LEVELS, isScopeLevel; session.ts parseRoleGrants and scope.ts import
them. The web copy stays (boundary) but add a drift test in the root suite
comparing the web file's literal to SCOPE_LEVELS (precedent:
test/field-catalog-drift.test.ts).

5.2 user-directory.ts hand-copies parseRoleGrants' tolerant parsing while the
export's doc says only the test may import it. Resolve the contradiction: let
user-directory call parseRoleGrants (it becomes the shared claims reader; fix
the doc), which also gives the directory the legacy-shape branch for free
(see 2.7). Collapse GrantClaim to RoleGrant (structurally identical; three
names for one shape).

5.3 BUNDLED_WIDGET_METRICS is all-null machinery; isValidInstance is
production-dead. Either wire isValidInstance into the future saved-dashboard
resolution path NOW (a stub that the widget endpoint will call), or simplify
the map to a documented readonly id list with the WIDGET_REGISTRY sync test
kept. Don't leave a validator only tests run.

5.4 check-story-status.mjs and eslint.config.mjs each encode the integration
path map; they drifted in unison once already (that's why this branch exists).
Extract one shared manifest (a small .mjs both import, or JSON) and make both
read it.

Out of scope, do not do here: Story 7.8 (uid mapping), Meta credentials, the
overview-tab race is IN scope though — add the requestId guard copied from
clients-book.ts (private requestId=0; capture ++this.requestId before await;
bail if changed after), and make the effect track only the id (computed(() =>
this.client().id)) so unrelated client-field refreshes stop re-firing it.
[That belongs to Stream 4; treat it as 4.4.]

Also fix while passing (low risk, note in commits): em dashes in the two
runtime error strings in lib/auth/grants.ts (CLAUDE.md: no em dashes — the
rule is dead in docs but these are user-facing strings; use a comma or
period); the orphaned doc comment in lib/ghl/opportunities.ts:87.

Definition of done: every stream's findings have a failing-then-passing test,
all gates green, story docs updated in the same commits, and a final summary
naming any finding you decided NOT to fix and why.


---

## Appendix: where the underlying analysis lives

The full third-iteration no-hats design (138k chars) and all six review documents are in
`/tmp/nohats/`, which is **ephemeral**. If that analysis is worth keeping beyond this document, it
needs committing somewhere durable.
