# Fulfillment Pipeline Re-architecture

**Status:** Proposal, 2026-08-22. Supersedes the stage model story 5.1 was built
against. Not yet agreed.

## Why

Two things forced this.

**The tracking sheet is not trustworthy.** TAG's onboarding state has lived in a
manual checkbox sheet: 15 boolean milestones per client, no timestamps, ticked by
hand. Sam's own assessment is that none of the checkmarks can be relied on, and
the sheet shows it internally — one column reads FALSE for every active client
while a later, dependent column reads TRUE for over half. That is not a data
entry problem to be fixed with discipline. Any state that requires a human to
remember to record it will drift, and the drift is invisible, which is worse than
a gap.

**The current pipeline cannot express the real bottleneck.** A GHL opportunity
sits in exactly one stage. The sheet's milestones are not all sequential: A2P
registration and creative production run alongside build work, not after it.
Forcing parallel work into a linear stage list means the pipeline can say a
client is stuck without saying on what, which is the only thing worth knowing.

## Three principles

**1. A stage is an ownership handoff, not a task.** The stage answers "whose move
is it?" Boundaries fall where responsibility crosses between TAG and the client.
This is what makes an SLA breach attributable instead of merely observed.

**2. Parallel workstreams are tracks, not stages.** A workstream that runs
alongside the main sequence and gates it later gets its own record and its own
clock. It never becomes a stage, because doing so would either stall the client's
visible progress or hide the workstream entirely.

**3. Derived beats declared.** Where a milestone can be observed from a system,
observe it. Reserve manual marking for the milestones that genuinely have no
system trace. This is the principle the sheet violated everywhere, and it is the
one that determines whether the new model is still true in six months.

## Proposed stages

The `PR`/`AP` naming is retained deliberately. `parseFulfillmentStage()` matches
a leading PR or AP plus a digit and ignores the human-readable remainder, so
redrawing what the stages *mean* costs no parser change and no migration of
`FULFILLMENT_STAGE_ORDER`.

| Stage | Name | Whose move | Exit condition |
| --- | --- | --- | --- |
| PR1 | Signed and access | TAG | Sub-account provisioned, Slack and Skool access issued |
| PR2 | Intake | Client | Intake form submitted and complete |
| AP1 | Build | TAG | Automations, funnel, and VSL script done |
| AP2 | Creative | Client | VSL creative assets delivered |
| AP3 | Launched | TAG | VSL live and campaign active |
| AP4 | First close | Client | First deal closed |
| AP5 | Ascension | Both | Steady state, expansion motion |

Ownership alternates: TAG, client, TAG, client, TAG, client. That alternation is
the design, not a coincidence. Every stage has exactly one accountable party, so
a breach names someone.

## Where the fine grain lives: opportunity custom fields

**Decision: the milestones become custom fields on the Fulfillment opportunity,
in their own folder. They do not become stages.**

This is what makes the two-axis model buildable. GHL gives one stage per
opportunity and an arbitrary number of custom fields on the same record, so the
stage carries the coarse handoff and the fields carry everything finer. One
mechanism covers both the sequential milestones and the parallel tracks, and both
travel with the opportunity that already exists.

**Use date fields, not checkboxes.** This is the single most important choice in
this document. A checkbox records that something happened and forgets when, which
is precisely the sheet's failure: no timestamps, and no way to tell a box ticked
today from one ticked in March. A date field is self-timestamping. Recording the
fact and recording its time are the same action, so the two cannot drift apart,
and duration becomes readable directly off the record rather than reconstructed.

An empty date field means not done. A populated one means done, on that date. No
separate boolean is needed, and adding one would reintroduce the possibility of
the two disagreeing.

**This is net-new code.** `lib/ghl/` has no custom field support today, and the
`Opportunity` type does not carry them. Reading and writing opportunity custom
fields is a prerequisite for everything downstream in this document.

## Parallel tracks

Each track opens at a defined stage, gates a later stage, and carries its own
clock independent of stage progress.

| Track | Opens at | Gates | Owner |
| --- | --- | --- | --- |
| A2P / 10DLC registration | PR1 | AP3 | Client supplies, TAG submits |
| Meta ad account handoff | PR2 | AP3 | Two-step, see story 5.1 AC2 |

A2P is the reason this section exists. It has a long external approval time, it
does not block build work, and it hard-gates launch. As a stage it would be
wrong in both directions: placed early it stalls clients who could be building,
placed late it is discovered too late to start. As a track it starts on day one
and is visible the entire time.

The Meta handoff has the same shape and is already documented as the known long
pole, so it is modeled the same way rather than as a task buried in AP1.

## Derived versus declared

Where a system already knows the answer, read it. Reserve manual marking for the
milestones that genuinely have no system trace. This is the principle the sheet
violated everywhere, and it is the one that determines whether the new model is
still true in six months.

Per-field sourcing is in the field set table below.

## The call: fields are the source of truth, the stage is derived

Every milestone becomes a date custom field. **No milestone is a stage.** The
seven stages are a rollup computed from which fields are populated.

Two reasons, and the second is the one that decides it.

**GHL does not retain stage history you can query.** An opportunity carries
`lastStageChangeAt` for the stage it is in now. Once it moves on, the duration of
the stage it left is gone. If stage transitions are the only record, every
question about how long AP1 took is unanswerable the moment AP1 ends. Stamping a
date field per milestone means the history is on the record permanently, and
stage durations are subtraction rather than archaeology.

**One source of truth cannot disagree with itself.** If a human can both move the
stage and tick the fields, the two will diverge, and the pipeline board will say
one thing while the record says another. Deriving the stage from the fields makes
that structurally impossible. The board stays useful for the people who work in
GHL, and it is a view rather than a second opinion.

### Field set

Dropped from the sheet's 15: `SKOOL` folded into a single access field, since
Slack and Skool are issued together and two fields for one action is two chances
to forget one. `INTAKE FORM` is not a milestone at all, it holds a submission
name, so it stays as a reference text field outside the folder.

Added from the existing code's `STAGE_TASKS`, which tracks real work the sheet
omits entirely: account funding, funnel testing, and the two-step Meta handoff.
The sheet and the code disagree about what onboarding is, and the union is
closer to the truth than either.

| Field | Rolls up to | Source |
| --- | --- | --- |
| `signed_on` | PR1 | Derived: opportunity creation |
| `access_issued_on` | PR1 | Manual (Slack + Skool) |
| `intake_sent_on` | PR1 | Derived: hub sends it |
| `account_funded_on` | PR1 | Manual |
| `intake_complete_on` | PR2 | Derived: intake submission record |
| `automations_built_on` | AP1 | Manual |
| `funnel_built_on` | AP1 | Derived: funnel publish state |
| `funnel_tested_on` | AP1 | Manual |
| `vsl_script_on` | AP1 | Manual |
| `vsl_creatives_on` | AP2 | Derived: cubby folder, else manual |
| `campaign_created_on` | AP3 | Derived: Meta, campaign exists paused |
| `vsl_launched_on` | AP3 | Manual |
| `campaign_live_on` | AP3 | Derived: Meta, campaign active |
| `first_close_on` | AP4 | Derived: opportunity won, Sales pipeline |
| `closer_recruited_on` | AP5 | Manual |
| `ascension_started_on` | AP5 | Manual |

Track fields, outside the stage rollup and carrying their own clocks:

| Field | Gates | Source |
| --- | --- | --- |
| `a2p_submitted_on` | AP3 | Manual, until the LC API is verified |
| `a2p_completed_on` | AP3 | Derived if reachable, else manual |
| `meta_partnered_on` | AP3 | Manual, client-side action |
| `meta_system_user_on` | AP3 | Derived: asset assignment check |

Nine of twenty are derivable. That ratio is the whole argument: the sheet was
100% manual, which is why it decayed.

## The call: what runs in GHL, what runs in the backend

First, a correction on framing. This repo's backend is Next API routes deployed
on Cloud Run, not Cloud Functions. The `functions/` workspace exists but new
Angular-era endpoints belong in `app/api`. "GCF" below means that backend.

**The dividing line: GHL workflows own everything that happens inside one
location and needs no outside knowledge. The backend owns anything that crosses
clients, touches an external system, or must be auditable.**

| Mechanism | Where | Why |
| --- | --- | --- |
| Stage rollup when fields populate | **GHL workflow** | Native trigger on custom field change, instant, no API quota, and it keeps working when the hub is down |
| Stamping a field from a GHL-native event (form submitted, opportunity won) | **GHL workflow** | The trigger already exists; a webhook to us and a write back is a round trip for nothing |
| Stamping a field from Meta, Drive, or Twilio state | **Backend** | GHL workflows cannot query an external API or reconcile a result |
| SLA breach sweep | **Backend** (`app/api/cron/sla-sweep`) | Cross-tenant, needs a durable record of what it already alerted on, must be auditable |
| Breach notification | **Backend** | One Slack path (story 6.5) beats forty workflow copies drifting apart |
| Reporting and duration analysis | **Backend** | Joins across clients; Postgres is where that lives |

**Do not build the stage rollup in the backend.** It is the tempting one, because
the logic is trivial and we control it. Putting it there means owning a sync loop
across forty tenants, with rate limits, retries, and a permanent question of
whether GHL or the hub is right during the gap. A GHL workflow does it natively,
per location, with no gap.

**How a workflow reaches forty sub-accounts.** It ships in the provisioning
snapshot. The repo already provisions from a `"Template Do Not Delete"` snapshot
(`functions/src/ghl.ts`), so the rollup workflow and the custom field folder are
built once in the template and travel with every new sub-account. Existing
accounts get it applied during the migration. This is also the answer to why the
field folder must be created in the template, not per client.

**The consequence worth naming.** Two systems now hold onboarding logic: field
definitions and rollup rules in a GHL snapshot, SLA and reporting in this repo.
That is a real cost and it is the right trade, but the snapshot has to be
versioned like code. An undocumented workflow edit in one sub-account is
precisely the drift the architecture isolation rules exist to prevent.

## What this changes downstream

- **Story 5.1** was built on the old stage meanings. `STAGE_TASKS` needs
  remapping, and its AC2 Meta note becomes a track rather than a task.
- **Stories 5.7 / 5.8 / 5.9** currently put SLAs on the old stages. They need
  re-pointing at this model, and 5.8 gains per-track SLA alongside per-stage.
- **Story 3.6** gains a real answer for its documented AC3 gap, since a stalled
  track is exactly the "delivery stalling" signal it cannot currently see.
- **GHL itself** needs the stages renamed and the custom field folder created.
  That is configuration work on the agency, and it should happen after the
  account consolidation, not during it.
- **`lib/ghl/opportunities.ts`** needs the `Opportunity` type extended with
  custom fields, plus typed read and write. Nothing in the codebase reads them
  today.

## Backfill of the existing 23

**Decision: manual pass per client.** Someone reviews each account and populates
the fields from what is actually true in GHL, Meta, and Drive, not from the
sheet. Roughly a day of work.

This is manual entry, which is the thing this document exists to reduce, and it
is still correct here. It happens once, against systems that hold the real
answer, rather than continuously against memory. Two things make it safe:

- **Do it after the field folder ships, before notifications turn on.** A
  half-populated account with alerting live produces noise that trains people to
  ignore alerts.
- **Leave a field empty rather than guessing a date.** An empty field reads as
  unknown and can be filled later. A guessed date is indistinguishable from a
  real one forever, and it silently corrupts every duration computed from it. If
  the milestone clearly happened but the date is unrecoverable, record the
  earliest date it could have been and note it, rather than splitting the
  difference.

## Open questions

1. Which derived signals are actually reachable? A2P status via the
   LeadConnector API is the important one and is unverified.
2. Are opportunity custom fields readable and writable on the API version this
   codebase pins (`2021-07-28`)? Assumed yes, unverified. This gates everything.
3. Can a GHL workflow trigger on an opportunity custom field change and write an
   opportunity stage? The rollup design depends on it. If not, the rollup moves
   to the backend and the sync-loop cost in the section above becomes real.
4. Does renaming the stages break any existing workflow that triggers on a stage
   name?
