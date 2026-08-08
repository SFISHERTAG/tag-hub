# TAG Hub

Internal acquisition hub for Tax Advisory Growth. Pipeline, appointments, and
notes across agency sub-accounts, with GoHighLevel as the system of record.

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in credentials
npm run dev
```

`.env.local` is gitignored and must stay that way — it holds live credentials.

| Variable | Purpose |
| --- | --- |
| `GHL_CLIENT_ID` / `GHL_CLIENT_SECRET` | Marketplace OAuth app (agency install) |
| `GHL_REDIRECT_URI` | Must match a Redirect URL registered on the app |
| `GHL_PIT` | Private Integration Token — single-location development fallback |
| `GHL_LOCATION_ID` | The sub-account the PIT belongs to |
| `GOOGLE_CLOUD_PROJECT` | Firestore project (`tag-success-hub`) |

Firestore access locally needs application default credentials:

```bash
gcloud auth application-default login
```

## Screens

| Route | What it does |
| --- | --- |
| `/` | Pipeline board — deals by stage, status filters, stage totals, staleness |
| `/today` | Appointments with Confirmed / Showed / No-show / DQ / Cancelled |
| `/contacts` | Searchable contact list |
| `/contacts/[id]` | Attribution, tags, and notes |

## How credentials resolve

Callers ask for a token by location and never learn where it came from
(`lib/ghl/tokens.ts`). Resolution order:

1. A cached location token that is still valid
2. A direct-install token, refreshed with its own refresh token
3. A token minted from the agency install
4. `GHL_PIT`, for the single location in `GHL_LOCATION_ID`

That indirection is what lets one agency OAuth install serve every sub-account.
A Private Integration Token reaches exactly one location, so at 40+ clients it
would mean 40 secrets and a manual step per client — fine for development,
unworkable in production.

Every GHL request names its location explicitly. There is no ambient "current
location", so a query cannot read another tenant's data by omission.

## What lives where

GoHighLevel stays the system of record for contacts, opportunities,
appointments, and notes. Firestore holds only what GHL has no concept of:

- OAuth tokens
- Appointment outcome timing — GHL stores the status but not when it was set,
  and for a DQ that timing is the meaning. Marked before the appointment starts,
  no call happened and the lead should never have been booked. Marked during it,
  a real person showed and did not qualify. The first belongs outside the
  show-rate denominator; the second counts as showed.

Keeping that boundary tight is what stops this becoming a data-reconciliation
project.

## Notes

Calendar endpoints are pinned to API version `2021-04-15`; everything else uses
`2021-07-28`. GHL returns appointment status under both `appointmentStatus` and
the misspelled `appoinmentStatus`, and both are read.
