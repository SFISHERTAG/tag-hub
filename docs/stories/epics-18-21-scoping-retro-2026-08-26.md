# Retrospective — Epics 18-21 scoping (2026-08-26)

**Not a code epic.** No story was implemented. The unit of work was the scoping of
the operator-side action layer, and the mechanism under review is the two-session
adversarial loop between `functions-typescript-build-8fa5d4` and
`handoff-review-questions-555acd-fa`.

Branch: `claude/marketer-com-discovery-055059`. Held unmerged pending PR #7.

| Commit | What |
| --- | --- |
| `3f584af` | `docs/action-contract.md` and the verb inventory |
| `ca4032c` | `META_SYSTEM_USER_TOKEN` mounted in `cloudbuild.yaml` |
| `c0c26c5` | `scripts/check-story-index.mjs` and the missing 14.B table row |
| `f31cb61` | Epics 18-21, Epic 17 amended |
| `597a746` | 18.2 replaced after the phantom-prerequisite finding |

## What the loop was

Two sessions, one drafting and one attacking, neither committing its own draft on
its own say-so. Six exchanges. Each side named its own weakest claims when handing
over, on the theory that flagging a claim for someone else to attack is what makes
you look at it.

## What it caught

Four defects, none of which the drafting session would have found alone:

1. **18.7 had no OAuth scope.** `lib/ghl/oauth.ts:17-28` requests ten scopes and
   none is messaging-shaped. Adding one does not grant it to existing tokens, so
   every installed location must re-consent, and Story 1.2 is itself blocked on
   GHL account consolidation. Reshaped the epic: messaging left Epic 18 entirely
   and became Epic 21 with both blockers named.
2. **18.2 was a phantom prerequisite.** The draft claimed the Angular widget layer
   needed a write path built. `WidgetHost` passes nothing to the widget it renders
   and every widget already fetches through its own typed service, so a write is
   architecturally identical to a read. Epic 18 was blocked on nothing. **A wrong
   dependency is worse than a missing one: nobody goes looking for work that is
   already listed.**
3. **The Meta token was never deployed.** `lib/meta/client.ts:51` requires it,
   `cloudbuild.yaml` never passed it, and `--set-env-vars` would wipe a manual fix.
   Every Meta call was dead in production while Story 4.1 read "Unblocked".
4. **Story 14.B had no row in any epic table.** Implemented 2026-08-23, Status
   Review, on six refs, invisible to the index everyone reads. That is the defect
   that duplicated 10.9.

## What it cost

Six exchanges to produce four epics, and roughly four of them were spent
cross-checking rather than scoping. Recorded as a real cost, not written off.

## The recurring failure, named specifically

Three times one session scoped against the layer it had read. Twice it was the
peer, twice this session, once caught before the other got there.

This session's version has a mechanism worth naming rather than generalising:
**grep answers whether a string is present, and absence of a string was treated as
absence of a capability.** "No action handling in `WidgetHost`" was true and the
conclusion drawn from it was false. Read the file when the question is what
something is capable of.

The peer's version: branch-relative line numbers cited as universal, and a story
correction recommended as a source while it sat unlanded on a local branch, so
following the recommendation would have returned the stale opposite.

## Decisions recorded

- **Control model: both.** Epic 17 stays automated, Epics 18-20 are
  operator-driven, and automation is a layer over the operator verbs. The
  constraint that makes that real rather than aspirational: 17.5 and 17.7 call
  Epic 19's service layer and never build a second Meta client. This is the
  `functions/src/ghl.ts` versus `lib/ghl/` lesson applied before the duplicate
  exists.
- **Confirm every write**, with the habituation tension recorded in the contract
  rather than silently accepted. Uniform confirms protect the trivial write by
  degrading the confirm on the one that matters. Tripwire, not an opt-out.
- **Action channel: a shared action bar** reading the definition `WidgetHost`
  already computes. Chosen over passing inputs down because it costs almost
  nothing and puts the confirm in exactly one component.

## Named risk carried forward

**Unlanded work stays invisible.** The peer holds seven commits of doc structure on
a local branch; this session holds five. Four of six exchanges existed to discover
which of us could see what. `docs/AGENT_COORDINATION.md` already says a reading
seconds old is a guess; this session shows the same is true of a document one
branch away. A rule that is not on `main` does not exist, and neither does a story.

## Action items

| Action | Owner | Status |
| --- | --- | --- |
| Create the `meta-system-user-token` Secret Manager entry from a terminal | Sam | open |
| Decide whether `check-story-index.mjs` joins pre-commit | Sam | open |
| Decide which epic owns the wider `process.env` sweep; Epic 14 does not | Sam | open |
| Google Drive: write surface, or a footnote on the one-surface claim | Sam | open |
| Land `docs/land-tonights-decisions` so its structure is readable to other sessions | peer session | open |
| Read the GHL v2 API before 18.5-18.8 are sized; every verb assumes one call | next session | open |
