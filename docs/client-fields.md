# TAG Client Record — Field Specification

100 fields across 14 categories. Synced against Epics 3–6 and the code already in
`lib/rules`, `lib/ghl/portfolio.ts`, and `lib/audit`.

---

## What this already lines up with

This spec is not a greenfield proposal. Most of it names data the repo is already
reaching for:

| Existing work | Fields it produces |
|---|---|
| `lib/rules/engine.ts` + `configs/clientHealth.config.ts` | all `health.*`, `risk.*` |
| `lib/ghl/portfolio.ts` → `PortfolioClient` | `client.name`, `onboard.stage`, `health.status` |
| `lib/audit/store.ts` | `ops.*` access trail |
| Story 3.1 Portfolio list | §1 §3 §10 |
| Story 3.2 Client health signals | §10 |
| Story 3.6 Escalation view | `risk.escalation*` |
| Story 4.2 Spend and delivery | §5 §6 |
| Story 4.3 Funnel counts | §7 |
| Story 4.4 ROAS on `utmAdId` | §9 |
| Story 4.5 "As of" freshness | `data.freshness` |
| Story 5.1 Onboarding checklist | §12 |
| Story 5.6 Budget ceilings | `spend.capStatus` |
| Story 6.4 Pre/on-call DQ | `funnel.dqPreCall`, `funnel.dqOnCall`, `sales.showRate` |
| Story 6.5 Delivery monitoring | `data.*`, `risk.deliveryStalls` |

**Three corrections this makes to my earlier draft**, all because the repo was right
and the draft was not:

1. **Health is not a 1–10 score.** `getClientHealth()` already returns
   `healthy | at-risk | critical`. A numeric score would be a second, disagreeing
   source of truth. Dropped.
2. **Show rate is not showed ÷ booked.** Story 6.4 defines it as
   `showed ÷ (booked − preCallDQ)`, and that is the correct definition — a
   pre-call DQ is a targeting failure that never should have been booked, and
   leaving it in the denominator makes bad targeting look like a closer problem.
3. **Delivery stalls were missing entirely.** `clientHealth.config.ts` treats
   won-but-not-delivered as a churn signal. It is one of the sharpest early
   warnings in this model and nothing in the draft captured it.

---

## Four structural decisions

**1. String IDs, never numeric.** Insert one field into a `1..43` scheme and every
saved config silently shifts. IDs are stable strings, never reused after retirement.

**2. Period is a dimension, not a field.** No `spend.mtd` *and* `spend.ytd`. One
`spend.actual` with declared windows and a global period selector. Otherwise 100
fields becomes 500.

**3. Channel is a dimension.** Ad metrics are blended by default, expandable to
Meta / Google inline. Otherwise every spend and funnel field triples.

**4. Computed fields are never stored.** If it derives from synced values, derive it
at read time. Storing `cpl` next to `spend` and `leads` means the day they disagree
you have two numbers and no truth — which is the exact drift your monitor exists to
catch. Don't manufacture it on purpose.

---

## Legend

`SRC` — **M** Meta · **G** Google · **H** GHL · **S** Slack · **T** TAG internal · **C** computed
`NOW` — ● ships against live integrations · ○ blocked on a pending integration story:
Story 4.1 (Meta setup) for all but §7b, which waits on the Slack channel work

Roles, TAG: `EX` exec · `CS` csm · `TCD` cs director · `SM` sales mgr · `SL` sales ·
`TSM` setter mgr · `TST` setter
Roles, client: `OW` owner · `CM` closing mgr · `CL` closer · `CSM` setter mgr · `CST` setter
● default on · ○ available, off by default · — never visible

**63 of 100 ship against live integrations today.** Of the 37 marked ○, 32 wait on
Story 4.1 (Meta setup) and 5 are the §7b Slack fields.

Every count on this page is checked against the tables on every build and CI run
(`scripts/parse-field-catalog.mjs`): `assertSectionCounts` for the per-section count in each
`##` heading, `assertHeaderTotals` for the four totals in the two paragraphs above. Edit a
table and the stale number fails the build. The tables are the source of truth; when the
prose disagrees, the prose is what changes.

---

## 1. Identity & commercial (11)

| ID | Field | SRC | NOW | EX | CS | TCD | SM | SL | TSM | TST | OW | CM | CL | CSM | CST |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `client.name` | Client name | H | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `client.company` | Firm name | H | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `client.locationId` | GHL location — the tenant key | H | ● | ● | ● | ● | ○ | ○ | ○ | ○ | — | ○ | — | ○ | — |
| `client.industry` | Tax prep · CPA · EA · bookkeeping | T | ● | ● | ● | ● | ○ | ○ | ○ | ○ | — | — | — | — | — |
| `client.region` | Territory | T | ● | ○ | ○ | ○ | ● | ● | ● | ● | — | — | — | — | — |
| `client.size` | Solo · 2–10 · 11–50 · 50+ | T | ● | ● | ● | ● | ○ | ○ | ○ | ○ | — | — | — | — | — |
| `client.tier` | Service package | T | ● | ● | ● | ● | ● | ● | ● | ● | ● | — | — | — | — |
| `contract.startDate` | Engagement start | T | ● | ● | ● | ● | ○ | ● | ○ | ● | ● | — | — | — | — |
| `contract.renewalDate` | Next renewal | T | ● | ● | ● | ● | ● | ● | ● | ● | ● | — | — | — | — |
| `contract.monthsActive` | Tenure | C | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ○ | — | — | — | — |
| `contract.paymentStatus` | current · late · failed | T | ● | ● | ● | ● | ○ | — | ○ | — | — | — | — | — | — |

> There is no separate `client.status`. Lifecycle **is** the Fulfillment stage
> (`onboard.stage`, PR1–AP5). A second status field would drift from the pipeline
> within a week and then nobody would know which one was true.

## 2. Margin — TAG-internal only (2)

> **Allowlist, not blocklist.** The client cockpit renders from an explicit permit
> list. A blocklist someone forgets to update is how your management-fee margin lands
> on a client's screen. Enforce at the query layer — a component that forgets a
> conditional is a bug; a query that cannot return the column is not.

| ID | Field | SRC | NOW | EX | CS | TCD | SM | SL | TSM | TST | OW | CM | CL | CSM | CST |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `contract.mrr` | Management fee / retainer | T | ● | ● | ○ | ○ | ● | ○ | ● | ○ | — | — | — | — | — |
| `econ.feeToSpendRatio` | Fee ÷ ad spend | C | ● | ● | — | — | ● | — | ● | — | — | — | — | — | — |

## 3. People & assignment (7)

| ID | Field | SRC | NOW | EX | CS | TCD | SM | SL | TSM | TST | OW | CM | CL | CSM | CST |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `contact.name` | Primary contact | H | ● | ● | ● | ● | ○ | ● | ○ | ● | — | ● | ● | ● | ● |
| `contact.email` | Email | H | ● | ○ | ● | ● | ○ | ● | ○ | ● | — | ● | ● | ● | ● |
| `contact.phone` | Direct line | H | ● | ○ | ● | ● | ○ | ● | ○ | ● | — | ● | ● | ● | ● |
| `assign.csm` | Assigned CSM | T | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ● | ○ | — | ○ | — |
| `assign.salesRep` | Who sold TAG | T | ● | ● | ○ | ○ | ● | ● | ● | ● | — | — | — | — | — |
| `assign.closers` | Fractional closers on account | T | ● | ● | ● | ● | ● | ○ | ● | ○ | ● | ● | ● | ● | ● |
| `assign.execSponsor` | Founder sponsor | T | ● | ● | ○ | ○ | ○ | — | ○ | — | — | — | — | — | — |

## 4. System deep links (6)

> The cockpit promise is one click from any number to the system that produced it.
> Not decoration — the difference between a report and a console.

| ID | Field | SRC | NOW | EX | CS | TCD | SM | SL | TSM | TST | OW | CM | CL | CSM | CST |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `link.ghlLocation` | GHL sub-account | H | ● | ● | ● | ● | ○ | ○ | ○ | ○ | — | ● | ○ | ● | ○ |
| `link.metaAdAccount` | Meta ad account | M | ○ | ● | ● | ● | — | — | — | — | — | — | — | — | — |
| `link.googleAdsCustomer` | Google Ads customer | G | ○ | ● | ● | ● | — | — | — | — | — | — | — | — | — |
| `link.slackChannel` | Shared Slack channel | S | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ● | ○ | — | ○ | — |
| `link.vsl` | Live VSL URL | T | ● | ● | ● | ● | ○ | ● | ○ | ● | ● | ○ | ○ | ○ | ○ |
| `link.calendar` | Booking calendar | H | ● | ○ | ● | ● | — | — | — | — | ● | ● | ● | ● | ● |

## 5. Spend & pacing (8)

> **Missing from the draft.** "Budget remaining" is static and nobody acts on it.
> Pace is the morning number: are we tracking to spend the budget, and what does
> today's run rate project to month end. Over-pacing burns out by the 20th;
> under-pacing under-delivers leads and the client notices on the invoice.
> `spend.capStatus` is where Story 5.6's budget ceilings surface.

| ID | Field | SRC | NOW | EX | CS | TCD | SM | SL | TSM | TST | OW | CM | CL | CSM | CST |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `spend.actual` | Ad spend · *channel split* | M G | ○ | ● | ● | ● | ● | ● | ● | ● | ● | — | — | — | — |
| `spend.budget` | Approved budget | T | ● | ● | ● | ● | ● | ○ | ● | ○ | ● | — | — | — | — |
| `spend.remaining` | Budget − actual | C | ○ | ● | ● | ● | ○ | ○ | ○ | ○ | ● | — | — | — | — |
| `spend.pacePct` | Actual ÷ expected-to-date | C | ○ | ● | ● | ● | ○ | — | ○ | — | ○ | — | — | — | — |
| `spend.projectedEom` | Run-rate projection | C | ○ | ● | ● | ● | ○ | — | ○ | — | ○ | — | — | — | — |
| `spend.dailyAvg` | Avg daily spend | C | ○ | ○ | ● | ● | — | — | — | — | ○ | — | — | — | — |
| `spend.capStatus` | under · on_pace · over · capped_out | C | ○ | ● | ● | ● | ○ | ○ | ○ | ○ | ● | — | — | — | — |
| `spend.channelMix` | Meta ÷ Google share | C | ○ | ● | ● | ● | ○ | — | ○ | — | ○ | — | — | — | — |

## 6. Traffic & creative (8)

> **Missing from the draft.** Creative fatigue is the most common cause of a campaign
> quietly degrading, and it is invisible in funnel metrics until CPL has already
> doubled. Frequency climbing past ~3 against a stale creative set is the leading
> indicator. For a DFY agency the creative refresh *is* the work product — measure it.

| ID | Field | SRC | NOW | EX | CS | TCD | SM | SL | TSM | TST | OW | CM | CL | CSM | CST |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `traffic.impressions` | Impressions · *split* | M G | ○ | ○ | ● | ● | — | — | — | — | ● | — | — | — | — |
| `traffic.clicks` | Clicks · *split* | M G | ○ | ○ | ● | ● | — | — | — | — | ● | — | — | — | — |
| `traffic.ctr` | Click-through rate | C | ○ | ○ | ● | ● | — | — | — | — | ● | — | — | — | — |
| `traffic.cpm` | Cost per 1k impressions | C | ○ | ○ | ● | ● | — | — | — | — | ○ | — | — | — | — |
| `traffic.cpc` | Cost per click | C | ○ | ○ | ● | ● | — | — | — | — | ○ | — | — | — | — |
| `creative.activeCount` | Live ads | M G | ○ | ○ | ● | ● | — | — | — | — | ○ | — | — | — | — |
| `creative.frequency` | Avg frequency — fatigue signal | M | ○ | ○ | ● | ● | — | — | — | — | — | — | — | — | — |
| `creative.daysSinceRefresh` | Days since new creative | C | ○ | ● | ● | ● | — | — | — | — | — | — | — | — | — |

## 7. Funnel (13)

> `dqPreCall` and `dqOnCall` are kept as separate first-class fields per Story 6.4.
> Collapsing them hides the distinction between a targeting failure and a
> qualification failure — which are different teams, different fixes.

| ID | Field | SRC | NOW | EX | CS | TCD | SM | SL | TSM | TST | OW | CM | CL | CSM | CST |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `funnel.vslViews` | VSL views | M G | ○ | ○ | ● | ● | — | — | — | — | ● | — | — | — | — |
| `funnel.vslCompletion` | Watched to end % | M | ○ | ○ | ● | ● | — | — | — | — | ● | — | — | — | — |
| `funnel.lpVisits` | Landing page visits | M G | ○ | — | ● | ● | — | — | — | — | ● | — | — | — | — |
| `funnel.lpConversion` | Visit → form % | C | ○ | ○ | ● | ● | — | — | — | — | ● | — | — | — | — |
| `funnel.formSubmissions` | Raw form fills | H | ● | ○ | ● | ● | ○ | ○ | ○ | ○ | ● | ● | ● | ● | ● |
| `funnel.leads` | Qualified leads · *split* | H | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `funnel.leadQuality` | Quality score 1–10 | C | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ○ | ● | ● | ● | ● |
| `funnel.cpl` | Cost per lead · *split* | C | ○ | ● | ● | ● | ● | ● | ● | ● | ● | — | — | — | — |
| `funnel.bookedCalls` | Consults booked | H | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `funnel.bookingRate` | Lead → booked % | C | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ● | ● | ● | ● | ● |
| `funnel.dqPreCall` | DQ'd before the call — *targeting* | H | ● | ● | ● | ● | ● | ○ | ● | ○ | ○ | ● | ● | ● | ● |
| `funnel.dqOnCall` | DQ'd on the call — *qualification* | H | ● | ● | ● | ● | ● | ○ | ● | ○ | ○ | ● | ● | ● | ● |
| `funnel.costPerBooked` | Cost per booked call | C | ○ | ● | ● | ● | ● | ○ | ● | ○ | ● | — | — | — | — |

## 7b. Client channel — Slack (5)

> Clients are single-channel guests in their own channel, so they are already in
> Slack. These fields exist for the view Slack cannot give a CSM holding forty
> channels: which client is waiting, and how long they have waited.
>
> `slack.awaiting*` and `slack.medianResponseHours` are computed from **message
> timestamps and author class only** — guest or staff, and when. That is the
> whole metric. Message bodies are never read into Firestore: those channels
> carry client financial conversations, and copying them would create a second
> store needing its own retention, access and deletion story for no extra
> signal.

| ID | Field | SRC | NOW | EX | CS | TCD | SM | SL | TSM | TST | OW | CM | CL | CSM | CST |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `slack.awaitingReply` | Newest message is the client's, unanswered | S | ○ | ● | ● | ● | ○ | — | ○ | — | — | ○ | — | ○ | — |
| `slack.awaitingHours` | How long they have waited | C | ○ | ● | ● | ● | ○ | — | ○ | — | — | ○ | — | ○ | — |
| `slack.medianResponseHours` | Median TAG reply time | C | ○ | ● | ● | ● | ○ | — | ○ | — | ○ | ○ | — | ○ | — |
| `slack.lastActivityAt` | Last message either way | S | ○ | ○ | ● | ● | ○ | — | ○ | — | ○ | ○ | — | ○ | — |
| `slack.botPresent` | Bot is a member of the channel | S | ○ | ● | ● | ● | — | — | — | — | — | — | — | — | — |

> `slack.botPresent` is not housekeeping. `conversations.history` returns
> nothing for a channel the bot has not joined, so a missing invite makes a busy
> account read as silent — identical to a client who genuinely has not written.
> Without this field that failure is invisible; with it, it is a row in the
> Epic 8 integration audit.

## 8. Sales execution — the fractional team (9)

> **The biggest gap in the draft.** It measured the campaign and stopped. TAG's
> fractional closers are the half of the promise that turns a booked call into a
> closed advisory package — and a client with flawless ads and an 8% close rate will
> churn while every campaign metric reads green.
>
> `speedToLead` belongs here too: strongest single predictor of show rate in a
> booked-call funnel, entirely within TAG's control, and absent from the draft.

| ID | Field | SRC | NOW | Definition | EX | CS | TCD | SM | SL | TSM | TST | OW | CM | CL | CSM | CST |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `sales.speedToLead` | Median lead → first contact | C | ● |  | ● | ● | ● | ● | ○ | ● | ○ | ● | ● | ● | ● | ● |
| `sales.callsTaken` | Calls held | H | ● |  | ○ | ● | ● | ● | ○ | ● | ○ | ● | ● | ● | ● | ● |
| `sales.showRate` | Show rate | C | ● | `showed ÷ (booked − dqPreCall)` | ● | ● | ● | ● | ○ | ● | ○ | ● | ● | ● | ● | ● |
| `sales.noShowRate` | No-show rate | C | ● | same denominator | ○ | ● | ● | ● | — | ● | — | ○ | ● | ● | ● | ● |
| `sales.closeRate` | Close rate | C | ● | `closed ÷ showed` — on-call DQ counts as showed | ● | ● | ● | ● | ○ | ● | ○ | ● | ● | ● | ● | ● |
| `sales.closes` | Deals closed | H | ● |  | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `sales.avgDealSize` | Avg advisory package | H | ● |  | ● | ● | ● | ● | ● | ● | ● | ● | ● | ○ | ● | ○ |
| `sales.revenueClosed` | Client revenue closed | H | ● |  | ● | ● | ● | ● | ● | ● | ● | ● | ● | ○ | ● | ○ |
| `sales.pipelineOpen` | Open opportunity value | H | ● |  | ● | ● | ● | ● | ○ | ● | ○ | ● | ● | ● | ● | ● |

## 9. Unit economics (6)

| ID | Field | SRC | NOW | EX | CS | TCD | SM | SL | TSM | TST | OW | CM | CL | CSM | CST |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `econ.roas` | Revenue ÷ ad spend — joined on `utmAdId` | C | ○ | ● | ● | ● | ● | ● | ● | ● | ● | — | — | — | — |
| `econ.cac` | Ad spend ÷ closes | C | ○ | ● | ● | ● | ● | ○ | ● | ○ | ● | — | — | — | — |
| `econ.ltvCac` | LTV : CAC ratio | C | ○ | ● | ○ | ○ | ● | ○ | ● | ○ | ○ | — | — | — | — |
| `econ.paybackMonths` | Months to recover CAC | C | ○ | ● | ○ | ○ | ● | — | ● | — | ○ | — | — | — | — |
| `econ.revenueLifetime` | Lifetime attributed revenue | C | ● | ● | ● | ● | ● | ● | ● | ● | ● | — | — | — | — |
| `econ.spendLifetime` | Lifetime ad spend | C | ○ | ● | ● | ● | ○ | ○ | ○ | ○ | ● | — | — | — | — |

## 10. Health, risk & benchmark (8)

> `health.status` is whatever `getClientHealth()` returns — not a parallel score.
> Thresholds live in `clientHealth.config.ts`; adding a signal is a config edit, not a
> code change, exactly as `portfolio.ts` documents.
>
> `health.benchmark` is the anti-gamification move. Tax professionals are not moved by
> badges; they are very moved by *"your cost per booked call is top-quartile for firms
> your size."* Same psychology, professional register. Anonymized cohort — never
> named peers.

| ID | Field | SRC | NOW | EX | CS | TCD | SM | SL | TSM | TST | OW | CM | CL | CSM | CST |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `health.status` | healthy · at-risk · critical | C | ● | ● | ● | ● | ● | ● | ● | ● | ○ | ○ | — | ○ | — |
| `health.reason` | Which rule fired | C | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ | — | ○ | — |
| `health.trend` | Direction vs. prior period | C | ● | ● | ● | ● | ● | ○ | ● | ○ | ● | ○ | — | ○ | — |
| `health.benchmark` | Cohort percentile | C | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ● | — | — | — | — |
| `risk.deliveryStalls` | Won but delivery not marked | C | ● | ● | ● | ● | ● | ○ | ● | ○ | — | ○ | — | ○ | — |
| `risk.escalation` | Escalation flag — Story 3.6 | T | ● | ● | ● | ● | ● | ○ | ● | ○ | — | ○ | — | ○ | — |
| `risk.escalationReason` | What triggered it | T | ● | ● | ● | ● | ● | ○ | ● | ○ | — | ○ | — | ○ | — |
| `risk.slaBreaches` | Missed SLAs, period | C | ● | ● | ● | ● | ○ | — | ○ | — | — | ○ | — | ○ | — |

## 11. Data integrity — per client (6)

> **The gap that quietly poisons everything above it.** Integration health was scoped
> globally in the draft. It is not global — it is per client. One client's pixel stops
> firing and *that* dashboard reports zero conversions while every other account looks
> fine and the global sync badge stays green.
>
> `quality.attributionGap` is your drift monitor aimed at the number that matters:
> platform-reported conversions vs. closes actually in GHL. It is also the standing
> version of the Story 6.1 duplicate-conversion audit — 6.1 is a one-time manual pass,
> this is the instrument that keeps it true afterward.

| ID | Field | SRC | NOW | EX | CS | TCD | SM | SL | TSM | TST | OW | CM | CL | CSM | CST |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `data.freshness` | Last successful sync — Story 4.5 | C | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ● | ○ | ○ | ○ | ○ |
| `data.metaSync` | ok · stale · failed · not_connected | M | ○ | ● | ● | ● | — | — | — | — | ○ | — | — | — | — |
| `data.googleSync` | ok · stale · failed · not_connected | G | ○ | ● | ● | ● | — | — | — | — | ○ | — | — | — | — |
| `data.ghlSync` | ok · stale · failed · not_connected | H | ● | ● | ● | ● | — | — | — | — | ○ | ○ | — | ○ | — |
| `data.pixelStatus` | Conversion tracking firing | M G | ○ | ● | ● | ● | — | — | — | — | — | — | — | — | — |
| `quality.attributionGap` | Platform-reported vs. GHL actual | C | ○ | ● | ● | ● | ○ | — | ○ | — | — | — | — | — | — |

## 12. Onboarding & launch (6)

> Same client record, filtered by `onboard.stage` and rendered as the kanban. Stages
> are the Fulfillment pipeline from Story 5.1 — PR1 funnel built · PR2 funnel tested ·
> AP1 campaign created paused · AP2 launched · AP3–5 post-launch. These fields
> auto-hide once the stage passes AP2.

| ID | Field | SRC | NOW | EX | CS | TCD | SM | SL | TSM | TST | OW | CM | CL | CSM | CST |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `onboard.stage` | Fulfillment stage PR1–AP5 | H | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ● | — | — | — | — |
| `onboard.daysInStage` | Time in current stage | C | ● | ● | ● | ● | ○ | — | ○ | — | ○ | — | — | — | — |
| `onboard.readinessPct` | Checklist completion | C | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ● | — | — | — | — |
| `onboard.blockers` | Open blockers | T | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ● | — | — | — | — |
| `onboard.targetLaunch` | Scheduled launch date | T | ● | ● | ● | ● | ● | ● | ● | ● | ● | — | — | — | — |
| `onboard.daysSinceLaunch` | Days live | C | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ● | — | — | — | — |

## 13. Operational (5)

| ID | Field | SRC | NOW | EX | CS | TCD | SM | SL | TSM | TST | OW | CM | CL | CSM | CST |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ops.lastContact` | Last CSM touch | H | ● | ● | ● | ● | ○ | ● | ○ | ● | — | ○ | — | ○ | — |
| `ops.nextReview` | Scheduled check-in | T | ● | ● | ● | ● | ○ | ● | ○ | ● | ● | ○ | — | ○ | — |
| `ops.priority` | high · normal · low | T | ● | ● | ● | ● | ○ | ○ | ○ | ○ | — | — | — | — | — |
| `ops.notes` | Internal notes | T | ● | ● | ● | ● | ○ | ○ | ○ | ○ | — | ○ | — | ○ | — |
| `ops.openIssues` | Open bug/issue count | T | ● | ● | ● | ● | ○ | — | ○ | — | ○ | — | — | — | — |

---

## Schema

Extends the existing `PortfolioClient` in `lib/ghl/portfolio.ts` rather than
replacing it.

```ts
type Channel = "meta" | "google" | "blended";
type Period  = "mtd" | "l7" | "l30" | "l90" | "ytd" | "lifetime";

/** Written by ingestion. Never computed, never hand-edited. */
interface SyncedMetric {
  value: number;
  channel: Channel;
  period: Period;
  syncedAt: Date;
  source: "meta" | "google" | "ghl";
}

/** Catalog entry — one per ID above. Drives the config UI. */
interface FieldDef {
  id: string;                 // stable, never reused
  label: string;
  category: string;
  kind: "synced" | "computed" | "manual";
  format: "money" | "percent" | "count" | "duration" | "date" | "text" | "enum" | "url";
  channelSplit: boolean;
  periods: Period[];          // empty ⇒ not period-scoped
  clientVisible: boolean;     // ALLOWLIST — false blocks at the query layer
  computeFrom?: string[];     // dependency IDs
}

interface DashboardConfig {
  role: Role;                 // from lib/auth/roles.ts
  fields: string[];           // ordered field IDs
  collapsed: string[];        // categories collapsed on load
  defaultPeriod: Period;
  defaultChannel: Channel;
}
```

---

## Build order

**Ship now — 41 fields, GHL + internal only.** Identity, assignment, deep links,
funnel from `formSubmissions` down, the whole sales-execution block, onboarding,
health, operational. A complete CSM and closer cockpit that never touches Meta.

**Lights up on Story 4.1 — 27 fields.** Spend and pacing, traffic and creative,
top-of-funnel, unit economics, platform sync health. Every one is additive; no rework.

`app/dashboard/page.tsx` currently renders a "Blocked on Meta setup" notice above five
empty placeholder cards. That framing trades a working product for a waiting one.
Invert it: ship the 41, let the ad-platform panels arrive as an upgrade.
