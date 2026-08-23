# Reconciliation: Epic 5 SLA stories vs Epic 13

**Decided 2026-08-22.** Two sessions specced onboarding SLA work in parallel
without seeing each other. This records what survives, what dies, and why.

## Verified first, because both drafts were wrong

The live Fulfillment pipeline in `rb6hPt8Ue77L4abghRMc`, read off the board on
2026-08-22, has **12 stages and 37 opportunities**:

| # | Stage | Open |
| --- | --- | --- |
| 1 | Onboarding Booked | 24 |
| 2 | Onboarding Complete | 0 |
| 3 | Tech Stack Provisioned | 1 |
| 4 | Intake Complete | 7 |
| 5 | Creative Copy Complete | 0 |
| 6 | Creatives Compete *(GHL's typo)* | 0 |
| 7 | Editing Complete | 0 |
| 8 | Campaign Launched | 0 |
| 9 | First Appointment Booked | 1 |
| 10 | 1st Deal Closed | 1 |
| 11 | Ascension | 0 |
| 12 | Offboarded | 0 |

Against that, **both** competing drafts were keyed to stages that no longer
exist:

- **13.2** describes an 11-stage pipeline with `New Client`, `Onboarding Call`,
  `PR 3 - VSL Creatives` and `PR 4 - Creative Edits`. That was accurate on
  2026-08-21 and was invalidated by the rename on the 22nd. Its central
  acceptance criterion, "extend `FULFILLMENT_STAGE_ORDER` to the 11 live
  stages", would now *add eleven dead stages to working code*.
- **5.7** assigns SLA baselines to PR1 through AP5. Seven stages, none of which
  exist either.

Neither draft is usable as written. That is the finding, and it is the reason
this document exists rather than a preference between two authors.

## The decision

**Epic 13 owns the outcome. Epic 5 keeps only the prerequisite.**

Not a split of the difference. Epic 13's stories are better specified on the
things that decide whether this gets used, and Epic 5's drafts are better on one
technical point that Epic 13 does not address at all. The merge takes the
Epic 13 shape and transplants the Epic 5 substance into it.

### Where Epic 13 was better, and won

- **Surface.** 13.5 puts the timer on the client card, in the client modal, and
  makes the portfolio sortable by time in stage. 5.7 put it on the onboarding
  checklist, which is the wrong screen: a CSM scanning a book of 37 does not
  open 37 checklists.
- **Notification.** 13.5 tells the assignee *and their manager*. 5.8 posted to
  Slack, which is a channel, not a person.
- **Escalation.** 13.6 is a real desk with severity and assignee, extending the
  Firestore surface that already shipped in 10.4. 5.8 fed 3.6's At Risk bucket,
  which is a filter, not a work queue.
- **Evidence.** Epic 13 was opened from an audit of real data. 24 of 37 clients
  are parked at the first stage and nothing says so. That is the business case,
  and 5.7 argued from first principles instead.
- **One detail worth naming:** 13.5 AC2 requires a missing timestamp to render
  as *unknown* rather than zero. 5.7 missed that, and a misleading zero on a
  churn signal is worse than a blank.

### Where Epic 5 was better, and is transplanted

- **`lastStageChangeAt` is not sufficient, and this is the load-bearing point.**
  13.5 AC2 computes time-in-stage from it. GHL only keeps that field for the
  stage an opportunity is in *now*. The moment a client advances, the duration
  of the stage they left is gone. Under 13.5 as drafted, every stage duration
  becomes unanswerable the instant it completes, so the pipeline can report
  where clients are stuck today and can never report where clients get stuck.
  The fix is dated milestone custom fields, specced in
  `docs/fulfillment-pipeline-architecture.md` and 5.10.
- **Parallel tracks.** A2P registration and the Meta ad account handoff start
  early, run alongside build work, and hard-gate launch. Epic 13 has no concept
  of them. A2P is the case that justifies the whole feature: it can sit
  untouched for a month while every stage clock reads green.
- **Sweep mechanics.** 5.8's idempotency, breach dedup so it does not re-alert
  hourly, and suppression for tenants with no milestone history. 13.5 says "a
  breach notifies" without saying how it avoids notifying forty times.
- **5.10 has no counterpart.** Nothing in `lib/ghl/` reads opportunity custom
  fields. Everything above depends on it.

## Disposition

| Story | Disposition |
| --- | --- |
| 5.7 Stage SLA deadlines | **Superseded** by 13.5. Baselines and tracks move there. |
| 5.8 SLA breach sweep | **Superseded** by 13.5 + 13.6. Sweep mechanics move to 13.5. |
| 5.9 Adjustable baselines | **Superseded.** 13.5 AC1 already requires admin-editable thresholds. Two stories for one requirement. |
| 5.10 Opportunity custom fields | **Kept**, unchanged, re-pointed as 13.5's hard prerequisite. |
| 13.2 Stage model parity | **Rewritten.** Original premise is dead: the parity fix landed in `2787e21`, and coverage in `lib/onboarding/stage-tasks.test.ts`. What survives is the "no tasks" vs "unrecognized stage" distinction and ordering from GHL `position`. |
| 13.5 Stage SLA timers | **Kept and enriched** with the four items above. |
| 13.6 Escalations desk | **Kept**, unchanged. |

Net: three of my own drafts retired, one kept. The architecture document behind
them survives and is now referenced from 13.5, because the `lastStageChangeAt`
problem it identifies is the one thing most likely to be rediscovered the
expensive way.

## Sequencing after the merge

5.10 → 13.2 → 13.5 → 13.6. 13.3's handoff decision still gates whether new
clients arrive in the pipeline at all, and none of this is worth much until it
does.
