# TAG Data Model

Single source of truth for all data stores, schemas, and the reason each exists.
Update this doc whenever a table is added, a collection is created, or a data
boundary changes. Same commit as the code change.

## Firestore (primary system of record)

**Location:** Google Cloud Firestore (GCP project: `GOOGLE_CLOUD_PROJECT`)

A missing `GOOGLE_CLOUD_PROJECT` throws at the point the client is constructed
(`lib/firestore.ts`) instead of silently falling back to a hardcoded project
id. The same guard, plus a development-only + non-production-id check, gates
every one-time seed script in `scripts/setup-*.ts` / `scripts/setup-*.mjs`
(`scripts/lib/seed-guard.mjs`) so they cannot write test data into production.

### Collections

| Collection | Purpose | Primary key | Replicated to Postgres? |
|---|---|---|---|
| `orgs` | Organizations and their tenants | doc ID | No |
| `locations` | Client sub-accounts within an org | doc ID | No |
| `users` | Sign-in identities and session auth | doc ID (Firebase UID) | No |
| `otp` | One-time sign-in tokens (temporary) | email | No, auto-expires |
| `audit_log` | Immutable record of all sensitive actions | doc ID (auto) | No |
| `flow_scripts` | FLOW automation editor content | doc ID | No |
| `creatives` | Campaign creative assets | doc ID | No |
| `bug_reports` | Client-submitted bugs and feedback | doc ID | No |

**Why Firestore for these:** real-time sync, permission-based read/write rules,
sub-millisecond lookups, immutable audit trail (`setOnServer()` guards). None of
these are read from Postgres.

---

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

Not currently in use. Session token is stored in HTTP-only cookie only.
Do not add a cache layer without updating this doc and documenting TTL + 
cache-invalidation strategy.

---

## Why each store exists

- **Firestore** is RBAC-aware (rules engine) and fast for single-document 
  lookups (user auth, permissions). Immutable append-only for audit logs.
  Real-time syncs for CSM portfolio + client dashboard.
- **Postgres** is for reporting, analytics, and joins that Firestore rules 
  can't express (e.g., "all appointments for a location grouped by show status").
- **No Redis/cache yet** because the Postgres pool is still unbounded and 
  Cloud Functions queries are per-request. If either becomes a bottleneck, 
  document the decision to add cache here first.

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
