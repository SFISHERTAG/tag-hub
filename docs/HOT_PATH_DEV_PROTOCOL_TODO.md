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

### The one thing this decision does NOT license

**Hot Path still may not be keyed on `locationId`.** This is now a commercial requirement,
not a portability one. A GHL location ID is a key GHL owns, and Hot Path needs one it owns:

- Multiple agencies install, each with their own location namespace.
- Billing, entitlements and plan tiers attach to a customer, not to a location. A location
  can be deleted, cloned from a template, or moved between agencies.
- One customer can have many locations. Keyed on `locationId` there is no way to express
  "this agency, 60 sub-accounts, one subscription."

You cannot bill a marketplace app on a key the marketplace owns. Introduce an internal
`tenantId` and demote the location ID to `externalRefs.ghl.locationId`. Blast radius at time
of writing: 175 files reference `locationId`, plus Firestore paths (`locations/{locationId}`
and four subcollections, `ghl/agency/**`) and Postgres tables (`tenants`,
`appointment_outcomes` PK, `ghl_location_tokens`). Mostly mechanical, but it is the gate to
charging money.

**Also unchanged:** finish the Story 11.6 courses backfill before any further store
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
