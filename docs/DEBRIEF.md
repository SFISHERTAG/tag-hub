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

**Why it earns a place in a list that says "and only these".** The list meant is
`PEER_SESSION_PROMPT.md` Step 1, and naming it matters: **there are two such
lists and this file is only on one of them.** The other three items there say
what is *true*: the constraints, the method, the standing orders. This is the
only one that says what went *wrong*.

**And the other list is the Lead's, and does not carry this file at all.**
`NEW_SESSION_PROMPT.md` §1 sends a Lead to `CLAUDE.md`, the standing orders and
`docs/data-model.md`, and stops. **So a Reviewer is told to read the traps and a
Lead is not** — including the Lead whose own errors most of the recent ones
are,
and who is the audience for "when you add a trap, extend this list". Recorded
here rather than left in a message, per trap 19, because a routing decision
about a document dies the same way one about a session does. Fixing it is a
one-line edit to a different file and lands on its own.

**Corrected 2026-08-28, twice in one line.** It said "the other four items" and
there are three. And it said this is the only item that does not get longer to
read as it grows. **That was true of a bounded read set and is no longer true of
this one:** the reading list names thirteen traps where it named five, and says
to extend it whenever a trap is added, so the read set is now monotonic in the
size of the file. The bound was bought back by correctness, which is the better
trade and not a free one. **What is still true, and is the actual argument for a
place in that list:** the traps stay distilled, the entries below them stay
optional, and the read set grows far more slowly than the file does. That is a
weaker claim than the one it replaces, and it is the one that survives being
checked.

## How to use this

- **At session start**, read *The standing traps* below. **Corrected 2026-08-28:
  this said to read the first five, on the grounds that the traps are ordered by
  how much they change what you do. They are not, and have not been since at
  least trap 14: new traps are appended chronologically.** Only the first block
  was ever ranked. So read **1-5, 7, 9, 15, 16, 17, 18, 19, 20, 21, 22, 23 and 24**, by number and not
  as a window. **Corrected again the same day: this said "the first five and the
  last five", and adding trap 20 slid that window off trap 15 with no edit to
  this line and nothing in the diff.** Trap 15 is title-versus-address, the
  failure that broke the fleet's protocol layer on 2026-08-27. 7 and 9 are here
  because 16, 17 and 18 define themselves against them. **When you add a trap,
  extend this list.** It breaks loudly now instead of silently. Left as a
  correction rather
  than a rewrite because an author who ranks their own new trap highly and files
  it last has no way to say so under the old rule, which is how this was found.
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
did not act on one. *Check, and it has two halves because a
prohibition alone leaves a Lead with nothing to route by.* **Routing:** a
worktree name, a branch name and a session title are three independent strings
and none is evidence about what a session has read, so ask what it has read
rather than inferring it. **Receiving:** when a request arrives premised on what
you supposedly know, say what you have actually opened and refuse to answer from
a label. **The second half is the one that fired here** — the session refused,
and that refusal is the only reason the Lead did not act on a plausible answer.
Same root as trap 7: the label was searched, not the thing. **A plausible answer
from the wrong source is indistinguishable from a derived one**, so the cost
lands later and on someone else.

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

**18. Correcting half a compound claim, and inheriting the other half.**
Presents as diligence rewarded, because you just found something. A Lead
re-derived a predecessor's claim that the migrations covered "neither clients
nor locations", found `clients` and reported the claim half wrong, then searched
for `locations`, did not find it, and reported that half confirmed. The table
existed under another name, disclosed nine lines from the top of the file
already open. **The half you corrected felt like the work. The half you
confirmed felt like agreeing with a check someone had already done, and nothing
about it felt different at the time.** *Check:* when you break one half of a
compound claim, the other half is now the least-verified thing you are holding,
and it will not feel that way. Say which half you actually ran a command on.
Distinct from trap 7: 7 is searching the label instead of the thing, this is
where attention goes inside a single act of verification.

**19. A routing decision written as prose.**
Presents as a thorough handover. Across four Lead handovers in one night, refs
survived every time and merged commits survived every time; **the assignment
graph died at every one.** Each Lead rebuilt who-reads-what from scratch and
each got it slightly wrong. One handover carried a decision to the effect of
*do not send this PR to that Reviewer, it produced the evidence* as a sentence
inside a dense paragraph. **Reconstructed, not quoted: the handover was a chat
message and no artefact preserves its wording**, which is the trap demonstrating
itself. The
incoming Lead read the paragraph and assigned exactly that pairing within the
hour. It did not override the decision. It did not reach it. *Check:* **a
handover carries routing as a decision in a list, never as a sentence someone
has to notice.** Board state regenerates from refs; routing does not, and it
exists only in whichever session is currently holding it. If you are handing
over, the first thing you write down is not the board, it is who is inside what.

**20. A correction that removes a false ordering, exposing what it hid.**
Presents as a clean fix, and the thing that breaks is never the line you edited.
This file claimed its traps were ranked by impact and told a reader short on
time to take the first five. They had been appended chronologically for some
time. Correcting that to "first five and last five" immediately stranded three
of the last five, each of which defines itself against trap 7 or trap 9, both
inside the newly-skipped band. **The references were always there. The false
rule made them unreachable in a way that looked like coherence**, because
nothing in the unread tail was being read anyway. **And the sharper form, found
when this trap's own arrival
broke the rule it was written about: a skip rule expressed as a relative window
changes what it excludes every time the set grows, with no edit to the rule and
nothing in the diff.** Every stated fact in the rule stays true while the set it
governs moves underneath it, so there is nothing to catch. *Check:* when you
correct a rule about what may be skipped, diff the newly-excluded set against
the newly-included set, and grep the included set for references into the
excluded one. **And never express the rule as a window: name the members.**
Fires on a specific act rather than on all editing, and generalises past reading
order to any gate that carries a skip list: a lint ignore list, a test suite's
skips, a permission boundary. Narrowing what is excluded can surface a
dependency.

**21. A fix that buys correctness by removing a bound.**
Presents as a strictly better version of the rule, because the new rule is true
and the old one was not. The claims that rested on the bound are nowhere near
the line you edited and nothing points at them. This file's reading list said
"the first five", which was bounded and wrong: it stranded a trap and it
misdescribed the ordering. Naming the members instead made it correct and
unbounded, and forty lines earlier the file's stated reason for being read at
all was that it *does not get longer to read as it grows*. **Correct rule, and
the argument for reading the file no longer held.** *Check:* when a fix replaces
a bound with an enumeration, a cap with a rule, or a fixed cost with a growing
one, grep the whole document for the properties the bound was carrying, not for
references to the thing you changed. Trap 20 finds references out of a set. This
one is about assertions elsewhere that were true only because the set was
capped.

**22. A three-dot diffstat read as what a merge would bring.**
Presents as the correct command, because it is: trap 12 is right that
`main...branch` is the PR and `main..branch` is not. The newer half is that
three dots diff from the *merge base*, so content that landed on `main` and on a
stale branch independently still reads as a branch addition. A branch's diffstat
claimed 793 lines of new code; `git rev-parse branch:<path>` and
`git rev-parse origin/main:<path>` returned the same blob for all three files
and a merge would have brought none of it. It ran the other way too: three files
showed as additions that were *resurrections* of files `main` had deleted, and a
diffstat renders those identically. *Check:* for every path in the three-dot
diff, compare the two blob SHAs, and test existence with `git cat-file -e` on
both sides before comparing. Identical blob means the branch contributes nothing
there whatever the stat says. This corrected two of five branch dispositions.

**23. A shell fallback that never fires, because the command prints on
failure.**
Presents as a defensive one-liner. `x=$(git rev-parse origin/main:$f || echo
ABSENT)` does not yield `ABSENT` for a missing path: `git rev-parse` exits
non-zero *and* echoes its argument to stdout, so `x` holds the literal string
`origin/main:missing.ts` and every downstream test reads it as a real value. An
absent file was reported as present-and-differing across a whole branch table,
and the check had already been recommended to another session as the one that
works. *Check:* before trusting a fallback, run the command on a case you know
fails and look at stdout, not only at the exit code. **A command that prints
something on failure defeats `||` silently**, and the wrong answer it produces
is the safe-sounding one. Same shape as trap 6, applied to a one-liner rather
than to a test suite.

**24. A branch delete that leaves its undo reachable only by a local ref.**
Presents as a closed loop, correctly closed, with the undo written down. The
four outcomes in `CLAUDE.md` treat "delete it" as terminal, and a session that
deletes a reviewed branch and records its SHA has done everything the rule asks.
**The SHA is then held by nothing that anyone will ever look at again.** After
`git push origin --delete`, the commit survives locally as
`refs/heads/<branch>` with `track=[gone]`, and: `npm run loops --remote` is
remote-scoped and does not report it, `git branch -r --contains <sha>` is empty,
and `git branch -D` on a `[gone]`-tracking branch is the ordinary tidy-up
gesture every session performs without thinking. One of those drops the last
name and the commit is reflog-only until gc. **Writing the SHA in a message or a
handover is not a mitigation: a transcript is not a ref**, and the session
holding that transcript is the one about to be replaced. *Check:* if a deleted
branch's history is worth an undo at all, the undo is `git tag closed/<branch>`
**pushed to origin**, verified with `git ls-remote --tags origin` and its `^{}`
dereference, not `git tag --contains`, which reads identically for a
local-only tag. If it is not worth a tag, say the undo is disposable rather than
recording a SHA that implies otherwise. Observed 2026-08-31 on
`claude/product-polish-assessment-d53e4e`; the tag now holds `e0f96fc`.

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

### 2026-08-31, REVIEWER seat, one branch disposition and a trap I had been warned about

**Supposed to happen.** Spawn from `PEER_SESSION_PROMPT.md`, take a unit from
the Lead, review it, report. The unit was the disposition of
`claude/product-polish-assessment-d53e4e` @ `e0f96fc`: three questions, auth
first.

**Actually happened.** The auth question answered and held, the branch closed by
deletion rather than merge, and two of the three questions dropped by the Lead
once the first settled it. **One finding of mine came after the verdict and was
worth more than the verdict**: the delete left the undo reachable only by a
local ref, which is now trap 24 and now a pushed tag.

**My errors first.**

- **I fell into trap 23 after being warned about it by name, in the message that
  assigned me the work.** The Lead's own hand-over said, in terms, do not use
  `git rev-parse ... || echo ABSENT` to test for a missing path, use
  `git cat-file -e`. I wrote `bb=$(git rev-parse "$B:$f" 2>/dev/null) || bb=MISSING`
  in my first blob-compare anyway, inside a loop that also mis-split a path
  containing `[clientId]`. It returned `identical=0 differing=1 total=53`.
  **I caught it because that arithmetic is impossible, not because I checked
  the instrument**, and if the numbers had been plausible I would have sent the
  Lead a false 38/15 split as my first substantive finding. The rewrite used
  `git rev-parse --verify --quiet` and a `while IFS= read -r` loop. **The lesson
  is not that trap 23 needs writing down. It was already written down, and it
  had been said to me in a sentence I had read minutes earlier.** A trap you
  have been warned about is not thereby a trap you will avoid, and this is the
  argument for adding 23 to the reading list rather than leaving it in the tail.
- **I cited a defect by a range that did not contain its own line.** I reported
  the bare `"tag_exec"` literal at `lib/auth/admin.ts:176-178`; the line is
  `:177`. My range contained it, so nobody was misled, but it is trap 11's
  shape and I produced it in the same message where I was correcting someone
  else's coordinates. Conceded the range only, not the finding, per Step 4.
- **I overstated a risk and had to retract the framing while the finding
  stood.** I told the Lead the residual `[gone]` ref would "never" be reported
  and framed the exposure as permanent. It was one `git tag --push` from
  closed, and the Lead closed it in minutes. The gap was real; my account of
  its permanence was not. **Retracted explicitly rather than letting the good
  outcome cover it**, which is trap 4 pointed at my own framing.

**What went right, kept because a debrief of only errors trains the next session
to hide them.**

- **Re-derived the Lead's two unchecked findings before reading its reasoning**,
  per standing order 9. The 38/15 split and the 15-file list were both exactly
  right, which is a real result and is reported as one rather than folded into
  agreement.
- **The auth answer survived `main` moving 21 commits under it.** Seven hours
  passed mid-unit. Rather than assume nothing had moved, I compared the six
  relevant blob hashes at the old and new `main` and re-ran the whole split.
  All six identical, split unchanged, zero delta. **That is the check that
  would have caught it had auth moved**, and it is why a seven-hour-old finding
  was still actionable.
- **Reproduced the Lead's guard result instead of accepting it.** It told me
  `check-role-strings` exits 1 on the branch's `admin.ts`. A confirmation is a
  claim, so I planted the file, watched the guard exit 1 naming
  `lib/auth/admin.ts:177`, and restored. **Seen going red, not only green.**
  That also produced the off-by-one correction above, against myself.
- **Held the scope statement when it would have been easy to widen it.** Two of
  the fifteen files were `app/api` callers I never read. The auth conclusion is
  `lib/auth/*`-only and says so, on a branch nobody will reopen.
- **Refused three things and said so each time.** Did not execute the branch
  delete (Step 6, not my branch); did not open `#56`/`#57` once the Lead ruled
  a guard question leaves my unit; did not resolve the AAR-versus-no-push
  conflict myself, and put it back as three named options rather than picking
  one quietly.

**Why the difference.** The unit shrank because the first question answered the
other two, which is the Lead sequencing correctly rather than anything I did.
The one thing I added past the assignment came from verifying that the verdict
had been *executed* rather than accepting that it had, and that is the general
form: **the check after the close found more than the review did.**

**What the next session should do differently.**

1. **Validate the loop before the finding.** Every error above is an instrument
   error, not a reasoning error. The blob-compare, the citation range, the
   permanence claim: three instruments, none checked before use, one caught by
   luck. Trap 6 says this and I still shipped a matcher whose totals did not add
   up.
2. **Treat "I was told about this trap" as no protection at all.** See the first
   error. The warning arrived in the assigning message and did not fire when the
   moment came.
3. **Check that a close actually closed.** After a branch delete, run
   `git branch -r --contains <sha>` and `git ls-remote --tags origin`. The
   four outcomes in `CLAUDE.md` do not distinguish a delete that preserved its
   undo from one that stranded it, and both render identically in
   `npm run loops`.

**Promoted upward:** trap 24, the branch delete that strands its own undo. I
also **added 23 to the reading list**, on the first-hand evidence in my first
error rather than on my judgement of its importance.

**Left for someone else to rule on, not decided by me: trap 22 is not in the
reading list either.** Traps 22 and 23 were both appended without the list being
extended, which is the file's own rule going unapplied twice. I have direct
evidence for 23 and none for 22, so adding 22 would be me asserting importance
for a finding I did not make. **Flagging it rather than fixing it, and naming
that this is exactly trap 8's shape**: one instance of a class fixed, its
neighbour left. Whoever authored 22 should rule.

### 2026-08-29, REVIEWER seat, on a night of documents and one guard

**Supposed to happen.** Spawn from `PEER_SESSION_PROMPT.md`, review what the
Lead handed over, and get to code.

**Actually happened.** Twenty-six findings across six documents and a branch
table, then one guard shipped. `scripts/check-story-status-parity.mjs` is on
`main`, wired at `ci.yml:90` and `.githooks/pre-commit:80`, and green. **Eight
hours produced one file of software.** Sam said so before either session did,
and he was right: the loop is not the product.

**My errors first, and the first one poisoned other sessions' work.**

- **I built a broken instrument, recommended it, and it was adopted before I
  found the bug.** My blob-comparison loop used `git rev-parse ... || echo
  ABSENT`, which never fires, so a file absent on `main` read as
  present-and-differing. I had called it "the check that works" in a report the
  Lead acted on. Promoted as trap 23. **Found because two of my own commands
  disagreed ten minutes apart, not by re-reading anything.**
- **Three parsers wrong before one was right**, surveying `docs/epics.md`. The
  first read the last column, which is `Doc` in five four-column tables and
  `Status` in twelve three-column ones — trap 14 — and returned filenames as
  statuses. The second used `\b` in `sed -E`, unsupported here, giving 41 false
  positives against a true 10. Only the third was validated by planting.
- **I hardcoded the status vocabulary into the guard, one turn after diagnosing
  that exact defect elsewhere.** I had just reported that `web/`'s widget
  registry mirrors `lib/`'s with nothing enforcing it. Then I wrote a second
  copy of the status list into a script. It was already stale when I pushed
  it — it carried `Unblocked`, which the vocabulary branch had removed. The
  guard now reads the list out of `docs/epics.md`.
- **I reported a severity I had not measured**, saying a finding's harm "might
  be nil" where one command showed it total.
- **I was wrong about sequencing and the Lead was right.** I argued a rule
  removal must land before its replacement; landing both together was correct,
  and the defect I predicted appeared by a different route I had not seen.
- **I nearly filed a survey against a `main` that had moved under me** mid-pass,
  and caught it only because `git for-each-ref --contains` listed a branch I
  expected to be unmerged as already on `origin/main`.

**What went right, kept because a debrief of only errors trains the next session
to hide them.** A claim that `locations` was a Postgres schema gap had reached
Sam twice and was false — `003_migrate_firestore_to_postgres.sql:9-11` says it
migrated to `tenants`. A branch that looked like new work would have resurrected
three files `main` deliberately deleted. The NATO callsign scheme could not have
worked, because it needed a name's history and a session title is mutable state
with no history. And the thing I am most sure of: **three times I declined —
declined to edit a section I had found the defect in, declined to open its
tracking issue, declined to judge two traps I had authored.** Standing order 9
held every time, and it cost nothing.

**Why the difference.** Every document finding was real and none of it was
software. The Lead named this correctly: it set seven document units and one
code unit, and stopped the code one after three commands. **But a Reviewer that
never says "this is meta-work" is also part of it, and I did not say it until
Sam did.**

**What the next session should do differently.** **Say what a unit is for before
you start it, not after.** Every unit tonight was well-scoped and correctly
executed, and the aggregate was eight hours of documents about documents. The
scoping question — *does this produce software* — was never asked by either
seat until the principal asked it. Ask it at the top of each unit and be
willing to answer no out loud.

Traps 22 and 23 are promoted from this entry: a three-dot diffstat read as what
a merge brings, and a shell fallback that never fires. Both are mine and both
changed real dispositions.

### 2026-08-28, LEAD seat, fourth holder, on taking it and clearing the fleet

**Supposed to happen.** Read `NEW_SESSION_PROMPT.md`, take the seat from the
outgoing Lead per §1b, derive state rather than inherit it, then clear the
board before Epic 14.

**Actually happened.** All five sessions debriefed and archived, each with its
loop closed and its ref named. Two PRs merged. Traps 15 to 18 are promoted
from my own errors, every one caught by another session rather than by me.
**Trap 19 is not mine**: it is the outgoing Reviewer's finding, promoted here
because it outranks anything I found, and my own error in that range is the one
at the bottom of the list below.

**The register of this entry, because the file's own argument is that a document
is not evidence, including itself.** Most of what follows is my account and no
successor can check it: which sessions said what, that five were archived, that
an order was relayed and refused, and what Sam said in reply. Trap 17 in
particular asserts what Sam did, and trap 9 in this same file says a relayed
"Sam said X" is not authorisation — so read it as a record that one occurred,
never as one. **What a successor can check from refs is narrower and is named
here so the two are not read in the same register:** the `locations` correction
against `003_migrate_firestore_to_postgres.sql`, that `TAG_STALE_OK=1` exists in
`scripts/check-branch-freshness.mjs`, and trap 15's §4b citation, whose
underlying mechanism was established by an experiment recorded in
`AGENT_COORDINATION.md` before my tenure and therefore does not rest on me at
all. An AAR is supposed to carry what refs cannot. It is not supposed to sound
like refs while doing it.

**Traps 18, 20 and 21 are unverified, and are marked here rather than left to
look like the rest.** The blind reviewer on this entry supplied the check and
the
framing for both, and abstained on their substance under standing order 9; I
wrote them up, so nobody entitled to judge them has. **That is the honest end
state of a two-session loop: the last thing it produces has no independent
reader, and saying so beats manufacturing one.** Treat all three as proposed
rather
than paid for until a session that authored none of them has attacked them.

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

**What the next session should do differently.** Traps 18 and 19 are the two I
would hand over if I could hand over only two, and both are above this line in
the traps section rather than asserted here, because a ranking stated inside an
entry is a ranking nobody reads. Beyond those:
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
