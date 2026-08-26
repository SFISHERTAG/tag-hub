# Hot Path Dev Protocol — TODO

**Status:** Deferred 2026-08-23. Document this so it doesn't get lost when TAG work winds down.

---

## What This Is

Hot Path is the core product/boilerplate that TAG is a remix/prototype of. The extraction hasn't happened yet. When it does, development needs a protocol to prevent the two from tangling.

**See also:** [project_hotpath_product_extraction.md](/Users/home/.claude/projects/-Users-home-projects-TAG/memory/project_hotpath_product_extraction.md)

---

## Decided 2026-08-26: Hot Path is a GHL Marketplace app

**Decision.** GHL is a core product dependency of Hot Path, not a TAG-specific detail.
Google Cloud (Identity Platform, Firestore, Cloud SQL, Cloud Run) and Google Workspace
(Drive, Docs) are likewise core. No CRM abstraction layer will be built.

**Driver.** GHL agencies are the ICP. Both known consumers, TAG and CCE, run GHL. A
vendor-neutral CRM port would be cost paid for customers who do not exist, and it would
slow down the GHL-specific features that are the product. Distribution beats portability
when the ICP is defined and lives inside one platform.

**Already true, and it is the asset.** TAG is a published GHL Marketplace app configured
for Target User: Sub-Account with agency and sub-account distribution
(`docs/architecture.md:173-175`). One agency install mints short-lived location-scoped
tokens on demand, so 40+ sub-accounts are served with no per-client secret to provision
(`lib/ghl/oauth.ts`, `lib/ghl/store.ts`). Agency tokens are keyed by company after an
earlier shared-document bug that would have taken the whole portfolio dark on an outside
install with no alarm. That token indirection is the hard part of a multi-tenant
marketplace app and it is already running in production.

**This closes open items 4 and 6 below.** Boundary enforcement and module isolation: the
existing `no-restricted-imports` zones stay exactly as they are. They keep integrations
from importing each other, which is still correct. They are not, and were never, a CRM
portability seam.

### The one thing this decision does NOT license: the tenancy boundary

**Hot Path may not treat `locationId` as its tenancy boundary.** The first draft of this
section said to rename `locationId` to `tenantId` across ~175 files. That was the wrong
shape and it is superseded by what follows. The correction matters more than the original,
so it is recorded rather than overwritten.

#### The model: a missing parent, not a wrong key

Most things keyed on `locationId` genuinely *are* per-location facts, and renaming them
would be renaming a correct key. `appointment_outcomes`, `followUpConfig`,
`onboardingChecklists`, `campaignLaunches`, `metaConversionLog` and `auditLog` are all
per-location. `ghl_location_tokens` is per-location by definition, because GHL mints tokens
that way.

What is absent is an entity *above* location:

```
account    (new: the billing entity and the tenancy boundary)
  └── location    (existing, keyed by GHL location id, unchanged)
```

`locations` gains an `account_id` foreign key; a new `accounts` table appears. Every other
key stays. "One agency, 60 sub-accounts, one subscription" becomes one `accounts` row and
60 `tenants` rows. The ~175 files that reference `locationId` change **zero**, because they
pass a location id through and none of them care what sits above it.

#### The urgent reason is a cross-tenant leak, not billing

Recorded here because it is the reason this has a deadline, and the deadline is Hot Path's
second customer rather than a date.

`lib/auth/session.ts:215` expands the current grant for global roles:

```ts
if (isGlobalRole(currentRole)) {
  locations = await listAllLocationIds();
}
```

`GLOBAL_ROLES` is `[ADMIN, TAG_CSD, TAG_EXEC]` (`lib/auth/grants.ts:58`).
`listAllLocationIds()` (`lib/ghl/tenants.ts:98`) reads **every location in the registry**,
unfiltered. `ownsLocation()` (`lib/auth/session.ts:305`) does not even consult the list:

```ts
if (isGlobalRole(session.currentRole)) return true;
```

A global role therefore owns every location unconditionally.

This is correct today, because TAG is the only installer and the registry holds only TAG's
locations. **It becomes a cross-tenant data leak the moment a second account has rows in
that registry.** An admin at account A gets `true` from `ownsLocation()` for account B's
locations, `requireLocationAccess()` waves them through, and `lib/ghl/client.ts` mints a
location-scoped GHL token for a sub-account they do not own. Nothing in the code complains
on the way there, and no test covers it, so this will not announce itself.

The account entity is what gives `listAllLocationIds()` something to filter on. There is no
correct fix without it. This is also why the UI-gating rule in `CLAUDE.md` matters here:
hiding a location picker would not touch any of the three functions above.

#### Why this is cheap: the seams already exist

Three seams funnel every location-scoped access, and that work is already done:

1. **`lib/data/repository.ts` (Story 14.1).** Seven parent-scoped accessors take a
   `locationId` (`auditLog`, `appointmentOutcomes`, `followUpConfig`, `metaConversionLog`,
   `metaFetchLog`, `onboardingChecklists`, `campaignLaunches`) plus three top-level refs
   (`locations`, `ghlLocationTokens`, `ghlCompanyTokens`). Every Firestore read and write
   goes through this interface and its two implementations.
2. **`lib/auth/session.ts`.** `RoleGrant.locations`, `ownsLocation()`,
   `requireLocationAccess()`. The whole authorization boundary is three functions in one file.
3. **`lib/ghl/client.ts`.** Every GHL call resolves a token by location id and already calls
   `requireLocationAccess()` itself.

Design surface is roughly six files. The rest is pass-through and stays untouched.

#### Sequence

1. **Add `accounts`, backfill, read nothing.**
   ```sql
   CREATE TABLE accounts (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     ghl_company_id TEXT UNIQUE,   -- null for direct installs
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ALTER TABLE tenants ADD COLUMN account_id TEXT REFERENCES accounts(id);
   ```
   Backfill, then set NOT NULL. Zero behaviour change. `docs/data-model.md` updates in the
   same commit, per the pre-commit hook.
2. **Close the auth hole.** Add `accountId` to `Session`. Replace `listAllLocationIds()`
   with an account-scoped form, and make the `ownsLocation()` global-role short-circuit
   account-scoped rather than unconditional. Do **not** change the claim shape:
   `RoleGrant.locations` stays a location list, so every existing claim keeps working and
   nothing needs re-issuing. This phase needs real tests.
3. **Billing reads `accounts`.** Plan, entitlements and subscription attach to the account
   row. Nothing else moves.
4. **A cosmetic `tenantId` rename, if ever.** It buys nothing once the model is right.
   Recommendation: do not.

#### The one open question, which code cannot answer

`lib/ghl/store.ts` documents two install paths and says the second is "half the portfolio":

- **Agency install** yields a `companyId`. Account maps to company almost 1:1, and
  `ghlCompanyTokens` is already keyed that way. Nearly free.
- **Direct location install** onto a single sub-account yields no company at all. There is
  nothing to derive an account from.

The backfill therefore needs a rule for direct installs: one synthetic account per location,
or a manual grouping where several locations are known to be one customer. Fragmenting one
customer into 30 accounts is the harmless failure. Merging two customers into one account
reintroduces the leak above by a different route, so that is the one to guard against.

**Owner: Sam.** This needs the current direct-install list read commercially, not from code.

### Other carve-outs, unchanged

**Story 11.6 still gates store migration.** Finish the courses backfill before any further store
migration. Unrelated to this decision, still blocking. Note that `docs/data-model.md`
currently claims that backfill is verified while `docs/stories/11.6-*.md` says Status:
Review with the script not yet run against production. Those contradict; the story is the
one built from code.

**Retained port, for one reason only.** `lib/sources/metric-source.ts` keeps its injected
`SourcePorts` shape because it lets tests run without a live GHL token. That is velocity,
not portability. Do not generalize it further.

---

## What Should Be Decided

1. **Extraction sequencing** — how to cleanly separate Hot Path product from TAG-specific code without losing either?

2. **Parallel development** — can they be worked on simultaneously, or must extraction complete first?

3. **Session/model assignment** — should Hot Path use different session types or model tiers than TAG remix work? (See 2026-08-23 session consolidation for why this matters: Haiku/Sonnet/Opus for different task complexity.)

4. **Boundary enforcement** — *decided 2026-08-26, see above.* — which directories, concerns, and modules belong to core product vs. TAG-specific remix? How are violations caught?

5. **Dependency management** — if TAG changes shared code, does it feed back to Hot Path automatically? Via PR? Via manual sync?

6. **Module isolation** — *decided 2026-08-26, see above.* — does the `no-restricted-imports` ESLint zone pattern (currently enforcing integration module isolation in TAG) apply to Hot Path / remix boundary?

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
