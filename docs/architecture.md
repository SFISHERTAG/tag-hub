# TAG Hub — Architecture

Companion to `prd.md`. Describes what is built, what is decided, and why.

---

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| App | Next.js 16, React 19, TypeScript, Tailwind 4 | Route handlers keep credentials server-side; middleware gates roles; one deploy |
| Hosting | Cloud Run (`us-central1`) | Scales to zero; pay per request |
| App data | Firestore (native, `us-central1`) | Tokens, entitlements, audit, outcome timing |
| Secrets | Secret Manager | Production credentials, versioned and audited |
| Auth | Identity Platform | Custom claims carry role and permitted locations |
| Images | Artifact Registry (`us-central1/hub`) | Cloud Run source |
| CI | Cloud Build | Build and deploy on push |
| Source | `github.com/SFISHERTAG/tag-hub` (private) | |

GCP project: `tag-success-hub`, under `taxadvisorygrowth.net`.

---

## The data boundary

**GoHighLevel is the system of record** for contacts, opportunities,
appointments, and notes. The Hub reads and writes through the API and never
mirrors that data.

**Firestore holds only what GHL has no concept of:**

| Collection | Contents |
| --- | --- |
| `ghl/agency` | Credential root — records which company is primary |
| `ghl/agency/companies/{companyId}` | One agency OAuth token per installing company |
| `ghl/agency/locations/{id}` | Per-location tokens — minted or direct-install |
| `locations/{id}` | Entitlements, Meta account ids, owner model |
| `locations/{id}/appointmentOutcomes/{id}` | Outcome timing |
| `audit/{id}` | Impersonation and campaign-launch records *(planned)* |

This boundary is the main defence against becoming a data-reconciliation
project. Every proposal to cache GHL data locally should be met with the
question of what happens when the two disagree.

**Outcome timing is the instructive case.** GHL stores an appointment's status
but not when it was set. For a DQ that timing is the entire meaning — marked
before the appointment starts, no call happened and the lead should never have
been booked; marked during it, a real person showed and did not qualify. Those
belong on opposite sides of a show-rate calculation. GHL has no field for it,
so Firestore does, and only that.

---

## Credential resolution

`lib/ghl/tokens.ts` is the seam. Callers ask for a token by location and never
learn where it came from:

1. A cached location token that is still valid
2. A direct-install token, refreshed with its own refresh token
3. A token minted from the agency install via `POST /oauth/locationToken`
4. `GHL_PIT` — development fallback, single location only

**Why the indirection.** A Private Integration Token reaches exactly one
location. At 40+ clients that is 40 secrets and a manual provisioning step per
client. The agency OAuth install mints per-location tokens on demand: one
install, new sub-accounts reachable automatically.

Firestore being unreachable is not fatal in development — resolution falls
through to the PIT rather than crashing, so local work continues without
application default credentials.

**Tenant isolation.** Every call in `lib/ghl/client.ts` takes `locationId` as
its first argument. There is deliberately no ambient "current location", so a
query cannot read another tenant's data by omission. At 40 tenants that is the
difference between a bug and a breach.

---

## Authentication and roles *(not built)*

Identity Platform, with custom claims:

```
{ role: 'tag_csm', locations: ['loc_a', 'loc_b'] }
{ role: 'client_closer', locations: ['loc_a'] }
```

Middleware resolves the claim, and every request validates that the requested
`locationId` is in the user's permitted set before any GHL call. Route shape:

```
/                          → role-appropriate landing
/l/[locationId]/pipeline   → closer / TAG sales
/l/[locationId]/today      → closer
/l/[locationId]/dashboard  → client owner
/portfolio                 → tag_csm, tag_exec
```

**Impersonation** is a role capability, never a shared login. A `tag_csm` may
enter a permitted client tenant. Requirements: a persistent banner naming the
tenant, read-only by default with writes separately permitted, and an audit
record of who entered which tenant, when, and what they touched. That record is
what answers a client asking who looked at their data.

---

## Meta integration *(not built)*

**One credential, not forty.** A System User in TAG's Business Manager, with
each client ad account shared in via partner access. Structurally identical to
the GHL agency install: one credential serving every tenant. System User tokens
do not carry the 60-day expiry that user tokens do.

Recommended ownership: **client owns the Business Manager and ad account, TAG
holds partner access.** The client keeps their pixel, audience history, and ad
account learning; offboarding is a removal rather than an asset transfer, and
spend stays on their billing. Note that partner access must be *granted* by the
client — a System User cannot be added to an account TAG does not own.

**Read** — Marketing API for spend per ad, joined to GHL revenue by `utmAdId`.

**Write** — Conversions API on showed and closed-won, carrying `fbc`, `fbp`,
`utmAdId`, and hashed email/phone.

**Campaign launch** spends real money, so: created `PAUSED` always, a preview
step showing exactly what will be created, app-side budget ceilings per client,
idempotency keys so a retry cannot double-create, and an audit record. Low
volume does not make a mistyped budget cheaper.

**Why not GHL's Ad Manager.** GHL has an in-app Ad Manager (GA as of mid-2026)
that connects a Meta ad account and lets a human create, publish, pause, edit,
and duplicate campaigns from inside GHL's own UI. Checked it against GHL's
full published API v2 endpoint list — every category they expose (Contacts,
Opportunities, Calendars, Campaigns [SMS/email, not ads], Funnels, Social
Planner, Workflows, and the rest) — and there is no Ad Manager, Meta, or
Facebook Ads category anywhere in it. It is not scriptable; a person has to
click through it. Two consequences:

- *Reporting is a non-issue either way.* Spend and delivery data has to come
  from Meta's Marketing API directly regardless of who launched the campaign,
  since GHL exposes no API for Ad Manager's data either. The Read section
  above isn't optional under any version of this plan.
- *Launch stays direct, on purpose.* GHL's Ad Manager is a generic third-party
  UI with no visibility into a per-client budget ceiling, no idempotency
  guarantee this app controls, and no audit record tied to this app's audit
  log. Routing the one step that spends real money through a tool with none of
  those guardrails would undo the whole point of the paragraph above it.

**Genuine complement, different feature.** GHL's Ad Manager also syncs Meta
Instant Form leads into GHL's CRM. If TAG ever runs lead-gen-objective
campaigns (as opposed to landing-page conversion campaigns), that sync is
worth using as-is — GHL is already the system of record for contacts, and
there's no reason to build a second Meta Lead Ads webhook receiver to
duplicate it.

---

## GHL API notes

Hard-won specifics, all verified against production:

- Base: `https://services.leadconnectorhq.com`
- Version header `2021-07-28` for most endpoints; **`2021-04-15` for calendars**
- Appointment status appears under both `appointmentStatus` and the misspelled
  `appoinmentStatus`; both are read so a fix on their side cannot blank the
  column
- Opportunity search uses `location_id` / `pipeline_id` (snake case) while most
  endpoints use `locationId`
- Attribution arrives as an `attributions` array from the contact list, and as
  `attributionSource` / `lastAttributionSource` objects from the single-contact
  route; normalised in `lib/ghl/contacts.ts`
- Redirect URIs **may not contain the string `ghl`** — the marketplace
  validator rejects them, which is why routes are `/api/oauth/*`
- Marketplace apps need **Target User: Sub-Account** with **Agency & sub-account
  install** to hold sub-account scopes while still installing agency-wide
- Sub-account creation and app installation are **Agency Owner** actions;
  `AGENCY-ADMIN` is refused

---

## Current state

**Built and working against production data**

- `lib/ghl/` — client, tokens, pipelines, opportunities, appointments, contacts
- `app/` — board, today, contacts list, contact detail
- `app/api/oauth/` — install and callback, agency and direct installs
- GCP project provisioned; Firestore, Secret Manager, Artifact Registry live

**Decided, not built** — auth and roles, portfolio, impersonation and audit,
client dashboard, onboarding, campaign launch, conversion dispatch.

**Blocked** — agency OAuth install and sub-account creation, both pending
Agency Owner permissions.

---

## Sequencing

The order that de-risks the most:

1. **Auth and roles** — everything else is a permissions question first
2. **CSM portfolio** — usable immediately, needs no new integration
3. **Client CRM per tenant** — the closer workspace, multi-tenant
4. **Impersonation with audit**
5. **Onboarding and campaign launch**
6. **Meta reporting and conversion dispatch**

Meta last, deliberately. It is the most visible piece and the most dependent on
everything else being real: ROAS cannot be computed until closed-won flows
reliably, and conversions should not be sent until outcomes are trustworthy.

Meta App Review, if required, runs on its own clock — start it in parallel with
step 1 rather than waiting for step 6.
