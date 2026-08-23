# Kronos Coordination Loop — Watchpoints & Discipline

Session: claude/loki-kronos-checkin-27bacb (archiving)
Refined by: Master feedback, Check 3 onwards

## Watchpoints — Report immediately if:

1. **Any worktree checking out `main`**
   - Count must stay 0. main is parked, never checked out.

2. **local main ≠ origin/main** (either direction)
   - Divergence is an alarm. They must stay in sync.

3. **Two worktrees on the SAME branch**, OR **any worktree on claude/story-14-1-repository-seam-e557d0 except Master's**
   - Duplicate checkouts violate branch ownership. Only Master owns 14.1.

4. **main moves to unattributed SHA**
   - Movement is expected. Unattributed movement is the alarm.
   - Verify: merged-by-worktree trailer, authorship, what commits are included.
   - Note: All sessions commit as same git author; trailers are the only authorship available.

5. **Any worktree dirty with tracked modifications >1-2 cycles**
   - Uncommitted work in shared trees deletes files on archive. Flag persisting dirt.

## Reporting Discipline

**Report state, not activity:**
- ✓ "14.1: 22c6836, Status=Review, unmerged" (state with evidence)
- ✗ "14.1: stalled" (activity guess)
- ✓ "main: 448b741, origin/main: 448b741, in sync" (state)
- ✗ "main blocked, nothing merged in 33m" (activity judgment)

**Distinguish verified from produced:**
- Report findings produced AND findings verified separately.
- A session producing 4 findings (2 wrong) is more expensive than 1 producing 2 (both held).
- Mark unverified work; completion requires verification.

**Snapshots are stale immediately:**
- Branch tips useful for coordination. Completion claims require verification.
- "22c6836 = complete" must be verified against story Status field, not commit message.

**Don't report stillness as a problem:**
- Idle branches staying idle is normal state.
- Reporting it trains readers to skim; real signals get missed.
- Only report if a watched signal fires (divergence, checkout, dirty tree).

## Earned Signals

**The loop caught: unattributed main move**
- main: 448b741 → 63362a8 (14.1 merge)
- Author field: Leverage Architect (same for all sessions)
- Result: Merged-By-Worktree trailer added to every merge on main
- Lesson: Watchpoints work when calibrated to real problems

**Coordination accuracy improved mid-session**
- Early: Speculative (14.2 "stalled", main "blocked")
- Later: Evidence-based (story Status field reads, SHA comparisons)
- This loop should start at "later" discipline, not repeat early mistakes

## Loop Cadence

**30-minute check-in cycle** (cron job 10502469)
- Context confirmation queries to active sessions
- Watchpoint scan on git state
- Synthesize verified findings only
- Report state + evidence to Secretary

**Purpose:** Scrum master role — unblock sessions, surface coordination gaps, filter for signal vs. noise

## For Next Session

Start with:
1. These five watchpoints (refined, not speculative)
2. Reporting discipline (state, not activity; verified not produced)
3. 30-minute cadence (reduce coordination overhead, give sessions longer work windows)
4. Evidence requirement (ref + SHA + field read, never guesses)

The loop works. It caught a real problem and produced a fix (Merged-By-Worktree trailer). Continue it.
