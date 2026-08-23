# Consolidation Status — 2026-08-23

Three complete sessions archived. Three active sessions with in-flight work consolidate here. Document captures all open loops from peer sessions so nothing is lost when they merge or wind down.

---

## Active In-Flight Work

### Session: ghl-multi-account-login-019007
**Branch:** `claude/ghl-multi-account-login-019007` @ f55143b (0 ahead/behind main)  
**Status:** ACTIVE — Sam working live, re-pointing stories

**Uncommitted docs (DO NOT COMMIT, merge decision pending):**
- `docs/fulfillment-pipeline-architecture.md` (262 lines, new)
- `docs/stories/5.7-stage-sla-deadlines.md` (Draft, 0 tasks checked)
- `docs/stories/5.8-sla-breach-sweep-and-escalation.md` (Draft, 0 tasks checked)
- `docs/stories/5.9-adjustable-stage-sla-baselines.md` (Draft, 0 tasks checked)
- Edits to `docs/epics.md` — Epic 5 table rows added for 5.7, 5.8, 5.9

**What the architecture decided:**
- 20 custom fields (not 15) — seven derivable from system, five from code's STAGE_TASKS that sheet omitted
- GHL workflows own stage rollup (not backend), running natively per location in `"Template Do Not Delete"` provisioning snapshot
- Backfill manual per client; leave field empty rather than guess dates
- Open question 3: can GHL workflow trigger on opportunity custom field change and write stage? Rollup design assumes yes. Needs 10-minute validation in GHL workflow builder.

**Decisions made:**
- Courses move to Postgres (acceptance criterion: aggregate progress reporting gets built)
- Fulfillment lives in TAG's sub-account (phase1-provisioning.ts now wrong; 13.3 notes reconciliation task)
- Auto-climb thresholds admin-adjustable, reporting lines from csm table, manual override both directions

**Open decisions (not started, documented in story docs):**
- Story 13.4: ascension value on opportunity — current value or delta over original deal?
- Story 13.6: "bug report" label in form — stays client-facing now that form carries service complaints too?

**Coordination flag:**
- `docs/epics.md` is shared file. If another session editing Epic tables, these three rows will conflict. Check before anyone rebases.

---

### Session: happy-ritchie-b3dc29
**Branch:** `claude/client-subaccount-import-65774f` @ 72d426f  
**Status:** ACTIVE — 5 commits ahead of main, not pushed

**Commits:**
```
72d426f  Record four decisions (Fulfillment location, courses store, notifications, tier climb)
404da84  Courses decision story 11.6, escalations desk story 13.6
cd9bf1b  Read-only Fulfillment audit script, GHL access outreach prompt
de77afb  Open Epic 13
0b243bc  Key agency tokens by company [DEFECT FIX]
```

**Real defect fixed (0b243bc):**
- Agency OAuth tokens shared one Firestore doc → any outside agency completing company-level install overwrote TAG's, taking every sub-account mint down
- Now keyed at `ghl/agency/companies/{companyId}` with self-migrating legacy read
- Files: `lib/ghl/store.ts`, `lib/ghl/tokens.ts`, `app/api/oauth/callback/route.ts`, `lib/ghl/store.test.ts` (new), `lib/ghl/tokens.test.ts`
- **Coordination:** If touching `lib/ghl/` or `app/api/oauth/`, coordinate before rebasing

**Docs added:**
- `docs/data-model.md` (edits)
- `docs/architecture.md` (edits)
- `docs/epics.md` (edits)
- `docs/stories/1.2` (edits)
- `docs/stories/11.6` (new — courses data store decision)
- `docs/stories/13.1` through `13.6` (new — Fulfillment epic)
- `docs/campaigns/` (new folder structure)

**Gate status (honestly stated):**
- 425 tests pass, lint clean (0 errors), `tsc --noEmit` clean
- **NEITHER BUILD RAN.** Worktree has no `node_modules`, `ng` and `next` don't resolve
- Real gate defect: `npm run build` exited 0 while Angular step had already failed with `ng: command not found` — root build script masking 127 errors

**Outstanding (work not started):**
1. Fulfillment audit script (scripts/fulfillment-audit.mjs) needs re-run by Sam with GHL token after matcher fix
2. Write pass behind audit not built
3. Story 13.3 notes: phase1-provisioning.ts now targets wrong location (decided today). Past runs left orphaned Fulfillment opportunities in cloned sub-accounts — needs reconciliation.
4. Story 13.4: ascension value — current vs delta over original deal? (undecided)
5. Story 13.6: client-facing label for complaints vs bug reports? (undecided)

**Security item:**
- GHL Private Integration Token pasted into transcript during debugging
- Sam said he'd rotate after wiring finished
- **IF THIS SESSION WINDS DOWN:** rotation must not be archived with it

---

### Session: handoff-review-questions-555acd
**Branch:** `claude/handoff-review-questions-555acd` @ 0bf8187  
**Status:** ACTIVE — 6 commits ahead of main, NOT merged. Database migrations already applied to production.

**Commits:**
```
0bf8187  Authored lessons (5 CSM lessons added)
... (4 prior)
fc61ff9  Initial Skool training schema + import
```

**What shipped to production database:**
- Migrations 008 and 009 applied to `tag_automation`
- Course imports executed
- Authored lessons written (5 new CSM lessons on live DB)
- Schema: multi-video lessons, reference-doc lessons, hat-scoped course visibility

**Epic 12 stories (12.3, 12.4, 12.5 — legacy Skool training migration):**
- Status: code committed, gates green (root vitest 457, Angular 557, both linters, production build)
- Database changes LIVE, not staged

**Coordination flag:**
- If another session touches `courses`, `course_sections`, `course_subsections` tables, **coordinate before rebasing**
- Note: `happy-ritchie` drafted story 11.6 "courses data store decision" — potential conflict zone

**Outstanding (not started):**
1. Review pass on authored lessons with Austyn or Walter (blocking Status → Done)
2. Two credential placeholders in admin editor need typing in:
   - Wistia login
   - Facebook login

---

## Blocked/Unmerged Branches

### `deploy-method-guard` — 1 commit
**Branch point:** fe332b2 (stale — rebased needed to f55143b)  
**Priority:** 🔴 **URGENT**

**Contents:**
- `docs/DEPLOYING_THE_APP.md` — full outage diagnosis + prevention
- `cloudbuild.yaml` — check-substitutions guard added

**Why urgent:**
- 2026-08-21 production outage: 4.5 hours, sign-in down
- Two independent faults: (1) `gcloud run deploy --source` bypassed Firebase config check; (2) users left with dead refresh tokens
- This branch documents both and adds safeguard to prevent (1) recurring
- Also documents diagnostics: image repo field names the deploy method, grepping bundle for `AIza` confirms sign-in will work *(both superseded 2026-08-22 — see the correction below and `docs/DEPLOYING_THE_APP.md`)*

**Action:** Rebase to f55143b, merge to main. This is the outage knowledge.

---

### `no-hats-epic` — 2 commits
**Branch point:** unknown (check before rebasing)  
**Priority:** 🟡 Blocked on `product-polish-assessment-d53e4e`

**Contents:**
- `docs/ROLES_AND_GRANTS_PLAN.md` (combined roles/grants design)
- `docs/reviews/2026-08-22-no-hats-design-fix-plan.md` (138k raw design + six review docs, captured actionable items)

**Blocker:**
- `lib/auth/grants.ts` already exists on `product-polish-assessment-d53e4e` (archived session, now merged from @happy-ritchie's view)
- No-hats design proposed creating that file + claim-size preflight
- File already exports: CLAIMS_BYTE_LIMIT, GrantValidationError, normaliseGrants, assertWithinClaimLimit
- **Sequence:** Land `product-polish-assessment-d53e4e` first to avoid re-creating utilities

**Outstanding:**
- Claim budget unsettled: design argues 900 bytes, `functions/src/auth.ts` spreads existing claims while `setUserClaims` doesn't, polish branch sets CLAIMS_BYTE_LIMIT = 1000. Differs because of claim-spreading asymmetry. Worth deciding rather than merging past.

---

## Collision Zones

**1. `docs/epics.md` — shared edits**
- ghl-multi-account adding Epic 5 rows (5.7, 5.8, 5.9)
- handoff-review likely also editing (Epic 12 updates)
- Check before any rebase

**2. `courses` tables — two sessions touching**
- happy-ritchie: Story 11.6 "courses data store decision" (drafted, not started)
- handoff-review: 12.3-12.5 lessons already in prod DB (migrations 008/009 live)
- If both merge without coordination, conflict expected

**3. `lib/auth/grants.ts` — re-creation risk**
- File already on product-polish-assessment (archived)
- no-hats-epic proposes creating it
- **Sequence:** product-polish must land first

---

## Production State

**Running:** revision `tag-hub-git-00016-b68`, image tag `4687084-grey` @ commit d5795ae  
**Behind main by:** 109 commits (deliberate post-outage scope decision)  
**Missing on live:** PHASE2_WEBHOOK_SECRET, PHASE3_WEBHOOK_SECRET mounted on revisions 00018/00019 (live on 00016 doesn't have them)

**Impact:**
- Onboarding intake endpoints depend on secrets; they are unused, so no functional impact
- Any Phase 2 or Phase 3 webhook inbound/outbound would fail with 403

**Outage today (2026-08-21):**
- 4.5 hours, sign-in completely down
- Root cause: revision 00017 deployed with `gcloud run deploy --source`, which bypassed cloudbuild.yaml
- Two faults: (1) Firebase config not inlined; (2) users left with dead refresh tokens
- Rollback to 00016, then redeploy via cloudbuild.yaml with correct method

**Deploy method diagnosis:**
- Image repo field: `hub/` = cloudbuild.yaml (correct), `cloud-run-source-deploy/...` = source deploy (broken)
- Bundle check: ~~`curl -s .../signin | grep -oE '/_next/static/[^"]+\.js' | ... | grep -c 'AIza'` — non-zero = key inlined, zero = broken~~

> **Corrected 2026-08-22.** The bundle check above is obsolete and inverted.
> `/signin` is served by Angular now, which has no `firebase` dependency and no
> client-side key; auth is server-side OTP. Zero is the *healthy* result. Acting
> on this line rolled back a working deploy. The image-repo field is also only a
> hint, not proof — a source-built image served correctly for days. Current
> verification is in `docs/DEPLOYING_THE_APP.md`.

---

## Open Decisions

| Item | Owner | Status | Options |
|------|-------|--------|---------|
| Story 13.4 ascension value | Sam | Undecided | Current value or delta over original deal? |
| Story 13.6 form label | Sam | Undecided | "bug report" or "service complaint"? |
| GHL workflow custom field trigger | Sam | Validation pending | 10 min in GHL workflow builder needed before rollup is implementable |
| Claim budget (900 vs 1000) | Sam | Unsettled | Functions spreads claims, app doesn't. Affects no-hats preflight design. |

---

## Critical Notes

1. **Gate defect in happy-ritchie:** `npm run build` exits 0 but Angular build fails silently (no node_modules). Root build script is masking 127. Needs fixing before gates are trustworthy.

2. **Live bug (production):** `clientOwnerGrants()` issues 5 roles to every founder, `switchRole` has zero callers in web/, so currentRole is permanently availableRoles[0]. Every founder holds five roles but can reach one. This is why no-hats design exists.

3. **Courses split-brain:** happy-ritchie drafted story 11.6 (data store decision). Fulfillment architecture (ghl-multi-account) decided courses move to Postgres. Acceptance criterion: aggregate progress reporting query gets built. Otherwise migration cost buys nothing.

4. **Sequence for no-hats merge:**
   - Land `product-polish-assessment-d53e4e` first (has lib/auth/grants.ts utilities)
   - Then `no-hats-epic` can merge without re-creating the file

5. **Deploy safeguard:** `deploy-method-guard` is one rebase away and protects against the 2026-08-21 outage pattern recurring. Land it.

---

## Next Steps

1. **Immediate:** Rebase and merge `deploy-method-guard` (outage safeguard)
2. **Sequence:** Land `product-polish-assessment-d53e4e` before `no-hats-epic`
3. **Validation:** 10-minute GHL workflow builder check (custom field trigger on opportunity) before anyone implements fulfillment rollup
4. **Review:** Austyn/Walter sign-off on handoff-review lessons (blocking Epic 12 Done)
5. **Merge decision:** ghl-multi-account, happy-ritchie, handoff-review — when ready, merge in sequence watching for collision zones
