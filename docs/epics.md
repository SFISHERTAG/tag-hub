# TAG Hub — Epics and Stories

Story files for Epics 1–2 live in `docs/stories/`. Epics 3–6 shard when they
come up; splitting them now would freeze decisions that earlier epics will
inform.

Status values: `Done` · `In progress` · `Ready` · `Blocked` · `Draft`

---

## Epic 1 — Foundation and access

**Goal:** a user logs in, carries a role and a set of permitted locations, and
cannot reach a tenant they are not entitled to.

Everything downstream is a permissions question before it is a feature, so this
epic gates the rest.

| ID | Story | Status |
| --- | --- | --- |
| 1.1 | Token resolution seam | Done |
| 1.2 | Agency OAuth install | Blocked — GHL account consolidation |
| 1.3 | Identity Platform sign-in | Ready |
| 1.4 | Role and location claims | Scaffolded |
| 1.5 | Location-scoped routing | Ready |
| 1.6 | Tenant registry and entitlements | Scaffolded |
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
| 2.6 | Mark won / lost with value | Ready |
| 2.7 | Call preparation panel | Draft |
| 2.8 | Follow-up queue | Draft |

## Epic 3 — CSM portfolio and impersonation

**Goal:** one view across all clients, and the ability to enter a client
account to work in it — auditably.

| ID | Story | Status |
| --- | --- | --- |
| 3.1 | Portfolio list with process stage | Ready |
| 3.2 | Client health signals | Ready |
| 3.3 | Enter a client tenant | Ready |
| 3.4 | Impersonation banner and read-only default | Ready |
| 3.5 | Audit log of tenant access | Ready |
| 3.6 | Escalation view — ascension and risk | Ready |

**No blocker.** Stories 1.4 + 1.6 scaffolded. Epic 3 ready to build once admin sets up CSM location claims.

Story 3.5 is not optional and should not be deferred behind 3.3. Entering a
client's data without a record of who did it is the kind of gap that is only
noticed when a client asks.

## Epic 4 — Client owner dashboard

**Goal:** the tax advisor sees whether it is working, without meeting
GoHighLevel.

| ID | Story | Status |
| --- | --- | --- |
| 4.1 | Meta System User and ad account access | Blocked — Meta setup |
| 4.2 | Spend and delivery by ad | Ready |
| 4.3 | Funnel counts — leads, booked, showed, closed | Ready |
| 4.4 | ROAS joined on `utmAdId` | Ready |
| 4.5 | "As of" freshness indicator | Ready |
| 4.6 | Owner's own calendar view | Ready |

**Blocker:** Story 4.1 (Meta setup) gates all of 4.2–4.6. Once Meta BM + API are ready, these can be built in parallel.

## Epic 5 — Onboarding and campaign launch

**Goal:** onboarding runs in the Hub, and the campaign launch that ends it is
one auditable action.

| ID | Story | Status |
| --- | --- | --- |
| 5.1 | Onboarding checklist from Fulfillment stages | Ready |
| 5.2 | Campaign template per offer | Ready |
| 5.3 | Launch preview | Ready |
| 5.4 | Create paused via Marketing API | Ready |
| 5.5 | Explicit activation, advancing to `AP 2 - Ads Launched` | Ready |
| 5.6 | Budget ceilings and idempotency | Ready |

**Blocker:** Story 4.1 (Meta API) gates 5.4–5.5. Onboarding flow (5.1–5.3, 5.6) can be built independently.

## Epic 6 — Acquisition loop

**Goal:** outcomes flow back to Meta so the algorithm buys prospects who close.

| ID | Story | Status |
| --- | --- | --- |
| 6.1 | Per-tenant duplicate-conversion audit | Ready — manual audit required |
| 6.2 | Conversion dispatch on showed | Ready |
| 6.3 | Conversion dispatch on closed-won with value | Ready |
| 6.4 | Pre-call vs on-call DQ in show-rate maths | Ready |
| 6.5 | Delivery monitoring and retry | Ready |

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
| 7.4 | Client-visibility allowlist at the query layer | Allowlist + catalog built |
| 7.5 | Sales-enablement upgrade lever — GHL tag, not a Hub action | Draft |
| 7.6 | Data scope at the query layer — whose rows, per hat | Enforcement layer built |

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
Angular SPA talks HTTP, and today 39 exported Server Actions across 21
`use server` files have no HTTP equivalent, while 24 of 25 data-reading pages
import `lib/` directly inside a React Server Component. So each story below ships
its endpoints and its screens together. Endpoints go in `app/api/**`, keeping the
Next deployment as an API-only host serving the Angular bundle same-origin —
`hub_session` is httpOnly SameSite=lax and only survives that topology, and
`functions/` is deliberately kept to as few dependencies as possible.

Screens move one feature at a time. When an Angular feature passes its gate, the
matching Next pages are deleted in the same commit and the route points at
Angular, so a screen exists in exactly one place and no defect gets fixed twice.

| ID | Story | Status |
| --- | --- | --- |
| 10.1 | Contract hardening and boundary enforcement | In Progress |
| 10.2 | Real session wiring and the auth surface | Draft |
| 10.3 | Responsive shell and navigation | In Progress |
| 10.4 | Shared M3 primitives, portfolio and bug reports | Draft |
| 10.5 | GHL integration module | Draft |
| 10.6 | Widget dashboard and the clients book | Draft |
| 10.7 | Remaining feature modules and legacy removal | Draft |

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
