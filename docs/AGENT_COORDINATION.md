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

**And the half that care cannot fix: your report goes stale under its reader.**
Added 2026-08-27.

**The near-miss first, because it is sharper than a bare number.** A session
reported its branch "0 ahead, 0 behind **at spawn**". It was trying to qualify the
claim and it had the SHA in hand. But "at spawn" is *provenance*, and a reader
cannot resolve it to anything runnable: there is no command that turns "spawn"
into a commit. "0 behind at `8787c50`" is checkable in one command and reads
identically. **That is the whole distinction — a ref is an expiry date, a
time-marker only looks like one.** This half was preventable, and the session that
did it says so.

**The half that was not preventable.** A Reviewer auditing a pull request verified
every claim from source, named the SHA it read them at, and said so. The branch
moved under it mid-audit, and by the time its message arrived the misleading
comment it had found was already corrected. Nothing it did was wrong, and the ref
it named is the only reason anyone could tell. **Note what had and had not
changed: the comment was fixed, the defect the comment described was not.** That
distinction is exactly the kind a stale reading destroys.

**So: name the ref, in anything you send.** Whether a number was still true at the
instant it left is usually unestablishable afterwards — no timestamped record ties
a message to a ref — which is the point. **A reader who can re-run it does not
need to know.**

**Two decay directions, and they need different remedies.** A stale "0 behind" or
"clean tree" is simply *false*, because those states reverse. A stale count of
merged work is an *undercount*, because merging is monotonic and that number only
rises. Treating them as one job teaches a reader to check them the same way.

**The generated categories are the ones to distrust in prose:** unmerged work,
stale branches, local-only branches, detached worktrees, dirty worktrees. `npm run
loops` prints all five. **The number is generated; the sentence around it is not.**

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
resolves an address collision, and `[ref]` is the only disambiguator.**

**The title conforms to the address, never the reverse.** The address is the field
nobody can write, so it is the one everything else follows. Read it from `ListAgents`
line 1 and set the title to match, verbatim. An earlier version of this rule derived
the title from the worktree basename instead, and produced three sessions whose
sidebar labels routed to nothing, which is worse than having no rule.

**The invariant is not self-maintaining, and this is the open hole.** One session's
address changed from `handoff-review-questions-555acd-3b` to `LEAD` without that
session doing anything, some time after its predecessor was archived. Its first
`set_session_title` call reported `(was "LEAD")`, so the field was already written
before it ever touched it, and the mechanism is not visible from inside a session.
So some event nobody has identified writes the address. **Re-read `ListAgents` and
re-conform the title at any handover, archive or adoption event**, not only when
someone asks for a rename. A stale title is now worse than it used to be: it looks
routable and is not, where a role word at least read as "look up the address".

### Callsigns: the name is chosen once, at spawn

Sam's ruling, 2026-08-27, replacing the deferred paragraph this section used to carry.

**This is not a naming preference. It is the addressing layer the protocols in
`PEER_SESSION_PROMPT.md` already presuppose, and which nobody installed.**

That document runs end to end on aviation and submarine crew resource management,
and says so: backbrief, closed-loop communication with verbatim readback,
questioning attitude, forceful backup, BLUF, pre-flight, after-action review.
Every one is borrowed intact from a field that pays for communication failures in
lives. **Every one of them also assumes the participants can address each other
unambiguously.** That is the substrate they run on, and it was the only part of
the doctrine left out.

The distinction matters for whether this rule survives. A rule justified as
"names were confusing" gets relaxed the first time someone finds it inconvenient.
A rule justified as "the protocols do not function without it" does not.

**The cost of the missing layer, all of it on 2026-08-27 and all of it inside one
hour:** two sessions both answering to `REVIEWER`; a Lead whose address was the
role word `LEAD`, so no session could tell the seat from the session; three
sessions renamed to worktree basenames that routed to nothing; the rule inverted
twice; and one address assigned by an event nobody has been able to identify.
None of that was carelessness. It is what happens when a protocol set that
presumes addressing is deployed without it.

**The test any scheme has to pass, and it is the whole requirement:** *"Tell BRAVO
to pick up #16."* Unambiguous to say aloud, to type, and to route, with no lookup.
Twenty-six is more than any concurrent fleet here has needed, and the phonetic
alphabet is engineered so that no two entries survive garbling as each other.
Measure any alternative against that sentence.

The address is derived from the worktree name at spawn. **Every address observed
at spawn matches `<worktreeName>-<2 hex>`. One has since been rewritten by the
unidentified event above, which is why rule 4 exists.** Run `ListAgents` and you
will find that exception rather than a clean five-for-five, and the exception is
evidence for the rule, not against it.

1. **Source: the NATO phonetic alphabet, official spellings.** ALFA, BRAVO, CHARLIE,
   DELTA, ECHO, FOXTROT, GOLF, HOTEL, INDIA, JULIETT, KILO, LIMA, MIKE, NOVEMBER,
   OSCAR, PAPA, QUEBEC, ROMEO, SIERRA, TANGO, UNIFORM, VICTOR, WHISKEY, XRAY, YANKEE,
   ZULU. **ALFA, JULIETT and XRAY are spelled that way deliberately; do not correct
   them.** The alphabet exists so that no two entries are confusable when garbled,
   which is the property an address typed under time pressure needs.
2. **Chosen at `EnterWorktree({name})` and nowhere else**, because that is the only
   moment a session can *choose* it. Not the only moment it can be written: the
   paragraph above records an address rewritten after spawn by something nobody
   has identified. An earlier draft of this clause said "the only moment the
   address is writable at all", which contradicted that paragraph nineteen lines
   above it and was caught by a second reader rather than by either of the two
   people who wrote it.
3. **Assign the first callsign not currently visible in `ListAgents`.** Derived, not
   remembered.
4. **Retire, never recycle.** A callsign stays dead until its address has stopped
   appearing in `ListAgents`. Given that an unidentified event can already move an
   address, recycling is how that curiosity becomes a collision.
5. **Never a role, never a task.** `LEAD` and `REVIEWER` collided on 2026-08-27
   because roles are seats and seats get reoccupied; a task name goes stale the moment
   the session is reassigned. A callsign names *which session*, never *what it does*.
   The seat belongs in the brief, where it changes without renaming anything.
6. **Sessions predating this are grandfathered until they respawn**, because their
   addresses cannot be changed from inside.

**Unverified, and the first respawn settles it: whether the address preserves
uppercase.** Every address observed so far is lowercase, and `EnterWorktree` refuses
to create a worktree from inside one, so no current session can test it. The first
session spawned under this rubric reports its address verbatim before anyone writes
`ALFA` into a document expecting it back.

**This retires the no-role-names rule rather than sitting beside it.** Once the title
must equal the address, and addresses are unique by construction, role-name collision
is structurally impossible.

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

- Use the directory name **verbatim, hash suffix included**:
  `functions-typescript-build-8fa5d4`, not "Functions build". The suffix is what makes
  it match `git worktree list`, and a tidied name defeats the whole point.
- A session in the shared checkout at the repo root is `TAG`. There should rarely be
  one; that checkout is usually parked.
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
