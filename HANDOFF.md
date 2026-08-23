# Handoff: Research Assistant Role — Session Status

## What's Done

**All primary tasking completed and reported to Master:**

1. **Task 1: Firestore Audit Verification** (0518b32)
   - Re-derived independently from call sites
   - Found 6 disagreements with Master's initial audit
   - Identified 1 data-integrity bug: `create()` operation missing from operations table
   - Result: Master's audit was correct; corrections landed at 23eb5d0

2. **Task 2: Gemini Branch Inventory** (claude/gemini-backend-orchestration-954818)
   - Branch is a point-in-time snapshot, 19 commits behind main
   - 14.1 docs superseded by Master's work
   - 17.1 story contradicts main's version (incompatible rewrites, not mergeable)
   - Verdict: Do not merge; leave branch parked

3. **Task 3: Integrity Checks + Orphan Detection**
   - Check 1 (role strings): PASS — no inline comparisons; verified with PCRE mode
   - Check 2 (frontend boundary): PASS — four integration modules (ghl/meta/drive/slack) correctly isolated; widget-loaders.ts is sole exemption
   - Check 3 (story status): PASS — sampled 15 of 78 stories; no systematic drift
   - FieldValue.increment: NOT used (three sentinels ARE live: arrayUnion, serverTimestamp, delete)
   - Orphans: 2 stale worktrees (/tmp/), 1 stash (52 .angular artifacts), 15 dead Postgres tables in migration 003
   - Data-model drift: csm table row is stale (same pattern as clients table issue)

4. **External Research (4 questions)**
   - Firebase custom claims byte limit: **1000 bytes** (verified at firebase.google.com/docs/auth/admin/custom-claims)
   - Google OAuth Calendar scopes: sensitive or restricted? **Not documented in public docs; must verify in GCP project OAuth configuration**
   - GHL API calendars.write scope coverage: **Not documented publicly; raise support ticket**
   - GHL sub-account transfer mechanics: **LC Phone transfers clean; Twilio requires three-party coordination; agency sub-accounts cannot transfer**

5. **Story 14.B: Inline Role String Audit** (ed0ed50)
   - Three live violations found and assigned to owning stories
   - Ten legacy violations documented (expected-to-vanish with Story 10.7)
   - One false positive documented
   - Root cause: pre-commit hook is diff-scoped (correct for commit gate, silent about tree-wide enforcement)
   - Periodic scanner proposal included

## Key Learning

**The artifact gap:** Across five instances in this session, the pattern was identical: reasoning was sound, but the artifact didn't carry it. Described a check instead of running it. Reported a headline number instead of recomputing it. Summarized a story instead of writing it.

**The fix:** Produce the artifact first, then describe it. Before reporting "clean", validate that your check can find a planted violation. Do not hand over a description; hand over a path and SHA.

**Methods that failed silently:**
- `git grep -E` with `\s` (POSIX ERE has no `\s`; use `-P` for PCRE)
- Comment filtering with `grep -vE '//|/\*|\*'` (too broad; removes legitimate code lines)
- Patterns that only look for comparisons (miss roles in object values, array literals, claim objects)
- Spot-checking 3 of 78 stories and calling it a clean bill; labeled honestly as a sample when reported

## Current Status

- **Worktree:** claude/research-assistant-role-422273
- **Head:** ed0ed50 (Story 14.B committed)
- **Tree state:** Clean (nothing staged, no uncommitted changes)
- **Awaiting:** Master's review of Story 14.B and next tasking

## Next Steps

1. **Check in with Master** via SendMessage. The session is awaiting their review of the story and direction on what to work next.
2. If Master approves Story 14.B, the violations are owned by their respective stories and no fixes belong in this story.
3. If Master has new tasking, follow the same principle: produce the artifact first, report the path/SHA second.

## To Master (if you're reading this as context)

This session completed all assigned work. The story is written, committed, and ready for review at ed0ed50. All findings are documented with source citations. No violations were fixed (as instructed; they belong to their owning stories).

The key behavioral correction this session absorbed: do not describe what should exist. Produce it, commit it, hand over the path and SHA.
