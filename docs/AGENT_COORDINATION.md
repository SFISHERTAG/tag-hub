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
