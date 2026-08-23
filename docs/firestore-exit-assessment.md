# Getting off Firestore: what it actually takes

Assessment written 2026-08-22, from the code rather than from principle.

> **Correction, 2026-08-23.** The reasoning in this document holds; the
> collection inventory does not. "What has to move" below was not derived from
> call sites, and five of its thirteen collections have no code behind them:
> `orgs`, `users` and `flow_scripts` have no Firestore reader or writer anywhere
> (`functions/` and `scripts/` included), `bug_reports` is `bugReports` in the
> code, and there is no top-level `creatives` — only `clients/{id}/creatives`,
> seeded by two scripts and read by nothing, since creatives render from Google
> Drive. There is also no `tenants` collection: `lib/ghl/tenants.ts:24` sets
> `TENANTS_COLLECTION = "locations"`. The real surface is 20 call sites and 21
> document paths, ten of them parent-scoped subcollections, which is a different
> shape from thirteen flat collections. "The method" below also says 21 files
> across 12 directories; that count included two `functions/` files that do not
> touch this seam and missed both `app/api` call sites.
>
> The four tractability findings were re-checked and all four hold, including
> "three transaction call sites" — there are exactly two `runTransaction` and
> one `batch`.
>
> Verified inventory with line numbers: `docs/14.1-firestore-audit.md`. Story
> titles in `docs/epics.md` were re-cut against it.

## The short version

This is a tractable migration, and it is smaller than it looks. The three things
that normally make leaving Firestore brutal are all absent here. But there is
one condition attached, and it is not negotiable: **finish the migration already
in flight before starting thirteen more.**

## Why it is tractable

Four findings, each verified:

- **No realtime listeners.** Zero `onSnapshot` anywhere. Every read is one-shot.
  Live subscriptions are the single hardest Firestore feature to replace, and
  nothing depends on one.
- **No security rules.** There is no `firestore.rules`. Authorization lives in
  `lib/auth`, server-side. Nothing to port, and no risk of silently widening
  access.
- **The client never touches the database.** No Firebase or Firestore reference
  anywhere in `web/src`. Angular talks to `/api` and nothing else, so the entire
  swap happens behind an unchanged HTTP contract. The frontend does not need to
  know this is happening.
- **Almost no transactional coupling.** Three `runTransaction`/`batch()` call
  sites in the whole codebase. Postgres does this better anyway.

Firestore is being used here as a plain server-side document store behind an
API. That is the easiest possible thing to replace.

**Firebase Auth is not Firestore and should not move.** Hats live in custom
claims on the Auth user, not in a collection. Sign-in, sessions and the whole
grant model are untouched by this. Leaving Firestore does not mean leaving
Firebase.

## What has to move

Thirteen collections, in four groups by difficulty.

**Group 1 — trivial, and arguably overdue.**

| Collection | Note |
|---|---|
| `authCodes` | Short-lived OTP hashes. **No TTL policy configured**, so these accumulate forever today. A Postgres table with an index on expiry fixes a real defect while migrating. |
| `authCodeCooldowns` | Same shape, same missing TTL. |

**Group 2 — plain relational data that wants to be relational.**

| Collection | Note |
|---|---|
| `orgs` | Parent of locations. Trivial. |
| `locations` | Already partly denormalised into Postgres `clients`. The split is the current pain. |
| `users` | Profile rows. Auth identity stays in Firebase. |
| `bug_reports` | Self-contained. |
| `creatives` | Self-contained. |

**Group 3 — has history or versioning, so needs care.**

| Collection | Note |
|---|---|
| `locations/{id}/auditLog` | Immutable append-only. Must not lose a row; it is the record of tenant access. Migrate by copy-then-verify-count, never move. |
| `manual_pages` + `versions` | Subcollection of full prior snapshots. Becomes two tables. |
| `flow_scripts` | **Already exists in both stores** with different content. Firestore's copy is not synced from Postgres. Resolve which is authoritative before touching it. |

**Group 4 — credentials, and the reason to go slowly.**

| Collection | Note |
|---|---|
| `ghl/agency` + `companies/{id}` + `locations/{id}` | Live OAuth tokens and refresh tokens for every sub-account. Losing or corrupting these is a whole-portfolio outage with no error until requests start failing. This group is last, and it deserves the question of whether it belongs in Secret Manager rather than any database. |

## The condition

`courses` is already mid-migration to Postgres and has been stalled long enough
that `docs/data-model.md` carries the warning "never assume it's in Postgres
when reading courses." Course structure reads from Postgres, user progress reads
from Firestore. That is one split-brain, tracked as story 11.6, and it is
unresolved.

Starting thirteen more migrations with that one still open produces thirteen
more of exactly the same condition. The pre-commit hook already refuses a data
model change that creates a split-brain with no backfill plan, and it is right
to.

**Finish 11.6 first.** Not for tidiness. It is the pilot: it proves the
dual-write, backfill, verify and cutover sequence on a collection whose failure
mode is a missing training video rather than a missing audit record. The pattern
it establishes is what makes the other thirteen routine. It is also already
half-paid-for.

## The method

Per collection, never in a big bang:

1. **Put a repository seam in front of it.** Today 21 files import
   `@/lib/firestore` directly across 12 directories. That is the actual work:
   not the SQL, but making each collection reachable through one module so its
   backing store can change in one place. Do this ahead of any data movement.
2. **Create the table.** `functions/sql/0NN_*.sql`, idempotent, with its own
   explicit `GRANT` — 003's blanket grant only covers tables that existed when
   it ran, and a missing grant works on a fresh deploy and fails on the real
   database.
3. **Dual-write.** Both stores, Firestore still authoritative.
4. **Backfill and verify by count**, not by spot check.
5. **Flip reads** behind the seam.
6. **Stop writing Firestore, and delete the collection** in a later, separate
   commit. A collection that is no longer read but still exists is how the
   courses split happened.

Update `docs/data-model.md` in the same commit at every step. The hook enforces
it, and the hook is the thing standing between this plan and thirteen split
brains.

## Cost and sequencing

Groups 1 and 2 are small and independent — the seam is most of the effort, and
after that each collection is a table, a backfill and a flip. Group 3 needs
verification discipline because losing an audit row is not recoverable. Group 4
should be a deliberate decision of its own, made after everything else works.

Realistic order: **11.6 → seam → Group 1 → Group 2 → Group 3 → Group 4.**

## Decided 2026-08-22: full exit, strict Postgres

The question below was put to Sam and answered: the driver is **operating two
databases, local development, and one query language instead of two** — not
only the query limitation. That is the broader case, and it justifies the full
programme rather than the cheaper read-model split.

So the target is one store. Postgres holds everything; Firebase keeps Auth and
nothing else. Tracked as Epic 14.

The cheaper option is recorded below for the record, because someone will
eventually ask why the smaller path was not taken.

### The option not taken

Firestore stays the write side, and every read model needing a join lives in
Postgres. That is the architecture `docs/data-model.md` already describes and it
is simply unfinished. It would have addressed rollups, the CS three-tier
reporting line and portfolio sorting at a fraction of the cost.

It was rejected because it does not address the actual complaint. Two stores
still have to be operated, local development still needs an emulator alongside a
database, and every engineer still holds two query languages. Those costs are
paid every day by everyone, and no amount of read-model tidiness removes them.
