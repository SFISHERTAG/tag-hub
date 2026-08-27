# Onboarding — Code Location Map

Companion to the same map kept for CCE. **Read the next section before treating the two as
the same feature — they aren't.**

---

## What "onboarding" means here vs. in CCE

| | CCE (Member Vision Portal) | TAG (this repo) |
|---|---|---|
| Who it's for | The **end member**, onboarding themselves | **TAG staff** (`tag_exec`, `tag_csm`) onboarding a *client* |
| Shape | Blocking 6-step profile wizard, then a 22-step guided product tour | Stage-driven task checklist + campaign launch flow |
| Trigger | `!user.onboardingCompleted` blocks the whole app | A nav destination staff visit deliberately |
| Drives off | A boolean column on the user row | The client's current **GHL Fulfillment pipeline stage** (PR1→AP5) |
| Completion state | One flag per user | Task-id → timestamp map per *opportunity* in Firestore |
| Client-facing UI | Yes, it *is* the member's first screen | No — client users are read-only (`isClientUser`) |

TAG has **no** welcome wizard and **no** guided tour. Greps for `welcome`, `wizard`, `joyride`,
`tour` across app code return nothing but course-content and email copy. The CCE-lineage
reference doc for that flow sits at `reference/CCE_Member_Onboarding_Canvas.md`; it describes
CCE's implementation, not anything in this repo.

---

## The checklist (stage-driven)

| Concern | File | Line |
|---|---|---|
| Page — role gate, client resolution, stage lookup | `app/onboarding/page.tsx` | 1–131 |
| Role gate (`tag_exec` / `tag_csm` only) | `app/onboarding/page.tsx` | 22 |
| Client resolution via impersonation (Story 3.3) | `app/onboarding/page.tsx` | 45–51 |
| Checkbox UI, optimistic toggle with rollback | `app/onboarding/checklist.tsx` | 1–74 |
| Server action `markTaskComplete` | `app/onboarding/actions.ts` | 8–43 |
| Stage → task mapping, `FULFILLMENT_STAGE_ORDER` | `lib/onboarding/stage-tasks.ts` | 1–67 |
| Firestore persistence | `lib/onboarding/store.ts` | 1–56 |
| Nav entry | `app/nav.tsx` | 87 |

**Stages:** `PR1 → PR2 → AP1 → AP2 → AP3 → AP4 → AP5`, mirroring GHL stage names. A stage that
doesn't match renders an explicit "Stage unrecognized" state rather than an empty checklist.

**Persistence key** (`store.ts:10`) is `locations/{locationId}/onboardingChecklists/{opportunityId}`
— deliberately keyed by *opportunity*, not location, so a client who churns and re-onboards gets
a fresh checklist instead of inheriting stale checkmarks.

**Authorization runs twice:** the page gates on role for display, and `actions.ts` independently
re-checks session + `isClientUser` + `requireLocationAccess(locationId)` before any write. The
server action does not trust the page having rendered. Every toggle writes an audit entry via
`logAction`.

---

## The campaign launch flow

Reached from the "Launch campaign" button in the onboarding page header.

| Step | File | Lines |
|---|---|---|
| Form | `app/onboarding/launch/page.tsx`, `campaign-launch-form.tsx` | 51 / 136 |
| `launchCampaign` server action | `app/onboarding/launch/actions.ts` | 13–50 |
| Preview | `app/onboarding/launch/preview/page.tsx`, `campaign-preview.tsx` | 73 / 112 |
| Activate | `app/onboarding/launch/activate/page.tsx`, `activate-form.tsx`, `activate-campaign-action.ts` | 90 / 79 / 43 |
| Campaign build + validation | `lib/onboarding/campaign-launch.ts` | 371 |
| Templates / budgets | `lib/onboarding/campaign-templates.ts`, `offer-budgets.ts` | 37 / 16 |
| Launch state store | `lib/onboarding/campaign-launch-store.ts` | 101 |

Campaigns are created **paused**, then activated as a separate deliberate step — matching the
AP1/AP2 task split in `stage-tasks.ts`.

---

## API routes

| Route | File | Purpose |
|---|---|---|
| `POST /api/onboarding/intake-submit` | `app/api/onboarding/intake-submit/route.ts` | Forwards intake payload to the Phase 2 provisioning Cloud Function (`PHASE2_WEBHOOK_URL`) |
| `POST /api/onboarding/phase3-meta-setup` | `app/api/onboarding/phase3-meta-setup/route.ts` | Meta ad-account setup step |

Note both are **outside** the `app/onboarding/` server-action flow above and do not go through
`requireLocationAccess` — they're webhook/service-to-service entry points guarded by bearer
secrets. Worth a look when the tenant-isolation helper gets extracted.

---

## For the Hot Path extraction

Reading this map against CCE's, the reusable pattern is *not* "an onboarding feature." Three
things generalize; the rest is TAG's own content.

**Generalizes:**
1. **Stage-driven checklist engine** — an ordered stage enum, a stage→tasks map, and completion
   keyed by the engagement record rather than the tenant. The churn/re-onboard reasoning in
   `store.ts` is a genuine product insight, not a TAG detail.
2. **Double authorization** — page-level role gate for display, independent re-check inside the
   server action. This is Part 2 item 1 of the kickoff brief (`hotpath/context.md`) already
   working correctly in one place; the extracted helper should look like `actions.ts:19–24`.
3. **Optimistic-toggle-with-rollback** — `checklist.tsx:24–47`, a clean reusable interaction.

**Correction, 2026-08-26.** The line below originally read "GHL as the pipeline source of
truth" as TAG-specific. That was wrong, and it was wrong because this section was written
from a portability standpoint without asking who installs Hot Path. Both known consumers
(TAG and CCE) run GHL, and GHL agencies are the stated ICP. GHL is therefore a **core
product dependency of Hot Path**, not a TAG detail to leave behind. See
`HOT_PATH_DEV_PROTOCOL_TODO.md` for the decision and its limits.

**Generalizes (added 2026-08-26):**
4. **GHL as the pipeline source of truth.** Hot Path is a GHL Marketplace app. The agency
   install that mints short-lived location-scoped tokens on demand (`lib/ghl/oauth.ts`,
   `lib/ghl/store.ts`) is the multi-tenant spine, not an integration detail.

**Does not generalize (TAG-specific, leave behind):**
- `PR1`–`AP5` stage names and the Fulfillment-opportunity model. The *stage engine* generalizes;
  this *stage vocabulary* does not, and in the product it is per-client configuration
- Meta / Business Manager campaign launch entirely
- `tag_exec` / `tag_csm` role names
- The hardcoded MVP `STAGE_TASKS` map — `stage-tasks.ts:29–32` already flags per-client
  customization as a deferred fast-follow. In the product this is per-client **configuration**,
  which makes it a concrete instance of the product/config boundary decision in Part 3a.

**Open, not decided here:** whether the CCE-style self-serve wizard + tour belongs in the
boilerplate at all. CCE has one and TAG doesn't, so it is not a shared pattern — it's a
per-client feature one of two clients needed. Extracting it now would be generalizing from a
single instance.
