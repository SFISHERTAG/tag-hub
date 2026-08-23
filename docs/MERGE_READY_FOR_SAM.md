# Merges Ready to Land — 2026-08-23

Two branches staged and verified. Waiting on shared ref coordination.

---

## Step 1: GHL Defect Fix (0b243bc) ✅ READY

**Commit:** 0b243bc "Key agency tokens by company so one outside install cannot take the portfolio down"  
**Status:** Cherry-picked to `merge-ghl-defect-fix` branch in functions-typescript-build worktree  
**Gate:** `npm run check:functions` ✅ PASSED

**To land:**
```bash
# From main checkout
git pull origin main
git merge 0b243bc
git push origin main
```

**Undo if needed:**
```bash
git revert 0b243bc
```

---

## Step 2: Happy-Ritchie Full Branch (de77afb-72d426f) ✅ READY

**Commits:** 5 commits on branch `claude/client-subaccount-import-65774f`
- de77afb: Open Epic 13
- cd9bf1b: Fulfillment audit script + outreach prompt
- 404da84: Stories 11.6 (courses decision), 13.6 (escalations)
- 72d426f: Four decisions recorded
- Plus 0b243bc: GHL tokens defect (merged in step 1)

**Status:** Branch exists on origin, not merged to main  
**Gate:** Pre-commit passed (role parity), all docs

**To land (after step 1):**
```bash
git checkout main
git pull origin main
git merge origin/claude/client-subaccount-import-65774f
# Conflict resolution: accept happy-ritchie changes on docs/epics.md and docs/data-model.md
git push origin main
```

**Conflicts expected:**
- `docs/epics.md` — resolves: take happy-ritchie's adds (Epic 13 rows)
- `docs/data-model.md` — resolves: take happy-ritchie's corrections

**Undo if needed:**
```bash
git reset --hard origin/main
```

---

## Step 3-4: Handoff-Review & GHL-Multi (pending steps 1-2)

Once steps 1-2 land, the other two branches rebase cleanly:
- Handoff-review awaits Austyn/Walter review
- GHL-multi has no gate blockers

---

## Shared Ref Blocker

`main` is currently checked out in `.claude/worktrees/onboarding-endpoint-auth`. 

**To unblock:** That worktree needs to switch to a different branch (e.g. `git checkout onboarding-endpoint-auth` from that location), freeing the `main` ref for this worktree's merge.

Or: execute merges from the main checkout directly.

---

## Verification

Before final merge, confirm:
```bash
git log --oneline main..merge-ghl-defect-fix
git diff --stat main merge-ghl-defect-fix
```

Should show: 5 files changed, 397 insertions(+), 21 deletions(-)

---

## Decision Tree

**If executing merges:**
1. Free `main` ref by switching onboarding-endpoint-auth worktree
2. Run step 1 merge (0b243bc)
3. Run step 2 merge (happy-ritchie), resolve conflicts per above
4. Rebase handoff-review and ghl-multi onto updated main
5. Verify all three landed cleanly

**If deferring:**
- Branches stay on origin
- Step 1 can land anytime (no dependencies)
- Step 2 depends on step 1
- Steps 3-4 depend on steps 1-2
