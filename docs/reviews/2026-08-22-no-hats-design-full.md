<!--
Source material, kept deliberately.

This is the full third-iteration no-hats design, as produced and as reviewed. The distilled version
that people should read first is docs/ROLES_AND_GRANTS_PLAN.md Part A; the open findings against this
document are docs/reviews/2026-08-22-no-hats-design-fix-plan.md.

It is committed because the summary is not implementable on its own. This carries the DDL, the exact
function signatures, the per-call-site conversion table and the worked byte counts. It also carries
the reasoning for choices the summary only states, including several alternatives that were
considered and rejected for reasons worth not rediscovering.

Read the fix plan before implementing from this. Roughly 22 findings are open against it, four of
them affecting the story order, and the design is not implementable until those are resolved.
-->

Source verified at `origin/main` = `f55143b`. Producing v3.

---

Verified: `origin/main` is `f55143b`; the working checkout is `3d3e059` on `onboarding-intake-wizard-scaffold`. Every citation below was re-read from `origin/main` via `git show`, including the ones v2 and the three reviews assert. Where a review's own citation was wrong, v3 uses the correct one and says so.

---

# DESIGN v3: REMOVING HATS

**Outcome:** a person becomes a set of role grants, and every entitlement is answered by naming a location and finding the single grant that satisfies both halves of the question. **Driver:** `resolveSession` pins `currentRole` to `availableRoles[0]` forever (`lib/auth/session.ts:185-187`) because `switchRole` has no caller, so every founder provisioned by `clientOwnerGrants` (`functions/src/auth.ts:52-60`) holds five grants and reaches one. **Next action:** land Story A (additive `Session.grants`, the predicate module, the reduced wire shape) and Story A2 (registry truth), because Story B's single entitlement authority reads both.

---

## 0. WHAT CHANGED FROM v2, AND WHY

v2 was reviewed three times against the source. The reviewers confirmed the claim shape is unchanged and that this defuses the rollback blocker; that the grant is the unit and entitlement is a single-grant conjunction; that the wildcard lives on the role and not on the claim; that `actorRole` is write-only; and that reorder-only drag with a re-validated whole-tab PUT is sound. **All of that is preserved here unchanged and is not re-argued.** What follows is the list of everything that is different, so a reviewer can orient in one page.

### 0.1 The three named defects

| Defect | Where v2 broke | Where v3 fixes it |
|---|---|---|
| **1 (security, HIGH).** The `holdsGlobal` admission path set `LocationContext.roles = heldRoles(session)`, carrying a `client_owner` grant held at X into tenant Y — the exact hazard v2 names one sentence later to justify pinning impersonation. | v2 §5.2 | **§5.2.** The global branch is **deleted, not repaired.** There are now exactly two admission paths, and neither can produce a cross-location role set. A global-role holder is admitted through the ordinary covering-grant path, because `grantCovers` already returns true for a global grant at every location. `heldRoles` is banned from `resolveLocationContext` structurally (branded type, single minter) and by a named regression test. |
| **2 (migration, HIGH).** The grant writer re-sorted by `ROLE_LIST`, flipping `roles[0]` for any founder who also holds a staff role. On rollback, `resolveSession` (`session.ts:185-187`) pins to the staff grant: their own tenant becomes unreachable and their saved layout reads as deleted. v2 also mis-cited `functions/src/auth.ts:41-45` as precedent for a sort. | v2 §2.3, §3, §10.2 | **§10.3**, with knock-on edits to §2.3 and §3. The writer is **append-only and order-preserving**, byte-for-byte the rule `functions/src/auth.ts#mergeGrants` already uses. Compaction merges into the first occurrence's position. Truncation keeps a prefix of the *stored* order, not a `ROLE_LIST` order. Grant **order** is asserted in the shared fixture. The miscitation is corrected in §3 and §10.3: `functions/src/auth.ts:43-45` is a first-screen decision about one literal array, not a sort rule. |
| **3 (completeness).** Missing call sites, two incompatible entitlement APIs, an unimplementable Story B, a fold that collides with its own reconciler, and registry corrections belonging to no story. | throughout | Mapped item by item in §0.2. |

### 0.2 Every completeness gap, and the section that closes it

| Gap (review-completeness) | Resolution | Section |
|---|---|---|
| `lib/auth/session-payload.ts` absent; its comment at `:48-51` refuses to send grants to the browser | **Refusal overturned, with a reduced wire shape.** `grants` ships as `{role, locations}` only — no `scope`, no `team` (no other person's uid). Global grants are **expanded server-side** on the wire, so the browser never learns `GLOBAL_ROLES` | **§4.5** |
| `?tab=` vs `?locationId=` — two APIs specified | **One at a time.** `?locationId=`, required, from Story B. `?tab=` from Story H, and Story H **deletes** `?locationId=`. Both are safe under the conjunction; the choice is about the honesty of the tab strip | **§5.3, §8.4** |
| Story B impossible for global-role holders (`grant.locations[0]` is `undefined` for `locations: []`) | Story B **never derives a location from a grant.** The location is a required request parameter. The `grant.locations[0]` mechanism is deleted from the design | **§5.3, §11.2** |
| Story B's claimed CSM/TAG_GROWTH behaviour has no mechanism | Deleted. TAG_GROWTH is an ordinary optional location id; a CSM's tiles read the tenant they name | **§5.5, §11.2** |
| Fold and reconciler collide on `uq_dashboard_tabs_grant` | Fold sets `source_role` on the **first page only**; extra pages become user-made tabs. Adoption runs **strictly before** reconciliation in one transaction. The index is kept, and is what makes the reconciler's insert a no-op | **§8.5, §9.3** |
| `resolveLocationContext` and `requireWidgetAt(session, …)` cannot both be the authority | `LocationContext` is the sole authority for every tenant-scoped question. `requireWidgetAt` takes a context, not a session. This also un-breaks impersonation | **§5.2, §5.3** |
| Registry corrections belong to no story | New **Story A2, "Registry truth"** | **§5.5, §11.2** |
| `app/api/setter/dashboard/route.ts:55` | Required `?locationId=`, routed through `resolveLocationContext`. Story B | **§4.2, §5.3** |
| `app/api/clients/route.ts:56` (sixth `loadClientBook` caller) | `loadClientBook` takes a resolved **role**, not a grant, so a route with no widget can supply one. Gate returns it | **§5.3** |
| `flow-framework.ts:72, 76, 78` | `:72`'s arbitrary `locations[0]` becomes an explicit org selector; `:76,78` become `hasAnyRoleAnywhere` (cosmetic layer) | **§4.2** |
| `has-permission.directive.ts:24, 29-30` | `hasAnyRoleAnywhere`, plus an optional `[hasPermissionAt]` input for the per-location form | **§4.2, §4.5** |
| `app/api/session/role/route.ts:65-72` impersonation close | Confirmed: three other closers remain, and the condition that required this one cannot occur once hats are gone | **§5.3** |
| `dashboard_prefs.active_tab_id` written by nothing | `PUT /api/dashboard/prefs`, validated against the caller's own tabs. No backfill | **§8.2** |
| Response `locationId` / `lastUpdated` | Replaced by `tabs[].locationId` and `freshnessByLocation`, one lookup per distinct location | **§5.3** |
| `layout-edit.ts:76-77`, `dashboard-customize.ts:130` `toggleWidget(available, …)` | Takes the tab's own list from `availableWidgetsByTab[tab.id]` | **§5.3** |
| `canConfigureFollowUp` (`app/api/ghl/_lib/gate.ts:81-83`) | Takes the `LocationContext`. Ships in the **same story** as the reachability widening at those routes, closing the live escalation window | **§4.2, §11.2** |
| `CROSS_BOOK_ROLES` at `client-book.ts:64-65, 70-71` | Same resolved-role parameter as `loadOwnBook` | **§5.3** |
| `ROLE_COOKIE` removal from the `clearAuthCookies` loop had no predecessor story | Story K keeps it; **Story M** removes the loop entry and the constant together | **§3, §11.2** |
| Reconciler `tab_id` generation, and its `position` | `source_role || ':' || COALESCE(location_id,'-')`; position `MAX(position)+1` inside the same transaction | **§9.3** |
| What `GET /api/dashboard/config` returns on a Postgres failure | Typed **503**, never a 200 with a synthesised default | **§8.1** |
| Tenant tab title: stored or rendered | `title` stored and user-editable; tenant **name** rendered live from `getTenant`. Templates store `Owner`, not `{tenant} Owner` | **§8.4, §9.2** |
| What is migration 009 | Renumbered contiguously: 008 ledger, 009 tabs+fold, 010 drop | **§11.1** |
| How Angular gets `GLOBAL_ROLES` | **It does not.** The server expands global grants on the wire and the guard's hardcoded three-role branch is deleted, so no fourth copy is created | **§4.5** |
| Where `user_grants` gets documented | Story I names `docs/data-model.md`, **and** extends `check-story-status.mjs`'s Check 3 path list so the next one is caught mechanically | **§10.2, §11.2** |
| Story 0 stages `functions/sql/`, so it needs `docs/data-model.md` | Stated in the story row | **§11.1, §11.2** |
| M3: `grantsTruncated` needs `user_grants/{uid}`, absent until Story I | The overflow path **ships with Story I**. Before it, no writer can exceed the cap | **§2.3** |
| M2: the ledger argues against the second fold run it mandates | Different questions, different records. The ledger answers "was this file applied"; the **runbook** answers "did the pre-cutover re-run happen". `docs/RESWEEP_DEPLOY_RUNBOOK.md` is edited by Story G | **§11.1** |
| Founder tab count never stated | Stated, and reduced: the reconciler **does not create a tab for a role whose template is empty** | **§9.2, §9.3** |
| No keyboard path on the new drag surface | Arrow-key reorder on the grid, same `moveItemInArray` implementation as the buttons and the drag | **§8.3** |
| `onboarding/checklist/route.ts:92` `isClientUser(currentRole)` | `!hasAnyRoleAt(session, locationId, ONBOARDING_WRITE_ROLES)` | **§4.2** |
| `session-payload.ts:26, 60` — the wire contract Story K must change | §4.5, and the Angular bundle is staged into the Next image so there is no skew window | **§4.5** |

### 0.3 Changes v3 makes that no reviewer demanded, and why they are here

Four, each because leaving it would make a fix above incoherent rather than merely incomplete:

1. **The read filter stops authoring deletions** (§8.1, §5.3). v2's read-time entitlement filter plus `dashboard-customize.ts:150-181`'s save-on-every-click destroys dormant and unadopted tabs. The dormant-tab guarantee in §9.3 is unsatisfiable without this, and §9.3 is load-bearing for product decision 4.
2. **Stories B, C and D are re-cut** (§11.2). v2 shipped the reachability union at the GHL family a full story before their role gates became per-location, which is a live cross-tenant *write* escalation. The re-cut is forced anyway by Story B's location source changing.
3. **`validateLocations` also rejects a non-empty `locations` on a global role** (§4.4). v2 asserted role assignment is where the scrutiny lives while leaving a field that looks like a restriction and is discarded. Two lines, same function.
4. **`grant-store` treats an absent `user_grants/{uid}` as unknown, not empty** (§10.2). `functions/` deploys separately from Cloud Run (`functions/package.json` `deploy:phase1|2|3` vs `cloudbuild.yaml`'s single service), so the two-deploy gap otherwise wipes a founder's five grants with the very code written to stop that.

Everything else in v2 stands.

---

## 1. THE MODEL IN ONE PARAGRAPH

The hat is replaced by **the grant**. A person is `RoleGrant[]` (`lib/auth/session.ts:25-36`, already the right shape), and the grant is the only object in the system that carries a role and a set of locations *jointly*. Every authorization question is asked in one of exactly two forms: a **reachability** question ("may this person touch tenant Y at all"), answered by the union of grants, and an **entitlement** question ("may this person read this thing at tenant Y"), answered by finding a **single grant** `g` such that `g.role` is in the allowed set **and** `g` covers Y. There is no active role, no role cookie, and no object anywhere that holds a role without also holding the locations it applies to — including, in v3, the `LocationContext` that answers the entitlement question. Product decision 6 ("a salesperson never reaches a ROAS widget, a CEO may hold sales widgets") then needs no allowlist maintenance: it falls out of `availableFor` plus the single-grant conjunction. The reason the old code accidentally worked is that `currentRole` pinned role and location to the same grant; this design makes that coupling explicit and mandatory instead of accidental and unstated.

---

## 2. THE CLAIM SHAPE

### 2.1 The shape

**Unchanged.** The claim stays exactly what `parseRoleGrants` already reads (`lib/auth/session.ts:90-121`):

```jsonc
{
  "roles": [
    { "role": "client_owner", "locations": ["<locId>"], "scope": "tenancy" },
    { "role": "client_manager", "locations": ["<locId>"], "scope": "team" }
  ]
}
```

`role` is a `Role`. `locations` is an array of location ids and **`[]` means no locations**, never "all". `scope` and `team` are optional and per grant. No key is removed, no key is retyped, no key changes meaning, **and no key changes position** (§10.3). The only addition anywhere in this design is one optional top-level boolean, `grantsTruncated`, described in 2.3, which an older parser ignores entirely.

**Rejected alternative:** a discriminated `tenancy: {all:true} | {locations: string[]}` on the grant. It is a cleaner type, and it is a retype of an existing key. `parseRoleGrants` filters on `Array.isArray(r.locations)` (`session.ts:95`), so on rollback every entry is dropped, `roleGrants.length === 0`, and `resolveSession` returns `null` (`:181`), which is a signed-out user. That is M3 firing at 100%. Rejected on that ground alone.

**Rejected alternative:** `allLocations?: true` on the grant as the wildcard. It is M3-safe (an old parser ignores it and reads `locations: []` as "reaches nothing", which fails closed). It is rejected in §4.4 for a different reason: it creates a second, independently-settable way to say "every tenant", with no role-level backstop when it is set by mistake.

### 2.2 Worked examples, with byte counts

Location ids are assumed 24 characters (`isValidLocationId` allows 1 to 128, `lib/ghl/tenants.ts:33-35`). Counts are `Buffer.byteLength(JSON.stringify(claims))` of the whole claims object, **recomputed** — v2's figures were computed against a 22-character id described as 24, so every one of them was low.

**(a) A CEO who is also sales manager and closer at one tenant.** Three grants, one location, `scope` on each: **257 bytes.**

**(b) A closer assigned to three tenants.** One grant naming three locations: **131 bytes.** The same access as three separate single-location grants: **209 bytes.** Both parse identically; the merge rule in §10.3 produces the three-grant form because it keys on role and location overlap, and the compaction rule in 2.3 collapses same-role-same-scope grants into the 131-byte form when the budget is tight.

**(c) A TAG exec.** `{"roles":[{"role":"tag_exec","locations":[]}]}` is **46 bytes**, exactly what `promoteToExec` writes today (`lib/auth/admin.ts:155-157`). Global reach comes from the role, not from the array (§4.4), so this claim needs no edit and no migration.

**The live load case.** `clientOwnerGrants` with all five roles and their scopes (`functions/src/auth.ts:52-60`) is **427 bytes** — 47% of the 900-byte budget in 2.3. It is unchanged by this design, because the shape is unchanged.

**Capacity.** Marginal cost is roughly 66 bytes per single-location `client_closer` grant (more for longer role names, up to ~80) and 27 bytes per extra location id inside a grant. **12 single-location `client_closer` grants is 803 bytes; 13 is 869**; both fit. Every user shape this product actually issues is well inside that. These figures are given because the overflow path in 2.3 needs a trigger point, not because they are load-bearing — the structural conclusion is only that the founder claim sits at under half the budget.

### 2.3 What happens when the cap is exceeded

Firebase rejects the write. `setUserClaims` (`lib/auth/admin.ts:140-150`) currently writes `{roles}` and drops every other claim, while `grantRoles` in `functions/` spreads the existing claims (`functions/src/auth.ts:127-130`), so other keys can be present. Budget **900 bytes**, not 1000.

**This path ships with Story I and not before.** Until Story I there is no writer that can exceed the cap: `setUserClaims` writes exactly one grant, and `clientOwnerGrants` writes five. v2 described the overflow path in §2 and created its authoritative store in §11's Story I, which the completeness review correctly called a disagreement between two sections. There is one story now.

The projection step in the grant writer (§10.2) does this, in order:

1. **Compact.** Merge grants that share `(role, scope, team)` into one entry with a combined `locations` array. Case (b) goes 209 to 131 bytes with no semantic change. **The merged entry occupies the position of the first occurrence**, and later occurrences are removed; nothing else moves. This is what keeps compaction order-preserving (§10.3).
2. **If still over budget, prefix-truncate and flag.** Write the authoritative full set to Firestore `user_grants/{uid}`, then set the claim to the **longest prefix of the stored order** that fits in 900 bytes, plus top-level `"grantsTruncated": true`. When it fits, write `"grantsTruncated": false` explicitly rather than omitting the key.
3. `resolveSession` reads `grantsTruncated` and, when true, loads the authoritative set from `user_grants/{uid}`.

**Prefix, not `ROLE_LIST` priority.** v2 kept the longest `ROLE_LIST`-ordered prefix, which drops the narrowest grants first and, for a founder, drops exactly the grants tied to day-to-day tenant work. Worse, it can drop the *first* grant, which changes `roles[0]` and reintroduces defect 2 through the back door. Prefix truncation of the stored order cannot change `roles[0]` unless the claim cannot hold even one grant, which is impossible at 900 bytes. **Rejected alternative:** drop by narrowest role first. It reads fairer and it is exactly the rollback hazard §10.3 exists to close.

**Truncation is chosen over refusal.** Refusing the write ("this person holds too many grants") leaves an admin with a legitimate case (a closer covering 15 tenancies) with no path forward. Truncation degrades to **strictly fewer grants**, which is fail closed, and the flag makes the degradation recoverable rather than silent. An old build reading a truncated claim sees a valid, non-empty, narrower `roles` array beginning with the same entry it always began with: reduced access, never a sign-out.

**The flag must never stick.** `setUserClaims` drops other claims and `functions/src/auth.ts:127-130` preserves them, so a `true` written by one writer can survive a later full write by the other. Both writers therefore set the flag **explicitly, in the same `setCustomUserClaims` call that writes `roles`**, to `true` or to `false`. Nothing omits it.

**The Firestore read needs its own cache, and it is new work.** `getLiveClaims` (`lib/auth/admin.ts:116-123`) caches Firebase **Auth** claims, not Firestore documents; v2's "the same 60-second cache path" does not exist. Story I adds `lib/auth/grant-store.ts#getAuthoritativeGrants(uid)` with its own 60-second `Map` cache, invalidated by the same `invalidateClaimsCache(uid)` call (`admin.ts:131-133`) so the two never disagree on the instance that wrote. For everyone else the flag is `false` and the document is never read.

---

## 3. CLAIM COMPATIBILITY AND ROLLBACK (answers M3)

**Does the shape change? No.** Every key in `roles[]` keeps its name, its type, and its meaning. The wildcard is not expressed on the claim at all (§4.4). **Does the content change? Only additively, and never in position** (§10.3). Both halves are required: v2 established the first and argued from it as though it were the second, which is the defect §10.3 closes.

Consequences, stated so a reviewer can check them:

- **`parseRoleGrants` needs no edit to accept the new world.** Old claims parse under new code; new claims parse under old code. There is no version skew window.
- **Rollback of any story is not a sign-out, and is not a re-pinning either.** Roll back to a build that still reads `currentRole` and `resolveSession:185-187` finds `roles[0]` exactly where it always was, because **no writer in this design reorders `roles`**. The rolled-back build restores the pre-existing "pinned to your first grant" behaviour, which is the bug, not a new failure.
- **The precedent v2 cited does not exist, and v3 does not repeat it.** `functions/src/auth.ts:43-45` says `client_owner` is first because "with no hat cookie set — exactly a new user's state — the app falls back to the first available role. Reorder this and the founder's first ever screen is the setter view." That is a first-screen decision about the literal order of one array in one function. It is not a `ROLE_LIST` sort, and it is not evidence that a sort is safe. It is, however, direct evidence that the order of `roles` is load-bearing under any build that still reads `currentRole` — which is every build this rollout can roll back to.
- **The only new claim key is `grantsTruncated`, top level.** `parseRoleGrants` reads `claims.roles` and nothing else (`session.ts:92, 113`), so an old parser never sees it. An old build reading a truncated claim gets less access, never zero.
- **The claim is read live, not from the cookie** (`session.ts:169-176`), cached 60 seconds (`admin.ts:105`). Any claim rewrite propagates to every signed-in user within 60 seconds without a sign-out, in both directions. There is no cookie to re-issue.
- **The wire contract changes, but atomically.** `npm run build` is `web:build && stage-angular-bundle && next build` (`package.json:10`), so the Angular bundle and the Next server ship as one image and one Cloud Run revision. A `SessionPayload` change (§4.5) cannot skew against its own client. This is why §4.5 can overturn a documented refusal without a compatibility shim.

**The one rollback hazard worth naming, and it is not a sign-out.** Rolling back past the story that deletes `POST /api/session/role` (`app/api/session/role/route.ts:35-110`) leaves a browser holding a `hub_role` cookie with a 30-day `maxAge` (`:96`). The restored build reads it and pins that user to whichever hat they last switched to. Nobody has switched, because the only caller of `switchRole` is `http-rbac.service.ts:42` and nothing calls that, so in practice the cookie does not exist. It is still the reason `ROLE_COOKIE` (`session.ts:22`) stays in the `clearAuthCookies` loop (`lib/auth/session-cookie.ts:165-168`) through Story K. **Story M** removes it from the loop and deletes the constant in one commit — v2 left the loop removal with no owning story, so the final step had no predecessor. Deleting the constant early also breaks two module-factory mocks that never assert on it (`test/google-signin.test.ts:51`, `test/signout-redirect.test.ts:39`).

---

## 4. LOCATION RESOLUTION

### 4.1 The union rule

```ts
// lib/auth/grants.ts  (pure: no server-only marker, no I/O)
export const GLOBAL_ROLES: readonly Role[] = [ROLES.TAG_EXEC, ROLES.TAG_CSD, ROLES.ADMIN];

export function grantCovers(g: RoleGrant, locationId: string): boolean {
  if (!locationId) return false;
  if (GLOBAL_ROLES.includes(g.role)) return true;      // the wildcard, and the only one
  return g.locations.includes(locationId);
}
export function heldRoles(s: Session): ReadonlySet<Role>;
export function holdsGlobal(s: Session): boolean;
export function grantsAt(s: Session, locationId: string): RoleGrant[];
export function rolesAt(s: Session, locationId: string): ReadonlySet<Role>;
export function hasAnyRoleAnywhere(s: Session | null, allowed: readonly Role[]): boolean;
export function hasAnyRoleAt(s: Session | null, locationId: string, allowed: readonly Role[]): boolean;
export function authorizingGrant(s: Session, allowed: readonly Role[], locationId?: string): RoleGrant | null;
export function widestRoleIn(roles: Iterable<Role>, allowed: readonly Role[]): Role | null;
```

**Everything lives in `grants.ts`, not in `role-labels.ts`.** v2 moved `hasAnyRole` down into `role-labels.ts`, which would make a file whose own comment says it is "just names and copy" (`role-labels.ts:1-12`) depend on the `Session` type declared in the `server-only` `session.ts`, which imports back from it. `grants.ts` already imports `Session` and is already pure. `role-labels.ts` keeps `ROLES`, `ROLE_LIST`, `Role`, `HAT_LABELS`, `HAT_DESCRIPTIONS` and nothing else; `isRole` stays in `roles.ts` (`:32-34`).

**`hasAnyRole` is renamed, not just re-typed.** The location-free form is called `hasAnyRoleAnywhere`. v2 relied on the parameter type changing from `Role | undefined` to `Session | null` to break all 24 call sites, which it does — `Role` is a string-literal union and is not assignable to `Session | null`. But a type error only forces a *conversion*; it does not force a *location* decision, and `hasAnyRole(session, allowed)` compiles fine at a tenant-scoped site. Renaming makes the location-blindness visible in review at every site that keeps it. Backed mechanically: an ESLint `no-restricted-imports` rule bans `hasAnyRoleAnywhere` under `app/api/ghl/**`, `app/api/clients/**`, `app/api/dashboard/widgets/**` and `app/api/setter/**`, in the same commit that introduces it. This is the same enforcement shape CLAUDE.md already uses for the integration-isolation boundary.

`hasRole` (`lib/auth/roles.ts:40-42`) is deleted: single-role equality against a set has no meaning once a person holds many. `effectiveRole` (`roles.ts:55-61`) is deleted: its only job was validating the hat cookie.

**`Session.locations` is renamed to `Session.reachableLocations`.** Same union content, expanded to `listAllLocationIds()` when `holdsGlobal(session)` (replacing the `currentRole`-keyed branch at `session.ts:196-202`). The rename is the forcing function: it turns each read site into a compile error so each one gets a decision instead of inheriting a widened value silently. The field is **reachability only**. It is never an input to an entitlement decision. `lib/dashboard/scope.ts:89` currently feeds it into a `ScopeFilter`; that is the one place where the rename catches a real leak (§6).

### 4.2 Gates that change

| Site | Change |
|---|---|
| `lib/auth/session.ts:287-292` `ownsLocation` global bypass | `holdsGlobal(session)` |
| `lib/auth/session.ts:294` | `session.reachableLocations.includes(locationId)`, union input |
| `lib/auth/session.ts:301-306` impersonation branch | `heldRoles(session).has(ROLES.TAG_CSM)` |
| `lib/auth/session.ts:317` 403 text | stops enumerating locations; names only the refused id. Under a union the list can be every tenant, in a message that reaches a server log |
| `lib/auth/api-session.ts:77-96` `requireApiLocationAccess` | identical three edits; its comment at `:64-66` requires byte-identical logic, so these ship in one commit |
| `lib/auth/session.ts:261-268` `requireRole` | `hasAnyRoleAnywhere(session, allowed)` |
| `app/api/admin/_lib/http.ts:149` and `app/api/dashboard/_lib/http.ts:149` `requireApiRole` (byte-identical duplicates) | `hasAnyRoleAnywhere(session, allowed)`, and both return the **resolved role** alongside the session: `widestRoleIn(heldRoles(session), allowed)`. That is what `app/api/clients/route.ts:56` needs (§5.3) |
| Flow and admin gates: `admin/flow/org/[orgId]/audit-log/route.ts:18`, `.../[changeId]/revert/route.ts:18`, `.../init/route.ts:20`, `flow/card/[cardId]/suggestions/route.ts:31`, `flow/org/[orgId]/suggestions/route.ts:21`, `flow/suggestions/[suggestionId]/resolve/route.ts:26` | mechanical, to `hasAnyRoleAnywhere`. These are org-scoped, not tenant-scoped; the org gate is separate and unchanged |
| `app/api/knowledge-base/route.ts:24`, `.../[pageId]/route.ts:27` | `holdsInternalRole(session)` beside `isInternalRole` (`session.ts:244-246`, unchanged as a pure predicate) |
| `app/api/meta/status/route.ts:24` | `hasAnyRoleAnywhere(session, [ROLES.TAG_EXEC])`. Also removes a live inline-role-string violation |
| `app/api/impersonation/enter/route.ts:41` | `heldRoles(session).has(ROLES.TAG_CSM)`, **plus the tenant-registry check its own comment at `:28-30` already promises** — see below |
| `app/api/portfolio/tenants/route.ts:61, 89` | union; this is where product decision 3 becomes visible to the user |
| `app/api/setter/dashboard/route.ts:55` | `gate.session.locations[0]` deleted. `?locationId=` required, then `resolveLocationContext`. Under a union `locations[0]` is an arbitrary member, and for a global-role holder it is `listAllLocationIds()[0]` |
| `app/api/onboarding/checklist/route.ts:92` | `readOnly: !hasAnyRoleAt(session, locationId, ONBOARDING_WRITE_ROLES)`. `isClientUser` is deleted with `location-selection.ts` (§5.2) |
| `lib/api/webhook-auth.ts:37` | `isInternalRole(session.currentRole)` becomes `holdsInternalRole(session)` — see the sign-off below |
| `app/api/dashboard/_lib/client-book.ts:85-95` `loadOwnBook`, `:64-65, 70-71` `CROSS_BOOK_ROLES` | take a resolved role, not a session — see the sign-off below |
| `app/api/ghl/_lib/gate.ts:81-83` `canConfigureFollowUp` | takes the `LocationContext` and evaluates `FOLLOW_UP_CONFIG_ROLES` against `ctx.roles` |
| `web/src/app/core/guards/location-access.guard.ts:41-58` | the three-role branch at `:41-47` is **deleted**, not converted: the server already expanded global reach into `reachableLocations` (§4.5). What remains is `session.reachableLocations.includes(locationId)` and the impersonation check at `:53-57` with the `currentRole` test dropped |
| `web/src/app/core/services/permission.service.ts:14-19` | `currentRole` computed deleted; `hasAnyRoleAnywhere(allowed)` plus `hasAnyRoleAt(locationId, allowed)` |
| `web/src/app/shared/directives/has-permission.directive.ts:24, 29-30` | `[hasPermission]="roles"` → `hasAnyRoleAnywhere`; new optional `[hasPermissionAt]="locationId"` switches it to `hasAnyRoleAt`. Cosmetic layer per its own comment at `:6-8` |
| `web/src/app/features/flow/flow-framework/flow-framework.ts:72` | `session.locations[0]` becomes `impersonation?.locationId ?? (reachableLocations.length === 1 ? reachableLocations[0] : null)`, with an explicit org selector rendered when the length is greater than one. Its own comment calls this "a best-effort client-side resolution, shown on screen" (`:68`) — under a union, "best effort" is an arbitrary firm's name on the page |
| `flow-framework.ts:76, 78` | `hasAnyRoleAnywhere`. The server routes these drive are org-scoped and gate themselves |
| `nav-items.ts:171` comment, `web/src/app/features/clients/services/client-widgets.service.ts:17-26` doc | text only; they describe the hat |

Three of these are widenings that deserve a sign-off line in their story, not a mechanical diff:

- **`lib/api/webhook-auth.ts:37`.** A client founder who is also granted any TAG staff role skips the bearer-token requirement on the onboarding trigger routes. Correct under the union decision. Largest blast radius of any mechanical conversion: it starts a client's provisioning pipeline.
- **`client-book.ts:85-95` `loadOwnBook`.** This is an ordered if/else **dispatch**, not a membership test. A naive union makes the first branch (`:86`, `tag_csm`) always win, handing a `tag_exec` who also holds `tag_csm` the *narrowest* book — a silent narrowing that reads clean. Rewritten with explicit widest-first precedence (`TAG_EXEC`/`ADMIN` → department, `TAG_CSD` → team, `TAG_CSM` → assigned, else `forbidden`), which inverts the current source order, and taking a single resolved role so a union cannot dispatch it (§5.3).
- **`app/api/impersonation/enter/route.ts:41`.** Widening from "grant[0] is `tag_csm`" to "holds a `tag_csm` grant anywhere" opens a route whose gate is weaker than its own comment claims. `:28-30` says "the gate is therefore role plus tenant-registry membership"; there is no registry check. `isValidLocationId` (`lib/ghl/tenants.ts:33-35`) is `/^[A-Za-z0-9_-]{1,128}$/`, shape only, and `getTenant` **synthesises a default for a missing document** (`:42-56`) rather than throwing, so `enter` accepts any well-formed string and `ownsLocation`'s impersonation branch then grants full access to it. The widening ships with the check the comment promises: a new `tenantExists(locationId): Promise<boolean>` in `lib/ghl/tenants.ts` that reads the document and returns `doc.exists`, called before `createImpersonationEntry` (`enter/route.ts:66`). Same commit.

### 4.3 Gates that do not change

`isValidLocationId` (`lib/ghl/tenants.ts:33-35`). `getTenant`'s fail-closed default (`:42-56`) — it is right for display and wrong as an existence test, which is why `tenantExists` is separate. `permission.guard.ts:38-50` default-DENY. The two-step shape of `app/api/clients/_lib/gate.ts:45` (staff role, then tenant), which is already the correct pattern and the model everything else moves toward. `nav-items.ts` (`permission: readonly Role[]` was always a list; union evaluation structurally prevents the `tag_csd` empty-nav bug documented at `:33-38`). The impersonation admission rule itself, only its role test changes.

### 4.4 F2: how the all-tenancies wildcard is expressed

**The wildcard is a property of the role, expressed once as `GLOBAL_ROLES` in `lib/auth/grants.ts`. It is never a property of a grant's `locations` array, and there is no wildcard token, sentinel, or empty-array promotion anywhere.** `locations: []` means, and continues to mean, **no locations**.

This is exactly today's live behaviour, hoisted from three hardcoded copies (`session.ts:196-200`, `session.ts:287-292`, `api-session.ts:77-83`) into one constant. It has four properties that matter:

1. **The blank textarea cannot produce a wildcard, because no data value expresses one.** `readLocations` returns `[]` for a blank or whitespace body (`app/api/admin/users/_locations.ts:24, 26-29`) and `validateLocations([])` loops zero times (`lib/auth/groups.ts:97-101`). Under this design that write produces a grant that reaches nothing, which is what it does today. There is no code path from an array to global reach.
2. **A mistake cannot escalate.** Under a grant-level `allLocations` flag, one wrong boolean on a `client_owner` grant is total cross-tenant disclosure with nothing behind it. Here, to reach every tenant you must hold `tag_exec`, `tag_csd`, or `admin`, and role assignment is the admin action that already gets the most scrutiny (`app/api/admin/users/[uid]/role/route.ts:35` validates the role, and CS roles carry an extra precondition at `:49-52`).
3. **`promoteToExec` (`lib/auth/admin.ts:155-157`) needs no change.** No claim rewrite, no backfill, nothing to roll back. Part of the M3 answer.
4. **It removes a per-request Firestore read for non-global users** and keeps the claim small (case (c): 46 bytes).

**Two admin mistakes are closed, both in `validateLocations`, both for usability and legibility rather than for the leak:**

```ts
function validateLocations(locations: string[], role: Role): void {
  if (locations.length === 0 && !GLOBAL_ROLES.includes(role)) throw new EmptyLocationsError(role);
  if (locations.length > 0 && GLOBAL_ROLES.includes(role)) throw new GlobalRoleLocationsError(role);
  for (const id of locations) if (!isValidLocationId(id)) throw new InvalidLocationError(id);
}
```

All three callers already have the role in hand (`createGroup:108`, `updateGroupRole:127`, `assignIndividualRole:187`). Both new errors surface as a 400 through the existing `withLocationValidation` path (`_locations.ts:41-47`), naming the field.

The second rule is new in v3 and is F2 inverted. `grantCovers` short-circuits on `GLOBAL_ROLES.includes(g.role)` **before** reading `g.locations`, so `{role: "tag_csd", locations: ["X"]}` — an admin deliberately scoping a CSD to one tenant through the textarea at `_locations.ts:14` — covers every tenant. v2 asserted that role assignment is where the scrutiny lives while leaving a field that looks like a restriction and is silently discarded. Making `[]` the only representable value for a global grant means the claim cannot carry a lie. **Rejected alternative:** honour the list, i.e. make `grantCovers` intersect for global roles too. That would break `tag_csd`'s whole-department view, which is the reason the wide roles exist (`session.ts:193-195`), and it moves the wildcard back onto the data.

`functions/src/auth.ts:46-47` currently documents `[]` as "the all-tenancies wildcard, not none", which contradicts `ownsLocation` (`session.ts:294`). The code is the safe one. That comment is corrected in the same commit that adds `GLOBAL_ROLES`; leaving a comment that instructs the next author to promote `[]` is how F2 comes back.

**Rejected alternative:** `allLocations?: true` on the grant. Genuinely M3-safe and more expressive (it would allow granting a non-global role globally). Rejected because it introduces two independent sources of truth for "every tenant" that must be kept consistent forever, and the failure mode of the new one has no backstop. Nothing in the product needs a globally-scoped `client_owner`.

### 4.5 The wire contract (`lib/auth/session-payload.ts`)

v2 omitted this file entirely, and its own comment refuses what v2's Angular half requires. The refusal is at `session-payload.ts:48-51`: "Fields are copied one at a time on purpose. Spreading the decoded token from verifySessionCookie, or returning roleGrants, would hand the browser iss/aud/sub/auth_time and the full grant map — none of which it needs and all of which are useful to an attacker reading a cached response."

**Decision: overturn the grant half of that refusal, with a reduced shape. Keep the token half in force.** Two separate objections were bundled into one sentence. The token half (never spread the decoded cookie) is right and is untouched — nothing here spreads it, and fields are still copied one at a time. The grant half was "none of which it needs", and that premise stops being true the moment `PermissionService.hasAnyRoleAt(locationId, allowed)` and `location-access.guard.ts` have to answer a per-location question in the browser.

```ts
// lib/auth/session-payload.ts
export type WireGrant = {
  role: Role;
  /** Location ids this grant covers. For a GLOBAL_ROLES grant the server has
   *  already expanded this to listAllLocationIds(); the browser never learns
   *  the wildcard rule. */
  locations: string[];
};

export type SessionPayload = {
  uid: string;
  email: string | null;
  grants: WireGrant[];
  reachableLocations: string[];
  impersonation: { locationId: string } | null;
};
```

Four decisions, each with what it rejects:

1. **`scope` and `team` are omitted.** `team` is a list of *other people's* uids (`session.ts:34-35`) and nothing in the browser has a use for either. Sending the `RoleGrant` type as-is, as v2's "add `grants: RoleGrant[]` to the Angular model" implied, would ship both. Omitting them keeps the original comment's instinct intact and makes the overturn narrow enough to defend. **The comment at `:48-51` is rewritten in the same commit** to record the narrowed decision, because a comment the code now contradicts is worse than no comment.
2. **Global grants are expanded server-side, on the wire.** `grantCovers` on the client then reduces to `g.locations.includes(locationId)` and needs no `GLOBAL_ROLES`. That answers the completeness review's question 10 by removing the question: there is no fourth, unchecked copy of a security list, and `location-access.guard.ts:41-47`'s hardcoded three roles are deleted rather than mirrored. This discloses nothing new — `reachableLocations` for a global-role holder is already `listAllLocationIds()` and is already on the wire today (`session-payload.ts:62`, fed by `session.ts:196-202`). **Rejected alternative:** a `global: true` flag per wire grant. Smaller payload, and it recreates the wildcard rule in a second place with no parity check — the exact failure `check-role-parity.mjs` exists to prevent and which it would not catch, since it parses only `export const ROLES = {...} as const` (`check-role-parity.mjs:26`).
3. **`reachableLocations` stays on the wire even though it is now derivable** from the expanded grants. This costs a duplicated id list for a global-role holder (order of a few KB on a `no-store` response fetched once per app load). Keeping it preserves the "REPLACE the whole session object, never merge, never patch a field" rule (`session-payload.ts:10-16`) with its original justification intact: reachability is a server-computed value the client consumes, not one it computes. **Rejected alternative:** derive it client-side and drop the field. That is the client computing its own access, which is the class of bug the replace-never-merge rule exists to close.
4. **`currentRole` and `availableRoles` are deleted, not replaced.** `availableRoles` is `grants.map(g => g.role)` client-side. Both leave in Story K, together with `Session.currentRole`, in the same commit as the Angular `session.model.ts:28-29` change.

**There is no skew window.** `npm run build` is `npm run web:build && node scripts/stage-angular-bundle.mjs && next build` (`package.json:10`), and `cloudbuild.yaml` builds and deploys exactly one Cloud Run service. The Angular bundle and the server that serves this payload are the same artifact, so the wire contract cannot be half-deployed. This is why the payload can change shape without a versioned field or a compatibility branch, and it is worth stating because nothing in v2 or the reviews says it out loud.

`web/src/app/core/models/session.model.ts:25-37` mirrors the new shape field for field, and its doc comment at `:15-24` (which explains `locations` as derived from `currentRole`) is rewritten in the same commit. `rbac.service.ts:30-31`'s `switchRole` member and its comment at `:12-16` are deleted in Story A.

---

## 5. PER-LOCATION ENTITLEMENT (answers F1)

### 5.1 The predicate

Entitlement is answered by finding **one grant** that satisfies both conjuncts. Not by intersecting two independently-computed sets.

```ts
// lib/auth/grants.ts (pure)
export function authorizingGrant(
  session: Session,
  allowed: readonly Role[],
  locationId?: string,          // omitted = a non-tenant question
): RoleGrant | null {
  const ordered = [...session.grants].sort(byRoleListOrder);   // widest first, deterministic
  return ordered.find((g) =>
    allowed.includes(g.role) && (locationId === undefined || grantCovers(g, locationId)),
  ) ?? null;
}
```

Sorting **at read time** is what lets the writer leave the stored order alone (§10.3). `byRoleListOrder` is index-in-`ROLE_LIST` (`role-labels.ts:40`: ADMIN first through CLIENT_SETTER last), so two identical questions produce the same answer and `actorRole` is deterministic (§7).

```ts
// lib/dashboard/widget-entitlement.ts (pure, no server-only, no I/O)
export function canUseWidgetAt(ctx: LocationContext, widgetId: string): boolean;
export function canUseWidgetForBook(s: Session, widgetId: string): boolean;
export function widgetsPlaceableAt(ctx: LocationContext): WidgetDefinition[];
export function widgetsPlaceableForBook(s: Session): WidgetDefinition[];
```

Five invariants, stated because they are what a future refactor will try to undo:

1. **No function takes a role set and a location set.** Every tenant question takes a `LocationContext`, which is per-location by construction (§5.2). Every book question takes the session and no location. Reintroducing `reachableLocations` as an authority reintroduces F1 regardless of how the hats were removed.
2. **There is no location-free form of `widgetsPlaceableAt`.** `getAvailableWidgets(role)` (`lib/dashboard/widget-definitions.ts:135-137`) is deleted rather than converted, along with its Angular twin (`widget-registry.service.ts:105-107`). A global "what may I place" list *is* the F1 shape; keeping one and remembering not to use it for validation is how F1 was introduced the first time.
3. **Asking the wrong question never yields a permissive answer.** `canUseWidgetAt` returns false for a `book` widget; `canUseWidgetForBook` returns false for a `tenant` widget. The throwing wrappers turn the mismatch into a 400 naming the widget (a programming error that is findable), not a 403 (a permissions story that is not).
4. **Entitlement is never cached, stored, or attached to anything.** It is a pure function of `(ctx, widgetId)`, recomputed per request and per render. No tab, page, config row, or session object carries an entitlement result that a second widget could inherit. The `entitled` boolean the read path returns (§5.3) is a **render hint recomputed on every read**, never a stored authority, and the data endpoints re-derive it independently.
5. **`heldRoles` never reaches a tenant decision.** It answers exactly three location-free questions (`holdsInternalRole`, the impersonation-enter membership test, and `widestRoleIn` for book dispatch) and is forbidden inside `resolveLocationContext` by construction (§5.2).

**The widget registry gains a required discriminant** in both mirrors (`lib/dashboard/widget-definitions.ts:34-41` and `web/src/app/shared/widgets/widget.model.ts:32-39`):

```ts
scope: 'tenant' | 'book';
```

Required, with no default, because that is what forces all registry entries, all route files, and the two test fixtures (`dashboard-customize.spec.ts:33`, `layout-edit.spec.ts:43`) to stop compiling until someone decides. Classification, grounded in what each endpoint already does:

- **tenant** (already resolves one `locationId` and passes it into `lib/`): `spend_roas` (`spend-roas/route.ts:40, 54`), `leads_funnel` (`:49`), `day_view` (`:29`), `pipeline_board` (`:38`), `owner_calendar` (`:28`), plus `kpi_summary` and the new `kpi_spend_summary` (§5.5).
- **book** (derives from the session, no location): `portfolio`, `client_health`, `team_health_rollup`, `department_overview`, `team_performance`.

`kpi_summary` is classified `tenant` **against its current implementation**, which returns `MOCK_METRICS.kpis` unconditionally (`kpi-summary/route.ts:29-50`) and takes no location. Classifying it `book` now means the story that gives it a live fetch must remember to reclassify it, and that is precisely the class of thing that is not remembered. Declaring it `tenant` today costs one query parameter the route ignores.

### 5.2 The location context — **DEFECT 1** — and what replaces `getLocationForDashboard`

`lib/dashboard/location-selection.ts` is **deleted in full**: `getLocationForDashboard:12-36`, `isInternalUser:41-48`, and `isClientUser:53-59`. It branches on `currentRole` and returns *different values* on branches a multi-grant person satisfies simultaneously (`:16` internal, `:27` client), falling through to `locations[0]` (`:35`), which under a union is an arbitrary firm. It has no hat-free version. It is also four inline-role-string violations of CLAUDE.md. `resolveDashboardLocation` (`app/api/dashboard/_lib/access.ts:73-79`), which is its only production reader and which swallows every throw, goes with it.

The location now comes from one of exactly two places, and never from the session:

- **From Story B:** a **required** `?locationId=` request parameter, validated by `resolveLocationContext`. There is no session-derived fallback and specifically no `locations[0]`.
- **From Story H:** the tab's `location_id`, looked up server-side from `(uid, tab_id)` (§8.4). `?locationId=` is deleted from the five endpoints in the same commit.

v2 specified a third source — "the authorizing grant's own location", `grant.locations[0]` — as the Story B bridge. **It is deleted.** For any global role `locations` is `[]` (mandated by §4.4 and written by `promoteToExec`, `admin.ts:155-157`), so `locations[0]` is `undefined` and all five tenant widgets break for every `tag_exec`, `tag_csd` and `admin`. It is also arbitrary for a multi-location grant. There is no version of it that is correct.

One minter, one branded type, so a hand-built context does not typecheck (the same technique `ScopeFilter` already uses at `lib/dashboard/scope.ts:24, 35-40`):

```ts
// lib/auth/location-context.ts  (server-only: it may read the impersonation cookie)
declare const ctxBrand: unique symbol;

export type LocationContext = {
  readonly locationId: string;
  /** Roles from grants covering THIS location — or, under impersonation, exactly {tag_csm}. */
  readonly roles: ReadonlySet<Role>;
  readonly scope: ScopeFilter;           // already narrowed to [locationId]
  readonly via: "grant" | "impersonation";
  readonly [ctxBrand]: "location-context";
};

export async function resolveLocationContext(
  session: Session,
  locationId: string,
  context: string,
): Promise<{ok: true; ctx: LocationContext} | {ok: false; response: NextResponse<ApiError>}>;
```

**There are exactly two admission paths, and this is the defect-1 fix.**

```ts
// 1. A covering grant. This subsumes the global case: grantCovers returns true
//    for a GLOBAL_ROLES grant at every location (§4.1), so a tag_csd is admitted
//    here, with roles = {tag_csd} — plus client_owner only at the tenant their
//    client_owner grant actually names.
const covering = grantsAt(session, locationId);
if (covering.length > 0) {
  return ok(mint(locationId, rolesAt(session, locationId), resolveScopeAt(session, locationId), "grant"));
}

// 2. An active impersonation, pinned.
const imp = await getImpersonation();
if (imp && imp.locationId === locationId && imp.actorId === session.uid
        && heldRoles(session).has(ROLES.TAG_CSM)) {
  return ok(mint(locationId, new Set([ROLES.TAG_CSM]),
                 unsafeTenancyAt(locationId), "impersonation"));
}

return forbidden(`No access to location ${locationId}`);
```

**What v2 got wrong, precisely.** v2 had three branches, and the `holdsGlobal` one assigned `roles = heldRoles(session)` — every held role, including grants that do not cover this location. Chain: U is a TAG CS Director who also owns a firm, the case `functions/src/auth.ts:96-98` explicitly anticipates ("a TAG staff member who is also an owner at a client, or someone provisioned for a second tenancy"). U holds `{tag_csd, []}` and `{client_owner, [X]}`. U requests tenant Y. Under v2, `holdsGlobal(U)` admits, `ctx.roles = {tag_csd, client_owner}`, and `spend_roas.availableFor = ["client_owner","tag_exec"]` (`widget-definitions.ts:72`) matches at **every tenant on the platform**. `tag_csd` is not in that list; U is entitled to spend and ROAS nowhere, and via `ctx.roles` gets it everywhere. Same for `owner_calendar` (`:121`). v2 names this exact hazard one sentence later to justify pinning impersonation, then commits it in the global branch.

*(For the record: the security review cited `functions/src/auth.ts:73` for this anticipated case. Line 73 is `return existing.uid;` inside `ensureUser`. The comment is at `:96-98`, in `mergeGrants`' doc block. The finding is right; the citation is not.)*

**Why the branch is deleted rather than repaired.** Assigning `roles = rolesAt(session, locationId)` in a third branch produces the correct answer, and it produces *the same answer as branch 1*, because `grantCovers` already returns true for a global grant. A branch that duplicates another branch's computation is a branch a future author will "simplify" back into `heldRoles`, and there is nothing in the type system to stop them. Deleting it means **there is no global branch to get wrong.** `holdsGlobal` survives as a reachability helper (`session.ts:287-292`, `api-session.ts:77-83`) and is not called from this file.

**Why impersonation is pinned to exactly `{tag_csm}`.** Under impersonation a CSM reaches a tenant they hold no grant for, so `rolesAt` returns the empty set and branch 1 does not admit them. Handing them `heldRoles` instead would carry a `client_owner` grant held elsewhere into the impersonated tenant and hand over its ROAS — the same defect, reached the other way. Pinning is the correct reading of `session.ts:296-306`: entering the tenant is what grants access, and what it grants is the CSM's authority. `via: "impersonation"` is on the context so audit and telemetry can tell the two apart without re-deriving anything.

**Why impersonation mints `tenancy` scope explicitly.** `resolveScopeAt` over an empty covering set returns `self` over `[uid]` (§6), and every fetcher would return nothing — impersonation dead for its only user. `DEFAULT_SCOPE_BY_ROLE.tag_csm` is already `"tenancy"` (`scope.ts:55`), so minting `tenancy` at `[locationId]` is the role's own declared default, bounded to exactly the one impersonated tenant. `unsafeTenancyAt` lives in `scope.ts` beside `unsafeScopeForTests` (`:119-125`), named so it cannot be mistaken for a general constructor, and has exactly one caller.

**This makes `LocationContext` the single entitlement authority.** v2 specified two — `resolveLocationContext` in §5.2 and `requireWidgetAt(session, widgetId, locationId)` in §5.3 — and never said which won. Under v3, every tenant-scoped route resolves a context first and every downstream check takes it. `authorizingGrant` does not disappear; it answers **non-tenant** questions (book widgets, `requireRole`, `requireApiRole`) and is the function `rolesAt` is defined against, so the two can never disagree:

> `∃ r ∈ allowed ∩ rolesAt(s, L)` ⟺ `∃ g ∈ s.grants : g.role ∈ allowed ∧ grantCovers(g, L)` ⟺ `authorizingGrant(s, allowed, L) ≠ null`.

The single-grant conjunction is therefore preserved exactly, and the impersonation case is the one deliberate, named exception to it.

**Required regression test, named so a verifier can find it.** `test/location-context.test.ts`: for `U = [{tag_csd, []}, {client_owner, ["X"]}]`, `resolveLocationContext(U, "Y").ctx.roles` must equal `new Set(["tag_csd"])` and `canUseWidgetAt(ctx, "spend_roas")` must be `false`; at `"X"` the same call must yield `{tag_csd, client_owner}` and `true`. A second case asserts `resolveLocationContext` contains no reference to `heldRoles`.

**Behaviour change to declare.** `resolveDashboardLocation` swallows every throw and returns `null`, and each of the five tenant endpoints then serves sample data with `NO_LOCATION_WARNING` (`spend-roas/route.ts:42-52` and its four twins). Under this design an unreachable or unentitled location is a **403**, and the no-location sample branch is deleted from all five. "You may not see this" and "we have no data" are different statements and the current code conflates them. A dead fallback is how a "no location" path becomes a "wrong location" path.

### 5.3 Call sites

| Site | Replacement |
|---|---|
| `_lib/access.ts:47-54` `requireWidget` | split into `requireWidgetAt(ctx, widgetId)` and `requireWidgetForBook(session, widgetId)`. The first returns `WidgetDefinition`; the second returns `{definition, role}` where `role = widestRoleIn(heldRoles(session), definition.availableFor)` |
| `_lib/access.ts:57-61` `canUseWidget` | deleted; superseded by the pure predicates |
| `_lib/access.ts:73-79` `resolveDashboardLocation` | deleted |
| `spend-roas:37,40`; `leads-funnel:46,49`; `day-view:27,29`; `pipeline-board:36,38`; `owner-calendar:26,28` | Story B: `locationId = requireLocationParam(request)` → `resolveLocationContext` → `requireWidgetAt(ctx, id)` → fetch with `ctx.scope`. Story H: `tabId = requireTabParam(request)` → `resolveTabContext`. Sample branches deleted in Story B |
| `kpi-summary/route.ts:34` | same; body unchanged while it serves `MOCK_METRICS`. The spend keys move to `kpi_spend_summary` (§5.5) |
| `client-health:34,36`, `portfolio:31,33`, `team-health-rollup:34,36`, `department-overview:31,33` | `requireWidgetForBook`, and its returned `role` threaded into `loadClientBook` |
| **`app/api/clients/route.ts:44,56`** | the sixth `loadClientBook` caller, absent from v2. It has no widget, so the role comes from the gate: `requireApiRole(CSM_BOOK_ROLES)` returns `{session, role}` (§4.2) and `:56` passes it |
| `client-book.ts:54-78` `loadClientBook` | signature `(session, role: Role, scope, csmEmail)`. `:64-65` and `:70-71`'s `CROSS_BOOK_ROLES` tests read the passed role, not the session |
| `client-book.ts:85-95` `loadOwnBook` | takes the role; explicit widest-first precedence, inverting the current source order (§4.2) |
| **`app/api/setter/dashboard/route.ts:55`** | `?locationId=` required; `gate.session.locations[0]` deleted; `resolveLocationContext` before `getSetterMetrics`/`getSetterLeads`. `requireApiLocationAccess` at `:60` is subsumed by the context and removed |
| `config/route.ts:51` | `loadDashboardTabs(session.uid)`; the storage key drops `role` |
| `config/route.ts:58-66` read filter | **no longer removes anything.** Per placement it computes `entitled: boolean` against that tab's own location and returns the placement either way. See "the read filter stops authoring deletions" below |
| `config/route.ts:73-78` `currentPageId` and `?page=` | becomes `activeTabId` and `?tab=`. Resolution order: `?tab=` if it names one of this user's tabs, else `dashboard_prefs.active_tab_id` if it still does, else the lowest `position`. A stale value degrades rather than erroring, same rule as today |
| `config/route.ts:80-86` `locationId` + `lastUpdated` | deleted as response fields. Location is per tab (`tabs[].locationId`); freshness becomes `freshnessByLocation: Record<string, LastUpdated>`, computed once per **distinct** location across the user's tabs, so a five-tab founder at one tenant makes one `getLastUpdated` call. The per-location `.catch(() => ({timestamp: null, source: null}))` at `:84` survives verbatim |
| `config/route.ts:90` `availableWidgets` | `availableWidgetsByTab: Record<string, WidgetDefinition[]>` — `widgetsPlaceableAt(ctx)` for a tenant tab, `widgetsPlaceableForBook(session)` for a book tab |
| `config/route.ts:123-127` `config.role !== session.currentRole` | deleted with `DashboardConfig.role`. One dashboard per person means there is no other hat's dashboard to protect. **Delete it only after the storage key changes**, or any client can write any role's row |
| `config/route.ts:129-136` | **this is the F1 validation hole.** Replaced by the per-tab, per-placement loop below |
| `widgets/route.ts:26-37` | takes `?tab=` (Story H) or `?locationId=` (Story B); response drops `role`, gains the resolved location; omitting the parameter returns **book widgets only**, never the union |
| `widget-definitions.ts:135-137` `getAvailableWidgets` | deleted, plus its re-export at `lib/dashboard/widget.ts:3` |
| `widget-registry.service.ts:105-107` | deleted; no production caller (`dashboard-customize.ts:97` uses the server's list) |
| `layout-edit.ts:62-88` `toggleWidget(page, widgetId, available)` | `available` is now the tab's own list. `dashboard-customize.ts:130` passes `this.availableWidgetsByTab()[tab.id] ?? []` |
| `layout-edit.ts:91-105` `moveWidget` | reimplemented as `moveItemInArray(widgets, index, index + delta)` so the buttons, the keyboard path and the drag run one implementation (§8.3) |
| `widget-host.ts:91` | stops recomputing the rule; takes a required `entitled` input the shell fills from the server's per-placement flag, so the `'forbidden'` tile cannot disagree with the API |
| `dashboard-shell.ts:78-80` | copy says "no longer available for the hat you are wearing". Reword to name the tab. A message naming a hat after hats are gone is a support ticket |
| **`app/api/session/role/route.ts`** | deleted whole in Story A. Its impersonation close at `:65-72` is **not** orphaned: `closeImpersonationEntry` has three other callers — `app/api/impersonation/exit/route.ts:41`, `app/api/auth/signout/route.ts:47`, and `lib/auth/impersonation-actions.ts:48`. The comment at `:59-64` explains the close exists because *switching hats* silently invalidated the impersonation grant (`session.ts:301` and `api-session.ts:87` both gated it on `currentRole === tag_csm`). With no hat to switch, that condition cannot arise. Verified, not assumed |

**The PUT, restated as the entitlement boundary:**

```
for each tab in body:
  row = SELECT location_id, widgets FROM dashboard_tabs WHERE uid = session.uid AND tab_id = tab.id
  if no row                        -> 404 (a tab id belonging to someone else does not resolve)
  ctx = row.location_id ? resolveLocationContext(session, row.location_id) : null
  if row.location_id and not ctx   -> 403
  existing = set of widgetId in row.widgets
  for each placement in tab.widgets:
    def = WIDGET_REGISTRY[placement.widgetId]
    if !def                        -> 400
    if def.scope === 'tenant' and ctx === null -> 400 (a tenant widget on a book tab)
    if placement.widgetId in existing -> allow          # retained, see below
    if def.scope === 'tenant' and !canUseWidgetAt(ctx, placement.widgetId)  -> 403
    if def.scope === 'book'   and !canUseWidgetForBook(session, placement.widgetId) -> 403
```

**The read filter stops authoring deletions, and the PUT validates additions only.** v2's read path dropped unentitled widgets from the returned config; `dashboard-customize.ts:95` stores that filtered object; any click runs `apply()` → `persist()` (`:150-181`), which PUTs the whole thing; `saveDashboardConfig` does `ON CONFLICT DO UPDATE`. One click permanently deletes what the filter hid. That destroys the two guarantees §9.3 is built to provide (a dormant tab's arrangement survives a revoke; a re-grant returns it exactly), and it destroys the widgets on any folded tab whose tenant could not be adopted — the zero-or-many case §8.5 deliberately refuses to guess. So: **the read returns every placement with an `entitled` flag, and the PUT validates only placements whose `widgetId` is not already stored.** A retained-but-unentitled placement renders as the existing `'forbidden'` tile and its data endpoint 403s independently (`requireWidgetAt` on the GET), so nothing reaches the browser. **Rejected alternative:** make the PUT a delta (`{tabId, op}`). Strictly safer, and it is a rewrite of `dashboard-customize.ts`'s optimistic-with-rollback pair (`:150-181`) whose rollback semantics are currently correct and cheap. The add-only validation gets the same property for one server-side read.

### 5.4 The exploit chain, shown failing

Actor **U** holds `G1 = {client_owner, ["X"]}` and `G2 = {client_closer, ["Y"]}`. Goal: read firm Y's ad spend and ROAS.

| Step | Today | Under this design |
|---|---|---|
| 1. Reachability | union makes `session.locations = [X, Y]`, `ownsLocation(U,"Y")` true (`session.ts:294`) | **Still true, via G2, and correct.** U genuinely works in Y. `reachableLocations` answers only "may a Y tab exist" |
| 2. Tab bound to Y | validates against that same union | **Still succeeds.** Refusing the tab would be the wrong control |
| 3. PUT the config | `getAvailableWidgets(config.role)` builds one global allowed set (`config/route.ts:129`); `spend_roas` accepted because `client_owner` is in `availableFor` (`widget-definitions.ts:72`) | **403.** `ctx = resolveLocationContext(U, "Y")` admits via G2 with `ctx.roles = {client_closer}`. `spend_roas` is a new placement, so it is validated: `canUseWidgetAt(ctx,"spend_roas")` intersects `{client_closer}` with `["client_owner","tag_exec"]` and finds nothing. G1 never enters the set, because `grantCovers(G1,"Y")` is false. The union that step 3 previously widened through is never constructed, because there is no location-free list to construct it from |
| 4. GET the widget | `requireWidget(session,"spend_roas")` passes on `currentRole` (`access.ts:50`) | **403, independently.** Given a row written before this landed, or by a direct database write, the endpoint resolves the same context and evaluates the identical predicate to the identical `false` |
| 5. Resolve the location | `resolveDashboardLocation(session)` returns Y (`spend-roas/route.ts:40`) | **Unreachable.** The function and `getLocationForDashboard` are deleted |
| 6. Fetch | `getDashboardAdRoas("Y", days)` returns firm Y's ROAS (`:54`) | **Never called** |

Five further attacks, each refused by the same rule:

- **Omit the location.** `requireLocationParam` / `requireTabParam` throws `badRequest` before the gate. There is no session-derived fallback and specifically no `locations[0]`.
- **Supply `?locationId=Y` directly** during Story B. Identical outcome to step 3: the context is resolved from U's own grants at Y regardless of who named Y.
- **Launder through a sibling widget.** U legitimately places `pipeline_board` on the Y tab (`client_closer` is in its `availableFor`, `:51`). The tab is validated and populated. The `spend_roas` question is then asked from scratch, because entitlement is never stored (invariant 4). No shared object exists for the first answer to contaminate.
- **Ride the retained-placement allowance.** The PUT skips validation only for a `widgetId` **already stored on that tab**. `spend_roas` was never stored on the Y tab, because step 3 refused it. To become "retained" it must first be added, which is the check.
- **Replay a config saved while the grant existed.** The read path marks it `entitled: false`, the tile renders `'forbidden'`, and the data endpoint refuses. The saved row is never the authority.

**And the case defect 1 created.** U' holds `{tag_csd, []}` and `{client_owner, ["X"]}`, and requests `spend_roas` at Y. `ctx.roles` is `{tag_csd}`, not `{tag_csd, client_owner}`. `tag_csd` is not in `spend_roas.availableFor`. **403 at every tenant except X**, where U' genuinely owns the firm.

### 5.5 The registry against product decision 6

The predicate enforces the rule; the registry supplies its inputs, and **one input currently contradicts it.** v2 identified all of this correctly and then assigned none of it to a story, while §12 deferred the one change that closes the violation. In v3 every item below is **Story A2** and none of it is deferred.

- **CRITICAL, `kpi_summary`.** `availableFor: ["client_owner","client_manager","tag_exec","tag_csm"]` (`widget-definitions.ts:114`), payload keys `spendActual`, `spendBudget`, `roas`, `cpl`, `bookingRatePct`, `costPerBooked` (`kpi-summary/route.ts:40-46`). `client_manager` is the closing manager, a salesperson. This is F1's outcome reached with **one grant and no exploit**; it leaks nothing today only because `source` is the literal `"sample"` (`:37`) and the route's own comment says the disclosure becomes conditional the moment a real fetch exists (`:25-28`). **Split, and ship the split:** `kpi_summary` keeps `bookingRatePct` for `["client_owner","client_manager","tag_exec","tag_csm"]`; a new `kpi_spend_summary` carries `spendActual`, `spendBudget`, `roas`, `cpl`, `costPerBooked` with `availableFor: ["client_owner","tag_exec"]`, matching `spend_roas`. Both `scope: 'tenant'`. v2's fallback — trim `client_manager` off the existing id — is rejected: it strips booking rate from a role that needs it and silently empties a saved tile for every closing manager. The split is roughly thirty lines across the registry, the route, and `SAMPLE_DATA_WIDGET_IDS` / `MOCK_METRICS_WIDGET_IDS` (`widget-definitions.ts:133`), and it is the only change in this plan that closes the violation rather than describing it.
- **`owner_calendar`.** A disclosure defect, not a rule violation. Titled "Your own scheduled calls" (`:123`), but `getOwnerCalendar` scopes by the tenant's `ownerGhlUserId` and the route's own comment says `calendar.scoped === false` returns the whole location's calendar (`owner-calendar/route.ts:17-20`). Keep the set, retitle to "Calendar", surface `scoped` in the tile.
- **`pipeline_board` and `tag_csm`.** Under hats a CSM's location resolved to `GHL_LOCATION_ID_TAG_GROWTH` (`location-selection.ts:16-23`), so their pipeline tile showed TAG's pipeline. Once the location comes from the tab or the parameter, `tag_csm` is not global, so the tile follows the tab or the impersonation. Keep `tag_csm`; the TAG_GROWTH pinning was an artefact, not a decision.
- **`tag_sales` holds nothing, and `pipeline_board` is literally its widget** (already flagged in-repo at `widget-registry.service.spec.ts:47-52`). Add `tag_sales` and `tag_sales_manager` to `pipeline_board` and `day_view`; a `tag_sales` grant lists TAG_GROWTH and nothing else, so `grantCovers` confines them there with no second rule. Then delete `tag_sales` from `ROLES_WITHOUT_WIDGETS` (`widget-registry.service.spec.ts:54`) rather than loosening the assertion.
- **`day_view` omits `client_manager` while `pipeline_board` includes it.** An omission, not a rule (`getTodayCalls` carries no spend). Add it. Setter roles stay out, deliberately.
- **`leads_funnel` reviewed and left alone.** Counts only, no cost anywhere (`funnel.ts:145`). Recorded explicitly so the next reader does not "fix" it by symmetry with `kpi_summary`.
- **Already correct:** `spend_roas` `[client_owner, tag_exec]`, `department_overview` `[tag_exec]`, `team_health_rollup` `[tag_csd]`, `portfolio`/`client_health` `[tag_csm, tag_csd, tag_exec]`, and `team_performance` `[tag_sales_manager, tag_exec]`, which is the second half of the rule (a CEO holding a sales widget).

**The Angular mirror stops mirroring `availableFor`.** Both registries carry it (`widget-definitions.ts:47-125` and `widget-registry.service.ts:15-85`), they agree today, and **nothing mechanical keeps them agreeing**: `check-role-parity.mjs` only parses `export const ROLES = {...} as const` from three named files (`:24-31, 43-45`). Worse, the inline-role-string check makes drift harder to see, because the Angular copy must write `ROLES.CLIENT_OWNER` while the server copy writes the bare literal `"client_owner"`, so the two files are not textually comparable, and `widget-definitions.ts` passes that check only because `ROLE_HELPER_PATTERN` matches its `import type { Role }` line at `:2`. The canonical registry is exempted by an import statement.

Fix: delete `availableFor` from `web/src/app/shared/widgets/widget.model.ts:36` and the method that reads it (`widget-registry.service.ts:105-107`), keep only presentation there (`id`, `title`, `description`, `defaultSize`, `scope`, loader), and add `scripts/check-widget-parity.mjs` that fails on a missing id, an unequal `scope`, an unequal `defaultSize`, **and on any occurrence of `availableFor` under `web/src/app/shared/widgets/`**. A parity check that permits the duplicate guarantees two copies stay equal; a check that forbids it guarantees there is one copy to be right.

**And it must actually run.** `scripts/hooks/pre-commit:17-18` hardcodes two `node scripts/...` lines and does not iterate npm scripts, so v2's "beside `check:role-parity` in `package.json:18`" would have added a check nobody runs. Story A2 adds **both** the `package.json` script and the `scripts/hooks/pre-commit` line, and the story's task list includes `npm run hooks:install`.

**TAG_GROWTH becomes an ordinary optional location id.** `lib/config.ts` gains `tagGrowthLocationId = optional("GHL_LOCATION_ID_TAG_GROWTH")`, replacing the per-request `throw` at `location-selection.ts:18-22` that lands in a `catch {}` returning `null`. **Optional, not required.** `lib/config.ts:19-20` states that "a required key that is missing throws HERE, at import, so the process fails to start"; making this key required would stop `npm run build`, `npm run test` and every CI run in any environment whose `cloudbuild.yaml --set-env-vars` omits it — and CLAUDE.md makes those three the gate. Its only consumer after this work is §9.3's seeding of a TAG-internal tenant tab; when it is empty, no such tab is seeded, and every internal role's template is a book tab anyway (§9.2), so nothing degrades.

---

## 6. SCOPE

**Rule: scope at a location is the MAXIMUM over the grants covering that location, on the total order `self < team < tenancy`. Never a maximum over all grants, and never a scope filter that spans more than one location.**

```ts
export function resolveScopeAt(session: Session, locationId: string): ScopeFilter {
  const covering = grantsAt(session, locationId);
  const levelOf = (g: RoleGrant): ScopeLevel =>
    isScopeLevel(g.scope) ? g.scope : (DEFAULT_SCOPE_BY_ROLE[g.role] ?? "self");
  const level = covering.map(levelOf).reduce(widest, "self");

  if (level === "tenancy") return mint("tenancy", [locationId], "all");
  if (level === "team") {
    // Only team-scoped grants contribute team uids.
    const team = covering
      .filter((g) => levelOf(g) === "team")
      .flatMap((g) => g.team ?? [])
      .filter((u) => typeof u === "string" && u.length > 0);
    const uids = team.length > 0 ? [...new Set([...team, session.uid])] : [session.uid];
    return mint(team.length > 0 ? "team" : "self", [locationId], uids);
  }
  return mint("self", [locationId], [session.uid]);
}
```

Security direction, property by property:

1. **Max, not min: widening, bounded, and neutral for the actual victims.** A founder holds `client_owner@X` (default `tenancy`, `scope.ts:60`) and `client_closer@X` (default `self`, `:63`). Min would narrow them to `self` and break the owner dashboard that works today. Max gives `tenancy`, which is exactly what they get today because `client_owner` happens to be `availableRoles[0]`. The bound is hard: the result can never exceed the widest scope on a grant the person holds **at that location**.
2. **`locations` narrows from the union to `[locationId]`: the security-critical half.** `scope.ts:89` currently puts `session.locations` into the filter. Under a union that hands a `tenancy`-level filter naming every tenant to any fetcher, which is F1 reproduced inside the one abstraction built to prevent leakage. `resolveScopeAt` is per-location by signature, so a cross-tenant filter becomes unrepresentable. This is the `reachableLocations` rename earning its cost.
3. **Max over `grantsAt`, never over `session.grants`.** Max over all grants would let `client_owner@X`'s tenancy scope read every row in Y. The `grantsAt` restriction is the only thing between the max rule and that leak, which is why the function takes a `locationId` rather than reading one off the session.
4. **Team uids come only from team-scoped grants.** `parseRoleGrants` preserves `team` regardless of `scope` (`session.ts:102-108`), so a naive `covering.flatMap(g => g.team ?? [])` would collect uids from a grant whose own level is `self` whenever some *other* grant at that location resolved to `team`. Latent today — `clientOwnerGrants` writes `scope` and never `team` — and it is a widening nobody intends. The `filter` above closes it in one line.
5. **The empty-team narrowing (`scope.ts:100-105`) survives verbatim, and its argument strengthens.** Under a union the team uids are a flatMap across grants, so an empty result now means "no team-scoped grant at this location named anyone", which is even more clearly a misconfiguration. Fail closed, as `getTenant` does one level up (`lib/ghl/tenants.ts:42-56`).

`resolveScope(session)` gets **no no-argument form**. A default of "the widest scope anywhere" is the leak. `resolveScopeAt` and `resolveLocationContext` are the same boundary and are minted together: `LocationContext.scope` is the only `ScopeFilter` a tenant-scoped fetcher ever sees. `DEFAULT_SCOPE_BY_ROLE` (`:51-65`) is unchanged as data, consulted once per grant instead of once per session. `unsafeScopeForTests` (`:119-125`) is unaffected; `unsafeTenancyAt` (§5.2) joins it, with exactly one production caller.

**Sequencing note:** `scope.ts` has no live production caller — `resolveScope` is exercised only by `test/scope-resolver.test.ts` and named in `docs/ROLE_SCOPE_MODEL.md` — so it converts early and cheaply, inside Story B rather than as its own story, because `resolveLocationContext` needs it on day one.

---

## 7. AUDIT

`actorRole` records **the role that authorised the action**: resolved at the location the action touched, from the context that admitted it.

```ts
// lib/auth/location-context.ts
export function authorizingRole(ctx: LocationContext, allowed: readonly Role[]): Role | "unknown" {
  return widestRoleIn(ctx.roles, allowed) ?? "unknown";
}
// non-tenant sites keep the session form:
actorRole: authorizingGrant(session, ALLOWED_FOR_THIS_ROUTE)?.role ?? "unknown",
```

v2 wrote `authorizingGrant(session, allowed, locationId)?.role` at every site. That returns `null` under an active impersonation — a CSM holds no grant covering the impersonated tenant — so every write made while impersonating would be logged as `"unknown"`, on exactly the actions the impersonation audit trail exists to attribute. Reading the role off the context fixes it: `ctx.roles` is `{tag_csm}` under impersonation, so the value is `tag_csm`, which is what `impersonation-actions.ts:21` and `enter/route.ts:69` already write positionally.

Design points:

- **No schema change, no migration, no reader to break.** `actorRole` stays `string` (`lib/audit/store.ts:25`). It is written and never read: `getAuditEvents` filters on `actorId` and `action` only (`:74-75`), `daysSinceLastAction` filters on `action` (`:83`), and nothing displays it. `lib/onboarding/campaign-launch.ts:183` already writes the literal `"system"`, so a non-role value is already legal.
- **The location needs no new field.** The collection path is `locations/{locationId}/auditLog` (`store.ts:44`), so "which tenant" is already the document's address. "Under what authority at this tenant" is the only fact the field was ever attempting to carry.
- **Deterministic.** `widestRoleIn` scans in `ROLE_LIST` order (`role-labels.ts:40`, ADMIN first through CLIENT_SETTER last), so two identical actions produce the same value. Falls back to `"unknown"` rather than throwing, since no reader filters on it and an audit write must never fail an action that already succeeded.

Eight sites, six direct writes and two positional arguments:

| Site | Allowed set used to resolve |
|---|---|
| `app/api/ghl/locations/[locationId]/appointments/[appointmentId]/status/route.ts:113` | the gate's role set, via `ctx` |
| `app/api/ghl/locations/[locationId]/follow-up/config/route.ts:103` | `FOLLOW_UP_CONFIG_ROLES`, via `ctx` |
| `app/api/ghl/locations/[locationId]/opportunities/[opportunityId]/close/route.ts:83` | the gate's role set, via `ctx` |
| `app/api/ghl/locations/[locationId]/opportunities/[opportunityId]/stage/route.ts:68` | the gate's role set, via `ctx` |
| `app/api/onboarding/checklist/task/route.ts:64` | `ONBOARDING_WRITE_ROLES`, via `ctx` |
| `lib/onboarding/campaign-launch.ts:363` | `ONBOARDING_ROLES`, via `ctx` |
| `lib/auth/impersonation-actions.ts:21` (positional) | `[ROLES.TAG_CSM]`, deterministically `tag_csm` |
| `app/api/impersonation/enter/route.ts:69` (positional) | same |

The doc-comment example at `store.ts:52-54` writes `actorRole: session.currentRole` and is rewritten in the same commit; leaving it is how the next author reintroduces the field's old meaning.

**One behaviour change to accept, not fix.** `app/api/impersonation/enter/route.ts:21-24` documents that exec/CSD/admin do not need impersonation. Under the union a dual-holder passes the `tag_csm` membership test and creates impersonation records that explain nothing. Accept the audit noise rather than refuse a real CSM. Note that the *access* granted by such a record is now bounded by §5.2's pinning (`{tag_csm}` only) and by the new `tenantExists` check (§4.2), so the noise is noise and not reach.

---

## 8. DASHBOARD SCHEMA, TABS AND DRAG AND DROP

### 8.1 What exists, including a conflict and a destructive bug

`dashboard_configs` is declared **twice, incompatibly**. `functions/sql/002_create_dashboard_configs.sql:2-10` gives `uid VARCHAR(255)`, no FK, `TIMESTAMP` without zone, `PRIMARY KEY (uid, role)`, and grants only `SELECT, INSERT, UPDATE` (`:16`, no DELETE). `functions/sql/003_migrate_firestore_to_postgres.sql:270-284` re-declares it with `uid TEXT REFERENCES users(uid)` and `TIMESTAMPTZ`. Both are `IF NOT EXISTS` and files run in number order, so **002 wins on every deploy**. The fold below touches only the four columns both declarations share. The table is **absent from `docs/data-model.md`** (its table list runs `:71-83`), so the first story here also documents the current schema, not only the delta.

`lib/dashboard/customization.ts:42-47` is a catch-to-empty that CLAUDE.md forbids and that **destroys data today**. Chain: pool exhaustion (`lib/postgres.ts:17` caps at 10) or a Cloud SQL blip, the read returns `createDefaultConfig(role)` (`:47`) indistinguishable from a saved layout, `dashboard-customize.ts:95` installs it, the user's next click runs `apply()` (`:150-162`) which PUTs it, and `saveDashboardConfig`'s `ON CONFLICT DO UPDATE` (`:54-55`) overwrites the real row. A transient read failure permanently deletes a saved layout. With tabs it deletes N tabs instead of one page. **Fixing this is a precondition of the fold, not a follow-up:** migrating data into a store the app can still silently overwrite buys nothing.

**The replacement, named** (v2 said the catch goes and did not say what replaces it): `loadDashboardTabs` propagates the error; `GET /api/dashboard/config` returns **503** with `{error: "The dashboard store is temporarily unavailable.", code: "dashboard_store_unavailable"}`; the Angular shell renders its existing error state (`dashboard-customize.ts:86-92`) with a Retry. Not a 200 with a synthesised default — that is the shape that authors the deletion. Not a 500 — a pool blip is retryable and the client should be able to say so. This is the `{error, data: null}` contract CLAUDE.md's error-handling section requires, and the write path is unreachable while the read is failing, which is the whole point.

### 8.2 Target DDL

```sql
-- functions/sql/009_dashboard_tabs.sql  (additive; does NOT drop dashboard_configs)

CREATE TABLE IF NOT EXISTS dashboard_tabs (
  uid           VARCHAR(255) NOT NULL,
  tab_id        TEXT         NOT NULL,
  title         TEXT         NOT NULL,
  source_role   VARCHAR(50),            -- the grant that justifies this tab; NULL = user-made
  location_id   TEXT,                   -- the tab's tenant; NULL = book tab or unadopted
  position      INTEGER      NOT NULL,  -- tab order in the strip
  widgets       JSONB        NOT NULL DEFAULT '[]'::jsonb,
  customized_at TIMESTAMPTZ,            -- first user edit; NULL = pristine template
  revoked_at    TIMESTAMPTZ,            -- justifying grant no longer held
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (uid, tab_id)
);

-- The idempotency key for grant-time insertion (§9.3). Kept, not dropped:
-- the fold is what changes (§8.5), so the two writers can share one key.
CREATE UNIQUE INDEX IF NOT EXISTS uq_dashboard_tabs_grant
  ON dashboard_tabs (uid, source_role, COALESCE(location_id, ''))
  WHERE source_role IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dashboard_tabs_uid_position
  ON dashboard_tabs (uid, position);

CREATE TABLE IF NOT EXISTS dashboard_prefs (
  uid           VARCHAR(255) PRIMARY KEY,
  active_tab_id TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_tabs, dashboard_prefs TO tag_app_user;
```

`uid VARCHAR(255)`, no FK, matching what 002 actually built. The explicit `GRANT` is mandatory: 003's blanket grant (`:289`) covers only tables existing when it runs, and `docs/data-model.md:85-91` already names this trap.

**`uq_dashboard_tabs_grant` is kept, contrary to the migration review's F3.** F3 is right that the index as v2 specified it aborts the fold — a two-page `dashboard_configs` row produces two rows keyed `(uid, 'client_owner', '')`. But the fix belongs in the fold, not the index: §8.5 sets `source_role` on the **first page only**, and since `dashboard_configs`' primary key is `(uid, role)` (`002:9`) there is exactly one first-page per `(uid, role)`. With that, the index is unique by construction and it is what makes §9.3's reconciler a database-level no-op rather than an application-level promise. **Rejected alternative:** drop the index and key the reconciler on `(uid, tab_id)` with a derived `tab_id`. That works, and it makes `tab_id` semantic — so adopting a tenant onto a folded tab would have to *rewrite* `tab_id`, breaking `?tab=` links and `active_tab_id`. Keeping `tab_id` opaque and stable is worth one partial index.

**`active_tab_id` replaces `current_page INTEGER`.** An array index is the wrong key once a grant can insert a tab: inserting at position 0 silently changes which tab `current_page = 0` names. Today's index-based code (`config/route.ts:73-78`, validated at `config-parse.ts:100-105`) is only correct because nothing else can insert.

**Who writes `dashboard_prefs`** (nothing in v2 did): a new `PUT /api/dashboard/prefs` with body `{activeTabId}`, called by the shell when the user switches tabs. The server validates that the id names one of the caller's own tabs and 400s otherwise. **Nothing backfills it.** `active_tab_id` starts NULL and `GET` falls back to the lowest `position`. **Rejected alternative:** backfill it from `dashboard_configs.current_page`. That imports the index-based bug the column exists to replace, for one page-load of convenience.

**One row per tab, rejecting one JSONB blob per person.** The blob is simpler and it makes grant-time insertion a read-modify-write racing the customize screen, which saves on every click (`dashboard-customize.ts:150-181`). Per-row makes it `INSERT ... ON CONFLICT DO NOTHING`: atomic, and structurally incapable of touching a neighbouring tab. That is what backs the guarantee in §9.3.

Placement shape after this work, in both mirrors (`widget-definitions.ts:9-14`, `widget.model.ts:10-15`):

```ts
type WidgetPlacement = { id: string; widgetId: string; size: { cols: number; rows: number } };
```

Two invariants enforced in the PUT parser, so each is a 400 rather than a rendering accident: **a `tenant` widget may only sit on a tab with `location_id IS NOT NULL`**, and **`config-parse.ts` does not accept `locationId`.** The second is new in v3. v2's Story H added `locationId` to the untrusted PUT parser while §8.4 asserted `location_id` "is set when the tab is created and never changes afterward" — the property the tenant-name label and the `?tab=` lookup both rest on. Accepting it in the parser makes that aspirational, and a re-point onto a location the user already has a `source_role` tab for raises a 23505 that surfaces as a 500 on an ordinary save. The layout PUT carries `tabId` and `widgets` only. Tab creation (`POST /api/dashboard/tabs`) and tenant adoption (`POST /api/dashboard/tabs/[tabId]/adopt`) are their own endpoints, and the adopt endpoint returns a typed **409** naming the existing tab when the target tenant already has one, offering to merge rather than throwing a constraint error.

### 8.3 The position decision, defended

**Delete `position: {x, y}`. Commit to ordered reflow.**

The facts. It is written in three places (`customization.ts:97-104` computes a real col/row, `config-parse.ts:74-77` parses and stores it, `layout-edit.ts:84` hardcodes `{x:0,y:0}`) and **read by none**. `dashboard-shell.html:53-59` iterates `widgets()` in array order; the only per-tile computation is `cellClass(placement)` (`dashboard-shell.ts:160-164`), which reads `size`. So `position` is not merely unused, it is **actively false**: since the Angular rewrite every widget added through the picker is stored at `{0,0}`, and a five-widget layout has five placements claiming one cell. Any code that started trusting it would stack them.

The alternative, stated fairly: making `position` load-bearing buys deliberate holes in the grid and free 2D placement, which is what "drag and drop" usually implies.

Why it loses, in order of weight:

1. **The phone has no representation for a 2D arrangement.** Below 840px the grid is one column and the span classes carry no rules at all (`dashboard-shell.scss:64-76`, and the comment at `:71-76` says so). A 2D model therefore needs a defined flattening to 1D, and the only sane flattening is reading order, which is array order. Two representations where one is derived from the other is one representation plus a synchronisation bug. Worse, the phone would be editing the derived view: a reorder on a phone either cannot be saved or scrambles the desktop x/y.
2. **Nothing can persist a hole today, and making it possible is a render rewrite plus a validator that does not exist.** `grid-auto-flow: row` packs sparsely, pulling a later narrow tile into an earlier gap, so the render would diverge from the stored x/y unless the shell moved to explicit `grid-column-start`/`grid-row-start`. That needs server-side collision validation; `config-parse.ts:68-80` currently checks only integer-ness, so two placements can claim one cell and both `-1` and `1e9` are accepted and stored.
3. **The CDK primitive is a list, not a canvas.** `@angular/cdk ^22.1.2` is already a dependency (`web/package.json:18`) and nothing in `web/src` uses it. `cdkDropList` plus `moveItemInArray` gives reorder-by-index for free. Free 2D positioning means `cdkDrag` with custom hit-testing, which is where teams reach for gridster: a new package, for a capability the mobile breakpoint cannot show.
4. **It shrinks the untrusted PUT surface** by two integers per placement.

This is a schema change, so `docs/data-model.md` ships in the same commit; `scripts/check-story-status.mjs:222-236` triggers on any staged `functions/sql/` path.

**How a drag persists.** `cdkDropList` on `.dashboard__grid`, `cdkDrag` per cell, `(cdkDropListDropped)` calls `moveItemInArray(widgets, event.previousIndex, event.currentIndex)`, then the existing `apply()`/`persist()` pair (`dashboard-customize.ts:150-181`). One PUT per drop, whole tab body. The optimistic-with-rollback behaviour already built at `:171-175` means a rejected drag snaps back to the last server-confirmed order, which is correct and needs no new code.

Three changes beyond the wiring. **The drag surface moves onto the dashboard grid itself**, behind an `editing` signal on `DashboardShell`, rather than living on `/dashboard/customize`, where you currently reorder blind over a text list on a different route (`dashboard-customize.html:80-97`). `/dashboard/customize` stays as the **picker** (add, remove, resize), because a labelled checkbox list is a better picker than a canvas.

**And the keyboard path moves with the drag surface.** v2 kept the arrow buttons as the accessibility answer while relocating the reorder to a page those buttons are not on — an argument satisfied on the wrong screen. In v3 each tile in edit mode is focusable and handles `(keydown.arrowup)` / `(keydown.arrowdown)` (and left/right on wide viewports) by calling the same `moveItemInArray`. The arrow buttons stay on `/dashboard/customize` as well. Three entry points, one implementation: `moveWidget` (`layout-edit.ts:91-105`, currently a neighbour swap) is re-expressed as `moveItemInArray(widgets, index, index + delta)` so nothing can drift.

**Resize survives unchanged and stays button-driven** (`dashboard-customize.html:41-76`). `cols` is a four-value enum (`config-parse.ts:21-22`, `MAX_COLS = 4`), not a continuous width, and below 840px it has no visible effect at all, so a resize handle on a phone is a control with no feedback. `canGrow`/`canShrink` (`layout-edit.ts:137-143`) already disable at the bounds.

**Mobile.** One column, every tile full width whatever its saved `cols`. Because the model is an ordered list on both sides of the breakpoint, a drag on a phone is the **same operation** as a drag on a desktop. Set `cdkDragStartDelay` around 200ms on touch so a drag does not fight page scroll.

### 8.4 How a tab pins to a tenant

`location_id` is set **when the tab is created, or once at adoption, and never again**. Granting `client_closer@Y` creates a tab whose `location_id` is Y, from that role's template. So the F1 chain step "the tab's locationId is set to Y" stops being an attacker-controlled move and becomes a consequence of a grant that was actually issued. The parser cannot change it (§8.2), so the invariant is enforced rather than asserted.

Per tab, not per placement, for two reasons. A dashboard where two adjacent tiles show two different firms' revenue is a misreading waiting to happen, and there is no room to label each tile. And per-tab is the only granularity that lets the five endpoints take `?tab=<tabId>` instead of a caller-supplied tenant: the server looks up `WHERE uid = $1 AND tab_id = $2`, reads `location_id`, and resolves the context from it. A tab id belonging to someone else does not resolve.

**On `?tab=` versus `?locationId=`, which v2 specified both of.** Both are safe: the single-grant conjunction was verified against the caller-supplied variant, and `resolveLocationContext` runs identically whichever names the location. The choice is therefore not about the leak. `?tab=` wins because it is the only form under which the tab strip's tenant label and the tile's data are guaranteed to be the same tenant — with `?locationId=` a tile can be pointed at any covered tenant while sitting under a tab labelled with another. The cost is one indexed lookup per widget request and a dependency on the tabs schema, which is why `?locationId=` is the Story B bridge and is **deleted in Story H**, in the commit that adds `?tab=`. One API in production at any moment.

**The tab strip** (`dashboard-shell.html:28-42`) renders the tenant *name* from `getTenant` (`lib/ghl/tenants.ts:38`) beneath the stored `title`, never the raw location id, and never a stored copy of the name. That answers "is a tenant tab's title stored or rendered": **`title` is stored and is the user's own label; the tenant name is rendered live**, so a rename in GHL propagates on the next load with no migration. Two tabs both titled "Owner" for two firms is the misreading that matters most, and the strip already scrolls horizontally (`dashboard-shell.scss:26-32`).

A **dormant tab** (grant revoked) reuses the removed-widgets notice pattern (`dashboard-shell.html:18-20`): "This tab came from the Closer role at Acme Tax, which you no longer hold. Its widgets are hidden", plus a Remove button. Its widgets render `'forbidden'` and are **not** stripped from storage (§5.3), which is what makes §9.3's re-grant guarantee real.

### 8.5 The fold

A founder with three saved role layouts must end with three tabs. `pages` is an array that is always length 1 today (`customization.ts:108-114`) but which the parser accepts as N (`config-parse.ts:95-96`), so the fold is **one tab per (row, page)**, or a two-page row loses a page.

```sql
INSERT INTO dashboard_tabs
  (uid, tab_id, title, source_role, location_id, position, widgets, customized_at)
SELECT
  c.uid,
  c.role || ':' || COALESCE(NULLIF(p.value->>'id',''), p.ord::text),
  COALESCE(NULLIF(p.value->>'title',''), c.role),
  -- source_role on the FIRST page only. dashboard_configs' PK is (uid, role)
  -- (002:9), so this is unique per (uid, role) and uq_dashboard_tabs_grant
  -- holds by construction. Extra pages are user-made tabs, which is what they
  -- are: nothing but a user's own action can create a second page.
  CASE WHEN p.ord = 1 THEN c.role ELSE NULL END,
  NULL,
  (SELECT COALESCE(MAX(t.position), -1) FROM dashboard_tabs t WHERE t.uid = c.uid)
    + (row_number() OVER (PARTITION BY c.uid ORDER BY c.role, p.ord))::int,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', w.value->>'id', 'widgetId', w.value->>'widgetId', 'size', w.value->'size')
           ORDER BY w.ord)
    FROM jsonb_array_elements(p.value->'widgets') WITH ORDINALITY AS w(value, ord)
  ), '[]'::jsonb),
  c.updated_at
FROM dashboard_configs c
CROSS JOIN LATERAL jsonb_array_elements(c.pages) WITH ORDINALITY AS p(value, ord)
ON CONFLICT (uid, tab_id) DO UPDATE
  SET widgets = EXCLUDED.widgets,
      title   = EXCLUDED.title,
      customized_at = EXCLUDED.customized_at
  -- Refresh only rows the application has never written. After cutover,
  -- updated_at moves off created_at on the first save and the fold stops
  -- touching that tab forever.
  WHERE dashboard_tabs.updated_at = dashboard_tabs.created_at;
```

Five deliberate properties:

- **`position` dies here, by not being copied.** Each placement is rebuilt with `id`, `widgetId`, `size` only. No later `UPDATE`, and no row can retain a stale x/y.
- **Re-running the fold refreshes, it does not skip.** v2's guard was `WHERE NOT EXISTS (... t.tab_id = ...)`, and `tab_id` is a pure function of `(role, page id)` that does not change when a user edits their layout. So v2's mandated second run would pick up **new rows only**, and every layout modified between the two runs would be served stale at cutover. The `ON CONFLICT ... DO UPDATE ... WHERE updated_at = created_at` form refreshes untouched rows and is inert on any row the application has written, which is the correct behaviour both pre- and post-cutover.
- **`position` is offset by the uid's existing maximum,** so a re-run cannot hand a new tab a position an existing tab already holds. There is no unique constraint on `(uid, position)` and the strip would otherwise order arbitrarily.
- **`customized_at := c.updated_at` on every folded tab.** A `dashboard_configs` row exists only because a user pressed something: the default is computed and returned, never written (`customization.ts:47`). So every folded tab is by definition customised and is permanently out of reach of any future `WHERE customized_at IS NULL` template-refresh job.
- **`location_id NULL` on fold, deliberately.** The source row contains no location, and grants live in custom claims, unreachable from psql. Inventing one in SQL would be a guess with a wrong-tenant failure mode, which is re-implementing `getLocationForDashboard`. Adoption is the application's job, and it runs **before** reconciliation (§9.3).

### 8.6 The runbook, because the fold is hand-applied

`docs/RESWEEP_DEPLOY_RUNBOOK.md` is edited by Story G — v2 named no story for it, and it is the document that actually carries hand-apply steps (`:59-60`). It gains, in order:

1. `CREATE TABLE IF NOT EXISTS dashboard_configs_prefold AS SELECT * FROM dashboard_configs;` **followed by `GRANT SELECT ON dashboard_configs_prefold TO tag_app_user;`**. A `CREATE TABLE AS` inherits no privileges and 003's blanket grant covers only tables existing when it ran — the trap `docs/data-model.md:85-91` documents. Reading the backup during a recovery must not be the moment that is discovered.
2. Apply 009. Run the fold once, when convenient.
3. Deploy Story H.
4. **Wait for old-revision drain**, then run the fold a final time before anyone is told the cutover is complete. `gcloud run deploy` shifts traffic but in-flight requests on the old revision drain, and those instances keep writing `dashboard_configs`.
5. Record the final run's timestamp in the runbook.

**On the ledger objection.** The completeness review is right that `schema_migrations` reports 009 as applied after run 1, which appears to argue against run 2. They answer different questions. The ledger answers "has this **file** been applied", which is what stops an operator re-running a non-idempotent DDL. The runbook step answers "has the pre-cutover **data** re-run happened", which is a deploy-sequencing fact about one release and does not belong in a table keyed by filename. Step 5 is the record.

---

## 9. TEMPLATES

### 9.1 There is no per-role template today

`getDefaultPagesForRole` (`customization.ts:88-115`) contains **no per-role branch of any kind**. It takes every id from `getAvailableWidgets(role)` (`:75, 78`), emits one page titled `roleLabel(role)` (`:111`), and fills it with all of them in registry order. One algorithm, a role-derived title. Computed from `WIDGET_REGISTRY`, that means `tag_exec` gets every tile on one page, and **six of thirteen roles get a blank dashboard** (`admin`, `tag_sales`, `tag_setter_manager`, `tag_setter`, `client_setter_manager`, `client_setter`), while a seventh (`tag_sales_manager`) gets one placeholder for `team_performance`, which has no endpoint and no loader (`web/src/app/widget-loaders.ts:27-29`).

Separately: **only four widget ids have a registered Angular component** (`portfolio`, `client_health`, `team_health_rollup`, `department_overview`, `client-widget-loaders.ts:23-41`). Everything else renders the `unbuilt` tile (`widget-host.ts:101-105`). Every widget in the `client_owner` default is unbuilt, so the founder pinned to `client_owner` by the production bug currently sees four "not built yet" tiles. The table below marks this, or a green build will be read as a working dashboard.

### 9.2 Proposed templates

A template is a **curated starting arrangement**, not everything in `availableFor` (that is today's behaviour and it is what puts every tile on an exec's page). Titles come from a new `TAB_TITLES: Record<Role, string>` beside `HAT_LABELS` (`role-labels.ts:42-56`), **not** from `HAT_LABELS`, which collides under one dashboard: `tag_setter_manager` and `client_setter_manager` both read "Setter manager", `tag_setter` and `client_setter` both read "Setter" (`:49-50, 54-55`). `roleLabel` (`customization.ts:117-133`) is a fourth copy of the same map and is deleted in favour of the import.

| Role | Tab title (stored) | Kind | Widgets | Built in Angular? |
|---|---|---|---|---|
| `admin` | — | — | **no tab** | — |
| `tag_exec` | Executive | book | `department_overview`, `portfolio`, `client_health` | all 3 |
| `tag_csd` | CS Department | book | `team_health_rollup`, `portfolio`, `client_health` | all 3 |
| `tag_csm` | My Book | book | `portfolio`, `client_health` | both |
| `tag_sales_manager` | Sales Team | book | `team_performance` | **unbuilt** |
| `tag_sales` | My Pipeline | tenant (TAG_GROWTH) | `pipeline_board`, `day_view` | **both unbuilt** |
| `tag_setter_manager` | — | — | **no tab** | — |
| `tag_setter` | — | — | **no tab** | — |
| `client_owner` | Owner | tenant | `kpi_summary`, `kpi_spend_summary`, `spend_roas`, `leads_funnel`, `owner_calendar` | **all unbuilt** |
| `client_manager` | Closing | tenant | `kpi_summary`, `leads_funnel`, `pipeline_board`, `day_view` | **all unbuilt** |
| `client_closer` | Closing Desk | tenant | `day_view`, `pipeline_board` | **both unbuilt** |
| `client_setter_manager` | — | — | **no tab** | — |
| `client_setter` | — | — | **no tab** | — |

Three consequences worth stating.

**Empty templates produce no tab, which reverses v2.** v2 gave five roles a real tab with zero widgets, arguing "a role that grants nothing visible should say so, not vanish". Under one dashboard that argument inverts: a founder holds `client_setter_manager` and `client_setter` (`functions/src/auth.ts:57-58`) and would get two permanently blank tabs beside their real ones, on a strip that is the primary navigation. The role is still disclosed, in one line in the tab-strip overflow menu — "You also hold: Setter Manager, Setter (no widgets yet)" — which says the same thing without spending two tabs on it. When a setter widget ships (`app/api/setter/dashboard/route.ts` exists and has no tile), the template gains widgets and the tab appears on the next read.

**The founder's tab count, which v2 never stated.** A founder provisioned by `clientOwnerGrants` holds five grants at one location. After the fold and the first reconciliation: **three tabs** — the folded Owner tab (adopted to their tenant), plus Closing and Closing Desk from the reconciler. `client_setter_manager` and `client_setter` produce none.

**`kpi_summary`, `leads_funnel` and `pipeline_board` leave the internal templates**, even though all three list `tag_exec` or `tag_csm` in `availableFor`: they are tenant-scoped, so an exec or CSM places them on a **tenant** tab for a tenant they cover, not on their book tab. The registry entries do not change, only the default placement. And **product decision 6 is not enforced by the template**: it is enforced by `availableFor` plus `canUseWidgetAt`. A template mistake costs a bad first screen, not a leak. That division is the point.

### 9.3 Grant-time insertion: lazy reconciliation on config read

Not inside `setUserClaims` (`lib/auth/admin.ts:140-150`), which is the Firebase auth path, and not in `functions/`, which keeps minimal deps while the pool lives in `lib/postgres.ts`. Instead, **`GET /api/dashboard/config` reconciles on every read, in one transaction, in a fixed order.** The session already carries the full grant set.

**Step 1 — adopt, strictly first.** For each row with `source_role IS NOT NULL AND location_id IS NULL`, compute the candidate locations from the session's grants whose `role = source_role`.

- Exactly one candidate `L`: `UPDATE dashboard_tabs SET location_id = $L WHERE uid = $1 AND tab_id = $2 AND location_id IS NULL`. `tab_id` is untouched, so links and `active_tab_id` survive.
- Zero candidates: the grant that justified the tab is gone. Set `revoked_at`; the tab is dormant.
- Many candidates: leave `location_id` NULL. The tab header renders a tenant chooser and the tenant widgets render a "choose a tenant" empty state. It must **not** silently pick one. Choosing calls `POST /api/dashboard/tabs/[tabId]/adopt`, which 409s if that tenant already has a `source_role` tab (§8.2).

For every founder in production today the candidate set is exactly one (`functions/src/auth.ts:52-60`), so adoption is invisible.

**Step 2 — reconcile, strictly second.** For each held `(role, location)` pair whose role has a non-empty template (§9.2):

```sql
INSERT INTO dashboard_tabs (uid, tab_id, title, source_role, location_id, position, widgets)
VALUES ($1, $2, $3, $4, $5,
        (SELECT COALESCE(MAX(position), -1) + 1 FROM dashboard_tabs WHERE uid = $1),
        $6)
ON CONFLICT (uid, source_role, (COALESCE(location_id, ''))) WHERE source_role IS NOT NULL
DO NOTHING;
```

`tab_id = source_role || ':' || COALESCE(location_id, '-')`, deterministic, one per pair. `position` is `MAX+1` computed inside the same transaction, so concurrent reads cannot both claim it. **Adoption-before-reconciliation is what makes this a no-op for a folded tab:** step 1 has already set the folded `client_owner` tab's `location_id` to X, so the conflict target `(uid, 'client_owner', 'X')` is taken and the insert does nothing. v2 specified no order between the two, and in the other order the reconciler inserts a pristine tab beside every preserved one and adoption then violates the index — the founder's layout buried among duplicates, or a constraint error on the first dashboard load.

**Why lazy and not at grant time:** a grant-time write covers `assignIndividualRole` and the group writers but **not** `provisionClientOwner` (`functions/src/auth.ts:134-142`), which is how the five founder grants actually get written. A reconciliation only some writers perform is wrong for exactly the users this product has. Cost is one indexed SELECT plus a usually-zero-row INSERT on a request that already runs a SELECT.

**Multi-location grants:** one tab per grant. `location_id` is set only when the grant names exactly one location. A grant naming many produces one **book** tab, so a `tag_exec` does not acquire a tab per client.

**Idempotency across grant, revoke, re-grant:**

- **Grant, repeated:** the partial unique index makes the second insert a database-level no-op. Re-provisioning a client (which `functions/src/auth.ts:96-101` explicitly designs for) creates no duplicates.
- **Revoke:** the tab is **not deleted**. The reconciler sets `revoked_at = now()`. Same reasoning `deleteGroup` already applies (`groups.ts:141-151`): clearing a list is not the same intent as revoking. The read path marks the tab's widgets `entitled: false`; it does not remove them, and the PUT preserves them (§5.3).
- **Re-grant:** the row still exists, so the insert does nothing and the reconciler clears `revoked_at`. The user's arrangement returns exactly as they left it.

**`revoked_at` is monotonic against a stale cache.** `getLiveClaims` caches per instance for 60 seconds and `invalidateClaimsCache` "only clears this instance" (`admin.ts:126-133`), with up to ten instances. Two instances with divergent cached claims would otherwise write opposite verdicts to a shared table on alternate page loads, and a revoked tab would flap between dormant and live on refresh. So: **the reconciler may set `revoked_at`, and may never clear it.** Clearing happens on the explicit re-grant path in `lib/auth/grant-store.ts#addGrants`, which knows the grant is real because it just wrote it, and which runs `invalidateClaimsCache` in the same call. A user re-granted a role sees the tab return within the 60-second window rather than instantly, which is the same latency every other claim change already has (§11.3).

**Five stacked guards that a customised tab is never overwritten,** so no single mistake suffices: the reconciler runs statements that **cannot write `widgets` or `title` on an existing row**; the partial unique index enforces that below the application; adoption runs first so a folded tab is never shadowed; `customized_at` scopes any future legitimate template-refresh job to `WHERE customized_at IS NULL`, and the fold sets it on every folded tab precisely so that job can never reach a pre-existing layout; and row granularity means a template write and a user save cannot interleave into a lost update.

---

## 10. THE ADMIN GRANT PATH

### 10.1 The bug that has to be fixed before "granting adds a tab" means anything

Three writers exist and they disagree:

1. `functions/src/auth.ts:120-131` `grantRoles` **merges additively** via `mergeGrants` (`:102-118`), keyed by role and location, appending at the tail.
2. `lib/auth/groups.ts:182-190` `assignIndividualRole` calls `setUserClaims(uid, [{role, locations}])` (`lib/auth/admin.ts:140-150`), which **replaces the entire `roles` array with one entry**. Reached from `app/api/admin/users/[uid]/role/route.ts:55`.
3. `groups.ts:153-166` `addMemberToGroup` and `:122-139` `updateGroupRole` do the same single-entry replacement, the latter across every member (`:136-138`).

So **an admin assigning one role today silently revokes every other grant that person holds**, including a founder's other four. Under "a person is a set of role grants" that is intolerable, and product decision 4 is meaningless while the grant write itself subtracts.

### 10.2 The grant store

`setCustomUserClaims` replaces the whole claim and offers no compare-and-swap, so read-modify-write against Firebase alone is a last-writer-wins race between two admins. Introduce one writer, with Firestore as the serialization point:

```ts
// lib/auth/grant-store.ts  (server-only)
export async function addGrants(uid: string, incoming: RoleGrant[]): Promise<RoleGrant[]>;
export async function removeGrants(uid: string, match: {role: Role; locationId?: string}[]): Promise<RoleGrant[]>;
export async function replaceGrantInPlace(uid: string, prior: {role: Role; locations: string[]},
                                          next: RoleGrant): Promise<RoleGrant[]>;
export async function replaceGrants(uid: string, next: RoleGrant[]): Promise<RoleGrant[]>;  // explicit, audited
export async function getAuthoritativeGrants(uid: string): Promise<RoleGrant[]>;            // 60s cached
```

Each runs a **Firestore transaction on `user_grants/{uid}`** (the authoritative set), applies the canonical merge rule (§10.3), then projects the result onto custom claims via `setCustomUserClaims` and calls `invalidateClaimsCache(uid)` (`admin.ts:131-133`). The projection applies the compaction and, if needed, the prefix truncation from §2.3, and always writes `grantsTruncated` explicitly.

**An absent `user_grants/{uid}` means unknown, not empty.** The transaction seeds the document from `getUserClaims(uid)` (`admin.ts:162-165`) before merging, and refuses to proceed if the claims carry `grantsTruncated: true` with no document — that combination is an inconsistency, not a starting point. Without this, the deploy ordering decides whether a founder keeps their grants: `cloudbuild.yaml` builds and deploys **one Cloud Run service**, while `functions/` deploys separately through `functions/package.json`'s three `gcloud functions deploy` scripts. If Cloud Run lands first, `provisionClientOwner` writes claims with no `user_grants` document; the next admin action reads an absent document as the empty set, merges one grant onto nothing, and projects that over the claims — **the founder's five grants wiped by the code written to stop exactly that**. With the seed, the ordering stops mattering. The runbook still states functions-first.

Consequences at the existing call sites:

- `assignIndividualRole` (`groups.ts:182-190`) becomes `addGrants`, **and `detachFromCurrentGroup` (`:77-88`) must revoke what it detaches.** Today that function edits only `memberUids` and its own comment says it "does not touch their claims" (`:77`), which is safe only because `setUserClaims` destroys the old grant by replacing the whole array. Make the write additive and nothing revokes it: an admin moving U from "Owners @ Acme" to "Setters @ Beta" leaves U holding `client_owner@X` forever, invisible in an admin UI that shows U in one group. So `detachFromCurrentGroup` returns the group it detached from, and both callers (`:157`, `:188`) issue `removeGrants(uid, prior.locations.map(l => ({role: prior.role, locationId: l})))` **inside the same transaction** as the `addGrants`. Removal does not reorder the survivors.
- The admin API gains an explicit `DELETE /api/admin/users/[uid]/role/[role]`, shipped **in the same commit** as the switch to additive, not later. Replacement stops being the accidental default of an add.
- `addMemberToGroup` (`:153-166`) becomes `addGrants` with the group's `{role, locations}`, plus the detach revoke above.
- `updateGroupRole` (`:122-139`) becomes, per member, **`replaceGrantInPlace`** of the group's previous `(role, locations)` with the new one, in one transaction. Not remove-then-add: that moves the grant to the tail and can change `roles[0]` for a member whose group grant happens to be first, which is defect 2 arriving through a different door.
- `removeMemberFromGroup` (`:169-179`) and `deleteGroup` (`:149-151`) keep their current claims-untouched behaviour, for the reason their own comments give (`:141-148`, `:168`).
- `promoteToExec` (`admin.ts:155-157`) becomes `addGrants(uid, [{role: ROLES.TAG_EXEC, locations: []}])`. Under the role-derived wildcard (§4.4) the empty array is correct and needs no change of meaning.
- `functions/src/auth.ts` keeps its own merge implementation and gains the same Firestore transaction. `functions/src/firestore.ts` already exists and `@google-cloud/firestore` is already a dependency (`functions/package.json`), so this needs no new package and no workspace-boundary crossing. `grantRoles` reads `user_grants/{uid}` as its input rather than `user.customClaims?.roles` (`:122-124`), because under truncation the claim is a lossy projection and merging onto it would delete the grants that did not fit — permanently, silently, and unreconstructably.
- **Every non-admin escalation path was checked and none exists:** every mutation route above is `requireApiRole([ROLES.ADMIN])` (`users/[uid]/role/route.ts:33`, `groups/[groupId]/route.ts:25,53`, `groups/[groupId]/members/route.ts:24`).

**`user_grants` is a new Firestore collection, so `docs/data-model.md` ships in the same commit.** The pre-commit data-model check (`scripts/check-story-status.mjs`, Check 3) matches only `lib/firestore.ts`, `lib/postgres.ts`, `functions/sql/` and `app/actions.ts`, so a collection declared from `lib/auth/grant-store.ts` will not trip it and CLAUDE.md's requirement would be missed silently. Story I therefore **adds `lib/auth/grant-store.ts` and `functions/src/firestore.ts` to that check's path list**, in the same commit, so the next one is caught mechanically rather than remembered.

**Rejected alternative:** make `lib/` import `functions/src/auth.ts#mergeGrants`. It crosses the workspace boundary that the minimal-deps decision exists to protect, and it would pull the Admin SDK's Node-only transport into a path an Angular build can reach.

**Rejected alternative:** keep claims as the sole authority and accept the race. Two admins editing one user in the same minute is rare, and the failure is a silent partial revoke that nobody can reconstruct afterward, because nothing records what the claim used to be.

### 10.3 Grant order is preserved — **DEFECT 2**

**The rule: the grant writer is append-only and order-preserving. Nothing sorts `roles` at write time. Ever.**

v2 had `addGrants` and the §2.3 compaction re-sort by `ROLE_LIST` — ADMIN, TAG_EXEC, TAG_CSD, TAG_CSM, … CLIENT_OWNER, … — described as "widest first". Grant a founder any TAG staff role and `roles[0]` flips from `client_owner` to the staff role. Roll back to any build that still reads the hat and `resolveSession:185-187` pins `currentRole` to `availableRoles[0]`, which is now the staff grant. Three consequences follow, all silent:

- `session.locations` becomes the staff grant's locations (`session.ts:190-191`), so **the founder's own tenant is no longer reachable** — `ownsLocation` at `:294` fails on their own firm.
- `getLocationForDashboard` takes the `tag_*` branch (`location-selection.ts:16`) and returns TAG_GROWTH instead of their firm.
- `loadDashboardConfig(uid, role)` queries `WHERE uid = $1 AND role = $2` (`customization.ts:26-29`), misses their saved row, and returns `createDefaultConfig` (`:47`). **Their layout reads as deleted.**

Claim shape unchanged is not the same as claim content unchanged, and v2's rollback argument rested on the latter while proving only the former.

**The rule, stated precisely.** Both writers implement this and nothing else:

```
merge(existing, incoming):
  merged = [...existing]
  for gi in incoming:
    i = first index in merged where
          merged[i].role === gi.role AND overlaps(merged[i].locations, gi.locations)
        where overlaps(a, b) = (a.length === 0 && b.length === 0)
                            || b.some(l => a.includes(l))
    if i found: merged[i] = {...gi}     // replace IN PLACE; position preserved
    else:       merged.push({...gi})    // append at the TAIL
  return merged
```

This is `functions/src/auth.ts#mergeGrants` (`:102-118`) with two corrections, both narrowing and both needing `npm run check:functions`:

- It matches on the whole incoming `locations` array rather than only `locations[0]` (`:109`). Today an incoming `{closer, ["Z","Y"]}` against an existing `{closer, ["Y"]}` does not match (`["Y"].includes("Z")` is false) and appends a duplicate grant covering Y twice. Under the rule it replaces in place.
- It handles the empty-locations case. Today `target` is `undefined` for a global grant and `includes(undefined)` is always false, so `promoteToExec` run twice appends two identical `{tag_exec, []}` entries and keeps doing so.

**Compaction preserves position** (§2.3 step 1): grants sharing `(role, scope, team)` merge into the **first occurrence's** index; later occurrences are removed and nothing else moves. **Truncation preserves position** (§2.3 step 2): the longest prefix of the stored order that fits. **`replaceGrantInPlace`** exists so `updateGroupRole` does not have to remove-then-append (§10.2). Those four are the complete set of write-side operations, and none of them reorders.

**Sorting happens once, at read time, in `authorizingGrant`** (§5.1). Nothing downstream needs a sorted claim, so the writer has no reason to produce one. That is the whole trade: one `[...].sort()` per authorization question, in exchange for a rollback that restores the pre-existing behaviour instead of a new failure.

**The shared fixture tests ORDER, not just the merged set.** `test/fixtures/grant-merge-cases.json` holds `{name, existing, incoming, expected}` triples, and both `test/grant-store.test.ts` and `functions/src/auth.test.ts` assert `toEqual` on the **ordered array**. v2's fixture tested the set, so the two writers could disagree on `roles[0]` and it would pass. Required cases, named:

| Case | Assertion |
|---|---|
| founder plus a staff role | `existing = clientOwnerGrants("X")`, `incoming = [{tag_csm, []}]` → `expected[0].role === "client_owner"`, `expected[5].role === "tag_csm"` |
| re-provision the same client | `existing = clientOwnerGrants("X")`, `incoming = clientOwnerGrants("X")` → deep-equal to `existing`, same length, same order |
| second tenancy | `incoming = clientOwnerGrants("Y")` → 10 entries, first five unchanged and in place |
| re-promote an exec | `existing = [{tag_exec, []}]`, `incoming = [{tag_exec, []}]` → one entry, not two |
| overlapping multi-location | `existing = [{client_closer, ["Y"]}]`, `incoming = [{client_closer, ["Z","Y"]}]` → one entry at index 0 |
| in-place group role change | `replaceGrantInPlace` on a first-position grant leaves it at index 0 |
| compaction | three same-`(role, scope)` grants at indices 0, 2, 4 collapse to one entry at index 0; the entries at 1 and 3 keep their relative order |
| prefix truncation | a 20-grant set truncates to a prefix, and `result[0]` equals `input[0]` |

---

## 11. ROLLOUT (answers M1 and M2)

### 11.1 M2: there is no migration runner, and this design does not pretend otherwise

Confirmed, not assumed: `cloudbuild.yaml:90-196` has five steps (`check-substitutions`, `pull-cache`, `build`, `push`, `deploy`) and no SQL step. `docs/RESWEEP_DEPLOY_RUNBOOK.md:59-60` states the SQL files are applied by hand. `git grep schema_migrations origin/main` returns nothing. `functions/sql/` holds 001 through 007. Migration 006 already failed once on a clean sequential deploy.

**Numbering, stated because v2 left a gap an operator would look for.** 008 is the ledger, 009 is tabs plus fold, 010 is the drop. Contiguous. v2 used 008 for tabs, 010 for the drop, and never said what 009 was.

**Story 0 (SQL only, zero app change): the migration ledger, `functions/sql/008_schema_migrations.sql`.**

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON schema_migrations TO tag_app_user;
```

plus one self-registering line at the foot of each migration (`INSERT ... ON CONFLICT DO NOTHING`), plus a backfill recording 001 through 007 as applied **without running them**, because on the live database they demonstrably have been. This is not scope creep: the brief asks for a safe migration, and for a hand-applied file "safe" means the operator can answer "has this already run?" before running it. Today they cannot, which is exactly how 006 reached a state nobody could characterise without the four diagnostic queries at `RESWEEP_DEPLOY_RUNBOOK.md:35-57`. Story 0 stages `functions/sql/`, so **`docs/data-model.md` ships with it** (`scripts/check-story-status.mjs:222-236`), which is also where `dashboard_configs` finally gets documented.

**Explicitly out of scope,** and recorded in `docs/data-model.md` next to the migration-order note at `:93-99` so it is a known gap rather than an oversight: a runner script that diffs the directory against the ledger, and a `cloudbuild.yaml` step that invokes it. That is a deploy-pipeline change to a file whose comments already record that deploys are manual with hand-passed substitutions, and per CLAUDE.md's phase-gate rule it needs its own story and its own green gate.

**Rules 009 follows.** Idempotent by construction in 006's `DO $$ ... to_regclass(...)` idiom, every DDL `IF NOT EXISTS`, the fold an upsert bounded by `updated_at = created_at` (§8.5). **Additive only: `dashboard_configs` is not dropped**, so a rolled-back image reads a table that is still present and still correct. Explicit `GRANT` inside the file. No assumption about which of 002/003 built the source table. Backup first, with its own `GRANT` (§8.6).

### 11.2 M1: the sequence, and why this order

Three techniques make the compile break tractable, and all three are deliberate:

- **`Session.currentRole` is not deleted first. It is deleted last.** Story A adds `grants` beside it. Every conversion story then removes readers. By the final story nothing reads it and its deletion is a pure removal with no replacement to invent. The alternative (delete first, fix 30 sites) is the shape that failed review.
- **Every tenant-scoped gate becomes per-location in one story, before anything else widens.** This is the correction to v2's B/C/D split. v2 shipped the reachability union at `requireApiLocationAccess` in Story C while `app/api/ghl/_lib/gate.ts:81-83`'s `canConfigureFollowUp(session)` stayed location-blind until Story D. Between the two, a user holding `client_owner@X` and `client_setter@Y` reaches Y through the union and is judged `client_owner` there — able to rewrite Y's follow-up threshold, close Y's opportunities and change Y's appointment statuses. A real cross-tenant **write** escalation, live for a story's duration. In v3 the reachability widening at a route and the per-location role test at that route are the same commit, by construction: both come from `resolveLocationContext`.
- **The renaming, not just the retyping, of `hasAnyRole`.** §4.1. The type change forces a conversion at 24 sites; the rename plus the ESLint restriction forces the *right* conversion at the tenant-scoped ones.

| # | Story | Contents | What a signed-in user experiences |
|---|---|---|---|
| **0** | Migration ledger | `008_schema_migrations.sql`, backfill 001-007, registration lines, `docs/data-model.md` (including `dashboard_configs`). Hand-applied SQL, no deploy | Nothing |
| **A** | Grants on the session | `grants: RoleGrant[]` on `Session`; `lib/auth/grants.ts` (predicates, `GLOBAL_ROLES`); the reduced `SessionPayload` (§4.5) and its Angular mirror; delete dead `switchRole` (`rbac.service.ts:30-31`, `http-rbac.service.ts:42-51`, mock and signed-out implementations) and `POST /api/session/role`; delete `legacy/hat-switcher.tsx`, `legacy/role-switcher-actions.ts`, `_archive/.../hat-actions.ts`; delete `test/role-endpoint.test.ts`. Additive on the auth path | Nothing. The deleted switcher had no caller |
| **A2** | Registry truth | `scope: 'tenant'\|'book'` on both registries; the `kpi_summary` / `kpi_spend_summary` split; `tag_sales`/`tag_sales_manager` on `pipeline_board` and `day_view`; `client_manager` on `day_view`; `owner_calendar` retitled with `scoped` surfaced; `tag_sales` out of `ROLES_WITHOUT_WIDGETS`; `availableFor` deleted from `web/src/app/shared/widgets/`; `scripts/check-widget-parity.mjs` **plus its line in `scripts/hooks/pre-commit`** and `npm run hooks:install` | **Product decision 6 is delivered.** A closing manager stops seeing spend and ROAS keys in their KPI tile and keeps booking rate. A `tag_sales` user has widgets for the first time |
| **B** | Entitlement carries its location | `lib/auth/location-context.ts` as the single tenant-scoped authority; `resolveScopeAt`; convert **every** tenant-scoped gate together — the five widget endpoints, `kpi-summary`, `setter/dashboard:55`, the `app/api/ghl/**` family including `canConfigureFollowUp`, `app/api/clients/**`, `onboarding/checklist:92`; `loadClientBook`/`loadOwnBook`/`CROSS_BOOK_ROLES` take a resolved role; delete `location-selection.ts`, `resolveDashboardLocation`, `canUseWidget`, and the five no-location sample branches; `?locationId=` required everywhere; `tagGrowthLocationId` in `lib/config.ts` | **F1 is closed here.** A user with grants at two tenants can no longer read the second tenant's spend through the first's role. Tenant tiles now need a location and 403 without one |
| **C** | Union reachability | `Session.locations` → `reachableLocations`, unioned, expanded via `GLOBAL_ROLES`; `ownsLocation`, `requireApiLocationAccess`, `location-access.guard` (its three-role branch deleted, §4.5), `portfolio/tenants`, the 403 text at `session.ts:317` | **Product decision 3 becomes visible.** A person granted at two tenants sees both in the portfolio list for the first time |
| **D** | Location-free role gates | `hasAnyRoleAnywhere` at the remaining sites: `requireRole`, both `requireApiRole` copies, the flow and admin routes, `knowledge-base`, `meta/status`, `webhook-auth.ts:37` (signed off), `impersonation/enter:41` **with `tenantExists`**, `has-permission.directive`, `permission.service`, `flow-framework:72,76,78`; the ESLint restriction on `hasAnyRoleAnywhere` | **The production bug is fixed.** A founder reaches everything all five grants allow, not just the first. Nav items appear that never appeared before |
| **F** | F2 hardening | `validateLocations(locations, role)` rejects `[]` for non-global roles and non-`[]` for global roles; `functions/src/auth.ts:46-47` comment corrected | An admin submitting a blank locations textarea, or scoping a global role to one tenant, gets a 400 naming the field instead of a silently useless or silently ignored grant |
| **G** | Tables and fold (009) | Hand-applied SQL per §8.6: back up **with its GRANT**, create `dashboard_tabs`/`dashboard_prefs`, fold. App change limited to replacing `customization.ts:42-47`'s catch-to-empty with the typed 503 (§8.1). `docs/data-model.md` and `docs/RESWEEP_DEPLOY_RUNBOOK.md` in the same commit | Nothing visible. A transient DB error stops silently deleting layouts and starts saying so |
| **H** | Cut over to tabs | Re-run the fold immediately before deploy, and again after drain. Then: `customization.ts` keyed on uid alone; `config-parse.ts` (drop `position`, drop `role`, **do not add `locationId`**); `config/route.ts` per-tab entitlement with `entitled` flags and add-only PUT validation; `?tab=` replaces `?locationId=` on the six tenant endpoints and on `widgets/route.ts`; `freshnessByLocation`; `PUT /api/dashboard/prefs`; `POST /api/dashboard/tabs[/[tabId]/adopt]`; `DashboardConfig.role` deleted; Angular mirrors; `dashboard-shell` copy | **One dashboard, one tab per old role layout, arrangements preserved.** Tenant widgets on a tab with no adopted tenant show a chooser rather than a guess |
| **I** | Grant store, reconciler, templates | `lib/auth/grant-store.ts`, `user_grants/{uid}`, the §2.3 overflow path and its document cache, admin add/remove API, `detachFromCurrentGroup` revoking, `updateGroupRole` in place, the templates, `customized_at`, adopt-then-reconcile, dormant and re-grant handling, `check-story-status.mjs` path list extended. Touches `functions/**`, so `npm run check:functions` gates it | **Product decision 4 becomes true.** A newly granted role appears as a new tab on next dashboard load; existing tabs are untouched; an admin assigning a role stops silently revoking the others |
| **J** | Drag and drop | `cdkDropList`/`cdkDrag`, `moveItemInArray`, 200ms touch delay, keyboard reorder on the grid, arrow buttons retained on the picker, drag surface behind an `editing` signal | **Product decision 5 ships.** Last, deliberately: the only purely presentational story, and it must not block a security fix |
| **K** | Delete the hat | `Session.currentRole`, `Session.availableRoles`, `SessionPayload.currentRole`/`availableRoles`, the Angular `Session` mirror fields, `PermissionService.currentRole`, `hasRole`, `effectiveRole`, `resolveSession`'s `requestedRole` parameter | Nothing. Nothing has read them since D |
| **M** | Retire the role cookie | `ROLE_COOKIE` removed from the `clearAuthCookies` loop (`session-cookie.ts:166`) **and** the constant deleted (`session.ts:22`), one release after K. Fixes the two module-factory mocks (`test/google-signin.test.ts:51`, `test/signout-redirect.test.ts:39`) | Nothing |
| **L** | Drop `dashboard_configs` (010) | Hand-run, separate, later, only after H has been live long enough to trust | Nothing |

Cross-cutting gates per CLAUDE.md: every story touching `functions/sql/` stages `docs/data-model.md` (`scripts/check-story-status.mjs:222-236`); every story touching `web/` runs the full Angular gate (`scripts/hooks/pre-commit:22-39`); stories F and I touch `functions/**` and add `npm run check:functions` to the gate. Story A rewrites the spec files enumerated as broken by the `Session` shape change; Story A2 rewrites `widget-registry.service.spec.ts`, `dashboard-customize.spec.ts:33` and `layout-edit.spec.ts:43`.

### 11.3 Claims are read live with a 60-second cache

`resolveSession` takes roles from `getLiveClaims` (`session.ts:169-176`, cache at `admin.ts:105-123`), not from the 14-day cookie snapshot, and falls back to the cookie's claims only if the Admin SDK lookup throws (`:173-175`). Four consequences for this rollout:

1. **No story requires a sign-out or a cookie re-issue.** The session cookie carries no role decision this design depends on.
2. **A grant change is visible within 60 seconds**, immediately on the instance that made it (`invalidateClaimsCache`). Story I's reconciler therefore sees a new grant on the first dashboard load after that window, which is what makes "granting adds a tab" feel immediate — and it is why `revoked_at` is monotonic against the cache rather than recomputed from it (§9.3).
3. **A rollback is visible within 60 seconds too**, in the same way, and with the claim shape *and order* unchanged there is nothing to un-write.
4. **The one skew case is an Admin SDK blip during a deploy**, where a user resolves from a 14-day-old cookie snapshot. Because the claim shape never changes, that snapshot parses correctly under every build in this sequence and yields whatever grants that user held at sign-in. Degraded freshness, never a sign-out, and never a widening.

The wire contract has no equivalent skew case, because the Angular bundle ships inside the Next image (`package.json:10`) and `cloudbuild.yaml` deploys one service (§3, §4.5).

---

## 12. WHAT THIS DOES NOT SOLVE

1. **No migration runner, and no `cloudbuild.yaml` SQL step.** Stories 0, G and L are hand-applied via psql. The ledger makes each apply *verifiable*; it does not make it *automatic*. The pre-cutover fold re-run is a runbook step whose completion is recorded by hand (§8.6). This is the largest operational risk in the plan and it is deferred on purpose, with the deferral recorded in `docs/data-model.md`.
2. **Two conflicting declarations of `dashboard_configs` remain** (`002:2-10` vs `003:270-284`). 009 works with either, and L drops the table, but until then a dev box seeded from 003 alone has a different column set from production. Reconciling them is its own story.
3. **Most widgets are still unbuilt in Angular.** Four ids have components (`client-widget-loaders.ts:23-41`). Every widget in the `client_owner` template renders the `unbuilt` tile. The templates in §9 are correct and mostly aspirational; a green build here does not mean a working founder dashboard.
4. **`team_performance` has no endpoint at all.** The `tag_sales_manager` template is a single placeholder.
5. **`kpi_summary` and `kpi_spend_summary` still serve `MOCK_METRICS` after this work.** Both are gated as `tenant` and the spend keys now sit behind `[client_owner, tag_exec]`, so the control is in place before the data is. `source` remains the literal `"sample"` (`kpi-summary/route.ts:37`) and the route comment at `:25-28` records what has to change when a live fetch arrives.
6. **Four roles hold no widgets and therefore no tab** (`admin`, `tag_setter`, `tag_setter_manager`, `client_setter`, `client_setter_manager` — five roles, four templates, since two share the setter shape). Disclosed in the tab-strip overflow line (§9.2) rather than as blank tabs. One constraint on whoever closes it: setter roles get speed-to-lead (`app/api/setter/dashboard/route.ts`, now per-location), never a spend widget.
7. **The union widens the webhook bearer-token bypass** (`lib/api/webhook-auth.ts:37`). A client founder who also holds any TAG staff role skips the bearer requirement on the onboarding trigger routes. Correct under the decision, and the widest blast radius in the plan.
8. **Impersonation audit entries become noisier.** A dual-holder passes the `tag_csm` test and creates records the route's own comment says are meaningless (`impersonation/enter/route.ts:21-24`). Accepted rather than refusing a real CSM; the access such a record grants is bounded by §5.2's pinning and by the new `tenantExists` check.
9. **`user_grants/{uid}` and custom claims can diverge if someone edits claims in the Firebase console.** Console edits are unsupported after Story I; a `scripts/reconcile-grants.ts` re-projection is the recovery path and is not written here.
10. **Free 2D widget placement is given up, permanently, not deferred.** Deleting `position` means holes in the grid cannot be expressed. Reintroducing it later is a render rewrite plus a server-side collision validator plus a defined mobile flattening.
11. **A tab whose `source_role` grant covers many tenants stays unadopted until the user chooses.** §9.3 refuses to guess. Every founder in production today has exactly one candidate, so this is a path with no current occupants — but it has a UI (`POST .../adopt`, a 409 merge prompt) that will be exercised for the first time by whoever hits it.
12. **Nothing here fixes the second `requireApiRole` copy.** `app/api/admin/_lib/http.ts:149` and `app/api/dashboard/_lib/http.ts:149` are byte-identical duplicates and both get edited in Story D. Deduplicating them is a separate cleanup.
13. **`grantsTruncated` has no operator surface.** When it is set, the admin UI shows nothing to say a user's claim is a projection. The recovery path is `getAuthoritativeGrants`, which is a function, not a screen. A user holding more than about a dozen single-location grants is not a shape this product has yet, which is why this is listed rather than built.
14. **The reduced wire payload duplicates the expanded location list** for a global-role holder — once inside their grant, once in `reachableLocations` (§4.5). Order of a few KB on a once-per-load `no-store` response. The fix, if it ever matters, is not a wire-level `global: true` flag, for the reason §4.5 gives.