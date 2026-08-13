# TAG Success Hub — Beta PRD

**Status:** Draft v1
**Owner:** Sam Fisher
**Working title:** TAG Success Hub (rename freely — used as a placeholder throughout)

---

## Problem Statement

TAG delivers marketing services to agency clients on a done-for-you (DFY) basis — TAG's CSMs do the work, not the agencies. Today, everything that keeps that relationship running (onboarding, answering repeat questions, tracking account health, approving creative/proof, reporting performance, scheduling check-ins) happens through scattered, manual channels (email, calls, spreadsheets, ad hoc decks). This creates two costs: CSMs spend time on repeatable, answerable-without-a-human work instead of strategic account work, and agency clients lack a single place to see how their account is performing or to act (approve proof, book time) without waiting on a reply.

CCE's Member Success Portal solves an analogous problem for its members. TAG needs its own version, shaped around a DFY service model rather than a self-serve product — agencies are clients receiving a service, not peers using a shared tool, so there is no community/networking surface.

## Goals

1. Reduce CSM time spent on repetitive onboarding/FAQ questions by giving agencies a self-serve resource before they need to ask a human.
2. Give agency clients a always-available view of account performance (ROAS and other live metrics) without waiting on a CSM report.
3. Cut proof/creative approval turnaround time by moving it into a dashboard workflow instead of email threads.
4. Make booking time with a CSM a zero-friction, in-dashboard action (no back-and-forth scheduling emails).
5. Validate the concept with a small beta cohort of real agency clients before investing in a v1 build — beta success is measured by usage and qualitative feedback, not scale.

## Non-Goals

- **Agency-to-agency community/networking.** TAG is DFY and plans to stay that way; agencies are not peers and should not interact with each other in the hub.
- **Self-serve campaign management.** Agencies are not building or editing campaigns themselves in this tool — TAG's team still does the work. The hub is for visibility and approval, not execution.
- **Full billing/invoicing system.** Payment and contract management stay in existing tools for the beta; not rebuilt here.
- **Native mobile app.** Beta ships as a responsive web app only.
- **White-labeling for agencies' own end clients.** Out of scope for the beta — this is TAG-branded, for TAG's direct agency clients only. May revisit post-beta if agencies want to expose parts of it to their own clients.

## Target Users

**1. CSM (internal, "CSM side")** — a TAG employee managing a portfolio of agency accounts. Needs fast answers to their own process questions, and a clear view of each account's status so they know who needs attention.

**2. Agency client contact ("client side")** — the primary point of contact at a marketing agency that TAG serves. Wants to know how their account/campaigns are performing, needs to approve or reject creative/proof quickly, and wants to reach their CSM without friction.

## Scope for the Beta

**In scope:** a two-sided web app with authenticated login and role-based views (CSM vs. client), covering onboarding, FAQ/self-serve knowledge, account/success tracking, a client performance dashboard, proof approval, in-dashboard scheduling, and reminders — see Requirements below for the P0/P1 cut.

**Out of scope:** everything listed under Non-Goals, plus any integration or feature not explicitly named in P0/P1.

**Beta cohort:** a small, hand-picked set of existing agency clients (exact number TBD by the business, not this spec) — not a public signup.

---

## User Stories

### CSM side
- As a CSM, I want a searchable FAQ/knowledge base of internal process answers so I don't have to interrupt a teammate or re-derive the answer myself.
- As a CSM, I want a guided onboarding checklist for each new agency account so nothing gets missed during setup.
- As a CSM, I want to see a list of my accounts with a status/health indicator so I know which ones need attention today.
- As a CSM, I want to see an account's history of approvals, meetings, and open items in one place so I don't have to piece it together from email.
- As a CSM, I want to be notified when a client submits a proof decision or books a meeting so I can respond promptly.

### Client (agency) side
- As an agency client, I want a self-serve onboarding flow so I know what to expect and what's needed from me without waiting on a call.
- As an agency client, I want an FAQ so I can answer my own basic questions (billing cycle, reporting cadence, who my CSM is) without emailing anyone.
- As an agency client, I want to see a live performance dashboard (current ROAS and other key metrics) so I always know how my account is doing.
- As an agency client, I want to review and approve or reject creative/proof directly in the dashboard so approvals don't get lost in email.
- As an agency client, I want to book time with my CSM directly from the dashboard so scheduling doesn't take multiple emails.
- As an agency client, I want reminders (e.g., pending approvals, upcoming meetings) so I don't miss something time-sensitive.
- As an agency client, I want to be notified when new proof is ready for my review so I don't have to keep checking manually.

### Edge cases to design for
- As an agency client, if I have no assigned CSM yet (mid-onboarding), I should still see a sensible empty/pending state, not a broken dashboard.
- As a CSM, if a client account has no live performance data yet (too new), the dashboard should say so clearly rather than showing zeros as if that's real performance.
- As an agency client, if I reject a proof, I need a way to leave a reason/comment so the CSM knows what to fix.

---

## Requirements

### Must-Have (P0)

**Auth & roles**
- Two authenticated roles: CSM and client contact, with distinct views/permissions.
- Each client user is scoped to only their own account's data.
- Acceptance: a client user cannot view another agency's data under any navigation path; a CSM can view all accounts assigned to them.

**Client onboarding & FAQ**
- Step-by-step onboarding checklist/flow for new agency clients.
- Searchable FAQ/knowledge base, editable by TAG staff without a code change.
- Acceptance: a new client can complete onboarding steps and mark them done; FAQ entries can be added/edited by an admin and appear immediately to clients.

**CSM onboarding & FAQ**
- Equivalent internal-facing checklist and FAQ for CSMs (process docs, not client-facing content).
- Acceptance: CSM-only FAQ content is not visible to client accounts.

**Account/success tracking (CSM view)**
- List of accounts assigned to a CSM with a status indicator (e.g., onboarding, healthy, needs attention).
- Per-account detail view showing key activity: recent approvals, upcoming/past meetings, onboarding progress.
- Acceptance: a CSM can go from account list to account detail in one click and see current status without pulling data from another tool.

**Performance dashboard (client view)**
- Displays current ROAS and a small set of other key metrics for the client's account.
- Data refreshes on a defined cadence (real-time is a stretch goal for beta — see Open Questions on data source).
- Acceptance: a client sees a populated dashboard reflecting the latest available data pull, with a visible "as of" timestamp so staleness is transparent.

**Proof/creative approval workflow**
- Client can view submitted creative/proof, and approve or reject with an optional comment.
- CSM can see the status (pending/approved/rejected) and any client comment.
- Acceptance: a full round trip — CSM submits proof, client approves or rejects with comment, CSM sees the outcome — works end to end.

**In-dashboard scheduling**
- Client can book an appointment with their assigned CSM directly from the dashboard, without leaving the app.
- Acceptance: booking a slot creates a confirmed meeting visible to both the client and the CSM.

**Reminders/notifications**
- Clients are reminded of pending approvals and upcoming booked meetings.
- CSMs are notified when a client takes an approval action or books a meeting.
- Acceptance: a pending proof approval older than a defined threshold surfaces a reminder to the client.

### Nice-to-Have (P1)

- "Running clock" / live-feeling metrics treatment on the dashboard (e.g., visibly ticking or auto-refreshing numbers) — the creative/engagement layer on top of the core metrics.
- Historical trend view of ROAS/metrics over time, not just current snapshot.
- In-app messaging/comment thread between client and CSM (beyond proof-approval comments).
- Configurable reminder cadence/thresholds per account.
- Admin analytics on hub usage itself (who's logging in, what's being used) to inform the beta readout.

### Future Considerations (P2)

- White-labeled or embeddable views agencies could expose to their own end clients.
- Expanding scheduling to support team-based (not just 1:1 CSM) booking.
- Automated health scoring instead of manually-set status.
- Self-serve billing/invoice visibility.

---

## Success Metrics

**Leading indicators (assessed during the beta window):**
- % of beta clients who complete onboarding in-app (target: 80%+)
- % of beta clients who log in more than once in the first 2 weeks (target: 60%+)
- Median time from proof submission to client decision, in-app vs. prior email baseline (target: meaningfully faster — establish the email baseline before launch)
- % of proof approvals completed in-app rather than reverting to email/call (target: 70%+)
- Number of appointments booked in-dashboard vs. booked the old way

**Lagging indicators (assessed at beta close, e.g., 4-6 weeks in):**
- Qualitative feedback from beta clients (would they want to keep using it)
- Qualitative feedback from CSMs (did it reduce repetitive questions/interruptions)
- Change in CSM time spent per account on status reporting and scheduling (self-reported or observed)

Define the exact beta length and evaluation date with the business before launch — not fixed in this spec.

---

## Open Questions

- **Data source for ROAS/performance metrics** (engineering/data): Where does this data live today, and is there an existing pipeline/API to pull from, or does one need to be built for the beta? This is likely the single biggest technical unknown.
- **What counts as "proof"?** (stakeholder): Is this static creative files/images, links, documents, or something else? Determines what the approval viewer needs to render.
- **Scheduling integration** (engineering): Does this connect to an existing calendar system (e.g., Google Calendar, Calendly-style tool) or does availability need to be managed natively in the hub?
- **CSM-to-client assignment model** (stakeholder): Is it strictly one CSM per account, or can multiple CSMs/roles touch one account? Affects the data model and notification routing.
- **Beta cohort size and selection** (stakeholder): How many agencies, which ones, and how are they invited/onboarded to the beta itself?
- **Branding/naming** (stakeholder): "TAG Success Hub" is a placeholder — confirm actual product name before it appears in client-facing UI.
- **Notification channels** (design/stakeholder): In-app only for beta, or also email/SMS push for reminders?
- **Hosting/tech constraints** (engineering): Any existing TAG infrastructure, auth provider, or stack this needs to fit into, or is this fully greenfield?

---

## Timeline Considerations

- No hard external deadline is specified yet — recommend the business set a target beta start date once the data-source and proof-definition open questions are resolved, since those two gate real engineering estimates.
- Suggested phasing if timeline is tight: ship onboarding + FAQ + proof approval + scheduling first (these don't depend on the ROAS data-source question being resolved), and treat the performance dashboard as a fast-follow once the data source is confirmed.
