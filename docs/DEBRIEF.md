# Debrief

The rolling debrief. **One file, no date in the name, newest entry first.**

This exists because the alternative was tried and failed in this repo. Counted at
`092b672`, `docs/` already holds **eight** handoff, status and retrospective
documents, several of them dated in the filename:

    CONSOLIDATION_STATUS_2026-08-23.md      SECRETARY_HANDOFF_2026-08-23.md
    SESSION_HANDOFF_2026-08-23.md           retro-2026-08-25-to-27-session-block.md
    LETTER_TO_THE_NEXT_LEAD.md              LETTER_TO_THE_NEXT_SESSION.md
    MERGE_CONFLICTS_IDENTIFIED.md           MERGE_READY_FOR_SAM.md

**Two corrections to that block, 2026-08-27, from a blind review.** The baseline
convention in trap 11 resolves a *count* at its baseline, and this is not only a
count: it is a block of paths a reader follows, doing live argumentative work in
the sentence below it. `LETTER_TO_THE_NEXT_SESSION.md` is no longer among them; it
is now `_archive/session-letters/LETTER_TO_THE_NEXT_SESSION-2026-08-23.md`, and a
reader on `main` following the old path finds nothing. Separately, **eight is an
undercount** of the class on `main`, which also holds `MERGE_DECISIONS_2026-08-23.md`
and `handoff-angular-migration.md`. The argument below is stronger than the number
it rests on, not weaker.

A ninth was about to be written, which is what prompted this file. `CLAUDE.md`
bans exactly this accumulation for status docs and names `MERGE_STATUS_<date>.md`
as the shape; the last two above are that shape with the date left off. A reader
facing eight does not know which is current, so they read none, and every lesson
paid for in them is lost.

It also exists because a debrief nobody reads is not a loop. `PEER_SESSION_PROMPT.md`
Step 1 points a new Reviewer here and **Moment 5** sends them back to append. Read
at the start, written at the end, same file. That is the whole mechanism.

**Corrected 2026-08-27: this sentence said "Step 5".** That document runs two
numbering schemes, Moments 1 to 5 and Steps 0 to 7, which is trap 14 below, and
this sentence committed trap 14 while describing its own mechanism. Step 5 is the
permission boundary, marked "Verbatim. This does not move", so a session sent
there either concludes the append was never shipped or starts editing beside the
one section that must not move. "Read at Step 1" was correct and stays.

**Why it earns a place in a list that says "and only these".** The other four
items in Step 1 say what is *true*: the constraints, the method, the standing
orders. This is the only one that says what went *wrong*. It is also the only one
that does not get longer to read as it grows, because the traps are distilled and
the entries below them are optional.

## How to use this

- **At session start**, read *The standing traps* below. **If you read only five,
  read the first five**; they are ordered by how much they change what you do.
  You do not need to read the entries.
- **At session end**, add a new entry directly under `## Entries`, above the
  previous one. Promote anything genuinely reusable up into the standing traps
  and say in your entry that you did.
- **Never rewrite an earlier entry.** Correct it in yours, naming what you are
  correcting. The record of a wrong belief is worth more than a tidy file.
- **If you renumber the traps, grep this file for every reference to the old
  numbers.** The entries cite them. That is trap 8 applied to this file.

## What does not go in here

**No board state. No `main is <sha>`. No PR numbers as status. No counts of
anything that moves.** This is the rule the file most needs, and it is written
from the failure of its own predecessor: `retro-2026-08-25-to-27-session-block.md:27`
says "`main` is `4986d1e` and green", which was true when written and false within
hours. Refs answer state questions. `npm run loops`, `npm run awaiting` and
`gh pr list` are generated;
this file is not.

Cite a SHA only as *where a lesson was observed*, never as *what is true now*.

---

## The standing traps

Each one presents as something a careful session already believes, which is why
care does not catch them. Each has a check that costs seconds.

**1. Asking your principal about everything, which spends his authority rather
than using it.**
Presents as diligence. It is the opposite. A Lead granted `main` kept asking Sam
to approve every merge anyway, until he said: *"I just don't know when I am
supposed to give the green light and really don't know what I am green lighting."*
**When everything looks like a decision, nothing does**, and the two that
genuinely needed him got the same yes as the eight that did not. *Check:* merge
what is reviewed, green and reversible without asking. Go to him only for a fact
only he has, a product direction, an irreversible or outward-facing act, or a case
where being wrong is expensive and you would otherwise be confident for free.

**2. State read at one moment, acted on at another.**
`AGENT_COORDINATION.md` already says to re-read state in the same command as the
action. **It applies to questions too**, and that is the newer half: a question
put to Sam is answered minutes later against a board that moved. One of four
questions in a single form described a PR that had merged five seconds earlier.
*Check:* derive state in the same command that composes the question, not the turn
before.

**3. A count from a loose matcher.**
Presents as a confident number, often inside a document that says "counted from
the code". `grep -c 'kind: "insert"'` matches the discriminated-union declaration
as well as every array entry: 11 where the array holds 9. `grep -c "^run_check"`
matches the function definition too: 10 and 8 where it is 9 and 7. A count that
comes back identical for every input is a broken matcher wearing a finding's
clothes. *Check:* **print the matching lines, not the count**, whenever a number
is suspiciously uniform or arrives inside a correction. Or read the test that pins
it. Four wrong counts came from this in one night, across three sessions.

**4. Retracting without verifying.**
The same error as asserting without verifying, and worse because it feels safer.
A correct count of 13 was retracted to 14 and 12, neither of which reproduced
under any reading; the original had been right and the two numbers were answering
different questions. Standing order 9 is usually read as "do not verify your own
work". **It also means: do not accept a correction to your own work unchecked.**
*Check:* a retraction is a claim. Run it.

**5. Testing the code path instead of the invocation path.**
Presents as green, and as a fix that is inert exactly where it fires. A guard
shipped with seven tests, three validated as discriminating against the reverted
script, and it did not work: every test called the guard directly, while in the
git hook that actually runs it `MERGE_HEAD` does not exist. Found by someone
running the real thing, not by re-reading. *Check:* **a test that exercises the
code and not the invocation cannot tell a working fix from an absent one.** Make
the invocation leave a trace, a sentinel file the test asserts, so the claim
becomes "it worked AND it ran". Shipped: `test/story-regression-merge.test.ts`
writes a hook that touches `HOOK_RAN` and asserts the file exists. Proposed by
one session, implemented by another, which is trap 4's point from the good end.

**6. An instrument that has never been shown to fail.**
Green output is a claim until you have seen the thing go red. *Check:* break the
behaviour it covers, confirm the failure, revert. A test or hook that passes
against deliberately broken code is worse than none, because it is trusted.

**7. A search that found an absence.**
Presents as "this feature is unreachable" or "this was never decided". The comment
explaining where something moved sits *below* the structure it was removed from,
so a grep that stops at the closing bracket misses it. *Check:* read past the end
of the thing you grepped. Search for the behaviour, not the label.

**8. Fixing one instance and not its neighbour.**
Presents as a completed fix. Step 2 of the peer brief was rewritten to forbid
identifiers while Step 7 kept its own, and line numbers were left inside Step 2's
incident record; both were caught by other readers within hours. The same shape in
review: one PR's live state was checked before relaying a ruling and the adjacent
PR's was not. *Check:* when you fix a class of defect, grep the whole document, or
the whole board, for the class. **Applying a lesson to one item and not its
neighbour is the failure, not the missing command.**

**9. A relay of "Sam said X".**
Presents as authorization. It is not, per Step 5 of the peer brief, and this is
not theoretical: a relayed instruction contradicted one Sam had given directly,
and the session that held it rather than acting was right to. *Check:* if a relay
reverses a disposition you were given first-hand, hold and ask him. Relays are
corrigible. Say so when you send one.

**10. A guard defending a record that was already false.**
`check-story-regression` refused a revert because it unchecked a "completed" task.
The task was never completed; the checkbox recorded a production write nobody
authorized. A pre-commit hook sees the diff, not the world, so it cannot tell
"undoing real work" from "undoing a false claim". *Check:* when a guard blocks
something obviously right, the guard may be reading a false record as ground
truth. Announce the hatch before using it and say what the guard got wrong.

**11. A citation that was correct when it was written.**
Presents as a broken `file:line` against current `main`. Story docs carry
`baseline_commit` frontmatter precisely for this. *Check:* resolve the line at the
document's own baseline before calling it stale, and name the SHA you read at
whenever you cite. Two line numbers can both be right at different commits.

**12. A two-dot diff on a branch whose base has moved.**
Presents as the PR deleting hundreds of lines it never touched, often the very
paragraphs that corrected an earlier false claim. *Check:* `git diff main...branch`
(three dots) is the PR. `git diff main branch` is the PR plus everything `main`
did since.

**13. A warning precise enough to be trusted and narrow enough to mislead.**
`NEW_SESSION_PROMPT.md:14` names `LETTER_TO_THE_NEXT_LEAD.md` as proven stale the
same day it was written, and it names it by **bare filename, never by path**.
Corrected 2026-08-27: this trap said "by path", so a session applying the trap's
own instruction greps `docs/LETTER_TO_THE_NEXT_LEAD.md`, gets zero hits, and
concludes there is no warning at all. The trap defeated itself on its own check.
On the Lead's account, which is the only source for it and cannot be checked from
the repository, two sessions produced that same "by path" wording independently
from the same sentence with no transmission between them. If that account holds,
the miscitation is reproducible rather than one person's slip.

**A second correction in the same trap, 2026-08-27, and it is the reason a
correction stamp is dangerous.** This trap also said the sibling document "sits
beside it". It does not: it is now at
`_archive/session-letters/LETTER_TO_THE_NEXT_SESSION-2026-08-23.md`. The first
correction above stamped this trap as corrected while leaving that false, which
turns latent staleness into a warranted falsehood, and the warrant is worse than
the error. **Fixing one cell in a table with several wrong entries invites the
next reader to assume the rest were checked** — which is the argument in the
entry below, made by Sam, when he declined a one-line correction for exactly this
reason. The sibling is still referenced by **nothing** on `main`; only its
location was wrong. **As written, this described a live condition. It no longer is,
and the trap is
kept as history rather than deleted.** For a time a session reading §0 carefully
learned to distrust exactly one of two identically shaped documents and trusted
the other *because* the warning was specific, which is worse than no warning.
`#28` closed that instance: the sibling now opens with `> **ARCHIVED 2026-08-27.
Do not act on this document.**` on its first line. **The lesson survives the
repair of its own example** — a caution precise about one file still licenses
trust in its unnamed neighbours, and the next specific warning anyone writes will
recreate the condition unless it says what it does not cover. *Check:*
when a caution names one file at all, by path or by bare filename, look for its
siblings before concluding the caution is exhaustive, and grep for the form it
actually uses rather than the form you expect. Same root as trap 7: the label was
searched, not the thing.

**14. Two conventions in one document.**
`docs/epics.md` uses three-column tables in Epics 4 and 8 and four-column ones in
10 and 11. Two PRs by different authors added a four-column row to a three-column
table; GitHub-flavored Markdown silently drops the extra cell, so the story link
renders nowhere. *Check:* count the header's columns before adding a row. When two
sessions make the same mistake, it is a trap in the document, not carelessness.

**15. A tool that succeeded, read as a state you never checked.** Presents as
a fact about yourself, which is the last place anyone looks for an error. A
Lead was told to take the seat as LEAD-DELTA, called `set_session_title`, saw
it succeed, and reported the new name to four sessions as its **address**.
`set_session_title` writes the title. §4b says the title conforms to the
address and never the reverse, and the Lead had read that section within the
hour. A Reviewer caught it by running `ListAgents`, which showed the address
unmoved. *Check:* **a tool's success tells you the tool ran, never what state
resulted.** Read the state back from the thing that reports it, not from the
act you believe changed it. Generalises past addresses to any write whose
effect you then assert.

**16. A name read as a qualification.** Presents as sensible routing. A Lead
sent the Epic 14 Postgres questions to the session whose worktree was named
`postgres-stack-replacement`, opening with "your session name says you have
been closest to that ground". That session had not read a migration or opened
`lib/data/` all night; the label was assigned at spawn and described nothing.
It refused to produce a plausible answer, which is the only reason the Lead
did not act on one. *Check:* a worktree name, a branch name and a session
title are three independent strings, and none is evidence about what a session
has read. Same root as trap 7: the label was searched, not the thing. **A
plausible answer from the wrong source is indistinguishable from a derived
one**, so the cost lands later and on someone else.

**17. Relaying an order as though the relay carried its authority.** Presents
as coordination. Told to have every session debrief and archive, a Lead sent
that to five peers as an instruction. Archiving is irreversible, so Moment 4's
pre-flight applies, and its fourth item is *who authorized it*, which the Lead
held and did not pass on. Three sessions complied. One refused, correctly, on
Step 5 grounds that a peer cannot carry authorisation, and stayed refused when
told everyone else had complied. **"Everyone else did" is a count, not an
authorisation.** Sam then told it directly and it closed in one message.
*Check:* when you relay an instruction for an irreversible act, name who
authorised it and say that you are relaying. If the answer is "a peer told
me", you are not carrying an order, you are carrying a rumour. Trap 9 is this
from the receiving end; this is the sending end, and it is easier to be wrong
at because relaying feels like helping.

---

## Why this worked, which is not what it looks like

**"Report your own errors first" is a good rule and a bad theory of why the loop
caught anything.** The outgoing Lead insisted on this correction to its own
entry, against its own interest, and it is the most useful sentence in the file:

> I did not say so first every time. The inert guard I did not find; a session
> running the real catch-up found it. The `^run_check` count I did not find; the
> Reviewer did. The stale citation inside Step 2 I did not find; the docs sweep
> did. Three of my four worst were found by someone else, and I only reported
> them first once I had them.

So the mechanism is **redundancy, not candour**. Four sessions on the same
primary sources found what no session found in its own work, including sessions
that were actively looking. Self-reporting is what makes the finding cheap once
it exists; it is not what makes it exist. A session that reads this file and
concludes "I will be scrupulous about my own errors" has taken the wrong lesson
and will still miss the same class, because **every error here was made with care
present at the moment of the error**.

The operational form: if a claim has been produced and checked by one party, it
is unverified, whatever the party's diligence. That is standing order 9, and this
is the evidence for it rather than the assertion of it.

**Record what went right, and treat that as load-bearing rather than as
courtesy.** The temptation when trimming this file will be to cut the
"what it was right about" lines from an entry. Do not. A debrief of only errors
trains the next session to hide them. If the record shows that the session that
shipped an inert guard also held twice against relayed instructions and was right
both times, then reporting your own errors reads as something competent sessions
do, rather than as a confession. That is what makes the traps usable by a reader
who does not yet trust the file.

---

## Entries

### 2026-08-28, LEAD seat, fourth holder, on taking it and clearing the fleet

**Supposed to happen.** Read `NEW_SESSION_PROMPT.md`, take the seat from the
outgoing Lead per §1b, derive state rather than inherit it, then clear the
board before Epic 14.

**Actually happened.** All five sessions debriefed and archived, each with its
loop closed and its ref named. Two PRs merged. Traps 15, 16 and 17 are
promoted from my own errors, and all three were caught by other sessions.

**My errors first, and the ordering is honest rather than modest: every one
was caught by someone else.**

- **I reported my title as my address**, to four sessions, having read the
  section that distinguishes them within the hour. Trap 15. Caught by a
  Reviewer running one command. I sent the correction backwards to the session
  where I had planted it as well as forwards, which is the only part of this I
  would repeat.

- **I asserted `origin/main` from a reading taken at orientation** and
  repeated it to four sessions after it had moved. The same Reviewer caught
  it. **Twice in one hour, on the two facts a Lead has least excuse to guess
  at: its own address and the ref it owns.**

- **I inferred a session's expertise from its worktree name.** Trap 16.

- **I relayed an archive order without its authorisation.** Trap 17.

- **I assigned a Reviewer a PR that the previous Lead had explicitly routed
  away from it**, for a stated conflict-of-interest reason, in the handoff I
  had just read. I did not override it; I did not reach it.

**And the error I was proudest of, which is the one worth reading.** I
re-derived my predecessor's Epic 14 handoff before acting on it. It claimed the
migrations cover neither clients nor locations. I searched for `clients`, found
it, and reported the claim half wrong. Then I searched for `locations`, did not
find it, and reported that half correct: the only genuine schema gap. **A blind
reviewer found the table nine lines from the top of the file I had already
opened.** `003_migrate_firestore_to_postgres.sql` says in its own header that
`locations/{locationId}` migrated to `tenants`, keyed on `location_id`, and that
a second `locations` concept migrated to `ghl_location_tokens`. There is no
gap. **Trap 7, applied correctly to the first half of a sentence and missed in
the second, on a trap promoted from my own predecessor.**

**Which is the whole lesson: catching someone else's error is not evidence that
you checked your own half.** The half I corrected felt like the work. The half I
confirmed felt like agreeing with a check already done, and nothing about it
felt different at the time.

The framing that came out of it survives and is now better founded. "Find out
how much is already built and why nothing uses it" was right, and the answer to
*how much* includes the thing I had just named as missing. What does not survive
is any version of this filed under work I got right. **A session acting on the
sentence I wrote would have created a `locations` table duplicating `tenants`,
which is the split-brain the data-model hook exists to block.**

What I will still claim: I declined `TAG_STALE_OK=1` when `branch-freshness`
refused a commit, and caught the branch up instead.

**The finding that outranks every PR, and it is not mine.** From the Reviewer,
on the way out: four Leads in one night; refs survived every handoff, merged
commits survived, and **routing died every single time**. Each Lead rebuilt
the assignment graph from scratch and each got it slightly wrong. The
staleness problem this fleet spent the night fixing is real and is the cheaper
one. The expensive one is that **who-is-reading-what exists only in whichever
session is currently holding it**, and that session is consumable by design.

Its second half is sharper still: **a handoff that carries a routing decision
should carry it as a decision, in a list, not as a sentence someone has to
notice.** The one I missed was prose in a dense paragraph. It read as
narration.

**And the structural joke, which is the argument for this file.** Every
debrief I collected reached me as a chat message, into a session that is
itself about to be replaced. The mechanism that fixes that is this file, and
it was sitting unmerged in a PR the Reviewer had read four times. **The file
that would have caught it was the file that was not on `main`.** It is now,
and this entry exists because it landed.

**What the next session should do differently.** Traps 15 and 17 cost the most
here and both are about asserting a state you did not read back. Beyond those:
when you take the seat, the first thing to write down is not the board, it is
**who is inside what**. The board regenerates from refs. The routing does not.

### 2026-08-27, the Lead seat, on being replaced

**Written on its behalf, not by it.** This session was replaced before it could
append, and handed its AAR to the Reviewer to preserve. Condensed, not
paraphrased into agreement. Traps 1, 3, 4, 5 and 8 are promoted from it.

**The finding it put first, and it is not a technique.** It had been granted
`main` and kept asking Sam to approve every merge anyway. His answer is trap 1.
The fix was a rule plus a tool: merge reviewed-plus-green-plus-reversible without
asking, escalate only four categories, and `npm run awaiting` prints which PRs are
actually asking a question, generated rather than written.

**Four wrong counts, all from loose matchers, all its own**, including one where
the correct answer was already on screen, and one where it **retracted a correct
number**. Traps 3 and 4.

**A guard it shipped did not work**, because all seven tests called the code and
none exercised the hook that invokes it. Trap 5. Found by a session running the
real catch-up rather than by re-reading, which is trap 6 from the other side.

**It fixed Step 2 and left Step 7**, then left identifiers inside Step 2's own
incident record. Trap 8.

**And it corrected the Reviewer's account of it**, insisting that it had not
reported three of those four itself. See *Why this worked* above; that paragraph
is its correction, not the Reviewer's summary.

**What it was right about, recorded because a debrief of only errors is a lie.**
It caught the guard defending a false record (trap 10). It counted the handoff
family properly, finding eight where the Reviewer found three, and noticed the
second letter nobody had mentioned (trap 13). And it held twice against relayed
instructions that contradicted what Sam had told it directly, and was right both
times (trap 9).

### 2026-08-27, `functions-typescript-build-8fa5d4-db`, Reviewer seat

**Supposed to happen.** Take the Reviewer seat, review four PRs from primary
sources, classify every finding, escalate continuously, touch nothing shared.

**Actually happened.** Four PRs reviewed, four breaks found, all fixed or ruled
on. The three that mattered were all the same shape: a document asserting a state
of the world that a short grep contradicts. A story doc miscounting its own array
while instructing future sessions to reconcile the story's *correct* number to its
wrong one. A story whose entire reason for existing was false, the feature it
called unreachable being two clicks away in the shell. A story claiming six broken
widgets for a role offered four.

In every case the author had opened the right file and stopped one line short. One
cited three line numbers accurately and missed the assertion that contradicted it.
Another read the file containing the answer and stopped above the comment holding
it. **Care was present at the moment of every error.** Only a second reader on the
same primary source catches that, which is the case for the seat.

**My own errors, first.**

- I checked one PR's live state before relaying a ruling, wrote a sentence about
  why that mattered, then did not run the same command against the adjacent PR.
  It had merged seconds earlier. One of four questions I put to Sam described a PR
  that no longer existed. **Applying a lesson to one item and not its neighbour is
  the failure, not the missing command.** Promoted as traps 2 and 8.
- I inferred a wrong count came from the test suite's case count. It came from a
  grep sweeping the type declaration. My theory explained one number and orphaned
  two; the better one explained all three. Flagging it as inference was the only
  thing that stopped it propagating. Promoted as trap 3.
- A `zsh` parameter modifier ate `:l` out of `"$c:lib/..."` and returned zeroes
  twice. I nearly recorded that as a fact about the repo. Shell quirks have now
  twice been mistaken here for findings.
- Three near-misses caught only by checking: a two-dot diff that looked like a
  mass reversion (trap 12), a citation that looked stale until resolved at its own
  baseline (trap 11), and a line number I reused after `main` had moved under it.
- I recommended filing a one-line correction to a wrong `epics.md` cell. Sam
  declined with the better reason: fixing one cell in a table with several wrong
  entries invites the next reader to assume the rest were checked.
- I counted three accumulated handoff documents. There are eight. I asserted the
  smaller number in a commit message before another reader corrected it.

**Why the difference.** The assignment named four PRs from a document; the board
held nine and grew past twenty during the session. Step 2 was perishable, had not
been rewritten before being handed over, and sent me at a PR another session had
held for an hour. That is fixed in the brief now. The deeper version is trap 2:
documents were already known to go stale, and the same defect turned out to live
in questions and relays too.

**What the next session should do differently.** The traps above are the answer,
and 2, 3 and 8 are the ones that cost real time here. Beyond those: attack the
premise before the diff. Both of the night's worst findings were premises, and
both were cheaper to check than the diffs were.
