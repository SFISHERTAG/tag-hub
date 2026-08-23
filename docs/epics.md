# TAG Hub — Epics and Stories

Story files for Epics 1–7 and 10–12 live in `docs/stories/`. Epics 8 and 9 shard
when they come up; splitting them now would freeze decisions that earlier epics
will inform.

Status values: `Done` · `In progress` · `In review` · `Ready` · `Blocked` · `Draft`

**The story doc is the source of truth for status.** Where a story has a file in
`docs/stories/`, the `**Status:**` line in that file wins and the table below is
a summary of it. Reconciled against the story docs on 2026-08-21.

---

## Epic 1 — Foundation and access

**Goal:** a user logs in, carries a role and a set of permitted locations, and
cannot reach a tenant they are not entitled to.

Everything downstream is a permissions question before it is a feature, so this
epic gates the rest.

| ID | Story | Status |
| --- | --- | --- |
| 1.1 | Token resolution seam | Done |
| 1.2 | Agency OAuth install | Blocked — GHL account consolidation (install itself complete 2026-08-09) |
| 1.3 | Identity Platform sign-in | Done |
| 1.4 | Role and location claims | Done |
| 1.5 | Location-scoped routing | Done |
| 1.6 | Tenant registry and entitlements | In progress — AC2 (nav filtering) and AC3 (`requireService` callers) unmet |
| 1.7 | Deploy to Cloud Run | Ready |
| 1.8 | Provision the client's Hub user at Phase 1 | Done |

## Epic 2 — Closer workspace

**Goal:** the surface a closer lives in all day. Built against one tenant;
remaining work is making it multi-tenant and adding call preparation.

| ID | Story | Status |
| --- | --- | --- |
| 2.1 | Pipeline board | Done |
| 2.2 | Day view with outcomes | Done |
| 2.3 | Outcome timing capture | Done |
| 2.4 | Contacts list and detail with notes | Done |
| 2.5 | Move a deal between stages | Ready |
| 2.6 | Mark won / lost with value | Done |
| 2.7 | Call preparation panel | Ready |
| 2.8 | Follow-up queue | Ready |

## Epic 3 — CSM portfolio and impersonation

**Goal:** one view across all clients, and the ability to enter a client
account to work in it — auditably.

| ID | Story | Status |
| --- | --- | --- |
| 3.1 | Portfolio list with process stage | In progress — Phase 1 complete |
| 3.2 | Client health signals | In progress — Phase 1 complete |
| 3.3 | Enter a client tenant | Done |
| 3.4 | Impersonation banner and read-only default | Done |
| 3.5 | Audit log of tenant access | Done |
| 3.6 | Escalation view — ascension and risk | In review — AC3/AC5 gaps pending live GHL data |

**No blocker.** 1.4 is Done and 1.6 is in progress; the impersonation half of
this epic (3.3–3.5) has landed. Remaining work is Phase 2 of 3.1/3.2 and
closing 3.6's two data-dependent acceptance criteria.

Story 3.5 is not optional and should not be deferred behind 3.3. Entering a
client's data without a record of who did it is the kind of gap that is only
noticed when a client asks.

## Epic 4 — Client owner dashboard

**Goal:** the tax advisor sees whether it is working, without meeting
GoHighLevel.

| ID | Story | Status |
| --- | --- | --- |
| 4.1 | Meta System User and ad account access | Unblocked — System User + token live, client ad accounts assigned (2026-08-16) |
| 4.2 | Spend and delivery by ad | Blocked — Meta credentials not present in this environment |
| 4.3 | Funnel counts — leads, booked, showed, closed | Done |
| 4.4 | ROAS joined on `utmAdId` | Done |
| 4.5 | "As of" freshness indicator | Done |
| 4.6 | Owner's own calendar view | Done |

**Blocker moved.** 4.1 is no longer the gate: the System User and token are live
and client ad accounts are assigned. What remains is that this environment has no
`META_SYSTEM_USER_TOKEN`/`META_BUSINESS_ID`, so 4.2 cannot be exercised against
real spend. The GHL-sourced stories (4.3–4.6) landed without it.

## Epic 5 — Onboarding and campaign launch

**Goal:** onboarding runs in the Hub, and the campaign launch that ends it is
one auditable action.

| ID | Story | Status |
| --- | --- | --- |
| 5.1 | Onboarding checklist from Fulfillment stages | Done |
| 5.2 | Campaign template per offer | Done |
| 5.3 | Launch preview | Ready |
| 5.4 | Create paused via Marketing API | Done |
| 5.5 | Explicit activation, advancing to `AP 2 - Ads Launched` | Done |
| 5.6 | Budget ceilings and idempotency | In progress — implemented and unit-tested, held from Done pending live Meta verification |
| 5.7 | Stage SLA deadlines | Superseded by 13.5 |
| 5.8 | SLA breach sweep and escalation | Superseded by 13.5/13.6 |
| 5.9 | Adjustable stage SLA baselines | Superseded by 13.5 |
| 5.10 | Opportunity custom fields in the GHL client | Draft — blocks 13.5 |

**Reconciled with Epic 13 on 2026-08-22.** 5.7, 5.8 and 5.9 duplicated Epic 13's
SLA work and are superseded; 5.10 survives as its prerequisite. Decision record:
`docs/epic-5-13-reconciliation.md`.

**Architecture note:** 5.10 and Epic 13's SLA work are built on
`docs/fulfillment-pipeline-architecture.md`, which re-draws the Fulfillment
stages as ownership handoffs and moves onboarding milestones onto dated
opportunity custom fields. 5.1's stage model is superseded; see its own note.
Sequence is 5.10, then 13.2, then 13.5, then 13.6.

**Blocker:** 5.6's double-submit test passes against a mocked Meta client and an
in-memory Firestore, not a real ad account. It stays out of Done until that same
scenario runs against live Meta credentials.

## Epic 6 — Acquisition loop

**Goal:** outcomes flow back to Meta so the algorithm buys prospects who close.

| ID | Story | Status |
| --- | --- | --- |
| 6.1 | Per-tenant duplicate-conversion audit | Blocked — manual audit required before implementation |
| 6.2 | Conversion dispatch on showed | Done |
| 6.3 | Conversion dispatch on closed-won with value | Done |
| 6.4 | Pre-call vs on-call DQ in show-rate maths | Done |
| 6.5 | Delivery monitoring and retry | Done |

**Critical blocker:** Story 6.1 is a manual audit (not code) — must complete before 6.2–6.3 deploy. Duplicate conversions would poison Meta's algorithm worse than no data.

Implementation can proceed in parallel; deployment gates on 6.1 audit results per client/pixel.

## Epic 7 — Command surface and configurability

**Goal:** one view across the whole book for the people who run TAG, and a
dashboard different roles can shape without a code change.

Epics 3 and 4 are both *per client* — the CSM's portfolio and the owner's own
numbers. Neither answers "how is the book doing", which is the question the
founders and the CSM lead actually open the Hub to ask.

| ID | Story | Status |
| --- | --- | --- |
| 7.1 | Client success aggregate view | Shell built — `/success` |
| 7.2 | Field catalog and per-role defaults | Draft |
| 7.3 | Dashboard configuration UI | Draft |
| 7.4 | Client-visibility allowlist at the query layer | In progress — allowlist and catalog landed, fetcher adoption outstanding |
| 7.5 | Sales-enablement upgrade lever — GHL tag, not a Hub action | Draft |
| 7.6 | Data scope at the query layer — whose rows, per hat | In progress — enforcement layer and metric registry landed, route wiring outstanding |
| 7.7 | Write scope and team to the claim | In Review — all tasks complete; AC9 verified by inspection only, see Completion Notes |
| 7.8 | Map uids to GHL users | Draft |

The Knowledge Base stories previously carried the ids 7.1 and 7.2, colliding with
the two command-surface stories of the same number. They are now Epic 12, and
7.7 and 7.8 were split out of 7.6 while scoping its remaining work, and each
records a gap found rather than planned: nothing writes `scope`/`team` into a
claim, so the per-hat scope 7.6 designed is inert; and no mapping exists between
Firebase uids and GHL user ids, so per-user rows are unreachable. They are
independent to build, and `team` scope produces nothing useful until both land.

`7.1`/`7.2` mean only what the table above says. 7.1, 7.2, 7.3 and 7.5 have no
story docs, so their statuses are unverified prose.

Field definitions live in `docs/client-fields.md` (100 fields, 63 of them
live before Meta setup).

Story 7.4 is not optional and must not be deferred behind 7.3. Client
visibility has to be an allowlist enforced where the data is fetched, not a
blocklist applied where it is rendered. A forgotten conditional in a component
is how `contract.mrr` and `econ.feeToSpendRatio` — TAG's own margin — end up on
a client's screen. A query that cannot return the column has no such failure
mode.

Most clients start self-managed: `Tenant.services.closingTeam` is `false` and
their own person works their own pipeline wearing the `client_closer` hat that
Epic 2's workspace already supports generically per `locationId` — no separate
mini-CRM to build. Selling them the fractional closing team afterward is a real
revenue lever, and it needs a mechanism that is not a manual Firestore edit.

**The lever is a tag, not a button.** A rep closes the sales-enablement upsell
in GHL — where the sales team already lives — and applies a tag on the
contact. A webhook consumes that tag event and flips
`Tenant.services.closingTeam` to `true`. `lib/webhooks/` already has the
receiving side built (HMAC signature verification, idempotency, a dead-letter
queue) — this is a new handler on that existing path, not a new subsystem. A
Hub-only "flip this switch" screen would be a second place the flip has to be
remembered, next to the GHL side reps already work from every day.

## Epic 8 — Operational instrumentation

**Goal:** when something breaks between GHL, Meta, Google and Slack, TAG sees it
here before the client does.

| ID | Story | Status |
| --- | --- | --- |
| 8.1 | Error log — searchable, filterable | Draft |
| 8.2 | Per-client integration health | Partly rendered in 7.1 |
| 8.3 | Attribution drift monitor | Draft |
| 8.4 | In-app bug reporting | Draft |

8.2 is per client, not global, and that distinction is the whole point. One
client's pixel stops firing and *that* dashboard reports zero conversions while
every other account looks fine and a global sync badge stays green. 8.3 is the
standing version of the 6.1 audit: 6.1 is a one-time manual pass, 8.3 is the
instrument that keeps it true afterward by comparing platform-reported
conversions against closes actually recorded in GHL.

## Epic 9 — The client channel

**Goal:** TAG can see which clients are waiting on a reply, without turning the
Hub into a second inbox.

Each client is a Slack single-channel guest in their own channel. They are
already in Slack — they have the app, the notifications, and the habit. So the
Hub does not mirror the conversation for them: a read-only copy means they read
in one place and reply in another, and the thread breaks. What the Hub adds is
the view Slack cannot give a CSM holding forty channels — which of them has an
unanswered client message, and for how long.

| ID | Story | Status |
| --- | --- | --- |
| 9.1 | Channel deep link on the client record | Draft |
| 9.2 | Slack app, bot install, per-channel membership | Draft |
| 9.3 | Awaiting-reply queue and response SLA | Draft |
| 9.4 | Response signal feeds client health | Draft |
| 9.5 | Read-only recent thread — staff views only | Draft |

**9.3 stores timestamps and author class, never message text.** Whether the
newest message came from the guest or from TAG, and when, is enough to compute
the entire metric. Copying message bodies into Firestore would duplicate client
financial conversations into a second system that then needs its own retention,
access and deletion story — for no additional signal.

**9.2 is the real cost, and it is per client, not once.** `conversations.history`
only returns a channel the bot is a member of, so every client channel needs the
bot invited. That belongs on the onboarding checklist in Story 5.1, otherwise it
is remembered for the first ten clients and forgotten for the eleventh — whose
dashboard then reports "no messages" indistinguishably from a quiet account.

**9.5 is the highest-risk story in this epic** and must not ship before 7.4.
Any Slack surface reachable by a `client_*` role has to resolve the channel from
the session's own tenant, never from a parameter. A channel id accepted from the
request is one client reading another client's conversation.

## Epic 10 — Angular migration

**Goal:** The frontend runs on Angular Material with the M3 theme contract, one
responsive shell, and integration modules that cannot import each other, without
a big-bang cutover.

The backend is not migrating. `functions/` and `lib/` keep their contracts. What
changes is that the browser can no longer reach `lib/` by importing it: an
Angular SPA talks HTTP, and as of `331e6ce` there are 41 exported Server Actions
across 22 `use server` files with no HTTP equivalent, while all 33 data-reading
pages import `lib/` directly inside a React Server Component.

Those counts were 39 across 21, and 24 of 25, when this epic was written. They
grew while the migration was being planned around them, which is why Story 11.5
makes the inventory a per-story script rather than a number written down once.
Do not trust this paragraph; run the script:

    node scripts/inventory-endpoints.mjs              # whole app
    node scripts/inventory-endpoints.mjs --area=l     # one feature area
    node scripts/inventory-endpoints.mjs --json       # machine-readable

It reports the commit it measured at, so a pasted result can be dated. Each of
10.5, 10.6 and 10.7 carries its own inventory, taken at `40e9aa6`.

**One finding from the first run worth surfacing here.** `admin` holds 20 Server
Actions across 4 files — nearly half the app's remaining surface, and more than
10.5 and 10.6 combined. It sits in 10.7, which was scoped as the small
leftovers. That story now flags splitting `admin` out as a decision to take
before it starts. So each story below ships
its endpoints and its screens together. Endpoints go in `app/api/**`, keeping the
Next deployment as an API-only host serving the Angular bundle same-origin —
`hub_session` is httpOnly SameSite=lax and only survives that topology, and
`functions/` is deliberately kept to as few dependencies as possible.

Screens move one feature at a time. When an Angular feature passes its gate, the
matching Next pages are deleted in the same commit and the route points at
Angular, so a screen exists in exactly one place and no defect gets fixed twice.

| ID | Story | Status | Doc |
| --- | --- | --- | --- |
| 10.1 | Contract hardening and boundary enforcement | Done | `10.1-angular-contract-hardening.md` |
| 10.2 | Real session wiring and the auth surface | In Progress | `10.2-real-session-wiring-and-the-auth-surface.md` |
| 10.3 | Responsive shell and navigation | Review — theme toggle rejected, see story | `10.3-responsive-shell-and-navigation.md` |
| 10.4 | Shared M3 primitives, portfolio and bug reports | Draft | `10.4-shared-m3-primitives-portfolio-and-bug-reports.md` |
| 10.5 | GHL integration module | Draft | `10.5-ghl-integration-module.md` |
| 10.6 | Widget dashboard and the clients book | Draft | `10.6-widget-dashboard-and-clients-book.md` |
| 10.7 | Remaining feature modules and legacy removal | Draft | `10.7-remaining-modules-and-legacy-removal.md` |
| 10.8 | Production hardening and release | Draft | `10.8-production-hardening-and-release.md` |

**Statuses above are taken from the story files, which are authoritative.** This
table previously had 10.1 as In Progress while its story said Done, and 10.2 as
Draft while its story said In Progress. Per Story 11.3, where a table and a
story disagree, the story wins and the table is the thing that was stale.

**10.4 was two stories under one number; split on 2026-08-21.** This table used
that number for "Shared M3 primitives, portfolio and bug reports", the first
story to ship a real feature end to end, while the story file of that number was
a deploy-and-soak story. Both were real work with different prerequisites.

10.4 is now the feature story, which is also what Story 11.4 calibrates its
estimates against. The release story moved to **10.8**, after 10.7's legacy
removal, because a release belongs at the end of the work it releases. Its
premise had also gone stale: it was written when the work was 22 unmerged
commits, and those are merged.

**10.1 is deliberately feature-free.** Every constraint it makes enforceable is
free to fix while `web/src/app/` holds twelve files, and expensive after fifteen
features land on top of it. Enabling `strict` cost zero code churn on the day it
was done.

**10.2 is the highest-risk story here** — it carries the one piece of genuinely
net-new work in the migration: the Google Identity Services rendered button,
which has no Next implementation to port. Porting is predictable; building is
not, which is why this runs early.

*Corrected 2026-08-20.* This paragraph previously said `MockRbacService` is
provided unconditionally and both route guards therefore fail open in a
production bundle. That was true when written and is not true now:
`app.config.ts` provides `isDevMode() ? MockRbacService : HttpRbacService`,
`authGuard` denies on a null session, and `permissionGuard` is default-deny and
refuses a route declaring no permission list. The stale text was read as current
and repeated as a live vulnerability. `web/src/app/app.config.spec.ts` now pins
the provider so the property is enforced rather than described.

**Hat switching is not a client-side concern.** Switching hats changes
`locations` server-side (`tag_exec`, `tag_csd` and `admin` swap to
`listAllLocationIds()`), so the switch must round-trip and replace the whole
Session. A client-side switch that only swaps `currentRole` silently desynchronises
tenant access from the hat.

**Epic 3 is the clients book, and it is not legacy.** All six of its stories are
Ready, and `/csm-dashboard` is 1,562 LOC of working views. Its absence from
`nav.tsx` is a bug that 10.3 fixes, not evidence of abandonment.

## Epic 11 — Migration readiness

**Goal:** Epic 10 is executable and estimable. Every gate it depends on actually
runs, every constraint it assumes is enforced by a check rather than a sentence,
and the work produces the numbers that let someone give a date.

This epic is deliberately feature-free, for the same reason 10.1 is. Each item
below is cheap now and expensive after fifteen feature stories have landed on
top of it. None of it moves a screen; all of it decides whether moving screens
is measurable or guesswork.

| ID | Story | Status | Doc |
| --- | --- | --- | --- |
| 11.1 | Runnable Angular gate — Node floor pinned and enforced | Done | `11.1-runnable-angular-gate.md` |
| 11.2 | Story isolation and merge discipline | Draft | `11.2-story-isolation-and-merge-discipline.md` |
| 11.3 | Verified doc claims — checks over prose | In Progress | `11.3-verified-doc-claims.md` |
| 11.4 | Calibration instrumentation on 10.4 | Draft | `11.4-calibration-instrumentation-on-10.4.md` |
| 11.5 | Endpoint inventory ahead of each feature story | Review — re-run 2026-08-23, metric reached zero |
| 11.6 | Resolve the courses store split | Ready — Option A decided 2026-08-22 | `11.6-resolve-the-courses-store-split.md` |
| 11.7 | The root build script masks a failure | Draft | `11.7-the-root-build-script-masks-a-failure.md` |

**11.1 was the one already failing silently.** Angular CLI requires Node
`v22.22.3` / `v24.15.0` / `v26.0.0`; the dev machine ran `v24.14.0`, one patch
short, so `ng build`, `ng test` and `ng lint` all refused to start. Items 1–3 of
the definition of done were unrunnable, which means `web/**` changes were landing
with their own gate never executing — and nothing said so, because a gate that
cannot start does not report failure. `.nvmrc` pins `24.19.0` and both
`package.json` files declare the supported range so npm rejects a wrong runtime
rather than letting it discover the problem later. **Fixing this immediately
surfaced four lint errors in code that had been committed as verified.** That is
the whole argument for this epic in one data point.

**11.2 exists because the failure already happened here.** `hotpath/context.md`
records ten parallel sessions on one working tree, several building the same
feature twice. On 2026-08-20 a smaller version of it produced a 110-conflict
merge: two agents on `onboarding-intake-wizard-scaffold` while main moved 18
commits underneath. Two agents is survivable and fifteen feature stories is not.
Any story touching a shared module (auth, session, a shared type) runs in its own
worktree with a deliberate merge step, or runs serialised — and every story
rebases on main before it starts and before it merges.

**11.3 is a rule with a receipt.** Epic 10 stated that `MockRbacService` was
provided unconditionally and both route guards failed open in production. It had
been fixed; the text had not. The stale claim was read as current and repeated as
a live vulnerability, and no test would have caught it because nothing tested it
— the property existed only as prose. Where a doc asserts a security property,
the assertion goes in a spec. Where it asserts current behaviour and cannot be
tested, it is dated. `app.config.spec.ts` is the first of these.

**11.4 is what makes a date possible.** No feature has gone end to end, so there
is no per-feature cost, so any estimate is arithmetic on a guess — including a
confident-sounding one. 10.4 is the calibration story: it records endpoint hours,
screen hours, one-time primitive cost, and post-gate defects. Subtract the
one-time cost and the remainder multiplies across 10.5–10.7. **No completion date
is committed before those four numbers exist.**

**11.5 is the estimate's largest unknown.** Epic 10's count — 41 Server Actions
with no HTTP equivalent, all 33 data-reading pages importing `lib/` inside a
React Server Component, measured at `331e6ce` — is the figure that makes the unit of work "an endpoint
that does not exist plus the screen consuming it". If that number grows as each
feature is actually inventoried, the estimate moves with it. Each story's first
step is that inventory, and its real count gets recorded rather than assumed.

Detail, sequencing and the per-feature runbook live in
`docs/ANGULAR_MIGRATION_PLAN.md`.

## Epic 12 — Knowledge Base

**Goal:** the CSM operating manual is readable and editable inside the Hub,
rather than living as generated static files nobody opens.

These two stories previously carried the ids 7.1 and 7.2, which collided with two
different stories of the same number in Epic 7. Renumbered 2026-08-21; the files
and their internal cross-references moved with them.

| ID | Story | Status | Doc |
| --- | --- | --- | --- |
| 12.1 | Knowledge Base view — read-only, TAG-side staff | Ready | `12.1-knowledge-base-view.md` |
| 12.2 | Knowledge Base admin edit — versioned, not overwritten | Ready | `12.2-knowledge-base-admin-edit.md` |
| 12.3 | Course multi-video and doc links — schema plus Angular player and editor | Ready | `12.3-course-multi-video-and-doc-links.md` |
| 12.4 | Legacy Skool course import — 4 courses, post-consolidation shape | Ready | `12.4-legacy-skool-course-import.md` |
| 12.5 | CSM course authored lessons — the 5 with no Skool source | Ready | `12.5-csm-course-authored-lessons.md` |

**12.3 through 12.5 are the legacy Skool training migration.** 12.3 is the
schema and UI change that makes multi-video lessons possible, 12.4 imports the
content that exists in Skool, and 12.5 authors the five lessons the course
update outline calls for that have no Skool source. They run strictly in that
order. The split between 12.4 and 12.5 is deliberate: a mechanical import
should not be blocked behind an authoring and review cycle.

**12.1 and 12.2 read Ready while the code has shipped** (commits 64be44e, 430c517). That
is not drift: each story has exactly one unchecked task, and it is the same task
— browser verification of the authorized and unauthorized role paths, which this
environment cannot run because it has no test-auth credentials. The status is
honest about a gate that never executed rather than claiming a Done nobody
watched. Whoever gets a test-auth session runs both checks and closes both
stories.

## Epic 13 — Lifecycle handoff and churn prevention

**Goal:** a prospect who closes becomes a tracked client automatically, and a
client who stalls is visible before they leave.

Opened 2026-08-22 from the audit of the Fulfillment pipeline in
`rb6hPt8Ue77L4abghRMc`. That audit found 35 of 37 opportunities parked at
`New Client`, two stages the code does not recognise, and no link between a
closed prospect and the client it becomes. The sales side and the delivery side
are the same client and are currently two disconnected records.

| ID | Story | Status | Doc |
| --- | --- | --- | --- |
| 13.1 | createOpportunity in the typed service layer | Draft | `13.1-create-opportunity-in-the-service-layer.md` |
| 13.2 | Fulfillment stage model parity | Draft — premise superseded, scope reduced | `13.2-fulfillment-stage-model-parity.md` |
| 13.3 | Prospect to fulfillment handoff | Draft — location decided 2026-08-22 | `13.3-prospect-to-fulfillment-handoff.md` |
| 13.4 | Ascension value on the fulfillment opportunity | Draft | `13.4-ascension-value-on-the-fulfillment-opportunity.md` |
| 13.5 | Stage SLA timers on the client card | Draft — merged with 5.7/5.8/5.9 | `13.5-stage-sla-timers-on-the-client-card.md` |
| 13.6 | Escalations desk | Draft | `13.6-escalations-desk.md` |

**13.2's original premise is dead.** It described an 11-stage pipeline with
`PR 3 - VSL Creatives` and `PR 4 - Creative Edits`. GHL rebuilt the pipeline on
2026-08-22 at 11:29 and none of those stages exist; the live board is 12 stages.
Parity landed in `2787e21` with coverage in `lib/onboarding/stage-tasks.test.ts`.
What remains of 13.2 is the "no tasks" vs "unrecognized stage" distinction and
ordering from GHL `position`. Do not act on the original acceptance criteria:
they would add eleven dead stages to working code.

**13.3 is blocked on a decision, not on work.** The provisioning webhook creates
the Fulfillment opportunity in the cloned client sub-account; every live
Fulfillment opportunity is in TAG's own sub-account. Both cannot be right.

**13.6 is half-built already.** The client-facing surface shipped in 10.4 as
bug reports, Firestore-backed, with an Angular feature module. It extends rather
than replaces. The story records why not a GHL pipeline (clients do not log into
GHL, and several are not in our agency at all) and why not Postgres (there is no
project-wide move off Firestore; the one feature mid-migration is stalled, story
11.6).

**Sequencing:** 13.1 unblocks 13.3. 5.10 and 13.2 both unblock 13.5. 13.4 and 13.5 both sit
downstream of the handoff, because neither ascension value nor a stage timer
means anything until clients reliably arrive in the pipeline in the first place.

## Epic 16 — Account settings

**Goal:** a person can configure their own account, starting with the things
that decide when the phone rings.

Opened 2026-08-23. Story 10.9 built the surface — a user menu and a `/settings`
page — because the menu needed somewhere real to send "Settings" and shipping a
link its guard refuses "sends people into a redirect" (`nav-items.ts`). That
page currently shows the signed-in address and the granted roles. This epic is
what fills it.

| ID | Story | Status |
| --- | --- | --- |
| 16.1 | Scheduling preferences | Draft — **blocked on 7.8** |
| 16.2 | Profile picture | Draft |
| 16.3 | Notification preferences | Draft — **blocked on there being notifications** |

**7.8 blocks more than it looks.** Every per-user setting has to be written
against a GHL user id, and nothing maps an app uid to one.
`lib/dashboard/owner-calendar.ts` gets away with it by reading
`tenant.ownerGhlUserId`, which works for one person per client and nobody else.
`lib/sources/metric-source.ts` calls them "GHL user ids from a different
identity space". Until 7.8 lands, a per-user scheduling screen would silently
write one person's settings onto the tenant's owner.

**16.3 has no subsystem under it.** There is no notification code anywhere —
no table, no service, no delivery. Story 13.5 needs one for SLA breaches and
15.I needs one for grant changes, so the mechanism should be built by whichever
of those lands first. Preferences before delivery is a page of switches that
control nothing.

**The conflict calendar is an open decision, not a task.** Connecting a personal
Google or Outlook calendar is an OAuth grant between the user and Google or
Microsoft, performed in GHL's own UI, and no GHL scope exposes it.

Deep-linking to GHL was the first answer and it only serves TAG staff. Story
13.6 already records why: clients do not log into GHL, and several are not in
our agency at all. `client_closer` and `client_setter` are real roles held by
people with a Hub login and no GHL seat — the population most exposed to
double-booking. The alternative, our own Google Calendar OAuth, serves everyone
and triggers Google verification for the whole application, which
`app/api/auth/google/route.ts` says sign-in was deliberately scoped to avoid.

**Decided 2026-08-23: keep the client out of GHL.** That eliminates GHL seats
entirely and reduces the deep-link to a TAG-staff convenience. For client-side
callers it is our own Google OAuth or no conflict detection — there is no third
path. The next step is to price Google verification properly: calendar scopes
are *sensitive* rather than *restricted*, which means verification and brand
review but not the annual third-party security assessment, and that is a
materially different cost from the one 16.1 first assumed.

## Epic 14 — Off Firestore

**Goal:** one store. Postgres holds the data; Firebase keeps Auth and nothing
else.

Decided 2026-08-23. Assessment and evidence in
`docs/firestore-exit-assessment.md`. The driver is operating two databases,
local development, and one query language instead of two — not only Firestore's
query limits. The cheaper read-model split was considered and rejected for not
addressing any of those.

**Firebase Auth stays.** Hats live in custom claims on the Auth user, not in a
collection. Sign-in, sessions and the grant model are untouched by this epic.

**Why it is tractable, all four verified in code:** no `onSnapshot` anywhere, so
nothing depends on realtime; no `firestore.rules`, so no authorization to port;
no Firebase reference in `web/src`, so the swap happens behind an unchanged HTTP
contract; three transaction call sites in total.

| ID | Story | Status |
| --- | --- | --- |
| 14.1 | Repository seam over every collection | Draft |
| 14.2 | Local Postgres and the migration runner | Draft |
| 14.3 | `authCodes`, `authCodeCooldowns` (+ the missing TTL) | Draft |
| 14.4 | `orgs`, `locations`, `users` | Draft |
| 14.5 | `bug_reports`, `creatives` | Draft |
| 14.6 | `auditLog` — copy and verify, never move | Draft |
| 14.7 | `manual_pages` and versions | Draft |
| 14.8 | `flow_scripts`: resolve the two-store split | Draft |
| 14.9 | GHL agency tokens — Postgres or Secret Manager | Draft |
| 14.10 | Delete `lib/firestore.ts` and drop the SDK | Draft |

**Story 11.6 was the pilot and is done** (Review, 2026-08-23). It proved the
sequence — dual-write, backfill, verify by count, cut over, delete the old path
— on a collection whose worst failure is a missing training video rather than a
missing audit record.

**The actual work is 14.1.** 21 files import `@/lib/firestore` directly across
12 directories. Until each collection is reachable through one module, every
later story is a scattered edit instead of a swap.

**14.9 is last and is a separate decision.** Those are live OAuth refresh tokens
for every sub-account. Losing them is a whole-portfolio outage with no error
until requests start failing.

## Epic 15 — No hats

**Goal:** a person is the set of grants they hold, not one hat at a time.

Opened 2026-08-23 from `docs/ROLES_AND_GRANTS_PLAN.md` — three design iterations
and six adversarial reviews, reviewed and marked "not implemented". Sequenced by
`docs/no-hats-sequence.md`, which re-cuts the plan's story order against a
dependency graph as §9 of the plan instructs.

**The live bug this exists to fix.** Every client founder in production holds
five grants and can reach exactly one of them, permanently.
`functions/src/auth.ts` issues all five; `resolveSession` falls back to
`availableRoles[0]` because `requestedRole` is always undefined; and the UI to
change it never shipped. `switchRole` exists in the `RbacService` interface and
its three implementations and is called by no component. A CEO who also closes
already holds the closer grant and cannot get to it.

Confirmed still live 2026-08-23, from the other end: granting one account all
thirteen roles produced an account stuck on `admin`, which is deliberately
without widgets, with no way to move.

| ID | Story | Status |
| --- | --- | --- |
| 15.0 | Migration ledger | Draft |
| 15.A | Grants on the session; delete the dead switcher | Draft |
| 15.A2 | Registry truth: scope, kpi_summary split, sales widgets | Draft |
| 15.C | Union reachability | Draft — **moved ahead of 15.B** |
| 15.B | Per-location entitlement; close the cross-tenant leak | Draft — **moved after 15.C** |
| 15.D | `hasAnyRoleAnywhere` at location-free gates | Draft — the live bug dies here |
| 15.F | `validateLocations(locations, role)` | Draft |
| 15.G | Tab tables and fold; typed 503 | Draft |
| 15.H | Cut over to tabs | Draft |
| 15.I | Grant store, reconciler, templates, admin | Draft |
| 15.K | Delete `currentRole` and `availableRoles` | Draft |
| 15.M | Retire `ROLE_COOKIE` | Draft |
| 15.J | Drag and drop | Draft — deliberately last |
| 15.L | Drop `dashboard_configs` | Draft — not in the same release as 15.H |

**Why C and B swapped.** The plan orders B before C, and its own migration
findings say "Story B removes the client's only location source four stories
before its replacement." B is the removal, C is the replacement. A removal goes
after its replacement exists. This is the re-cut §9 asked for.

**Do not touch the claim shape.** §4 of the plan is the load-bearing decision:
retyping `locations` makes `parseRoleGrants` drop every entry, which
`resolveSession` reads as signed out. A rollback would sign out every migrated
user. Same keys, same types.

**15.0 first, and not only for this epic.** Nothing records which migrations
have been applied; 006 already failed once on a clean deploy. This epic adds two
more and the Firestore exit adds one per collection.

## Epic 17 — End-to-End Campaign Orchestration

**Goal:** From intake form to live Meta campaign running Mon-Thu-Sun with KPI monitoring and budget scaling, fully automated via Gemini orchestration.

Opened 2026-08-23. Phases 1–3 (provisioning, intake+Gemini copy, Meta setup) are live. Epic 17 extends from "Meta account ready" to "campaign live, monitored, and scaling."

**Scope:** Actor/AI video generation, editor integration, GHL funnel wiring, Meta campaign creation with predetermined settings, Mon-Thu-Sun scheduling with Thursday copy operation, KPI monitoring with alert routing, budget scaling based on ROAS signal.

**Blocked on:** 10.4 (Angular migration calibration) landing. The design phase (17.1) will interview the tech lead on seven decisions before implementation. Stories 17.2–17.7 build to that locked design.

| ID | Story | Status |
| --- | --- | --- |
| 17.1 | Orchestration layer design | Blocked — gates on 10.4 landing |
| 17.2 | Actor/AI video generation | Blocked on 17.1 |
| 17.3 | Editor integration | Blocked on 17.1 |
| 17.4 | GHL funnel placeholder wiring | Blocked on 17.1 |
| 17.5 | Meta campaign creation from copy variations | Blocked on 17.1 |
| 17.6 | Scheduling (Mon-Thu-Sun + Thursday copy) | Blocked on 17.1 |
| 17.7 | KPI monitoring + budget scaling + escalations | Blocked on 17.1 |

**Design questions (17.1 interview, when 10.4 lands):**
1. Where do actor videos live and how do they flow to editor?
2. How does editor hand off processed video back into the workflow?
3. How does Gemini wire videos into GHL PSL/pre-call placeholders?
4. What's the Meta campaign template (budget, audiences, placements)?
5. How does scheduling work (Cloud Scheduler, Pub/Sub, Firestore triggers)?
6. Which KPIs trigger alerts, and to whom?
7. What signal drives budget scaling (ROAS, daily spend trend, cost-per-lead)?
