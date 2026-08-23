# GHL Account Migration Checklist (per account)

Moving one client from a standalone GHL account into a sub-account under the TAG
agency. Run this once per account. 23 accounts in scope, target 40 post-migration.

Unblocks: `docs/stories/1.2-agency-oauth-install.md` AC#4. No code change is
required by this migration; the agency install completed 2026-08-09 and the
token path (`lib/ghl/tokens.ts`) already resolves any location under the agency.

## Phase 0 — Classify (5 min, do this for all 23 before starting any)

- [ ] Log in as the client (or have them log in) and record whether an **agency
      dashboard** sits above their location.
- [ ] Record the plan tier and who pays the GHL bill today.
- [ ] Decide the path:
      - **Transfer** — agency container exists. Data moves intact. Default path.
      - **Rebuild** — no agency container, or the owner will not release it.
        Snapshot plus CSV. Accept history loss. Requires client sign-off.
- [ ] Record the owner-of-record email. It is the only account that can
      initiate a transfer.

Do not start Phase 1 on any account until all 23 are classified. The split
determines the programme timeline.

## Phase 1 — Pre-flight capture (before you touch anything)

The point of this phase is to be able to prove afterwards that nothing was lost.

- [ ] Export contacts to CSV. Note the exact row count.
- [ ] Note counts: opportunities per pipeline, calendars, active workflows,
      funnels/websites, forms, custom fields, custom values.
- [ ] Screenshot the pipeline board and the calendar list.
- [ ] List every phone number on the account, with its A2P/10DLC brand and
      campaign registration status.
- [ ] List the sending email domain and its verification state.
- [ ] List every third-party connection the client authorized personally:
      Stripe, Google (calendar, GMB, Ads), Facebook/Meta, QuickBooks, Zapier.
- [ ] Note any active recurring payments or subscriptions running through GHL.
- [ ] Confirm whether the support account is currently a user on this account,
      and note what it is used for.

## Phase 2 — Execute the move

### Transfer path
- [ ] Confirm both sides are on plans eligible for sub-account transfer.
- [ ] Agree in writing who pays from the transfer date forward.
- [ ] Client-side owner initiates the sub-account transfer to the TAG agency.
- [ ] TAG accepts on the receiving side.
- [ ] Confirm the location now appears under the TAG agency, and record its
      `locationId`.

### Rebuild path
- [ ] Create the sub-account under the TAG agency from the standard template.
- [ ] Load the client's configuration snapshot.
- [ ] Import the contacts CSV. Reconcile the row count against Phase 1.
- [ ] Recreate pipelines, stages, and calendars to match the Phase 1 screenshots.
- [ ] Tell the client, in writing and before cutover, exactly what history does
      not come across: conversation threads, call recordings, appointment
      history.
- [ ] Record the new `locationId`.

## Phase 3 — Reconnect what never travels

Assume all of these are broken until individually verified. This phase is where
migrations actually fail.

- [ ] Phone numbers moved or re-provisioned. A2P brand and campaign
      re-registered if required. Send a live test SMS.
- [ ] Email sending domain re-verified. Send a live test email.
- [ ] Stripe reconnected. Confirm no duplicate or orphaned subscriptions.
- [ ] Google connections re-authorized.
- [ ] Meta/Facebook reconnected. Separately confirm the ad account is still
      partnered to TAG's Business Manager **and** assigned to the
      `tag-hub-server` System User. Partner access alone is not sufficient
      (story 4.1, and story 5.1 AC2).
- [ ] Workflows re-enabled and spot-checked. Confirm none fired duplicate
      messages to real contacts during the move.

## Phase 4 — Hub cutover

- [ ] Add the location to the tenant registry with its new `locationId`
      (`lib/ghl/tenants.ts`, story 1.6).
- [ ] Confirm the agency install mints a location token for it. This is the
      single check that proves the migration worked for the Hub.
- [ ] Set `metaAdAccountId` on the tenant record.
- [ ] Confirm the Fulfillment opportunity and its stage resolve
      (`getFulfillmentOpportunity()`, story 5.1).
- [ ] Enter the tenant from Portfolio (story 3.3) and confirm the impersonation
      banner and audit entry both appear (stories 3.4, 3.5).
- [ ] Remove the support account as a direct user on the old account. Agency
      access replaces it, and it is what makes the audit log complete.
- [ ] If a per-client direct install was ever created for this account, revoke
      it so there is one credential path, not two.

## Phase 5 — Verify and close

- [ ] Contact count matches Phase 1.
- [ ] Opportunity counts per pipeline match Phase 1.
- [ ] Live inbound test: form submission creates a contact and fires the
      expected workflow.
- [ ] Live outbound test: SMS and email both deliver.
- [ ] Client confirms in writing that they can log in and see their data.
- [ ] Old standalone account cancelled or downgraded, with a date recorded.
- [ ] Tick this account off in story 1.2's count.

## Rollback

Up to the end of Phase 2, rollback is: do not cancel the old account. Keep it
live and paid through Phase 5 sign-off on every account. The old account is the
only backup that exists, and a transfer cannot be reversed by clicking a button.
