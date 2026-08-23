# Handoff — 2026-08-23

Written before archiving the sessions that hold this context. Everything below
is verified against code or refs, with SHAs. Where something is unverified it
says so.

`main` is at `63362a8`.

---

## What shipped

| Story | Where | State |
| --- | --- | --- |
| 14.1 — repository seam over every Firestore path | merged `63362a8` | Review |
| 14.2 — local Postgres and the migration runner | merged `448b741` | Review |

**14.1.** All 20 Firestore call sites in `lib/` and `app/` now go through
`lib/data`. Nothing outside `lib/data/firestore-repository.ts` imports the
client or the SDK. Enforced by an ESLint rule (`eslint.config.mjs:139`) and a
pre-commit check (`scripts/check-firestore-seam.mjs`), both verified in **both**
directions: each catches a planted violation and each leaves `lib/data` alone.
Contract in `docs/repository.md`.

**14.2.** A migration runner that refuses. The design decision worth keeping is
the *order* of its refusals: drift is checked before the local/force question,
so `--force` can only mean "yes, this is production" and never "apply over
drift". Authored by a session that has since retired.

---

## The four defects the seam exposed

None was the purpose of the story. All were invisible while call sites read
untyped snapshots.

1. **A duplicate paid Meta campaign.** `reserveCampaignLaunch` used Firestore
   `create()`, which throws on collision; the seam reports collisions as `false`.
   Its caller does not wrap the call, and the next statement creates a campaign
   at Meta. A race loser would have created a second paid campaign with no error
   anywhere. Found by a peer re-deriving the audit blind and reporting `create()`
   at two sites where the original recorded one.
2. **`locations/undefined/auditLog`.** `computeEscalation` was called with
   whatever the client document held. A missing location produced a *valid* path
   matching nothing, so "no location" reported as "never checked in" and the
   escalation rules acted on it. My first fix was worse — `""` produces an empty
   path segment, which Firestore rejects outright.
3. **Two Firestore types in module public signatures**, including
   `fetchClients(query: Query | CollectionReference)` — the one function every
   CSM scope routes through.
4. **Five collections declared narrower than their contents**: `locations`,
   `locations/{id}/auditLog`, `clients`, `ghl/agency`, and the three whose doc id
   is the entity id. **Two of those wrong types were mine**, written during the
   story.

**`verifyCode` has tests for the first time.** The OTP attempt cap, expiry and
single use had no coverage anywhere and could not have — it runs inside a
transaction, so exercising it meant reaching real Firestore. Ten tests now cover
it against the in-memory fake.

---

## What the audits found, and what they got wrong

The inherited Firestore audit was derived from documents, not call sites. It
named eight collections that do not exist, missed both `app/api` call sites, and
reported "no transactions" where there are two plus a batch. Re-derived from
code: **23 document paths, 12 parent-scoped, across 20 call sites**, and nine
operations beyond get/set/query rather than the five predicted.

`docs/firestore-exit-assessment.md`, `docs/data-model.md` and `docs/epics.md` all
carried the error and are corrected. **Migration 003's table list independently
corroborates the code against all three** — it was written months ago from code
by someone solving a different problem, and it agrees with the code on every row
and with the documents on none.

**Migration 003 is unadopted, not partially adopted.** It creates 17 tables; only
`dashboard_configs` and `course_progress` are ever queried. The live Postgres
surface is `flow_*`, `course_*`, `automation_logs`, `dashboard_configs`,
`course_progress` — none of it from 003. Stories 14.4–14.9 are written as
create-table-then-backfill; the tables have existed since 003 and are unproven.

---

## Open, with owners

| Item | Needs |
| --- | --- |
| Migration `010` unapplied | An owner role. `tag_app_user` has DML, no DDL. General form: migrations need an owner role and the app must not have one. **Sam.** |
| Google Calendar scope classification | Not in public docs. Only visible in our own Cloud Console consent screen. Blocks 16.1's cost estimate. **Sam.** |
| GHL agency sub-accounts cannot be transferred | May invalidate part of Story 1.2's 23-account consolidation. **Sam.** |
| GHL `calendars.write` coverage | Undocumented; needs a support ticket. **Sam.** |
| 14.B — three live inline-role violations | Assigned: whoever owns stories 15.A and 7.7. `lib/auth/admin.ts:175` hardcodes a role in the **claim-issuing** path. |
| Firebase claims cap citation | Verified 1000 bytes, sourced. Homeless: the files are story-referenced. Rides with the next Epic 15 update. |
| 14.A — fold `functions/` into `app/api` | **Not written.** Blocks 14.10: the SDK cannot be dropped while `functions/` has its own client on a different major. |
| Three timestamp conventions | `Timestamp.now()`, `serverTimestamp()`, `new Date()`. 14.4 must pick one. |

**Unmerged branches:** the handoff letter (`e03066f`), 14.B (`864e644`), the
Legendarium draft (`f58f7cc`, preserved not reviewed), the 14.4 table audit
(`b693a43`), the type audit (`704eb02`), the adversarial review (`17d8923`).

---

## What worked, from evidence

**Peer contradiction.** Four sessions corrected me and every one was right. The
highest-value catch of the day came from a blind re-derivation. Three of the best
findings came from someone disagreeing with me on a specific number.

**Mechanisms.** The story-status hook stopped a drifting commit twice and did not
care that I was the one committing. The branch-freshness check refused a stale
commit. The main-ownership guard held.

**What did not work: norms.** "A document is not evidence" was stated, agreed,
repeated — and violated by four sessions including the one enforcing it. This is
why `AGENT_COORDINATION.md §10` order 8 outranks the others: prefer a mechanism
to a norm.

**Coordination outproduced code.** In the window 14.1 went from nothing to merged,
the coordination layer produced roughly seven documents. I found substantive
errors in four, including a "correction" that deleted the most severe finding in
its own story, and a units error that was **mine** and propagated into another
session's work. None of that coordination output changed a line of shipped code.

**Every correction cycle introduced a new error while fixing an old one** — the
table audit, the type audit, and 14.B. That produced standing order 5.

---

## For whoever comes next

Read `AGENT_COORDINATION.md` §10 first. Nine standing orders, each with the
incident that produced it, because a rule you cannot argue with is a rule nobody
applies to a case it did not anticipate.

The shortest useful version: **on this repo, a document is not evidence.** Every
wrong finding of 2026-08-23 came from trusting a document. Every right one came
from reading code. That includes this file.
