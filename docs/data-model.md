# TAG Data Model

Single source of truth for all data stores, schemas, and the reason each exists.
Update this doc whenever a table is added, a collection is created, or a data
boundary changes. Same commit as the code change.

## Firestore (primary system of record)

**Location:** Google Cloud Firestore (GCP project: `GOOGLE_CLOUD_PROJECT`)

`GOOGLE_CLOUD_PROJECT` has no fallback (`lib/firestore.ts#firestore()` throws immediately if it's
unset) — it used to default to the real production project id, so a missing env var silently
connected local/dev/script runs to live production data instead of failing. `lib/auth/otp.ts` now
uses this same shared client rather than constructing its own.

### Collections

| Collection | Purpose | Primary key | Replicated to Postgres? |
|---|---|---|---|
| `orgs` | Organizations and their tenants | doc ID | No |
| `locations` | Client sub-accounts within an org | doc ID | No |
| `users` | Sign-in identities and session auth | doc ID (Firebase UID) | No |
| `authCodes` | Hashed 6-digit sign-in codes | sha256 of the lowercased email | **No TTL policy configured** |
| `authCodeCooldowns` | Resend rate limit, one doc per address | sha256 of the lowercased email | **No TTL policy configured** |
| `locations/{id}/auditLog` | Immutable record of sensitive actions, per tenant | doc ID (auto) | No |
| `flow_scripts` | FLOW automation editor content | doc ID | No |
| `creatives` | Campaign creative assets | doc ID | No |
| `bug_reports` | Client-submitted bugs and feedback | doc ID | No |
| `manual_pages` | Knowledge base (TAG CSM Operating Manual) content, viewable in-app | doc ID (`p0`–`p13`, matches `_archive/manual-content.json`) | No |
| `manual_pages/{id}/versions` | Version history for one knowledge base page — full prior snapshot + author + timestamp, written before every admin edit | doc ID (auto) | No |
| `ghl/agency` | Root of GHL credential storage. Records `primaryCompanyId`, the agency whose token serves locations with no recorded owner | fixed doc ID | No |
| `ghl/agency/companies/{companyId}` | One agency OAuth token per installing company | GHL company ID | No |
| `ghl/agency/locations/{locationId}` | Per-location tokens, minted from an agency token or obtained by direct install | GHL location ID | No |

**GHL agency tokens are keyed by company, not shared.** They previously lived in
one document at `ghl/agency`. Any agency completing a company-level install
overwrote it, `companyId` included, so every later mint for every one of our own
sub-accounts would have been attempted against the wrong company. That is a
whole-portfolio outage triggered by one outside install, with no error until
requests started failing. The first install recorded becomes `primaryCompanyId`
and is never reassigned; later installs by other agencies are stored under their
own company and serve only their own locations. `ghl/agency/locations/{id}`
carries `agencyCompanyId` so a re-mint returns to the agency that owns the
location rather than guessing the primary. Documents written before this change
have no `agencyCompanyId` and fall back to the primary, which is correct for
them: they were all minted through it.

**Why Firestore for these:** real-time sync, permission-based read/write rules,
sub-millisecond lookups, immutable audit trail (`setOnServer()` guards). None of
these are read from Postgres.

**`manual_pages` versioning is not `audit_log`.** It follows the
`flow_audit_log` revert-capable pattern instead (own sub-collection, full
content snapshot per version) — see "Audit trail" below for why the two
patterns differ.

---


### Auth collections (corrected 10.2)

These three rows previously read `otp` and a top-level `audit_log`, neither of
which exists. The real names are above; `lib/auth/otp.ts` writes `authCodes` and
`lib/audit/store.ts` writes a per-location `auditLog` subcollection.

`authCodeCooldowns` is new in story 10.2 and is deliberately a separate document
from `authCodes`. The resend cooldown used to live on the code document, and
`verifyCode` deletes that document on success, on expiry, and on too many
attempts — so a caller could clear their own rate limit by burning five wrong
guesses. Splitting them means nothing on the verify path can reset the limit.

Neither collection has a Firestore TTL policy. Both hold only a hash of an
address plus timestamps, so the exposure is storage growth rather than data
retention, but a TTL on `expiresAt` (authCodes) and `lastIssuedAt`
(authCodeCooldowns) is the obvious follow-up and is not done.

Codes are stored hashed and bound to the address they were issued for, so a
Firestore reader cannot sign in as anyone or replay a code against a different
account.

## Postgres (computed views &amp; logs)

**Location:** Cloud SQL (GCP project: `GOOGLE_CLOUD_PROJECT`)

### Tables

| Table | Purpose | Sync source | Backfill done? | Notes |
|---|---|---|---|---|
| `clients` | Denormalized client summary (FLOW health, metrics) | Firestore `locations` | Partial | See backfill note below |
| `appointments` | Show/DQ/booked appointments from GHL | GHL API → Cloud Functions → this table | Yes | Includes timing (pre-call vs. on-call DQ) |
| `courses` | Course catalog and structure | Migrating from Firestore | **NO — BLOCKED** | See migration status |
| `course_progress` | Per-user completion tracking | **Postgres is authoritative** (story 11.6, 2026-08-23) | N/A | Was a split-brain: schema here, live data in Firestore. Firestore path deleted; backfill verified by count |
| `course_subsection_videos` | Every video on one lesson: provider (`loom`/`fathom`/`drive`), provider-native id, optional label, order | App writes directly (admin editor, and the 12.4 import) | N/A | `sql/008_course_subsection_media.sql`. Primary store for lesson video, not a cache. `course_subsections.loom_id` is retained as the single-Loom fast path and is NOT backfilled into this table — the read path falls back to it when a lesson has no rows here, so the two are complementary rather than a split-brain |
| `course_subsection_docs` | Non-video reference links on one lesson (Google Doc/Sheet), label + URL + order | App writes directly (admin editor, and the 12.4 import) | N/A | `sql/008_course_subsection_media.sql`. Separate from videos because a doc has no provider constraint and always carries a label, where a video has a constrained provider and an id |

**Course visibility columns** (`sql/009_course_visibility.sql`). `courses.visible_to_roles`
and `course_subsections.visible_to_roles` are `VARCHAR[]` allowlists of role ids,
read through `lib/course/visibility.ts`. **Empty means every signed-in user**, which
is what every pre-existing row gets: training was open to all sessions before story
12.4, and reading "unset" as "nobody" would have removed the onboarding course from
every client the day the migration ran. Role strings are constrained by
`lib/auth/roles.ts` rather than by a CHECK, so there is one definition of a role and
not two to keep in sync. Admins are exempt from the check entirely — someone has to
be able to open a course to fix it.
| `automation_log` | Cloud Functions execution history | Cloud Functions | Yes | Keyed to location + function name |
| `flow_frameworks` | FLOW sales-coaching framework versions | App writes directly | N/A | `sql/flow-schema.sql`, org-scoped |
| `flow_tabs` / `flow_sections` / `flow_cards` | FLOW framework structure | App writes directly | N/A | Hierarchy under a framework |
| `flow_scripts` | FLOW card script content (versioned) | App writes directly | N/A | Also see `flow_scripts` in Firestore table above — same name, different store; Postgres is the live editor content, Firestore's is not currently synced from it |
| `flow_audit_log` | FLOW change history, revert-capable | App writes directly | N/A | Written by `lib/flow/db.ts#logChange` |
| `flow_script_suggestions` | Closer-submitted script edit suggestions, pending sales-manager review | App writes directly | N/A | Added Phase 2 item 2.5 fast-follow; approving one creates a new `flow_scripts` row and writes `flow_audit_log`, all inside one transaction |
| `csm` | CS org reporting lines (who a CSM reports to) | Firestore `csm/{email}` | N/A | Keyed by email to match `clients.csm_assigned`. Migration 004 briefly created the same table as `csm_directory`; 006 consolidates the two |

**Table grants.** Every table in `public` is read and written by
`tag_app_user`, granted by 003's blanket
`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public`. That
blanket only covers tables existing when it runs, so a migration creating or
renaming a table after 003 grants explicitly on it (004 and 006 both do). A new
table added without its own GRANT works on a fresh sequential deploy and fails
on an existing database, which is the harder of the two to notice.

**Migration ledger (`schema_migrations`, story 15.0).** Which migrations have
been applied is now recorded rather than remembered: one row per filename, with
`applied_at` and a sha256 of the file. `npm run check:migrations` reports drift
— files on disk with no row, rows with no file, and the one that matters, a file
edited after it was applied. It is read-only and never applies anything; there
is no staging environment and these files are hand-applied against production,
so a runner that guesses wrong is worse than a human with a trustworthy list.

`011` backfills `001`–`010` with a NULL checksum. Those rows assert history
nothing can verify, so the checker reports them as *unverified* rather than as
agreement — a checksum invented after the fact would look like evidence.

**Applied 2026-08-23, and the backfill was immediately wrong.** It claimed
`010_course_progress_reporting.sql` had run. It had not: the index that file
creates was absent, because `010` was written an hour earlier by story 11.6 and
never applied. The false row was deleted by hand — not by editing `011`, which
has already run and is therefore immutable. `010` remains outstanding and needs
the owner role rather than `tag_app_user`; see
`docs/RESWEEP_DEPLOY_RUNBOOK.md` §1b.

Worth keeping, because it is the case for the ledger made by the ledger: nothing
before it could have detected that, and it detected it on itself within minutes.
Production now reads 10 applied with `010` correctly flagged as missing.

**Migration order.** `functions/sql/*.sql` run in file-number order, and each
one has to be safe both on a fresh database and on one that has already seen
its predecessors. 006 originally assumed the opposite order and failed on
every clean deploy with `relation "csm" already exists`, because 003 creates
that table first. It is written as idempotent `DO` blocks now. Any migration
that renames or drops something an earlier file may also create needs the
same treatment.

**Suggestion approval is transactional.** `resolveSuggestion` claims the
suggestion with a conditional `UPDATE ... WHERE status = 'pending'` and does
the script insert plus the audit write in the same transaction, so two
concurrent approvals cannot produce two script versions on one card.

**Why Postgres:** structured schema for analytics queries, SQL joins across entities,
time-series aggregation (sum spend by day), efficient pagination, no real-time
requirement on these reads.

### Backfill Status

**Clients table:** `locations` snapshot was loaded once. New locations are sync'd
via Cloud Functions on onboarding. Updates to location names/metadata are NOT
sync'd from Firestore—check schema for stale data policy.

**Courses:** split by half, not by store. Corrected 2026-08-22; the previous
text here claimed Firestore was authoritative and that code still read from it,
which was false for structure and named the wrong migration file.

- **Structure** (`courses`, `course_sections`, and below) is on **Postgres**,
  created by `functions/sql/007_courses.sql` and read and written through
  `lib/course/db.ts` by every `app/api/admin/courses/*` route. Landed in
  `4638e98`.
- **Per-user progress** is also on **Postgres** as of 2026-08-23, in
  `course_progress` (created by `003_migrate_firestore_to_postgres.sql` line
  258, covered by that file's blanket GRANT at line 289). Read and written
  through `lib/course/progress.ts`.

**Resolved by story 11.6, 2026-08-23.** Until then this was the split-brain the
pre-commit hook exists to block, sitting in the tree: one entity, two stores,
one of them live and one of them a schema nobody filled. Progress was moved to
Postgres, the Firestore documents were backfilled with the copy verified by row
count, and `lib/course/firestore.ts` was deleted rather than left dormant — a
collection no longer read but still present is how this lasted as long as it
did.

Worth remembering why it lasted: the blocker was recorded as
"see `docs/stories/X.X-courses.md`", a placeholder filename for a story nobody
ever created. Nothing technical was in the way. It was a to-do written inside a
document, where no sprint would surface it.

---

## Cache (Redis, session, TTL)

No Redis. Session token is stored in HTTP-only cookie only.

**In-memory cache (Phase 2 item 2.5):** `lib/flow/db.ts#getFullFramework()` —
the FLOW framework closers load on every call is a 30-100+ query serial
waterfall (framework → tabs → per-tab sections → per-section cards → per-card
script), so it's cached in a module-level `Map<orgId, FullFramework>` with a
5-minute TTL. Invalidation is a full cache clear on any Flow write (create/
update/delete on any framework/tab/section/card/script, or a revert) rather
than a per-org entry removal — see the comment above `clearFrameworkCache()`
for why that's the right tradeoff here. This cache is per Node process/
instance, not shared across Cloud Run replicas; a write on one replica
doesn't invalidate another's cache until that replica's own TTL expires
(worst case 5 minutes of staleness on other replicas, not incorrectness).

Do not add another cache layer without updating this doc and documenting TTL
+ invalidation strategy.

---

## Why each store exists

- **Firestore** is RBAC-aware (rules engine) and fast for single-document 
  lookups (user auth, permissions). Immutable append-only for audit logs.
  Real-time syncs for CSM portfolio + client dashboard.
- **Postgres** is for reporting, analytics, and joins that Firestore rules 
  can't express (e.g., "all appointments for a location grouped by show status").
- **Postgres pool is bounded** (`lib/postgres.ts`: `max: 10`,
  `idleTimeoutMillis: 30s`, `connectionTimeoutMillis: 5s`, warns when a query
  queues behind a full pool) — fixed Phase 2 item 2.5 after `getFullFramework()`'s
  query waterfall made concurrent closers a real exhaustion risk. Cloud
  Functions queries remain per-request (functions/src has no shared pool
  across invocations by design — each Cloud Function instance is short-lived).

---

## Audit trail

All writes to `locations`, `users`, `flow_scripts`, and `creatives` are 
logged to Firestore's `audit_log` collection by the API layer 
(`lib/audit/log.ts`). App code never writes to audit_log directly—always 
call the logging service.

Immutability is enforced by Firestore security rules (see `.firebase/firestore.rules`).

---

## Migration in progress

**Firestore → Postgres (courses): resolved 2026-08-23, story 11.6.** Both halves
are on Postgres now. Structure was already there; progress moved from the
`userProgress/{uid}/courses/...` document tree into `course_progress`, and
`lib/course/firestore.ts` was deleted rather than left dormant, so no code path
can read progress from Firestore. `lib/course/progress.ts` is the only way in.

Two things worth keeping from it. The read went from one Firestore query per
node — sections, then subsections, then checkboxes, dozens per page — to a
single `SELECT`. And `getCourseCompletionRates` exists, which is the aggregate
the document tree could not answer without reading every user's whole subtree;
it is the reason this option was taken over keeping Firestore.

The Firestore documents were not deleted by the backfill. Removing them is a
separate decision, and keeping the source intact is what makes the count check
re-runnable.

**There is no project-wide move off Firestore.** Firestore remains the primary
system of record, including the sign-in path (`lib/auth/otp.ts`), tenants, audit,
onboarding, and GHL credentials. 29 modules call `firestore()`. Courses is one
feature mid-migration, not the leading edge of a general one. Recorded here
because the half-finished state above reads like evidence of a direction that
does not exist.
