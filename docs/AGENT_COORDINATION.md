# Working in concert — SOP for concurrent agent sessions

Several Claude sessions work this repo at once, in the main checkout and in worktrees under
`.claude/worktrees/`. They share one `.git`, one `main`, and one set of hooks. Every rule below
was paid for by an incident on 2026-08-20, cited inline so you can check the claim rather than
trust it.

---

## 1. Re-read state immediately before you act on it

A reading seconds old is a guess. On 2026-08-20 a session read a worktree's status, saw
`docs/ALB_CUTOVER_RUNBOOK.md` as untracked, and ran `git checkout --detach` to free the `main`
ref. In the interval the file had been committed as `e04e71a`. Detaching to an older commit
therefore **deleted a tracked file from another session's working tree.** The reasoning was
sound; the state was stale.

Re-run the check in the same command as the action, or accept that you are acting blind.

## 2. Verify against a commit, never against a directory

`cd`-ing into the repo tells you nothing about which branch you are on. The main checkout at
`/Users/home/projects/TAG` routinely sits on a feature branch, not `main`.

On 2026-08-20 a `grep` and a `tsc --noEmit` were run there to decide whether `main` was safe to
publish. Both ran against `onboarding-intake-wizard-scaffold`. The grep returned nothing and was
read as "the export is missing"; the typecheck returned clean and was about to be read as "main
compiles." **A green check from the wrong branch is worse than no check** — it manufactures
confidence you then act on.

Every verification you report must name the commit it ran against:

```
tsc --noEmit @ main 57c2182   EXIT 0        ✅
"tests pass"                                ❌
```

## 3. A status field is not a readiness check

`gcloud functions describe phase1-provisioning` reported `state: ACTIVE` for a function whose
container had **never started**. The underlying Cloud Run service told the truth:

```
Ready / ConfigurationsReady / RoutesReady:  False / False / False
"The user-provided container failed to start and listen on PORT=8080"
```

That gap sent a wrong claim about live production exposure to a user. Before reporting that
something works, find the signal that would go red if it did not, and read *that*. The same
shape recurs: a pre-commit hook whose checks skip silently on a drifted branch reports healthy
by running a smaller and smaller share of its gates.

## 4. Never attribute work by style or lineage

Uncommitted work appeared in a worktree: a `.githooks/pre-commit` v1→v2 rewrite plus a new
`scripts/check-branch-freshness.mjs`. It read unmistakably as a follow-on to one session's
hooks work — same lineage, same filenames, same argument. It was attributed to them on that
basis and the attribution was **wrong**. They disproved it in one command:

```bash
git log --all -- "**/check-branch-freshness.mjs"   # returns nothing — never committed by anyone
```

Stylistic inference is not evidence. Ask, and say plainly that you are asking rather than
concluding.

## 5. Another session's work is not yours to move

This covers uncommitted files, untracked files, and commits.

Commit `b1ee4fc` — an Angular migration plan, a Node version bump, `docs/epics.md` changes — was
set on `main` at 20:29:14 and reset off it 33 seconds later. It sat orphaned and reachable only
by hash for roughly an hour while its author believed it had landed. Nothing was lost, but
nobody noticed.

If you find orphaned or unowned work: **surface it, offer to restore it, do not restore it.**
You do not know why it was moved. If you are blocked by someone's checkout, ask them to release
it — do not free the ref yourself.

## 6. Announce every shared-ref move, and ship the undo

`main` moved at least five times in one working session and was force-reset twice. Any message
that moves a shared ref must carry:

- the new SHA and what is in it
- what you verified, per rule 2
- **the undo**, spelled out: `git branch -f main e04e71a`

## 7. State what you did *not* do

The most useful line in any of the day's messages was a negative:

> I created no secrets and deployed nothing.

Negative space is where the other session's fear lives. Close it explicitly. Say what you did
not touch, not merely what you touched.

## 8. Secrets never travel through a session

Read a secret in a terminal and paste it into its destination. Do not route it through a chat,
a message to another session, or a tool result — transcripts persist.

A live webhook secret was pasted into a session on 2026-08-20 and had to be rotated. That was
cheap only because nothing depended on it yet. If a value does reach a transcript, rotate it
immediately rather than reasoning about who might have seen it.

---

## 9. `main` has one owner, and it is not whoever gets there first

Added 2026-08-23, after `main` moved twice in one day under a session that was mid-story
against the previous tip. Nothing was corrupted either time — the changes did not overlap —
which is exactly why it went unremarked. The damage is not a bad merge; it is that a session
verified against a commit that stopped being `main` while it worked, which is §2's "green
check from the wrong branch" arriving by a different road.

**The rule.** One session owns `main` at a time. Everyone else works on a branch and asks the
owner to land it. Ownership is handed over explicitly, in a message, not assumed from being
idle or from having a merge ready.

**The enforcement**, because an agreement nobody checks is the drift:

| Hook | Catches |
| --- | --- |
| `pre-commit` | An ordinary commit made while on `main` |
| `pre-merge-commit` | A **merge** into `main`. This is the one that matters |
| `pre-push` | A push of `refs/heads/main` from any branch |

All three call `scripts/check-main-ownership.mjs`.

**Why it is not a `pre-commit` check alone: `git` does not run `pre-commit` for a merge.** A
guard living only there would not have caught the event that prompted it. If you are ever
tempted to consolidate these three into one hook, that is the reason not to.

**The escape hatch is typed each time, never persisted:**

```bash
TAG_MAIN_OWNER=1 git merge --no-ff claude/some-branch
TAG_MAIN_OWNER=1 git push origin main
```

A marker written to config gets set once and then outlives the intent, which is how a guard
ends up existing on paper only. Typing it is the moment to ask whether you are actually the
owner. If you are not, stop.

**Parking the main checkout is the other half.** With `main` checked out nowhere,
`git worktree list` shows zero holders and nobody can move it without an explicit,
visible checkout. Park with `git switch -c hold/main-parked` from the same commit: it changes
no file, preserves untracked files, and leaves stashes alone. Never park with
`git checkout --detach`, which is what deleted a tracked file from another session's tree on
2026-08-20 (§1).

## 10. Standing orders

Added 2026-08-23. Every one of these came from something that actually went wrong
that day, and the incident is named so the rule is arguable rather than obeyed.
A rule you cannot argue with is a rule nobody applies to a case it did not
anticipate.

They live here rather than in a briefing document because sessions are
consumable: they run out of context and get replaced. A rule only survives that
if it sits somewhere the replacement is told to read. CLAUDE.md points every
session here before it touches a shared ref, so this is that place.

**1. Cite or flag.** Every factual claim carries `file:line` and the SHA it was
read at, or says explicitly that it is unverified.
*Scar:* `docs/firestore-exit-assessment.md` built its collection inventory from
`docs/data-model.md` rather than from call sites. A story doc and an audit were
written from the assessment, and Epic 14's story titles were sequenced off those.
Five of ten stories ended up named after collections that do not exist. Nobody
was careless; each step trusted the previous document.

**2. Validate the instrument before trusting a clean result.** Plant a hit you
know exists and confirm your check finds it. Show the planted case in the report.
*Scar:* four separate "no violations found" results came from broken checks.
`git grep -E` does not understand `\s` in this environment and silently matches
nothing for any input; a comment filter dropped every line containing an
asterisk; a pattern using `!=` could not match `!==`. An empty result from a
broken matcher and an empty result from a clean tree are identical.

**3. Produce the artifact, then describe it.** If a report says "attached", a
path and a SHA must follow.
*Scar:* a session reported an attached draft and said its tree was clean in the
same message. Both could not be true. The draft did not exist.

**4. A document is not evidence, including this one.** The code and the commits
are the truth. When a source is missing, find it — never substitute a weaker one
that happens to be reachable.
*Scar:* asked to audit against a file that was on another branch, a session
proposed falling back to `data-model.md`, which is the document whose errors
started the whole problem. Separately, a reviewer who could not locate an ESLint
rule recommended proceeding with one enforcement mechanism instead of two.

**5. When correcting a document, diff it against the original.** Confirm nothing
that was *right* disappeared, and say what you removed and why.
*Scar:* a corrected story doc silently deleted the three findings the original
got right, including the most severe one in it — a hardcoded role in the
claim-issuing path. The correction replaced the findings table instead of
merging into it.

**6. Every count carries its unit.** Files, lines, occurrences. Never add across
units or across scopes.
*Scar:* "33 occurrences" was actually 33 lines; a line holding four role
literals is one line and four occurrences. That figure was handed to another
session mislabelled, propagated into a story, and produced `3 + 33 = 36`. It only
became visible because the receiving session showed its arithmetic instead of
asserting a total.

**7. Report produced and survived separately.** Four findings of which two were
wrong cost more than two that held.

**8. Prefer a mechanism to a norm.** If a rule can be checked by a script, make
it one.
*Scar:* the story-status hook stopped a drifting commit twice in one day and did
not care who was committing. Meanwhile "a document is not evidence" was stated,
agreed, repeated — and four sessions did it anyway, including the one enforcing
it. Norms degrade across session replacement. Checks do not.

**9. Verification is never self-assigned and never sighted.** Whoever produced a
finding does not verify it, and the verifier re-derives from source *before*
reading the original.
*Scar:* a blind re-derivation of an audit found `create()` at two call sites
where the original recorded one. The missed site reserved a campaign launch key,
and migrating it faithfully would have let a race loser create a duplicate paid
Meta campaign with no error anywhere. Reading the original first produces
agreement, not verification.

---

**Overrides are recorded, not prevented.** Each standing order above that is
mechanised carries a typed escape hatch, and every one of them stamps a
`Guard-Override:` trailer onto the resulting commit. The hatches are deliberately
easy to reach: a guard that refuses without naming the legitimate path is an
obstacle, and on 2026-08-23 the friction did its job — `check-main-ownership`
refused a commit to `main`, the session escalated to Sam, Sam approved, and the
override was used correctly. What was missing was any sign of it on the commit
itself, which took a reflog read to reconstruct. Now it is one `git log` away.

Monitoring conditions for a supervisory loop are in `docs/KRONOS_WATCHPOINTS.md`,
kept separate on purpose: these are rules for whoever is working, that is
configuration for something watching.

---

## 11. If it can run, it needs a story

Added 2026-08-23, after finding that two thirds of client provisioning had
stopped working and nobody knew.

**The rule.** Anything that can be deployed, can break, or can silently stop
running gets a story in `docs/stories/`, owned by an epic. Not a phase, not a
milestone, not a document named after the sprint it was built in. A story.

**Why it is a rule and not a preference.** Every automated guard here watches
`docs/stories/*.md`. `check-story-status` reads a Status field against its own
Tasks; `check-story-regression` reads two versions and refuses a commit that
walks one backwards. Both are good and both are blind to anything that is not a
story.

The failure mode is precise: work with no story cannot regress, because it has
no Status to move. Story 10.3 lost five checkboxes and a hook caught it within a
day. "Phase 2" stopped existing in production and nothing fired, because there
was nothing to fire about.

**What it cost.** Client provisioning ran as three webhooks named Phase 1, 2 and
3. Phase 1 is deployed and enforcing. Phases 2 and 3 are not deployed at all,
and their `app/api` routes forward to environment variables unset in production,
so a client who submits the intake form authenticates, fails on a missing URL,
and gets nothing. Every document still described them as live. They are now
stories 5.11, 5.12 and 5.13, with their real state written down.

**A second cost, same root.** "Phase 1/2/3" also named an unrelated CSM
dashboard workstream. Six `PHASE_*.md` documents described *that* work, not
provisioning. That code shipped, is live in `lib/meta/creatives.ts`, and **no
epic owns it either.** Two bodies of running code, one name, zero stories.

**Applying it:**

- If you are about to name something "Phase N", you are describing a deployment
  order, not a unit of work. Write the story instead.
- "Deployed and reachable" belongs in the acceptance criteria of anything that
  gets deployed. 5.11 is live and correct and passes three of its four criteria;
  the one it fails is exactly the one that would have caught its siblings dying.
- A completion report is not a story. `PHASE_1_COMPLETION.md` asserted
  production-ready for work whose production status nobody could check. Those
  were retired rather than corrected; the API reference among them was renamed
  for what it actually describes.
- When you find running code with no story, say so rather than writing one from
  guesswork. Status invented to fill a gap is worse than an admitted gap.

---

## Message shape

Address it, then answer the four questions the recipient actually has.

```
1. WHAT CHANGED     new SHA, what is in it, what you verified (with the commit)
2. WHAT I DID NOT DO   the negative space — deploys not run, secrets not created,
                       files not touched
3. EVIDENCE         the command and its output, not the conclusion
4. WHAT I NEED      the ask, or the blocker, or "nothing, FYI"
```

Include the undo whenever you moved something shared. Ask rather than conclude whenever you are
inferring. Keep it plain — the recipient is triaging, not reading.

## Before you touch a shared ref

```bash
git rev-parse --short main                       # where is it NOW, not where you last saw it
git worktree list                                # who holds what
git merge-base --is-ancestor <your-base> main    # has it moved under you?
git status --short                               # is there work here that is not yours?
```

If the last one returns anything you did not create, stop and ask whose it is.

## When someone corrects you

Check it, then say so plainly. Two corrections landed on 2026-08-20 — a wrong claim about
production exposure, and a wrong attribution of authorship — and both improved the outcome. A
peer's report is evidence to verify, not a verdict to accept and not an attack to deflect. Run
the command yourself; if they are right, say they were right and move on.
