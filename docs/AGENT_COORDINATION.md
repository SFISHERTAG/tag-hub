# Working in concert — SOP for concurrent agent sessions

Several Claude sessions work this repo at once, in the main checkout and in worktrees under
`.claude/worktrees/`. They share one `.git`, one `main`, and one set of hooks. Every rule below
was paid for by an incident, cited inline and most of them dated, so you can check the claim
rather than trust it.

---

## 1. Re-read state immediately before you act on it

A reading seconds old is a guess. On 2026-08-20 a session read a worktree's status, saw
`docs/ALB_CUTOVER_RUNBOOK.md` as untracked, and ran `git checkout --detach` to free the `main`
ref. In the interval the file had been committed as `e04e71a`. Detaching to an older commit
therefore **deleted a tracked file from another session's working tree.** The reasoning was
sound; the state was stale.

Re-run the check in the same command as the action, or accept that you are acting blind.

**And the half that care cannot fix: your report goes stale under its reader.**
Added 2026-08-27. **A ref is an expiry date; a time-marker only looks like one.**

One session reported "0 ahead, 0 behind **at spawn**", which is provenance rather
than a ref: no command turns "spawn" into a commit, while "0 behind at `8787c50`"
is checkable in one and reads the same. Another verified a pull request from
source, named the SHA, and had the branch move mid-audit — **and note what had changed there and
what had not: the misleading comment it found was corrected, the defect that
comment described was not.**

**Only the first was preventable.** The remedy for all three is the same and it is
cheap: name the ref in anything you send. Whether a number was still true when the
message left is usually unestablishable afterwards, and **a reader who can re-run
it does not need to know.**

**Two decay directions, needing different remedies.** A stale "0 behind" or "clean
tree" is *false*, because those states reverse. A stale count of merged work is an
*undercount*, because merging is monotonic. Treating them as one job teaches a
reader to check them the same way.

**And distrust the categories in prose, not the generator.** `npm run loops` always
prints four: unmerged work, stale branches, detached worktrees, dirty worktrees.
**Local-only branches print only without `--remote`**, deliberately, since every
branch is pushed by definition in that mode; a sixth line about vanished worktree
registrations prints only when there are any. **Which mode you are in decides what silence
means.** `CLAUDE.md` tells a session to run the plain form, which prints the
local-only line, so a session following it is not at risk. **The reader who is at
risk runs `--remote`: CI, and Step 1 of the peer brief.** Read four there,
conclude there are no local-only branches, and you have made standing order 2's
mistake through a document rather than a matcher. **The number is generated; the sentence around
it is not.**

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

## 4b. A session is named for where it sits

**A session has two names and only one of them routes.** Get this backwards and every
rule below reads as solved when it is not.

- The **address** is what `ListAgents` prints on its first line, `This session is
  <NAME> [<ref>]`. It is what another session must type to reach you. No tool
  available to a session can write it.
- The **title** is the sidebar label. `set_session_title` writes it and nothing else.

Established by experiment on 2026-08-27, after three sessions each renamed themselves
and checked immediately afterwards, which is shared method rather than independent
confirmation and would have returned the same answer under a caching lag:

```
set_session_title -> "LEAD-PROBE-1"
ListAgents        -> This session is LEAD [b09feb]
(work, delay)
ListAgents        -> This session is LEAD [b09feb]
```

Distinct title, delayed second read, address unmoved. **Renaming therefore never
resolves an address collision.** `[ref]` disambiguates at a single moment and no
longer than that: it has since been observed to move on its own, and the measurement
is below.

**Neither name routes by being written down. Only `ListAgents`, read at the moment
of sending, routes.** This is the rule the two below hang off, and getting it wrong
is what every naming incident in this section has in common.

**The title is derived from where the session sits, never from its address.** Set it
at the start of a session, to `ROLE · <worktree-directory-verbatim>`; the full
convention and the reason are below. An earlier version of this rule said the title
must equal the address verbatim, which was right about direction and wrong about
source: the address is not stable enough to copy, so a conformed title is stale from
the next rewrite onward.

**The objection this has to answer, because it is a scar and not a hypothetical.**
An even earlier version derived the title from the worktree basename and produced
three sessions whose sidebar labels routed to nothing, which was judged worse than
having no rule. **This convention is closer to that failure than the old one was,
not further from it:** a worktree half is exactly one suffix away from a real
address, where "Functions build" was obviously not one.

**What retires the scar is the `ROLE · ` prefix, and it is structural rather than a
rule about behaviour.** Every address observed here matches `[a-z0-9-]+`; none
contains a space or a `·`. So `REVIEWER · postgres-stack-replacement-202d6e` cannot
be mistaken for an address at a glance, and pasting it into `SendMessage` cannot
work. That is a property of the string. **Do not defend this convention with "no
title routes" instead** — the scar was three sessions acting on a norm, and nobody
types a name they believe is wrong, so another norm would not have stopped them.

**The invariant is not self-maintaining, and this is the open hole.** One session's
address changed from `handoff-review-questions-555acd-3b` to `LEAD` without that
session doing anything, some time after its predecessor was archived. Its first
`set_session_title` call reported `(was "LEAD")`, so the field was already written
before it ever touched it, and the mechanism is not visible from inside a session.
So some event nobody has identified writes the address. **Re-read `ListAgents` at any
handover, archive or adoption event**, and never carry an address forward from an
earlier message, including one in this file.

### Callsigns: withdrawn 2026-08-27, and kept here as the reason

**Sam withdrew the NATO callsign scheme on the evening of 2026-08-27 local time**
(PR `#42` closed `2026-08-28T04:16:20Z`; **every date in this section is local
time, and the same event has two defensible dates if you mix conventions**). The rules it stated are
gone from this section rather than amended, because a withdrawn rule left standing
is worse than no rule: for about 36 hours after the withdrawal this section still
instructed every new session to pick a callsign, and `#45` was opened by a reviewer
who found it *while verifying that the withdrawal had been executed*, which it had
not. The amendment had been made in `PEER_SESSION_PROMPT.md` Step 0, correctly and
alone; the scheme itself lived here and nobody came back for it.

**Why it failed, which is the part worth keeping.** Two reasons, and the second
outlives the scheme.

1. **Twenty-six names with retire-never-recycle is a ceiling that fails without
   warning.** It does not degrade as the fleet grows, it stops.
2. **No naming scheme here can rest on a session's `title`.** The title is mutable
   current state with no history, and this section itself mandates renaming at
   handover, archive and adoption. Anything that needs to know a name was once
   used needs a record that is not a session title. Standing order 8.

Established over four rounds of review on `docs/reinforcement-callsigns`, kept on
origin as `keep/callsign-scheme-review-record` @ `3315607` so the next person to
propose spoken callsigns pays the reading cost rather than the discovery cost.

### What a session cannot do, which constrains every scheme that follows

**A session cannot read its own title non-destructively.** `list_sessions` excludes
the caller. `ListAgents` returns the address. The only path is the `(was "...")`
string that `set_session_title` returns when it overwrites — a destructive read.
So "is my title correct?" is answerable only by making it correct, and a session
renamed by someone else cannot detect that it was. This is a property of the
tooling, not of any scheme, and it will outlive this paragraph. **Do not write a
rule whose conformance nobody can check.**

**Addresses are mutable in both halves, and more so than this section used to say.**
Measured 2026-08-29: two live sessions changed address in the same window, with no
action by either, `peer-session-prompt-docs-5dd173-6f [2202da]` to `-66 [103fe9]`
and `postgres-stack-replacement-202d6e-37 [11ea02]` to `-25 [0e438b]`. **The `[ref]`
moved too**, so the claim above that `[ref]` is the only disambiguator is true only
of a single moment. The worktree half of each address was unchanged, which is the
one stable component. The window coincided with two sessions leaving `ListAgents`;
that is a correlation and nobody has identified the mechanism.

A separate experiment the same day, 2026-08-29: `ListAgents`, then `set_session_title`, then
`ListAgents` again returned an identical address and ref. **Renaming is not what
moves an address.** That corroborates the `LEAD-PROBE-1` result above at a second
moment with a different title shape.

### Two names, and which one is authority

**The title is for the human. The record is the authority. Do not confuse them.**

**Title = `ROLE · <worktree-directory-verbatim>`**, for example
`LEAD · peer-session-prompt-docs-5dd173`. It exists because Sam cannot otherwise
tell from his sidebar which session holds the seat, and a blank field was his actual
reported problem. The mutable suffix is excluded deliberately: a title carrying
`-6f` was false at the moment `set_session_title` reported success, which is trap 15
caught by reading the state back instead of trusting the tool.

**This replaces "the title conforms to the address, verbatim."** That rule was
written when the address looked stable. It is not, so conforming a title to it
guarantees a stale title, and the worktree half is the only component that holds
still. The half of the old rule that survives is its direction: the session does not
get to invent the name, it derives it from where it sits.

**A title cannot settle who holds a seat, because it is self-asserted.** N sessions
can each title themselves `LEAD` and the sidebar shows N. That is the two-sessions-
answering-to-`REVIEWER` failure moved from the address to the title, and it is worse
there: a blank reads as missing information, two reads as an answer. Only a grant
settles a grant.

**So the seat lives in `docs/LEAD_OF_RECORD.md`**, one line naming the current
Lead's worktree and address and the SHA at which Sam granted it, **written by the
outgoing holder and never by the session taking the seat**, in the handover commit.
A handover has two parties; a session recording itself is the self-assertion the
file exists to exclude. Where no outgoing session survives to write it, the row
stays unfilled rather than being filled by its subject. It is greppable, it is in the repository, it survives every rename and
every address rewrite, and two sessions cannot both hold the file. Standing order 8:
this is the mechanism, and the title is the norm that points at it. **When the
sidebar and the file disagree, the file is right.**

**A caution the title inherits and the file does not.** A role changes mid-session:
a Reviewer promoted to Lead has a silently wrong title from that instant and nothing
fires. Read the file, not the sidebar, whenever the answer matters.

**`#45`'s other observation, recorded so it is not re-derived as broken:** the
no-role-names retirement below is sound again, on a different premise than the one
it was written with. It rested on titles equalling unique addresses. It now rests on
roles being confined to the title and the record, and never appearing in an address
at all.

On 2026-08-27, forty-two commits of video-editing work under `tools/rough-cut` took
an unrelated audit to find. The session doing it was titled for one thing, sat in a
worktree named for a second, and committed to a branch named for a third. No
individual name was wrong; answering *who is in there and what are they touching*
required already knowing all three.

**This rule is about discoverability, not loss.** The loss half is mechanised as of
`54d08ea`: `check-commit-reachability` refuses a commit on a detached HEAD and warns
with the exact push command on a branch with no upstream. Naming by location answers a
different question — *which of a hundred sessions was that* — and no guard can answer
it, because a chat title is not in the repository. Per standing order 8, the part of a
norm that duplicates a mechanism is the part that decays, so this rule deliberately
claims only what no mechanism covers.

- Use the directory name **verbatim, hash suffix included**, after the role prefix:
  `LEAD · functions-typescript-build-8fa5d4`, never `LEAD · Functions build`. The
  suffix is what makes the second half match `git worktree list`, and a tidied name
  defeats the whole point. **This bullet used to forbid the prefix** by demanding the
  directory name alone; that was left standing six lines below the rule that
  introduced the prefix, and a reviewer found it before this branch merged.
- A session in the shared checkout at the repo root is `ROLE · TAG`. There should
  rarely be one; that checkout is usually parked.
- **Rename at the start of a session, not at the end.** A title that becomes correct
  after the work is over solves nothing.

**A second hole, larger than the first.** A plain terminal `claude` session in a
worktree has no title to set. It does not appear in the session list, its transcript is
not searchable, and there is nothing to archive or restore — the video-editing session
above was exactly this, which is why searching the session list for it returned nothing.
The rule cannot reach those sessions at all. Where work matters, the branch is the
record that survives, not the chat.

**The known hole, stated rather than hidden.** Worktrees outlive sessions and get
reused — `functions-typescript-build-8fa5d4` has hosted at least five — so a location
name is not unique over time. Address the live one by name; if two are live in the
same directory, disambiguate with the session id, never with an invented nickname.
Inventing one puts you straight back in the situation this rule exists to prevent.

This is **not mechanised**, and cannot be: no git hook can read a chat title. It is
therefore a check-in item. When two sessions first make contact, the first thing each
confirms is that it is named for where it sits.

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

## 9b. Say whether it is safe. Then ask.

Added 2026-08-26, after a session merged a PR on the words "so can you merge
pr7". That was a question about safety, not an instruction, and it was read as
one because it was the first thing in three days that sounded like a yes.

**The rule.** For any action on a shared ref -- a merge, a push to `main`, a
deploy, a branch deletion -- report whether it is safe and then ASK whether to
proceed. Two separate messages, or one message ending in a question. Never infer
the instruction from the question.

**Why the phrasing is the trap.** "Can you X" is ambiguous between *are you able*
and *please do*. So is "should we X", "ready to X", and "is X good to go". Every
one of them reads as authorisation to a session that has been waiting for
authorisation, which is exactly when it is least able to tell the difference. The
longer a session has been correctly declining to act, the more likely it is to
over-read the first permissive-sounding sentence.

**What safe means here, and it is not a feeling.** Name the checks that ran, the
commit they ran against, and what is still unverified. "It is safe" without those
is the same claim as "this should work", which §10 already refuses.

**This is not the ownership rule again.** §9 says who may move `main`. This says
that even the owner's apparent go-ahead is confirmed before it is acted on,
because the cost of asking is one line and the cost of a wrong read is a shared
ref moved without intent.

---

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

**10. `mergedBy` is a credential field, not an actor field.** The repository
records *that* a shared ref moved and *by whose token*. It records nothing about
which session did it.
*Scar:* on 2026-08-27 a session audited who had merged four PRs, ran
`gh pr view N --json mergedBy`, got `SFISHERTAG` on all four, and reported "no
session merged anything, boundary intact". Another session had merged all four,
with Sam's authorisation given in chat. `gh api /user` returns `SFISHERTAG` too:
every session on this machine holds the same credential, so a merge performed by
a session is indistinguishable from one performed by Sam in every GitHub field
there is. The conclusion happened to be right and the evidence could not have
established it, which is standing order 2 arriving through a field nobody
suspected.
The gap is worth naming as a gap: **the only record of which session moved a
shared ref is the transcript where the authorisation was given, and no such
record exists in the repository.** Do not fix this by inferring an actor from a
commit trailer either; `Agent-Worktree:` is stamped by the committing session
about itself, which answers a different question and is trivially absent on a
merge made through the GitHub UI or API.

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
