# Intake Wizard + Welcome Tour — build brief (ON HOLD)

**Status: not built, but no longer blocked.** All six open decisions are now answered
(§3). One question remains before code: whether a re-submit updates the existing Google Doc
or creates a new one (§3b). This is a context-gathering handoff, not an implementation.
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

## 3. Decisions — all six resolved

**A. Who sees it?** The **client**, inbound. Not the staff-only `/onboarding` route.

**B. Trigger?** A **hard gate** at sign-in. Client signs in → meets the form → answers →
passes → tour. *(An earlier draft recommended a soft nudge. Wrong; struck.)*

**C. What marks the gate cleared?** Track it, but **fail open, never locked out.** If the
state is missing or unreadable, the client sees the welcome tour again on next login. A
repeated tour is a minor annoyance; a client locked out of their own product is an incident.
Staff override still required for the intake half. Design note: this makes "not sure" a safe
state, which means the completion check does not need to be bulletproof to ship.

**D. Resume?** Yes, fully. Per-step autosave; the client resumes exactly where they stopped.
**Staff can open and continue a half-finished form** — so drafts are not private to the
client, and the draft record needs an editor identity (client vs. which staff member) for the
audit trail. Reuse `logAction` (`lib/audit/store.ts`), as the checklist does.

**E. Tour timing?** Immediately on clearing the gate. Build the framework, not its content —
steps are data, supplied later. Ship it switched off.

**F. Coexist with the GHL form?** **Non-issue — the GHL form never went into production use.**
It was built to prove the answers land in the custom fields, and that is all it did. So there
is no dual-write problem, no precedence question, and no migration window. The in-app wizard
is the **first real use** of this path.

> **This changes §1's highest-risk step.** "Capture a real Phase 2 payload" assumed production
> traffic exists. It may not. The source of truth for field keys is the **GHL form's
> custom-field definitions** — export those. Then send one test submission through
> `/api/onboarding/intake-submit` and diff what Phase 2 actually receives against the export.
> The risk is unchanged and still the highest in the build; only the method of retiring it is.

---

## 3b. The living Google Doc — a conflict to resolve before building

Phase 2 does more than store answers. `functions/src/webhooks/phase2-intake-submit.ts`:

1. Creates a Drive folder and a Google Doc titled `{clientName} - Onboarding Doc`
2. Fills it with four Gemini-generated sections, added as tabs (`addDocTab`)
3. Shares it to the client's email **as `reader`** (`functions/src/google.ts:191`)

That doc is the intended shared, running, living document. Three things about it collide with
a save-and-resume wizard, and none are hypothetical:

**1. A later resubmission creates a second doc, it does not update the first.** The
idempotency guard is explicit that it blocks exact-body retries while allowing "a genuinely
different later resubmission for the same location" (comment at line 41–46) — and that path
runs `createGoogleDoc` again. With autosave, resume, and staff editing a client's draft,
meaningfully-different submissions stop being an edge case and become the normal path. Left
alone, a client accumulates several docs with the same name and no indication which is current.

**2. The client is a `reader`.** They cannot write to the document they are meant to live in.
`shareGoogleDoc` already takes `"reader" | "writer"` — this is a one-argument decision, but
it is a decision.

**3. `appendToGoogleDoc` exists and Phase 2 never calls it after creation.** The mechanism for
growing the doc over time is already written and unused. That is very likely the intended
tool for updates-after-first-submit.

**Decide before building:** does a re-submit *update* the existing doc (append or replace a
tab, keeping one stable URL), or *create* a new one? A living document argues for one stable
doc and one stable link, which points at storing `googleDocId` on the tenant record and
having Phase 2 update in place when it is already set. Worth confirming that intent before a
line of wizard code is written, because it decides whether the wizard's submit is a one-shot
event or an ongoing sync.

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
