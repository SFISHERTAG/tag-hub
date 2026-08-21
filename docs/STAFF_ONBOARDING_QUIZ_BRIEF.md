# Staff onboarding quiz — build brief (ON HOLD)

**Status: not built.** Context-gathering only. Separate feature from the client intake
gate in `docs/ONBOARDING_INTAKE_WIZARD_BRIEF.md` — do not merge the two.

**Goal, as stated:** a quiz for onboarding **staff**, distinct from the client intake form.

---

## Two different things that both say "onboarding"

| | Client intake gate | Staff onboarding quiz |
|---|---|---|
| Who | Inbound **client** (`client_owner`) | **TAG staff** (`tag_*` roles) |
| Purpose | Capture business data TAG needs to build campaigns | Confirm the person **learned** something |
| Answers are | Data, fed to Gemini and to marketing | Assessed — right or wrong |
| Right answer? | No such thing | Yes, that's the point |
| Storage | `intakeData/latest`, one per location | Attempts and scores, per user |

They share the word and nothing else. Different audience, different data model, different
definition of "done."

---

## The foundation already exists — build on it, don't start fresh

TAG has a full courses module. Staff training already lives there.

**Content, in Postgres** (`functions/sql/007_courses.sql`) — admin-editable without a deploy,
which was the whole reason it moved out of code:

```
courses → course_sections → course_subsections (title, loom_id, content) → course_checkboxes
```

**Per-user progress, in Firestore** (`lib/course/firestore.ts`):
`userProgress/{uid}/courses/{courseId}/sections/{...}/subsections/{...}/checkboxes/{...}`

**Read/write path:** `lib/course/{data,db,firestore,types,seed}.ts`, UI at
`app/courses/page.tsx` and `app/courses/[courseId]/`.

**The gap this feature fills:** there is no assessment anywhere in it. Greps for
`quiz` / `assessment` / `score` / `passing` across `lib/course`, `app/courses` and the
courses SQL return nothing. `course_checkboxes` is **self-attested** — the trainee ticks
"watched." Nobody checks whether they understood it. That is exactly the hole a quiz fills,
and it means this is an extension of a working system, not a new subsystem.

---

## The staff entry flow (as specified)

```
Admin provisions the user + sets permissions
        ↓
Staff signs in with the six-digit code
        ↓
Gate — has the quiz been passed?           ─── no ──▶ take the quiz
        ↓ yes
Into the hub
        ↓
Onboarding walkthrough + welcome tour, forced on first entry
(no skipping the first time through)
        ↓
Normal hub use. A link goes back to the walkthrough,
the welcome tour, and settings, on demand.
```

**Order matters and is unusual:** the **quiz comes before** the walkthrough, not after it.
The quiz gates entry; the walkthrough then orients someone who is already inside. Anyone
implementing this from habit will build it backwards — learn, then test. Don't.

### The six-digit code already exists — do not build one

This is TAG's existing **email OTP sign-in**, already working:

| Piece | Location |
|---|---|
| OTP generation, expiry, attempt guards | `lib/auth/otp.ts` |
| Request / verify endpoints | `/api/auth/otp/request`, `/api/auth/otp/verify` |
| Two-step email → code form | `app/signin/signin-form.tsx` ("Six-digit code", line 143) |
| Delivery | `lib/auth/mailer.ts` |
| Dev bypass | `app/signin/test-signin-panel.tsx`, `TEST_AUTH_ENABLED` |

So the gate is **not** an authentication change. The user is already signed in and has a
session by the time it runs. It is a post-authentication redirect on top of an auth flow
that is finished. Touching `lib/auth/otp.ts` for this would be a mistake.

### Two independent completion flags

The gate tests two separate conditions — quiz passed, walkthrough seen. They complete at
different moments and one can be reset without the other (re-quiz someone after a policy
change without replaying their tour). Model them as two flags, not one
`onboardingCompleted` boolean. Both sit naturally next to existing per-user state at
`userProgress/{uid}/...` (`lib/course/firestore.ts`).

### "No skipping on the first try"

First run: no dismiss control, no Esc, no click-outside — advance only. Later runs, reached
from the replay link, are freely skippable. That is one `firstRun` flag through the tour
framework, but it has to be designed in from the start; retrofitting a non-dismissible mode
onto a dismissible overlay means touching every exit path.

### The replay link

One entry point back to walkthrough + welcome tour + settings. Worth noting this makes the
tour framework serve **both** audiences — staff here, and clients in the intake brief. Build
it once, generic over its step list, and let each caller supply steps. Two bespoke tours
would be the wrong outcome.

---

## Proposed shape (not built)

Follow the split the module already uses — **content in Postgres, per-user results in
Firestore**. Don't invent a third pattern.

**New Postgres tables**, mirroring the existing `courses` conventions (VARCHAR uuid PKs,
`display_order`, `ON DELETE CASCADE`):

```
course_quizzes        one per section or subsection; passing_score, attempt_limit
quiz_questions        stem, type, display_order, explanation
quiz_options          label, is_correct, display_order
```

**Per-user attempts in Firestore**, alongside existing progress:
`userProgress/{uid}/quizAttempts/{attemptId}` — score, answers, passed, submittedAt.

Keeping attempts out of Postgres matches where per-user state already lives, and keeps the
admin-editable content tables free of trainee data.

---

## Open decisions

1. **Attach point** — quiz per subsection (after each video), per section, or one final exam
   per course? Changes the schema's foreign key and nothing else, but decide first.
2. **Gating — RESOLVED for hub entry:** the quiz is a hard gate before the hub. Still open:
   whether a *failed* attempt blocks retry immediately, and what the admin override is when
   someone locks themselves out. A hard gate with no override strands a new hire on day one.
3. **Question types** — multiple choice only is a one-day build. Free-text needs grading:
   human, or LLM-assisted (Gemini is already wired for other purposes in `functions/src/gemini.ts`).
   Recommend starting multiple-choice-only.
4. **Retakes** — unlimited, capped, or cooldown? `attempt_limit` above assumes capped; drop
   the column if not.
5. **Who sees results** — trainee only, their manager, or `tag_exec`/`admin`? Affects whether
   a reporting view is in scope at all.
6. **Per-role quizzes** — is a setter's quiz different from a closer's? TAG has 13 roles
   (`lib/auth/role-labels.ts`). If quizzes are role-scoped that's a column and a filter; if
   not, say so explicitly so nobody adds it later "just in case."

---

## Repo rules that will bite (from CLAUDE.md)

- **New Postgres tables require `docs/data-model.md` updated in the same commit.** Pre-commit
  hook enforces it. This feature adds three tables and a Firestore path — it will trip.
- **Story discipline** — needs a `docs/stories/*.md` doc; code and Status/Tasks land together.
  Implement via the `bmad-dev-story` skill, not ad hoc edits. Don't `--no-verify`.
- **Terminology** — "client" not "Member". Note that staff here are *not* clients; use the
  role names from `lib/auth/role-labels.ts`.
- Migration file goes in `functions/sql/`, next number in sequence after `007_courses.sql`.
