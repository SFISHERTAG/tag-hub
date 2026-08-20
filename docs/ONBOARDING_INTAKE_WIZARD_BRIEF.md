# Intake Wizard + Welcome Tour — build brief (ON HOLD)

**Status: not built. Two viable paths.** §3d proposes embedding the existing GHL form rather
than rebuilding it — much cheaper, and it deletes the highest-risk work, but it cannot do the
autosave/resume/staff-pickup of decision D. **Read §3d first and decide that before anything
else**; it determines whether most of §1–§3c is needed at all. This is a context-gathering
handoff, not an implementation.
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

## 3b. The living Google Doc — RESOLVED: update in place, one link

Phase 2 (`functions/src/webhooks/phase2-intake-submit.ts`) creates a Drive folder and a Doc
titled `{clientName} - Onboarding Doc`, fills it with four Gemini-generated tabs
(`addDocTab`), and shares it to the client as `reader` (`functions/src/google.ts:191`).

**Decision: a re-submit updates the existing document. One doc, one stable link, forever.**

Today a meaningfully different resubmission calls `createGoogleDoc` again and produces a
*second* doc with the same title (the idempotency guard blocks only exact-body retries —
see the comment at lines 41–46). With autosave, resume, and staff editing a client's draft,
resubmission stops being an edge case, so this would have produced doc sprawl with no
indication which is current.

**This is cheap to implement — the state already exists.** `googleDocId` and `driveFolderId`
are already persisted on the tenant record (`functions/src/firestore.ts:44–45`, written at
`phase2-intake-submit.ts:156–157`). The change is a branch at the top of the doc step:

- `tenantData.googleDocId` **set** → update that doc in place, keep the id, skip re-sharing
- **not set** → create as today, then persist the id (existing path)

`appendToGoogleDoc` (`functions/src/google.ts:103`) already exists and is never called after
creation — it is the obvious tool for the update path, though replacing a tab's content is
likely closer to intent than appending, so that revisions don't stack endlessly.

**One small thing still open:** the client is shared as `reader` and so cannot write in the
document. `shareGoogleDoc` already accepts `"reader" | "writer"` — a one-argument change if
you want the client contributing to it. Recommend leaving it `reader` unless client edits are
actually wanted: TAG generates, the client reads, and a read-only doc cannot be accidentally
broken by the person it was made for.

---

## 3c. Architecture — the form is a front end over GHL, and GCP does the work

Stated intent, in order:

1. The **old GHL form is canonical.** Its questions are the question set. Do not rewrite,
   reorder, or "improve" them while porting.
2. Rebuild it as a **custom-embedded, multi-page quiz** at the app's onboarding entry.
3. Answers must **land in GHL's custom fields**, exactly as the GHL-hosted form would have.
4. **GCP builds everything downstream** from there — the Cloud Functions generate the Doc,
   the Gemini content, and drive Phase 3.

So the wizard is a front door. It is not the system of record and it does not generate
anything; it captures answers, puts them where GHL expects them, and lets the existing
pipeline run.

### The gap: nothing in this repo can write a GHL custom field

This is net-new code, and it is the piece the plan currently lacks.

| Surface | What it can do |
|---|---|
| `lib/ghl/contacts.ts` | Read-mostly — `searchContacts`, `getContact`, `getNotes`. One write: `addNote` (POST). **No contact update. No custom-field write.** |
| `functions/src/ghl.ts` | Generic `ghlCall<T>` supporting GET/POST/PUT/DELETE, plus location/opportunity helpers. Transport exists; **no custom-field helper.** |

When the form lived in GHL, custom fields were populated by GHL for free. Move the form
into the app and that stops happening — the wizard has to write them back over the API.
Needed: an `updateContactCustomFields(locationId, contactId, fields)` helper on top of the
existing transport, plus the custom-field **ids** exported from GHL (the same export §1
already calls the highest-risk step — one export answers both).

**Where it lives matters.** CLAUDE.md's architecture-isolation rule calls out the duplicate
GHL client (`functions/src/ghl.ts` vs. `lib/ghl/`) as a real audit finding. Do not add a
third implementation. Decide deliberately which side owns the write and have the other call
it through an endpoint.

### Trigger order — decide before wiring

The wizard now has two downstream effects: write custom fields to GHL, and set the GCP
pipeline going. Today `POST /api/onboarding/intake-submit` calls Phase 2 directly. Options:

- **Wizard writes GHL, then calls Phase 2 directly** (keeps today's path; most predictable)
- **Wizard writes GHL, GHL webhook triggers Phase 2** (matches the original design, adds a
  hop and a failure mode)

Do not do both, or a single submit fires Phase 2 twice. The content-hash idempotency guard
would catch an identical double-fire, but not two calls whose bodies differ slightly.

## 3d. Cheaper option — embed the GHL form instead of rebuilding it

**Proposal:** don't rebuild the form. Embed the existing GHL form in the app's intake step,
styled with custom CSS, and let GHL keep writing its own custom fields.

**This is a strong trade and it should be taken seriously.** It deletes the most expensive
and riskiest work in this brief:

| Problem it removes | Where it came from |
|---|---|
| Writing GHL custom fields over the API | §3c — net-new code, nothing in the repo can do it |
| Exporting and matching field ids byte-for-byte | §1 — named the highest-risk step in the build |
| Silent Gemini prompt drift from a mistyped key | §1 — the failure mode that motivated that risk |
| Choosing which GHL client owns the write | §3c — CLAUDE.md's duplicate-client finding |
| Phase 2 double-trigger | §3c — resolves itself; GHL's webhook stays the only trigger |

GHL's form writes GHL's fields, exactly as today. Everything downstream — Phase 2, Gemini,
the Doc, Phase 3 — is untouched and already proven. **Already in place:** the form URL
carries `?email=` and `?locationId=` (`phase1-provisioning.ts:138`), so an embed associates
the submission the same way the emailed link does. No new contract.

### What it costs — one real conflict, stated plainly

**It contradicts resolved decision D.** You asked for per-step autosave, resume exactly where
they stopped, and **staff able to open and continue a half-finished form**. An embedded
third-party form does not give you that:

- Cross-origin iframe — the app cannot see or touch the answers mid-flight
- No resume-where-you-left-off across sessions for the client
- No second editor: staff cannot pick up a client's partial form
- No editor identity for the audit trail (client vs. which staff member)

Smaller costs: styling must be done **inside GHL's form builder**, not from the app — a
cross-origin iframe cannot be styled by the parent page, so the app's design tokens
(`bg-surface`, `text-ink`, dark mode) will not reach it, and matching the look is fiddly and
approximate. And the gate's completion signal has to come from GHL's webhook rather than the
app watching directly. That last one is fine: decision C already fails open, so the worst
case is a client sees the welcome tour a second time.

**Needs verifying in GHL before committing** (product capability, not answerable from this
repo): whether the form is a Form or a Survey, whether multi-page/multi-step is available on
that type, and how much the custom-CSS field actually reaches.

### Recommendation — embed first

Ship the embed as v1. Keep the custom wizard as the documented fallback, not the plan.

The reason is evidence, not cost. **The form has never been used in production** (§3F), so
there is currently *no data* on whether clients actually abandon it midway. Autosave, resume,
and staff-pickup were specified against a hypothetical. Build the cheap version, watch what
real clients do with 20+ free-text questions, and rebuild only if abandonment turns out to
be real. If it is, §1–§3c are still here and still accurate — nothing in this brief is wasted
by trying the embed first.

The one thing that would flip this decision: if staff picking up half-finished forms is a
firm operational requirement rather than a nice-to-have, the embed cannot do it at any price,
and the custom build is the only path.

## 3e. The snapshot — verify where the form and custom fields actually live

Two unrelated things both get called "GHL client" in this repo. Keep them apart:

- **GHL API client** — the code that makes HTTP calls to GHL. There are two implementations
  (`lib/ghl/` and `functions/src/ghl.ts`), which CLAUDE.md flags as an audit finding. A code
  duplication problem. Nothing to do with snapshots.
- **GHL sub-account** ("location") — a customer's own space inside GHL. That *is* the snapshot's
  business.

So the duplicate-client warning in §3c is not a snapshot concern. **But the snapshot matters
here for a different and more load-bearing reason.**

### How provisioning works today

Phase 1 (`functions/src/webhooks/phase1-provisioning.ts:72–77`) finds a location literally named
`"Template Do Not Delete"` and calls `POST /location/{id}/snapshot` (`functions/src/ghl.ts:68`)
to clone it. **Every client gets their own cloned sub-account from that template.** Custom
fields, pipelines and workflows come along with the clone.

### The unresolved question

The form, however, is configured as a **single** URL:
`GHL_FORM_URL=<share link to intake form in TAG agency account>` (`functions/README.md:69`) —
one env var, one form, described as living in the *agency* account, not the template. Phase 1
appends `?email=...&locationId=...` to it (`phase1-provisioning.ts:138`).

Those two facts are in tension, and the answer decides real work:

**If the form is part of the snapshot** (cloned per client), then every client has their own
form *and their own custom-field ids* — GHL generates fresh ids on clone. A single
`GHL_FORM_URL` env var cannot be correct, the embed needs a per-client URL resolved at
runtime, and a custom-field writer would need per-location id lookup rather than one static
map. This is the expensive branch.

**If it is one shared agency form** (what the env var implies), field ids are stable and
global, the embed is trivially simple, and `?locationId=` is how a submission is attributed.
But then a second question follows immediately: *a single agency-level form does not natively
write custom fields into a cloned sub-account.* So either those fields are not actually being
populated in the client's own location today, or something else is doing it — worth confirming
rather than assuming, given the stated requirement is that answers "land correctly into the
custom fields of GHL."

> **Verify in GHL before choosing a path.** Open `"Template Do Not Delete"` and check whether
> the intake form and its custom fields are in it. Then open one real cloned client location
> and check whether that client's contact record actually shows the intake answers in custom
> fields. Fifteen minutes in the GHL UI settles both branches, and it gates §3c and §3d alike.
> Nothing in this repo can answer it.

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
