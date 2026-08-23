# Start here

> If you were handed a different `NEW_SESSION_PROMPT.md`, this is the one that
> is current. A shorter copy exists on a detached worktree 49 commits behind
> `main` (`functions-typescript-build-8fa5d4`). Check `main`, per rule 4.

You are picking up TAG. Read this, then read the two documents it names, then
start. Should take fifteen minutes.

---

## Before anything, orient against reality

```bash
git -C /Users/home/projects/TAG rev-parse --short main        # where main is
git -C /Users/home/projects/TAG worktree list                  # who holds what
gcloud run services describe tag-hub-git --region=us-central1 \
  --format='value(status.latestReadyRevisionName,spec.template.spec.containers[0].image)'
```

That last one matters more than it looks. On 2026-08-23 the deploy notes said
production ran one commit and `gcloud` said another. Trusting the note would
have produced a 241-commit deploy instead of the real 44.

**`cd` into the repo root is not neutral.** `/Users/home/projects/TAG` is the
shared checkout, usually parked on `hold/main-parked`, which is behind `main`.
Work in your own worktree. After any `cd`, check
`git rev-parse --abbrev-ref HEAD`. Three sessions got this wrong in one day,
including the one writing this.

---

## The nine standing orders, in full

Scannable here so you have them before you open anything. Each one in
`AGENT_COORDINATION.md` §10 carries the incident that produced it — read those
when you want to argue with a rule rather than obey it, which is encouraged.

1. **Cite or flag.** Every factual claim carries `file:line` and the SHA it was
   read at, or says it is unverified.
2. **Validate the instrument.** Plant a hit you know exists and confirm your
   check finds it, before believing a clean result. Show the planted case.
3. **Produce the artefact, then describe it.** If you write "attached", a path
   and SHA must follow.
4. **A document is not evidence, including this one.** Nor is source code
   evidence about production — check the artefact.
5. **When correcting a document, diff it against the original.** Confirm nothing
   that was *right* disappeared.
6. **Every count carries its unit.** Files, lines, occurrences. Never add across
   units or scopes.
7. **Report produced and survived separately.**
8. **Prefer a mechanism to a norm.** If a rule can be a script, make it one.
9. **Verification is never self-assigned and never sighted.** The producer does
   not verify; the verifier re-derives *before* reading the original.

§11 is the tenth in practice: **if it can run, it needs a story.**

## Read these two, in order

1. **`docs/AGENT_COORDINATION.md`** — §10 in full, §11 for the story rule.
2. **`docs/LETTER_TO_THE_NEXT_LEAD.md`** — fourteen things that went wrong and
   what they cost. Written by the previous lead about their own mistakes.

Then `docs/SESSION_HANDOFF_2026-08-23.md` for facts, and
`docs/SECRETARY_HANDOFF_2026-08-23.md` for the coordination history.

**The one-line version: a document is not evidence, including this one.** Every
wrong finding on 2026-08-23 came from trusting a document. Every right one came
from reading code — and then checking the artefact, because source is not
evidence about production either.

---

## Rules that are mechanised, and will stop you

You cannot talk your way past these. Each has a typed escape hatch that stamps
`Guard-Override:` onto the commit, so using one is visible rather than
archaeological.

| Check | Refuses |
| --- | --- |
| `check-main-ownership` | Commits, merges or pushes to `main` from a session that does not own it |
| `check-firestore-seam` | Importing `@/lib/firestore` or the SDK outside `lib/data/` |
| `check-role-strings` | An inline role string anywhere in the tree |
| `check-story-status` | A commit touching a story's files without that story's doc |
| `check-story-regression` | A commit that walks a story document backwards |
| `check-branch-freshness` | Committing onto a stale branch with no unique work |

`git` does **not** run `pre-commit` for a merge, which is why `pre-merge-commit`
and `pre-push` exist too. If you add a guard, wire all three.

---

## Where the work actually is

**Live in production** (revision `tag-hub-git-00027-k9z`): the Angular sign-in
redesign, and story 14.1's repository seam. Verified by request, not assumed.

**Merged but not deployed:** stories 14.A and 14.B — docs, constant
substitutions and hook scripts, no runtime effect. No reason to deploy alone.

**The live gap, and the best next thing to pick up.** Client provisioning stops
after phase one. Story 5.11 is deployed and enforcing. **Stories 5.12 and 5.13
are not deployed**, and their `app/api` routes forward to environment variables
unset in production. A client submits the intake form, authenticates, and gets
nothing. Both routes now alert Slack before failing, so the silence reaches a
person — that was step one of the rebuild.

**The rebuild is in progress and deliberately incomplete:**

| Module | Lines | Dependency | State |
| --- | --- | --- | --- |
| `intake-format` | 276 | none | **Ported to `lib/onboarding/`, 15 tests, landed** |
| `google` (Docs) | 231 | `googleapis` — already in root | Next, needs nothing new |
| `email` | 212 | `nodemailer` — **not in root** | Needs Sam's call on the dependency |
| `gemini` | 174 | `@google/genai` — **not in root** | Same |

Then wire 5.12's handler in `app/api`, then 5.13.

**Do not redeploy the `functions/` versions.** `checkWebhookSecret` returns
`void` and never blocks, and `deploy:phase2` / `deploy:phase3` carry
`--allow-unauthenticated`. There is no exposure today only because they are not
deployed. Running `npm run deploy` in `functions/` ships two open doors.

---

## Where to kick off

**Do this first, in this order.** It is about an hour and it ends with something
landed.

1. **Run the three orientation commands above.** Confirm `main`, confirm the
   live revision. If either surprises you, stop and say so before doing anything
   else — a wrong baseline makes everything after it wrong.

2. **Port `functions/src/google.ts` to `lib/onboarding/google-docs.ts`.** It is
   231 lines, needs `googleapis` which is already a root dependency, and it is
   the next module in the 5.12 rebuild. `lib/onboarding/intake-format.ts` is the
   worked example — a straight move, a header note saying it was ported and why
   the `functions/` copy still exists, and tests it did not have before.

3. **Write its tests.** `createGoogleDoc` and `addDocTab` are the two that
   matter. `intake-format.test.ts` is the model: test the guarantee the module
   claims, not the lines it contains.

4. **Run the gate and land it.** `npx tsc --noEmit`, `npm run test`,
   `npm run lint`. One module, one commit.

Then stop and ask about `email` and `gemini` — both need a new root dependency
and that is Sam's call, not yours.

**Why this task.** It is self-contained, it has a worked example one commit back,
it needs no new dependency and no deploy, and it moves a real user-facing gap: a
client who submits the intake form currently gets nothing.

**What not to start with.** Do not begin with the coordination layer, the swarm
model, or an audit of the audits. On 2026-08-23 that layer produced seven
documents, four had substantive errors, and none of it changed a line of shipped
code.

## Open decisions that are Sam's, not yours

1. Two new root dependencies for the port above.
2. Migration `010` is unapplied and needs an owner role; `tag_app_user` has DML
   and no DDL. General form: migrations need an owner role, the app must not
   have one.
3. Google Calendar scope classification — only visible in our own Cloud Console.
   Blocks 16.1's estimate.
4. GHL agency sub-accounts cannot be transferred between agencies, which may
   invalidate part of Story 1.2's 23-account consolidation.

---

## How to deploy, if you have to

`gcloud builds submit --config=cloudbuild.yaml` from a checkout of exactly what
should ship, passing `SHORT_SHA`, `_FIREBASE_API_KEY` and
`_FIREBASE_AUTH_DOMAIN`. **Never `gcloud run deploy --source`** — it skips
`cloudbuild.yaml` and every guard in it, and did four and a half hours of
downtime on 2026-08-21.

Afterwards check the image repo: `hub/` is correct, `cloud-run-source-deploy/`
is the broken method. That one field is the whole diagnosis.

**The `AIza` bundle grep in the old notes is obsolete** — `/signin` is Angular
now and the browser never touches Firebase, so it returns zero on a healthy
deploy. Use `/signin` 200, the Angular chunk 200, and a POST to
`/api/auth/otp/request` returning 403 rather than 5xx.

---

## The habit worth copying

Four sessions corrected the previous lead on 2026-08-23 and all four were right,
including one that prevented a bug which would have charged a customer twice.
None of that came from agreement.

So: contradict people with a specific number. Re-derive rather than review.
Never verify your own work. And when you are proved wrong, say so plainly and
carry on — that is the cheapest thing that happens all day.
