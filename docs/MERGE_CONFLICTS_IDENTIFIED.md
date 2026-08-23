# Merge Conflicts — Identified 2026-08-23

Three branches will have merge conflicts on shared files. Merge sequence matters.

---

## Conflict Zones

### 1. `docs/epics.md` — **HIGH IMPACT**

**All three branches edit this file:**

| Branch | Commit | Changes |
|--------|--------|---------|
| ghl-multi-account | dcb26e4 | Epic 5 table: adds rows 5.7, 5.8, 5.9, 5.10 + architecture note |
| handoff-review | 0bf8187 | Epic 12 table updates (12.3, 12.4, 12.5 new stories) |
| happy-ritchie | 72d426f | Epic 13 table updates (13.1-13.6 new stories) + Epic 1.2 edit |

**Conflict type:** Additive (each adds different Epic rows). Rebaseable if done in sequence.

**Safe merge order:** 
1. happy-ritchie first (adds Epic 13 rows 13.1-13.6)
2. Then handoff-review (adds Epic 12 rows 12.3-12.5)
3. Then ghl-multi (adds Epic 5 rows 5.7-5.10)

Each rebase will pull the prior Epic table updates and add its own rows.

---

### 2. `docs/data-model.md` — **MEDIUM IMPACT**

**Two branches edit this file:**

| Branch | Commit | Content |
|--------|--------|---------|
| handoff-review | 0bf8187 | Course schema updates (multi-video, doc-links, visibility) |
| happy-ritchie | 72d426f | **Corrections + decisions** (Firestore authoritative claim was wrong, 003 migration details wrong, courses table migration decision) |

**Conflict type:** Semantic (happy-ritchie corrects claims, handoff-review adds schema). Real conflict risk.

**Safe merge order:** 
1. happy-ritchie MUST merge first (it corrects the doc's falsehoods)
2. handoff-review second (builds on corrected foundation)

If handoff-review merges first, happy-ritchie's corrections will conflict on the corrections themselves.

---

### 3. `lib/ghl/` — **NO CONFLICT, HIGH CARE**

**Only happy-ritchie touches this:**
- lib/ghl/store.ts (defect fix: agency tokens keyed by company)
- lib/ghl/tokens.ts
- lib/ghl/store.test.ts (new)
- lib/ghl/tokens.test.ts

No other branch reads/writes it. But this is the defect fix that gates one merge decision.

**Gate:** `npm run check:functions` must pass before merge.

---

### 4. `lib/course/` & course routes — **SOFT CONFLICT**

**handoff-review touches these:**
- lib/course/db.ts
- lib/course/*.ts (visibility, types, seed, import, etc.)
- app/api/courses/* routes
- functions/sql/008_course_subsection_media.sql
- functions/sql/009_course_visibility.sql

**happy-ritchie drafts story 11.6** (courses store decision) but doesn't yet touch code. Once 11.6 is implemented, it will touch lib/course/.

**Conflict risk:** Low now (11.6 is drafted, not coded). Medium after 11.6 implementation starts.

---

### 5. `docs/stories/` — **NO CONFLICT**

Story ranges don't overlap:
- ghl-multi: 5.7, 5.8, 5.9, 5.10 (new files)
- handoff-review: 12.3, 12.4, 12.5 (new files)
- happy-ritchie: 11.6, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6 (new files)

---

## Safe Merge Sequence

### Step 1: happy-ritchie defect fix (0b243bc) — MERGE INDEPENDENTLY

**Commit:** 0b243bc "Key agency tokens by company"  
**Files:** lib/ghl/store.ts, tokens.ts, tests  
**Gate:** `npm run check:functions` ✅  
**Blocker:** None. Merge immediately after gate passes.

```
git fetch origin
git checkout -b merge-ghl-defect origin/claude/client-subaccount-import-65774f
git reset --soft HEAD~4  # Back to 0b243bc
git commit -m "..."  # Rewrite as clean, standalone commit
git checkout main
git merge merge-ghl-defect
```

### Step 2: happy-ritchie full branch — MERGE AFTER defect

**Commits:** de77afb, cd9bf1b, 404da84, 72d426f (de77afb-72d426f on top of 0b243bc)  
**Gate:** All story docs, 0b243bc already merged  
**Blockers:** None code-side (docs only after defect)

This merge corrects data-model.md before handoff-review rebases.

### Step 3: handoff-review — REBASE after happy-ritchie

**Branch:** 6 commits (fc61ff9-0bf8187)  
**Rebase onto:** main (after happy-ritchie merges)  
**Conflicts:** docs/epics.md and docs/data-model.md  
**Resolution:** Accept handoff-review's course schema changes (happy-ritchie provides corrected foundation)

Handoff-review adds schema; happy-ritchie added corrections. Both land cleanly.

### Step 4: ghl-multi-account — REBASE after handoff-review

**Branch:** 1 commit (dcb26e4)  
**Rebase onto:** main (after handoff-review merges)  
**Conflicts:** docs/epics.md only  
**Resolution:** ghl-multi adds Epic 5 rows; happy-ritchie added 13.x, handoff added 12.x. All three coexist.

---

## Gate Verification

Before executing merges:

- [ ] `npm run check:functions` passes (gates 0b243bc merge)
- [ ] Austyn/Walter review complete (gates handoff-review merge)
- [ ] `git merge --no-commit --no-ff` dry-run on each rebase to confirm conflict resolution
- [ ] docs/epics.md has all three Epic regions intact post-rebase

---

## Execution Order

1. ✅ Merge 0b243bc (defect fix) — no dependencies
2. ✅ Merge happy-ritchie full (stories 11.6, 13.1-13.6) — corrects data-model.md
3. 🔲 Rebase + merge handoff-review (stories 12.3-12.5) — builds on corrected data-model
4. 🔲 Rebase + merge ghl-multi (stories 5.7-5.10) — final epics.md update
5. 🔲 After: `deploy-method-guard` and `no-hats-epic` (unrelated to these three)

---

## Undo Plan

If a merge goes sideways:

```bash
# Undo last merge
git reset --hard HEAD~1

# Or revert cleanly
git revert -m 1 <merge-commit>
```

All three branches exist on origin. Easy to re-attempt.
