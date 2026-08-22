# Fix plan: no-hats design review findings (2026-08-22)

Fix the confirmed findings from the third adversarial review of the no-hats design
(`docs/ROLES_AND_GRANTS_PLAN.md`, Part A). Three independent reviewers — security, migration and
completeness — read the design in full against `origin/main` @ `f55143b`.

**These are design defects, not code defects.** Nothing here is implemented. Fix the design first;
each item below says what to change in the plan, and the ones that touch existing code say so
explicitly.

**What the review already settled, so nobody relitigates it.** The three defects that killed the
previous iteration are genuinely closed, verified by tracing the predicate rather than reading the
prose: the cross-tenant ROAS leak, the empty-`locations` wildcard inversion, and the rollback that
would have signed out every migrated user. The claim shape stays byte-identical, the grant is the
unit, entitlement is a single-grant conjunction, and global reach comes from the role. Do not
redesign any of that to fix what is below.

Ground rules, non-negotiable:
- **Fix the design, then the code.** A design change that makes an implemented story wrong is
  cheaper to find now than in a merge.
- Do not weaken a guard to make a fix easy. Fail-closed stays fail-closed.
- Where a fix touches code, red-green: write the failing test first, watch it fail, then fix.
- Story discipline per CLAUDE.md: stage the story doc with the code in the same commit.
- Gates: root `tsc --noEmit` + lint + vitest; `npm run check:functions` if `functions/` is touched;
  the full Angular gate if `web/` is touched. Only green output counts.
- **Read `docs/ROLES_AND_GRANTS_PLAN.md` §1 before starting.** `lib/auth/grants.ts` already exists on
  `claude/product-polish-assessment-d53e4e`, and several things this design proposes to build are
  already built there.

---

## Stream 0 — Gate the writers (do this first, it is real code and it is cheap)

**0.1 CRITICAL. The fixture that enforces the grant-ordering fix runs in no gate.**
The fix depends on two writers agreeing — `lib/auth/grant-store.ts` and
`functions/src/auth.ts#mergeGrants` — enforced by a shared ordered fixture. Half of it never
executes:

- `vitest.config.mts` excludes `functions/**` outright.
- `.github/workflows/ci.yml` has three jobs (`contracts`, `next`, `angular`) and no functions job.
- `npm run check:functions` is `build && lint`. No test.
- `functions/tsconfig.json` excludes `**/*.test.ts`, so the build does not typecheck them either.
- `functions/package.json` declares `"test": "vitest run"` but lists no `vitest` dependency; it
  resolves only from the root's hoisted `node_modules/.bin`.

A functions-side `mergeGrants` that drifts back to sorting ships green. This is CLAUDE.md's own
recorded failure repeating verbatim: *"Story 1.8 landed functions-side auth code against a green root
gate that proved nothing about it."*

Fix: add a `functions` CI job running build, lint and `vitest run`; add `vitest` to
`functions/devDependencies`; extend `check:functions` to include the tests.

**0.2 While you are in that file.** `npm run lint` is absent from the Next CI job behind a comment
citing 47 pre-existing errors. Those were cleared — lint is 0 errors on both configs. The comment is
stale; add the line and delete the comment.

---

## Stream 1 — The grant write path

**1.1 HIGH. A group move never revokes a global-role grant.** `removeGrants` must be called with
`{role: prior.role}` and no `locationId` when `prior.locations.length === 0`, and its matcher must
treat an absent `locationId` as "remove every grant with this role". Add a named regression test: a
user moved out of a `tag_exec` group must not retain global reach.

**1.2 HIGH. The canonical merge rule lets an add silently revoke locations.** On a match, union
rather than replace:
`merged[i] = {...gi, locations: [...new Set([...merged[i].locations, ...gi.locations])]}`.
Removal stays `removeGrants`' job. Add the mirror fixture case. Note this is the same family as the
existing fix plan's 2.1 (`mergeGrants` dropping admin-set scope/team on re-provision) — **fix both in
one pass, in `functions/src/auth.ts`, not twice.**

**1.3 HIGH. The absent-document seed is specified for one writer, and the runbook deploys the other
first.** State the seed rule for both. Functions seeds from `auth().getUser(uid).customClaims.roles`
inside the same transaction, and refuses on `grantsTruncated: true` with no document.

**1.4 HIGH. Monotonic `revoked_at` turns a 60-second cache flap into permanent dormancy.** Make
revocation the guarded direction, not clearing. Add `last_seen_at TIMESTAMPTZ`; revoke only when
`now() - last_seen_at > CLAIMS_TTL_MS`, updating `last_seen_at` on every read where the grant is
present.

**1.5 HIGH. `validateLocations` rule 1 makes `{tag_csm, []}` unwritable**, forcing admins to
over-grant CSMs. A CSM's book is dynamic (Firestore, not claims) — `lib/auth/session.ts:296-300`.
Exempt the roles whose access is dynamic: `EMPTY_LOCATIONS_OK = [...GLOBAL_ROLES, ROLES.TAG_CSM]`,
with a comment naming that line as the reason.

**1.6 Reconcile the claim byte limit.** The design argues a 900-byte budget; `lib/auth/grants.ts` on
the polish branch sets `CLAIMS_BYTE_LIMIT = 1000`. The design's reasoning is that
`functions/src/auth.ts` spreads existing claims onto the write while `setUserClaims` does not, so the
same grant list costs more from one writer. Settle it and cite the reason in the constant's comment.

---

## Stream 2 — Entitlement and context

**2.1 MEDIUM. The defect-1 regression test contradicts the code it guards.** A source-text assertion
is not a guard. Replace it with an ESLint `no-restricted-syntax` rule banning `heldRoles` as an
argument to the context minter, or restructure so the minter takes `ReadonlySet<Role>` and cannot
accept a session at all. Prefer the type-level version: it is the mechanism Story 7.6 already
established for `ScopeFilter`.

**2.2 LOW. The browser mirror of the impersonation pinning is missing.** `PermissionService.hasAnyRoleAt`
must treat `session.impersonation?.locationId === locationId` as `{tag_csm}`, mirroring the server
branch exactly, with a comment pointing at it. Cosmetic layer only — the server remains the authority
— but a nav that disagrees with the API sends people into 403s.

**2.3 LOW. `tenantExists` duplicates `tenantDocExists`.** Text change: call the existing one.

---

## Stream 3 — Tabs and the dashboard

**3.1 HIGH. The tab schema cannot distinguish a book tab from an unadopted tenant tab, and three
rules key off that distinction.** Add `kind TEXT NOT NULL CHECK (kind IN ('book','tenant'))` to
`dashboard_tabs`, set from the template at reconcile time and from the folded role's template kind in
migration 009. Scope the adoption step to `kind = 'tenant'`.

**3.2 HIGH. One unresolvable tab 403s the whole-config PUT**, so a single revoke makes the entire
dashboard read-only. An unresolvable `row.location_id` must be a **skip**, not a 403: the tab is
stored, the caller is not adding to it, and its widgets are already inert (`entitled: false` on read,
403 at the data endpoint). Validate only what is being added.

**3.3 HIGH. The PUT's null-context 400 precedes the retained-placement allowance**, so an unadopted
tenant tab cannot be edited at all. Move the retained-placement allowance above the `ctx === null`
check. That is what the design's own prose says the behaviour should be; the ordering contradicts it.

**3.4 MEDIUM. `freshnessByLocation` discloses per-tenant activity for locations the caller no longer
reaches.** Compute it only over locations where `resolveLocationContext` succeeds — those contexts
are already resolved for `availableWidgetsByTab`. Dormant tabs get `{timestamp: null, source: null}`.

**3.5 MEDIUM. `POST /api/dashboard/tabs` is a third writer of `location_id` with no specified
validation.** It must run `resolveLocationContext(session, locationId)` and 403 on failure.
`POST .../adopt` must validate the submitted id against the computed candidate set, not merely
against reachability.

**3.6 MEDIUM. The fold's refresh guard depends on a write-path contract nothing states.** Add
`updated_at = now()` as a `BEFORE UPDATE` trigger in the DDL rather than trusting the writer, and add
a runbook precondition asserting the expected row count before the final fold run.

**3.7 MEDIUM. Adoption with more than one candidate leaves a duplicate.** Skip reconciliation for any
`(role, location)` pair where an unadopted tab with the same `source_role` already exists, until that
tab is adopted or removed.

**3.8 MEDIUM. The reconciler can hard-fail the dashboard, and it runs on every read.** Use unqualified
`ON CONFLICT DO NOTHING`, and wrap the adopt-plus-reconcile block so a 23505 is caught, logged and
skipped, serving the read from whatever is already stored. A tab-seeding convenience must never be
able to take the dashboard down.

---

## Stream 4 — Sequencing

**4.1 HIGH. Story B removes the client's only location source four stories before its replacement.**
Either keep a Story-B-shaped `config/route.ts` that still returns a single `locationId` and delete it
in Story H, or move the tab work forward. As written there is a gap where the Angular client has no
way to name a tenant.

**4.2 At least four stories do not compile in the order given.** The per-site designs are right; the
story table does not carry them. Re-cut A / A2 / B / C against a dependency graph rather than by
topic, before writing any story doc.

**4.3 Answer the open question.** Between Story B and Story H, who sends `?locationId=` to
`/api/setter/dashboard`? It has a live Angular caller and no tab.

---

## Definition of done

Every finding is either fixed in `docs/ROLES_AND_GRANTS_PLAN.md` or listed in a final summary saying
which were deliberately not fixed and why. Stream 0 additionally lands as real code with green gates.
The design is not ready to implement from until Stream 4 is resolved, because the story order is what
an implementer follows first.
