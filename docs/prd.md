# TAG Hub — Product Requirements

**Status:** v1 draft
**Owner:** Samuel Fisher
**Supersedes:** `../../PRD.md` ("TAG Success Hub — Beta PRD", 25 Jul 2026)

---

## What changed from the previous PRD

The earlier document described a client success portal: CSMs and agency
clients, proof approval, an FAQ, and a ROAS dashboard whose data source was
listed as the single largest technical unknown. That product is not this one.

| Then | Now |
| --- | --- |
| CSM + client, two roles | Seven roles across TAG and client sides |
| One implied tenant | 40+ GHL sub-accounts, one tenant each |
| Proof approval as a core workflow | Not in scope |
| ROAS source unknown | Meta Marketing API, joined to GHL via `utmAdId` |
| Clients operate their own sales | TAG supplies closers as an à la carte service |
| No ad management | CSM launches client campaigns from onboarding |
| Nothing built | Four screens live against production data |

The FAQ, onboarding checklist, and in-dashboard scheduling ideas survive. The
proof-approval workflow does not.

---

## Problem

TAG sells done-for-you client acquisition to tax advisory firms: a VSL funnel
and Meta ad management as the entry offer, with a closing team, website, and
sales enablement available à la carte. The client's job is to deliver tax
advisory work on roughly $20k engagements. TAG's job is everything upstream of
that.

Today the work of running this is spread across GoHighLevel sub-accounts, Meta
Ads Manager, spreadsheets, and people's memory. Three costs follow:

1. **Outcomes are not recorded, so ad spend cannot be optimised.** Across 30
   days on one calendar, 86 appointments were marked confirmed and 24
   cancelled. Zero were marked showed or no-show. Show rate — the number that
   reveals whether ad spend is buying real prospects — is currently
   unmeasurable.
2. **No one can see across accounts.** Knowing which of 40 clients is
   onboarding, thriving, or quietly failing requires opening 40 sub-accounts.
3. **Clients see GoHighLevel.** A tax advisor logging in to check performance
   meets a marketing platform built for agencies, not a dashboard built for
   them.

## Goals

1. Make appointment outcomes a two-second click, so show rate, DQ rate, and
   close rate become measurable per client and per ad.
2. Close the acquisition loop: send showed and closed-won back to Meta as
   conversions, attributed to the individual ad via `utmAdId`.
3. Give each client's owner a dashboard that answers "is this working" without
   exposing GoHighLevel.
4. Give TAG one portfolio view showing where every client sits in the process
   and which need escalation — for expansion or for rescue.
5. Let a CSM launch a client's campaign from inside the onboarding sequence.

## Non-goals

- **A general-purpose Meta ads console.** Campaign launch is one step in
  onboarding, not a day-to-day management surface.
- **Rebuilding GHL's conversations, phone, or email.** GHL keeps doing those.
  Reminder automations stay as GHL workflows.
- **Replacing GHL as the system of record.** The Hub reads and writes through
  the API; it does not mirror GHL's data.
- **Reselling the Hub to other agencies.** Private app, one agency. Revisit
  later; it would change the OAuth and billing model.
- **A funnel or website builder.** Those stay in GHL.

---

## Users

### TAG side — cross-tenant

| Role | Frequency | Needs |
| --- | --- | --- |
| `tag_sales` | Daily | TAG's own pipeline. Sells TAG's services. |
| `tag_sales_manager` | Daily | Rep performance across TAG's pipeline. |
| `tag_csm` | Daily | Portfolio of assigned clients; enter a client account to work in it; run onboarding; launch campaigns. |
| `tag_exec` | Weekly | All 40 clients, escalation signals, revenue. |

### Client side — scoped to one tenant

| Role | Frequency | Needs |
| --- | --- | --- |
| `client_closer` | All day | Today's calls, prep, disposition, notes, follow-up. |
| `client_manager` | Daily | Closer performance, calendar coverage, pipeline health. |
| `client_owner` | Weekly | Spend, ROAS, leads, booked, showed, closed. Their calendar. |

**The closer is the primary daily user.** Their screen is a working surface
someone lives in for eight hours; show rate and follow-up discipline come from
it being fast. The owner's dashboard can be static and beautiful. The closer's
cannot be slow.

TAG's own sales team uses the same CRM code as a client's closers, against
TAG's own sub-account. One sub-account equals one tenant, including TAG's.

---

## Tenancy and entitlements

One GHL sub-account is one tenant. Services are à la carte, so the Hub cannot
assume every tenant has every capability.

```
locations/{locationId} → {
  name,
  services: {
    vslFunnel, adManagement,        // entry offer
    closingTeam, website, salesEnablement,   // à la carte
  },
  metaAdAccountId, metaBusinessId, metaPixelId,
  ownerModel: 'client' | 'tag',
}
```

Navigation and routes read from `services`. A tenant without `closingTeam` has
no pipeline route at all — not hidden with CSS, not rendered.

The Fulfillment pipeline already encodes the à la carte ladder: PR stages
produce the funnel, `AP 2 - Ads Launched` is the entry offer going live,
`AP 4 - Closer Recruit` sits between first deal and `AP 5 - Ascension`. The
closing team is the upsell once ads are proving out.

---

## The acquisition loop

Both directions share one join key: `utmAdId`, present on GHL contacts.

**Read** — Meta Marketing API gives spend per ad. GHL gives closed-won value
per contact. `utmAdId` joins them. That is ROAS per creative, not per campaign.

**Write** — showed and closed-won fire to the Meta Conversions API carrying
`fbc`, `fbp`, `utmAdId`, and hashed email/phone. That is what teaches the
algorithm to buy prospects who close rather than forms that submit.

Verified present on production contacts: `fbc`, `fbp`, `utmFbclid`, `utmAdId`,
`ip`, `userAgent`, and the full UTM set. The attribution plumbing already
works; nothing needs building to capture it.

**Open risk:** if GHL is already sending conversions to a client's pixel and
the Hub adds a second sender, conversions double-count and the algorithm
optimises against inflated outcomes — worse than sending nothing. Each client's
pixel must be checked in Meta Events Manager before the dispatch is enabled for
that tenant.

---

## Escalation signals

TAG owns every stage of the funnel, so a drop identifies which stage broke.

| Signal | Diagnosis | Owner |
| --- | --- | --- |
| Spend steady, bookings down | Creative fatigue or funnel | TAG media |
| Bookings up, show rate down | Reminder sequence or lead quality | TAG automation |
| Shows steady, DQ rate up | Targeting — wrong people booking | TAG media |
| Shows steady, close rate down | Closer performance or offer fit | Closing manager |
| All healthy, no expansion | **Ascension opportunity** | TAG CSM |
| Deals closing, delivery stalling | Client capacity — real churn risk | TAG CSM |

The last row is the failure that ends a $20k engagement fastest and appears
nowhere in ad metrics.

DQ rate is only meaningful if pre-call and on-call DQs are separated. A pre-call
DQ means no call happened and the lead should never have been booked — a
targeting failure that must leave the show-rate denominator entirely. An
on-call DQ means a real person showed and did not qualify; it counts as showed
and leaves close rate. This is captured automatically from when the outcome was
marked relative to the appointment.

---

## Requirements

### P0

**Access and tenancy**
- Authenticated users carry a role and a set of permitted locations.
- Every GHL request names its location explicitly; no ambient current location.
- A client user cannot reach another tenant's data by any navigation path.
- Agency OAuth install serves all sub-accounts; no per-client secret.

**Closer workspace** *(built)*
- Day view of appointments across all calendars, with Confirmed / Showed /
  No-show / DQ / Cancelled.
- Outcome timing recorded relative to the appointment.
- Pipeline board by stage, defaulting to open.
- Contact detail with attribution and notes.

**Client owner dashboard**
- Spend, leads, booked, showed, closed, ROAS. A visible "as of" timestamp so
  staleness is never ambiguous.
- No GoHighLevel surface area.

**CSM portfolio**
- All assigned clients with process stage and health.
- Enter a client account to work inside it, with an unmistakable banner and an
  audit record of who entered which tenant, when, and what they did.

### P1

- Onboarding checklist per client, driven by Fulfillment pipeline position.
- Campaign launch from onboarding: template plus client inputs, created paused,
  explicit preview, explicit activation, advancing the opportunity to
  `AP 2 - Ads Launched`.
- Meta conversion dispatch on showed and closed-won.
- Sales enablement content surfaced on the closer's call screen.

### P2

- Automated health scoring rather than derived signals.
- Client-facing views the advisor could expose to their own clients.
- Reselling the Hub to other agencies.

---

## Baselines

Measured against production on 7 Aug 2026. These are the numbers v1 has to move.

| Metric | Today |
| --- | --- |
| Appointments marked showed or no-show | **0** of 110 over 30 days |
| Sales Pipeline opportunities | 100 — 77 abandoned, 15 open, 8 won |
| Open pipeline value | $270,000 |
| Typical deal | $18,000 |
| Show rate | Unmeasurable |
| DQ rate | Unmeasurable |
| ROAS per ad | Unmeasurable |

The 77% abandoned rate needs interpretation before it can be a baseline: if it
is genuine attrition it is the largest number in the acquisition loop; if it is
housekeeping, the denominator is wrong.

## Success metrics

**Leading**
- Share of appointments with an outcome marked within 24h — target 90%+
- Clients with a computable show rate — target all with `closingTeam`
- CSM portfolio replacing per-account checking as the daily habit

**Lagging**
- Show rate and close rate trend, per client and per ad
- Cost per closed deal, once conversions are flowing
- Ascension conversions sourced from the escalation view

---

## Epics

| # | Epic | Status |
| --- | --- | --- |
| 1 | Foundation and access | Partially built — token seam done, auth not started |
| 2 | Closer workspace | Built against one tenant |
| 3 | CSM portfolio and impersonation | Not started |
| 4 | Client owner dashboard | Not started |
| 5 | Onboarding and campaign launch | Not started |
| 6 | Acquisition loop | Not started |

Stories live in `docs/stories/`. Epics 1 and 2 are sharded; 3–6 are summarised
in `docs/epics.md` and shard when they come up.

## Open questions

- **Duplicate conversions.** Is GHL already sending Meta conversions on any
  client pixel? Blocks Epic 6 per tenant.
- **Meta asset ownership.** Client-owned Business Manager with TAG partner
  access, or TAG-owned? Recommended: client-owned. Affects offboarding.
- **`ads_management` access tier.** Standard access may suffice at this volume
  with a System User inside TAG's BM; verify before planning a date.
- **The 77% abandoned rate.** Real attrition or housekeeping?
- **Agency owner permissions.** Sub-account creation and app install are
  owner-gated; `AGENCY-ADMIN` is not sufficient.
