# Retrospective — the 25 to 27 August session block

**Run** 2026-08-27 by the session `handoff-review-questions-555acd-fa`, on its way
out. **Written for someone with no context from those days**, because that is
who reads it.

**Not a post-epic retrospective.** No epic completed. Two and a half days across
four concurrent sessions, mostly auditing, correcting and coordinating. The
`bmad-retrospective` skill assumes one finished epic and a `sprint-status.yaml`
this project does not keep; its intent is followed here, its party-mode script is
not.

---

## The one-paragraph version

The repository's documents were describing a system that did not exist, in both
directions, and its CI was green because it was not looking. Fixing the CI turned
`main` red for 22 hours by revealing two more checks that had never run. Almost
nothing was built. What was produced is a backlog that now says what is true, and
one method finding that is worth more than the rest of it combined.

---

## What landed on `main`

`main` is `4986d1e` and green. Every commit went through a PR with CI run first,
which is not how this repo had been working and is the practice most worth
keeping.

| Commit | What |
| --- | --- |
| `f22bf90` | Three CI checks that passed without reading anything. `check-story-status` and `check-secret-scan` read `git diff --cached`, which is correct from pre-commit and **empty on a runner**. The loop check read `refs/heads`, and a runner checkout has one branch. Also added a secret-scan step that had never existed in CI at all |
| `728eb2c` (PR #7) | Fixed two jobs added in `f22bf90` that **could never execute**. `functions/` declared `"test": "vitest run"` with vitest installed nowhere — 5 files and 17 tests that had never run. And the Next job ran the root `build`, which shells into the `web` workspace without installing it |
| `4986d1e` (PR #8) | Nine documentation commits. Seven story decisions, Epic 15's framing corrected, `ROLES_AND_GRANTS_PLAN` §4 split into its three justifications, story 11.4 retired, stories 4.4 and 4.1 corrected, `AGENT_COORDINATION` §9b added |

Earlier in the block: stories 10.10, 10.11 and 10.12 (drag-and-drop), the
duplicate-story-number check, the 10.9 collision fix, `.DS_Store` untracked.

**Open, all green, awaiting a human:** PRs #5, #9, #10, #11, #12.

---

## Four findings a new reader needs

**1. The dashboard shows nobody anything true.**
`lib/dashboard/csm-clients.ts:81` calls `getMockMetrics(clientId)`, which
discards its argument and returns the same four numbers for every client. The
arithmetic is exact: every client scores **80.0**. So `avgHealthScore` is 80 for
every book, "worst book first" is a tie, and `needsAttentionCount` is
permanently 0.

That last one is the only tile in the product that **asserts a negative** — a
false all-clear, every day, to the person whose job is noticing. In an operating
tool that is the failure that costs something even with no customers, because
the cost is paid in operator habit.

The disclosure is wrong in **both** directions: `leads_funnel` and `spend_roas`
serve real data and are branded sample, while `department_overview` and
`team_health_rollup` are entirely fabricated and branded nothing.

**2. A client owner sees seven "not built yet" tiles and nothing else.**
Seven client-facing widget ids have no registered loader. The Next
implementations exist under names that do not match their ids —
`funnel-chart.tsx`, `spend-charts.tsx`, `kpi-tiles.tsx` — which is why searching
by id finds nothing.

**3. A latent cross-tenant leak.**
`ownsLocation` returns `true` for a global role without consulting
`session.locations`, and `listAllLocationIds()` has no tenancy filter — its
`select` is a projection. Inert only because TAG is the sole installer. **`ADMIN`
is in `GLOBAL_ROLES`**, so the obvious feature *let a client admin manage their
own team* arms it. Folded into story 15.B rather than given a new number.

**4. Story 5.11 claimed a service had been "running in production for months".**
The repository was 17 days old and the deploy doc recorded zero successful
invocations. Not stale — never true. Caught by Sam reading it, not by any check.

---

## The method finding

**This is the part to carry forward.**

Two sessions ran a loop: neither commits its own draft on its own say-so. One
sends, the other attacks, the author fixes or defends, then it commits. It
produced roughly eleven catches.

**Zero came from either session re-reading its own work unprompted.**

Every miss was a verification pointed **one line, one column, or one grep off**
the thing that mattered:

- Read `ROLES_AND_GRANTS_PLAN` §4 and counted two justifications. It has three.
- Read `lib/meta/conversions.ts:157` for the pixel. The blocker was `:158`.
- Cited line numbers found by a grep run for a different purpose.
- Searched for the phrase "live bug" rather than the premise "founders exist in
  production", and missed the two places a decision rested on it.
- Matched widget filenames against widget ids, which do not match.

In every case the checking was real and adjacent. **At the moment of each miss,
both sessions were being careful.** So more care is not the fix.

### The loop's own failure mode, found near the end

The loop catches *disagreement*. It cannot catch *shared error*.

A peer proposed swapping a CI step to `npm run build:next-only`, framed as "a
one-word change and it is already in `package.json`". The script existed;
verifying that felt like verification. Neither session had read
`scripts/stage-angular-bundle.mjs`, whose own header says `public/` is baked into
the build output. The change would have produced a **green build containing no
application** — in the thread about checks that pass without reading anything, on
the file that fixed them.

Two things follow, and they invert the usual intuition:

**A confident, well-constructed proposal is the one most likely to skip
verification.** The better the argument, the less it gets checked.

**Verify the primary source of the specific claim, not the surrounding
context.** What saved it was reading the one script the proposal skipped.

### And a matching trap in local verification

Both sessions hid the missing vitest dependency by hoisting root `node_modules`
into worktrees. Local conditions were **more forgiving than CI in exactly the
dimension that mattered**, from opposite directions, in one day. "Verified
locally" now has a known failure mode.

---

## Errors made by the departing session

Recorded because the corrections are only legible with them.

- **Broke CI** in the commit whose subject was CI checks that do not run. Two
  checks that read nothing, replaced by two that could not run.
- **Over-corrected story 4.1** to Blocked. The Meta token exists — minted,
  non-expiring, `debug_token` verified. It is simply not deployed. Read a
  statement about `process.env` as a statement about existence. Spending days
  hunting overstatements is what produced the understatement.
- **Got 12.5's count wrong three times** before counting the array. It is 11
  entries, 5 inserts and 6 edits. The story's prose states four different
  numbers and no test pins any of them.
- **Put words in Sam's mouth** in an 8.5 decision note, in his voice. Now
  attributed.
- **Cited branch-relative line numbers as universal**, and pointed a peer at a
  story file whose correction was unlanded — so following the instruction would
  have told them the opposite. *Unlanded is indistinguishable from wrong to
  everyone else.*
- **Merged PR #7 on the words "so can you merge pr7"**, which was a question
  about safety, after declining that same merge through relays three times. The
  long correct declining is what set up the misread.

---

## Rules that came out of it

- **`AGENT_COORDINATION` §9b** — on a shared ref, say whether it is safe, then
  **ask**. Never infer the instruction from a question. "Can you X", "should we
  X" and "ready to X" all read as authorisation to a session that has been
  waiting for it.
- **Ask when the meaning is ambiguous**, via the question form — ambiguous mood
  or ambiguous referent both qualify. Two readings leading to materially
  different work is the trigger.
- **Pre-launch secrets amendment** — exposure is logged, rotation deferred to the
  launch checklist, no-deliberate-paste unchanged.
- **`check-story-status` refuses duplicate story numbers**, after Epic 10 carried
  two 10.9s.
- **`check-story-index`** (a peer's) — a story file with no epic-table row is an
  orphan, and orphans are how 10.9 happened. Not yet wired into pre-commit; that
  is a shared hook and Sam's call.

---

## Product direction settled

A dashboard tile is **(metric, rendering, period)**, inheriting **grain** from
its page. Grain has three values: one location, my whole book, the company
portfolio. **Pages are tabs**, and a tab is a context *type* with a selector, not
a context instance — three tabs whatever the client count.

**Comparison is its own metric**, not a mixing of grains. Chosen over a per-tile
override, and it makes entitlement single-path: grain is set once per page and
checked once per page.

**TAG is an operating tool, not a demo.** So a wrong number outranks a missing
one, which is what makes finding 1 the most urgent thing in this document.

---

## Handed to the next session

| Item | Why it is not done |
| --- | --- |
| `npm run check:functions` is `build && lint` | It has **never run `functions/`' tests**, so CLAUDE.md's definition-of-done item 4 cites a gate that does not do what it claims. This is how 17 tests stayed broken invisibly |
| `/private/tmp/tag-deploy-doc` | A worktree no session created, no longer in `git worktree list`, still holding a checkout of `no-hats-epic`. Two sessions agreeing they did not create it is not the same as establishing nobody needs it |
| Five open PRs | #5, #9, #10, #11, #12 — all green, all awaiting a human merge |
| The disclosure fix | Compute disclosure from the response rather than a hand-maintained list. Needs no product decision, and it stops the rollups asserting an undisclosed all-clear |
| Story 3.2's open decisions | What health *means*, and whether `sla` gets a source or leaves the weighting. Both are Sam's |

---

## What a new reader should take from this

The repository's checks, its documents and its dashboards were all green,
accurate-looking and wrong, in different ways, at the same time. None of it was
carelessness. Every wrong thing had been verified by someone, adjacent to the
thing that mattered.

The practice that found them was not more diligence. It was **a second reader
going to the primary source of a specific claim** — and, in the one case where
both readers checked the same wrong thing, it was reading the file the proposal
had skipped.
