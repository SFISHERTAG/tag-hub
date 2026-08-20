# TAG Data Model

Single source of truth for all data stores, schemas, and the reason each exists.
Update this doc whenever a table is added, a collection is created, or a data
boundary changes. Same commit as the code change.

## Firestore (primary system of record)

**Location:** Google Cloud Firestore (GCP project: `GOOGLE_CLOUD_PROJECT`)

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

**Why Firestore for these:** real-time sync, permission-based read/write rules,
sub-millisecond lookups, immutable audit trail (`setOnServer()` guards). None of
these are read from Postgres.

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
| `course_progress` | Per-user completion tracking | Migrating from Firestore | No | Depends on `courses` table |
| `automation_log` | Cloud Functions execution history | Cloud Functions | Yes | Keyed to location + function name |
| `flow_frameworks` | FLOW sales-coaching framework versions | App writes directly | N/A | `sql/flow-schema.sql`, org-scoped |
| `flow_tabs` / `flow_sections` / `flow_cards` | FLOW framework structure | App writes directly | N/A | Hierarchy under a framework |
| `flow_scripts` | FLOW card script content (versioned) | App writes directly | N/A | Also see `flow_scripts` in Firestore table above — same name, different store; Postgres is the live editor content, Firestore's is not currently synced from it |
| `flow_audit_log` | FLOW change history, revert-capable | App writes directly | N/A | Written by `lib/flow/db.ts#logChange` |
| `flow_script_suggestions` | Closer-submitted script edit suggestions, pending sales-manager review | App writes directly | N/A | Added Phase 2 item 2.5 fast-follow; approving one calls `updateScript` (which writes `flow_audit_log`) |

**Why Postgres:** structured schema for analytics queries, SQL joins across entities,
time-series aggregation (sum spend by day), efficient pagination, no real-time
requirement on these reads.

### Backfill Status

**Clients table:** `locations` snapshot was loaded once. New locations are sync'd
via Cloud Functions on onboarding. Updates to location names/metadata are NOT
sync'd from Firestore—check schema for stale data policy.

**Courses table:** Firestore source is authoritative. Backfill to Postgres was
started in `functions/sql/003` but code still reads from Firestore. **This is
a known split-brain.** Either:
- Finish the backfill, update all reads to Postgres, drop from Firestore, or
- Remove the Postgres table, revert `003`, commit the reversal.

Do not leave it split. Decision pending: see `docs/stories/X.X-courses.md`.

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

**Firestore → Postgres (courses):** started but not finished. Code is split: 
course structure reads from Postgres, user progress reads from Firestore. 
Status: blocked on product decision.

Until resolved: never assume "it's in Postgres" when reading courses.
