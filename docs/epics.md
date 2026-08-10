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
| 1.2 | Agency OAuth install | Blocked — Agency Owner permission |
| 1.3 | Identity Platform sign-in | Ready |
| 1.4 | Role and location claims | Ready |
| 1.5 | Location-scoped routing | Ready |
| 1.6 | Tenant registry and entitlements | Ready |
| 1.7 | Deploy to Cloud Run | Ready |

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
| 3.1 | Portfolio list with process stage | Draft |
| 3.2 | Client health signals | Draft |
| 3.3 | Enter a client tenant | Draft |
| 3.4 | Impersonation banner and read-only default | Draft |
| 3.5 | Audit log of tenant access | Draft |
| 3.6 | Escalation view — ascension and risk | Draft |

Story 3.5 is not optional and should not be deferred behind 3.3. Entering a
client's data without a record of who did it is the kind of gap that is only
noticed when a client asks.

## Epic 4 — Client owner dashboard

**Goal:** the tax advisor sees whether it is working, without meeting
GoHighLevel.

| ID | Story | Status |
| --- | --- | --- |
| 4.1 | Meta System User and ad account access | Blocked — Meta setup |
| 4.2 | Spend and delivery by ad | Draft |
| 4.3 | Funnel counts — leads, booked, showed, closed | Draft |
| 4.4 | ROAS joined on `utmAdId` | Draft |
| 4.5 | "As of" freshness indicator | Draft |
| 4.6 | Owner's own calendar view | Draft |

## Epic 5 — Onboarding and campaign launch

**Goal:** onboarding runs in the Hub, and the campaign launch that ends it is
one auditable action.

| ID | Story | Status |
| --- | --- | --- |
| 5.1 | Onboarding checklist from Fulfillment stages | Draft |
| 5.2 | Campaign template per offer | Draft |
| 5.3 | Launch preview | Draft |
| 5.4 | Create paused via Marketing API | Draft |
| 5.5 | Explicit activation, advancing to `AP 2 - Ads Launched` | Draft |
| 5.6 | Budget ceilings and idempotency | Draft |

## Epic 6 — Acquisition loop

**Goal:** outcomes flow back to Meta so the algorithm buys prospects who close.

| ID | Story | Status |
| --- | --- | --- |
| 6.1 | Per-tenant duplicate-conversion audit | Blocked — open question |
| 6.2 | Conversion dispatch on showed | Draft |
| 6.3 | Conversion dispatch on closed-won with value | Draft |
| 6.4 | Pre-call vs on-call DQ in show-rate maths | Draft |
| 6.5 | Delivery monitoring and retry | Draft |

Story 6.1 gates the whole epic per tenant. Sending duplicate conversions is
worse than sending none — the algorithm optimises against inflated outcomes.
