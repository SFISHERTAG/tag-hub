# Intake Wizard + Welcome Tour — build brief (ON HOLD)

**Status: not built.** This is a context-gathering handoff, not an implementation.
Nothing in `app/` or `lib/` was changed. Pick this up in a fresh session inside
`/Users/home/projects/TAG` on branch `onboarding-intake-wizard-scaffold`.

**Goal, as stated:** bake the GHL onboarding intake form into the app's own onboarding
as a **wizard**, followed by a **spotlight welcome tour** — scaffolded and parked as an
addition to sign-in, because the routing logic and its options aren't decided yet.

Companion doc: `docs/ONBOARDING.md` maps what onboarding code exists in TAG today.

---

## 1. What exists now (verified, don't re-derive)

**TAG's `/onboarding` is staff-facing.** `tag_exec` / `tag_csm` only, checklist driven by
GHL Fulfillment stage (PR1→AP5), client users read-only. It is *not* a client-facing
wizard. See `docs/ONBOARDING.md`.

**The intake form is not in the app at all.** It lives in GHL and is handed to the client
on their onboarding call. Its full question set is transcribed in
`TAG_Client_Onboarding_Canvas.md` §"Intake Form" (line ~265), organised as five sections:

| # | Section | Rough field count |
|---|---|---|
| 1 | Tax Advisory Offer | 6 (incl. 4-part fee breakdown) |
| 2 | Ideal Client | 4 |
| 3 | Pain Points & Motivation | 4 |
| 4 | Results & Proof | 3 (one is a repeating 3× success-story group) |
| 5 | Competition & Positioning | 3 |

Those five sections are the natural wizard steps.

**What this replaces.** Phase 1 (`functions/src/webhooks/phase1-provisioning.ts:135–139`)
currently *emails* the client a GHL-hosted form link:
`${GHL_FORM_URL}?email=...&locationId=...`. The client leaves the product to answer, and the
answers come back by webhook. The ask is to delete that detour: greet the client with the same
questions inside the app instead of mailing them elsewhere.

**Where intake data goes today.** `POST /api/onboarding/intake-submit`
(`app/api/onboarding/intake-submit/route.ts`) takes `{ locationId, email, intakeData }`,
hashes the body into an `x-idempotency-key`, and forwards to the Phase 2 Cloud Function
at `PHASE2_WEBHOOK_URL`. Phase 2 (`functions/src/webhooks/phase2-intake-submit.ts`)
persists via `saveIntakeSubmission()` → `locations/{locationId}/intakeData/latest`
(`functions/src/firestore.ts:123`), then generates content with Gemini and triggers Phase 3.

**Critical constraint — the field keys are already decided, and they are not in this repo.**
`intakeData` is consumed as an opaque `Record<string, unknown>` and JSON-stringified straight
into four Gemini prompts — `generateUVP`, `generateAdCopy`, `generatePreCallScript`,
`generateProjectCharter` (`functions/src/gemini.ts`). Only `businessName` / `clientName` /
`metaAdAccountId` are read structurally anywhere.

So the wizard's field keys **are** LLM prompt content, and they must match what the existing
GHL form already sends, byte for byte. This is a port of a form that exists, not a new form:
same questions, same custom fields, same payload. Change a key and the generated UVP, ad copy,
pre-call script and project charter all quietly change with it.

`TAG_Client_Onboarding_Canvas.md` gives you the **questions**. It does not give you the
**keys**. The keys live in the GHL form itself, reachable via `GHL_FORM_URL`.

> **Do this before writing any schema:** capture one real Phase 2 payload (or export the GHL
> form's custom-field definitions) and derive `intake-schema.ts` from that. Typing the keys by
> hand off the canvas transcript will produce plausible-looking names that silently differ from
> production. This is the single highest-risk step in the build.

Get that right and Phase 2/3 need no changes at all — the wizard just becomes a second caller
of the same contract.

---

## 2. Proposed shape (not built — argue with it first)

```
lib/onboarding/intake-schema.ts    Client-safe declarative field/step definitions
lib/onboarding/intake-store.ts     server-only. Draft save/load/submit
app/onboarding/intake/page.tsx     Server component, gated, flag-off by default
app/onboarding/intake/wizard.tsx   "use client" — step nav, per-step validation
app/onboarding/intake/actions.ts   saveIntakeDraft / submitIntake server actions
lib/onboarding/tour-steps.ts       Spotlight tour step definitions
app/onboarding/welcome-tour.tsx    "use client" — portal + spotlight overlay
```

**Two patterns worth lifting from what's already here**, both documented in
`docs/ONBOARDING.md`:
- **Double authorization** — page-level gate for display, independent re-check inside the
  server action (`app/onboarding/actions.ts:19–24`). The action must not trust the page.
- **Optimistic-update-with-rollback** — `app/onboarding/checklist.tsx:24–47`.

**Draft persistence.** Wizard drafts are not submissions. Keep them apart from
`intakeData/latest`, which Phase 2 owns. Suggested `locations/{locationId}/intakeDrafts/{draftId}`.
The churn/re-onboard reasoning in `lib/onboarding/store.ts:10` applies — key by engagement,
not by location alone, or a re-onboarding client inherits a stale draft.

**Spotlight tour: no new dependency.** CCE uses `react-joyride`; TAG has no such package
(deps are `@google-cloud/firestore`, `facebook-nodejs-business-sdk`, `firebase`,
`firebase-admin`, `googleapis`, `next`, `pg`, `react`, `react-dom`, `server-only`).
Hand-roll it: portal + `getBoundingClientRect()` on `[data-tour="..."]` targets.
Adding a dep for something parked is the wrong trade.

---

## 3. Decisions — three resolved, three still open

**RESOLVED — A. Who sees it?** The **client**, inbound. This is a client-facing greeting, not
a staff tool. It does not belong on the existing staff-only `/onboarding` route.

**RESOLVED — B. What triggers it at sign-in?** A **hard gate**, CCE-style. Client signs in →
is met by the form → answers → passes the gate → tour. *(An earlier draft of this brief
recommended a soft nudge. That was wrong and has been struck.)*

**RESOLVED — E. Tour timing.** The tour fires immediately on clearing the gate, as orientation
for someone seeing the product for the first time.

**Also settled — build the tour framework, not its content.** What gets highlighted is not
decided and does not need to be. Build the mechanism — overlay, target resolution, step
sequencing, "seen" state — driven by a step list that is data, so steps can be written later
without touching the machinery. Ship it switched off.

---

**OPEN — C. What marks the gate cleared?** No `onboardingCompleted` equivalent exists on TAG's
session or claims. Options: derive from `intakeData/latest` existing; a new tenant field; or
tie to the PR1 checklist task. Deriving adds no state to keep in sync and is the cheapest.
A hard gate makes this load-bearing — get it wrong and a client is locked out of their own
product, so whatever is chosen needs a staff override path.

**OPEN — D. Resume semantics.** 20+ substantive free-text questions is a multi-sitting form,
and a hard gate makes abandoning it costly. Per-step autosave is effectively mandatory.
Decide whether partial drafts are visible to the CSM.

**OPEN — F. Relationship to the GHL form during transition.** Does the in-app gate replace the
emailed link outright, or run alongside it? If alongside, two sources can write
`intakeData/latest` — decide precedence before, not after.

## 4. Repo rules that will bite (from CLAUDE.md)

1. **Data model as contract.** Code may not declare a new Firestore collection without
   updating `docs/data-model.md` **in the same commit**. A pre-commit hook enforces it.
   The `intakeDrafts` collection above triggers this.
2. **Story status discipline.** This work should get a story doc under `docs/stories/`
   (next in sequence — 5.x). Code and the story's Status/Tasks land in the same commit;
   a pre-commit hook blocks contradictions. Implement via the `bmad-dev-story` skill,
   not ad hoc edits. Don't `--no-verify`.
3. **Terminology.** "client", never "Member" — that's CCE's word. The intake copy in
   `TAG_Client_Onboarding_Canvas.md` is already correct; keep it that way when porting.
4. **Integration isolation.** No cross-imports between integration modules; shared code
   goes in `lib/`.

---

## 5. Lineage note

CCE's member wizard + 22-step tour is the visual prototype for this, but it is **not the
same feature** — different audience, different trigger, different completion model. Port
the interaction patterns, not the data model. For the Hot Path extraction question
(`/Users/home/projects/hotpath/context.md`): a self-serve wizard exists in CCE and not in
TAG, so it is a per-client feature, not yet a shared pattern. Building it here would make
it two instances — which is when extracting it starts to be justified, and not before.
