# GHL Fulfillment Stage Rename: Impact Audit

**Checked:** 2026-08-22, Tax Advisory Growth (`rb6hPt8Ue77L4abghRMc`), The Deal
Closers LLC. All 15 workflows inspected individually.

## The rename already happened

The Fulfillment pipeline was rebuilt on 2026-08-22 at 11:29. PR1 through AP5 no
longer exist. The pipeline now has 12 stages:

`Onboarding Booked` (0%) → `Onboarding Complete` (5%) → `Tech Stack Provisioned`
(10%) → `Intake Complete` (20%) → `Creative Copy Complete` (30%) →
`Creatives Compete` (40%) → `Editing Complete` (50%) → `Campaign Launched` (60%)
→ `First Appointment Booked` (70%) → `1st Deal Closed` (80%) → `Ascension`
(100%) → `Offboarded` (0%)

The other three pipelines were also touched the same morning: Sales (7 stages),
Ascension (6), Inner Circle (5).

`Creatives Compete` at 40% appears to be a typo for `Creatives Complete`.

## Broken by the rename

Three published workflows, four broken references.

| Workflow | Enrolled | What broke | Kind |
| --- | --- | --- | --- |
| `Rebooked → Confirmed Apt + Tag.` | 999 | **Trigger** `Pipeline Stage Changed`: "Opportunity pipeline not found" + "Referenced Pipeline Stage does not exist" | **Trigger** |
| `No Show → Follow Up + Tag.` | 1009 | Action `Update opportunity`: Referenced Pipeline and Pipeline Stage do not exist | Action |
| `Closed Lost → Results.` | 11 | Two `Update opportunity` actions, same two errors each | Action |

`Rebooked → Confirmed Apt + Tag.` is the answer to "does it break a trigger":
yes, exactly one, and it is a published workflow with 999 enrollments. A broken
trigger is worse than a broken action, because the workflow no longer fires at
all rather than failing partway.

## Broken, but not by the rename

Pre-existing, listed so they are not mistaken for fallout.

| Workflow | What broke |
| --- | --- |
| `Closed Won → New Client + Tag.` | `Assign to user`: referenced user does not exist. `Email`: referenced template does not exist. |
| `TAG Reminder- Client Call Booked` | `Customer booked appointment`: referenced calendar does not exist. |

## Clean

`EXISTING LIST-TDC-30 Day Email FUS`, `FACEBOOK API`, `META API CLOSED DEALS`,
`SLACK- APT Booked`, `SLACK- Deal Closed`, `SLACK- New Lead`,
`TAG- ADS Call Booked Reminder` (Draft), `TAG- ADS Manual Booking Reminders`,
`TAG-Follow Up-Booked Appointment`, `TAG-Survey Complete-14 Day Email FUS`.

## The code is broken too, and nothing reports it

This is the larger consequence and it is not visible in GHL at all.

- `FULFILLMENT_STAGE_ORDER` in `lib/onboarding/stage-tasks.ts` is
  `["PR1".."AP5"]`. None of those stages exist now.
- `parseFulfillmentStage()` matches `^(PR|AP)\s*[-–—.]?\s*([1-9])`. Every one of
  the 12 new stage names returns `null`.
- `AP2_STAGE_NAME` (`"AP 2 - Ads Launched"`) resolves through
  `findStageIdByName()`, which will now find nothing.

Consequences, all in stories currently marked Done:

| Story | Effect |
| --- | --- |
| 5.1 Onboarding checklist | `stage` is `null` for every client. Empty task list, no `daysInStage`. This is the exact "Stage unrecognized" failure the `parseFulfillmentStage` comment says was already fixed once. |
| 5.5 Explicit activation | Cannot resolve the AP2 stage id, so advancing the opportunity fails. |
| 5.4 Campaign launch | Depends on 5.5's advance. |
| 3.6 Escalation view | Its "stage" sort was already a stand-in; the underlying stage read now returns nothing. |

## How this went unnoticed, and the process fix

GHL surfaces these config errors **only inside each workflow's own builder**, via
the error icon in the left rail. There is no global list. The `Needs review` tab
is runtime execution failures, not configuration validation: it showed one entry,
`META API CLOSED DEALS`, last occurring 2026-08-18, which predates the rename and
is unrelated.

So a stage rename silently invalidates every reference across every workflow and
every sub-account, and the only way to find out is to open each workflow one at a
time. Nothing warns at rename time.

This is precisely the drift risk named in
`docs/fulfillment-pipeline-architecture.md`, and it argues for the same fix: the
pipeline definition and the workflows that depend on it need to be versioned
together in the provisioning snapshot, with a rename checklist that includes an
inventory sweep.

## Not checked

- **`Template - DO NOT DELETE`.** The highest priority remaining. It seeds every
  new sub-account, so a broken reference there propagates to every future client.
- **`Bulletproof`** and **`Casey Williams Co`**. Both are client-facing.
- Whether the three broken references pointed at the old Fulfillment pipeline or
  at Sales / Ascension / Inner Circle, which were also edited that morning.
