# Merge Decisions — 2026-08-23

Consolidation decisions recorded. Three sessions with decisions on merge sequence and timing.

---

## Session 1: ghl-multi-account-login-019007
**Branch:** claude/ghl-multi-account-login-019007 @ dcb26e4  
**Decision:** ✅ **READY TO MERGE**

**Commit:** 1 commit, 8 files, docs only, 871 insertions (no code)
- docs/epics.md (Epic 5 rows 5.7-5.10)
- docs/fulfillment-pipeline-architecture.md
- docs/ghl-account-migration-checklist.md
- docs/stories/5.7-stage-sla-deadlines.md
- docs/stories/5.8-sla-breach-sweep-and-escalation.md
- docs/stories/5.9-adjustable-stage-sla-baselines.md
- docs/stories/5.10-opportunity-custom-fields.md
- docs/stories/5.1-onboarding-checklist (appended section)

**Pre-commit status:** Passed (role parity check green)

**Sequence:** 
1. Check for conflicts on epics.md (4 rows added to Epic 5 table)
2. If no conflicts, merge to main
3. Push if needed

**Blocked on:** Nothing. Safe to merge.

---

## Session 2: happy-ritchie-b3dc29
**Branch:** claude/client-subaccount-import-65774f @ 72d426f  
**Decision:** ✅ **MERGE 0b243bc ONLY** | 🔲 **HOLD 4 remaining commits**

**Commits on branch:**
```
72d426f  Record four decisions (Fulfillment location, courses store, notifications, tier climb)
404da84  Courses decision story 11.6, escalations desk story 13.6
cd9bf1b  Read-only Fulfillment audit script, GHL access outreach prompt
de77afb  Open Epic 13
0b243bc  Key agency tokens by company [DEFECT FIX] ← MERGE THIS ONLY
```

**Defect fix (0b243bc) — MERGE:**
- Agency OAuth tokens keyed at `ghl/agency/companies/{companyId}` (was shared, overwrite risk)
- Self-migrating legacy read = backward compatible
- Files: `lib/ghl/store.ts`, `lib/ghl/tokens.ts`, `app/api/oauth/callback/route.ts`, `lib/ghl/store.test.ts`, `lib/ghl/tokens.test.ts`
- Tests pass (425 passing), lint clean, tsc clean

**Before merge:** Run from main checkout to verify functions/ compiles:
```bash
npm run check:functions
```
(Worktree builds are unreliable — no node_modules, build script masked Angular failure.)

**Hold 4 commits (de77afb through 72d426f):**
- Epic 13 stories (13.1-13.6) — wait for post-launch
- Fulfillment audit script — wait for decision on 13.4/13.6
- Fulfillment location decision — wait

**Blocked on:** `npm run check:functions` verification. Gate defect (build masking) needs confirming that the fix actually compiles.

---

## Session 3: handoff-review-questions-555acd
**Branch:** claude/handoff-review-questions-555acd @ 0bf8187  
**Decision:** ✅ **MERGE AFTER REVIEW** | ✅ **COORDINATE FIRST**

**Commits:** 6 commits (fc61ff9-0bf8187)
- Schema: multi-video lessons, reference-doc lessons, hat-scoped visibility
- Migrations 008 and 009 applied to `tag_automation` (live in production)
- Course imports executed
- Authored lessons written (5 CSM lessons)

**Current state:**
- Code committed, gates green
- Database migrations ALREADY LIVE on prod
- Branch not merged to main

**Merge sequence:**
1. **Coordinate conflict check:**
   - Check `docs/epics.md` for edits since f55143b (ghl-multi-account added 4 rows — may conflict)
   - Check `courses`, `course_sections`, `course_subsections` tables for concurrent edits (happy-ritchie drafted story 11.6 — potential touch)
2. **Complete review:** Austyn/Walter sign-off on 5 authored CSM lessons (blocks Epic 12 Done)
3. **Merge to main** (codifies live DB state on trunk)
4. **Update story status:** Mark 12.3, 12.4, 12.5 Done (code + DB live, waiting on review only)
5. **Separate task:** Type two credential placeholders in admin UI (Wistia, Facebook logins) — can happen after merge, not a blocker

**Blocked on:** Austyn/Walter content review. Coordinate check can run now.

---

## Action Summary

| Session | Action | Blocked on | Timeline |
|---------|--------|-----------|----------|
| ghl-multi-account-login | Merge to main | Check epics.md conflicts | Immediate |
| happy-ritchie (0b243bc only) | Merge defect fix | `npm run check:functions` | Immediate (after verification) |
| happy-ritchie (4 remaining) | Hold | Post-launch | Hold |
| handoff-review | Merge after review | Austyn/Walter sign-off + conflict coordinate | When review complete |

---

## Coordination Checklist

Before any merge/rebase:

- [ ] Check `docs/epics.md` — any edits to Epic tables since f55143b? (ghl-multi-account added 4 rows)
- [ ] Check `courses` tables — any concurrent work on courses schema? (happy-ritchie drafted 11.6)
- [ ] Verify 0b243bc compiles: `npm run check:functions` from main checkout
- [ ] Get Austyn/Walter sign-off on handoff-review lessons

---

## Unmerged Branches (Separate from Sessions)

**`deploy-method-guard`** (1 commit)
- Outage docs + cloudbuild.yaml safeguard
- Rebase from fe332b2 to f55143b, then merge
- Priority: 🔴 **URGENT** (protects future deploys)

**`no-hats-epic`** (2 commits)
- Roles/grants design
- Blocked: wait for `product-polish-assessment-d53e4e` to land first (has lib/auth/grants.ts utilities)
- Priority: 🟡 After product-polish merged
