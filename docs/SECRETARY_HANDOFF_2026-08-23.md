# Secretary Handoff — 2026-08-23

> **Correction, appended when this was landed on `main`.** Written before story
> 14.B was finished, and two of its central claims went stale within the hour.
> The original text is left intact below rather than edited, because a handoff
> that quietly rewrites itself is not a record.
>
> - **"Story 14.B (93ffc5f) — NOT LANDABLE" is resolved.** It was correct when
>   written. The rewrite landed, all eight production violations were fixed, and
>   14.B is merged to `main` at `5abacb4`.
> - **The "Security Finding (Not in Master's List)" is closed.** The pre-commit
>   hook's file-level exemption is gone, replaced by `scripts/check-role-strings.mjs`,
>   which is tree-wide and exempts per line. Both holes it names are shut.
> - **It was committed onto `hold/main-parked` in the main checkout**, not onto
>   its own branch. That branch is 19 commits behind `main`, so this document was
>   stranded where nobody would find it. Preserved and landed from here.
>
> What it captures that `SESSION_HANDOFF_2026-08-23.md` does not is the
> coordination layer's own history: which audits needed rework, why, and the
> order in which things blocked. That is the part worth keeping.



Secretary session tracking: coordination layer, audits, standing orders, quality gates.
Complements Master's SESSION_HANDOFF_2026-08-23.md (main at 63362a8).

---

## Coordination Summary

**Sessions active**: Master, Research Assistant, ghl-multi-account-login-019007-76, Loki Kronos (monitoring), functions-typescript-build-8fa5d4-4c (swarm review), Scribe (new, 9m ago), Apprentice.

**Decisions for Sam (3 items, from Master's 2026-08-23 handoff)**:
1. Migration 010 — owner role assignment
2. Google Calendar scope — GCP console access for cost estimate
3. GHL sub-accounts — transfer limitations vs. Story 1.2 scope
4. GHL calendars.write — support ticket priority (Story 16.1)

**Stories shipped**:
- 14.1 — repository seam (merged 63362a8 by Sam)
- 14.2 — Postgres runner (merged 448b741 by Master)
- 14.A — fold functions/ into app/api (merged 0e71b3b by Sam, 66s after 14.1)

---

## Audits Completed (All with Verification Gates)

### Firestore Type Audit (704eb02)
**Path**: docs/14.1-firestore-type-audit.md  
**Status**: Complete, awaiting verification before 14.4–14.9  
**Critical finding**: `locations/{locationId}` has 10 undeclared fields (locationId, googleDocId, ownerEmail, metaAdAccountId, metaBusinessId, metaPixelId, services, ownerModel, createdAt, provisioned) that will be **silently dropped** in Postgres migration.

**Other findings**:
- 3 FieldValue sentinels verified
- 2 exactly-once write sites (.create()) for idempotency
- 6 paths verified matching
- 15 paths pending field inventory
- Timestamp handling inconsistent (Timestamp.now vs. serverTimestamp vs. new Date)

### Table Audit (Correcting - ghl-multi-account-login-019007-76)
**Status**: Re-deriving from functions/sql/003_migrate_firestore_to_postgres.sql  
**Errors found in 94f5973**: manual_pages (wrong, not in 003), course_progress (wrong, is live)  
**Gate**: Do NOT use for 14.4–14.9 without re-verification.

---

## Story Issues Requiring Rework

### Story 14.B (93ffc5f) — NOT LANDABLE
**Defect**: Correction REPLACED findings table instead of MERGING, dropped three original violations.

**Missing violations** (still in tree, absent from story):
- lib/auth/admin.ts:175: `role: "tag_exec"` in promoteToExec (claim-issuing path)
- app/api/meta/status/route.ts:24: `session.currentRole !== "tag_exec"`
- scripts/setup-csm-test-data.ts:110: `role: "tag_csm"`

**Additional errors**:
1. Heading says 8 files, table lists 5
2. Math error: "41 violations" (8 files + 33 occurrences)
3. Hole 2 code paraphrased, not quoted (check-story-status.mjs:185)

**Required**: Full rewrite merging both holes + both finding sets in one table.

---

## Security Finding (Not in Master's List)

### Pre-commit Hook File-Level Exemption Flaw
**Severity**: SECURITY — production gap  
**Issue**: Hook exempts entire files that call hasAnyRole/ROLES./import auth/roles. Any file with sanctioned helpers gets blanket pass for ALL role literals.

**Blast radius**: 8 live files, 33 violations invisible to current check:
- app/api/flow/card/[cardId]/suggestions/route.ts:9
- app/api/flow/org/[orgId]/suggestions/route.ts:8
- app/api/flow/suggestions/[suggestionId]/resolve/route.ts:8
- lib/dashboard/location-selection.ts (9 occurrences)
- lib/dashboard/widget-definitions.ts (11 occurrences)

**Proposed fix**: Line-level exemption (a line calling ROLES.ADMIN is fine; a bare literal is not, regardless of file).

---

## Standing Orders (Established 2026-08-23)

**Order 1 — Corrections must preserve right findings**  
When correcting a document, diff original vs. corrected. Confirm nothing right disappeared. Report what was removed and why. Root cause: replacement-instead-of-merge errors dropped correct findings in table audit, type audit, and 14.B.

**Order 2 — Findings PRODUCED vs. SURVIVED verification**  
Report both numbers separately. A session producing 4 findings (2 wrong) is more expensive than one producing 2 (both correct).

**Order 3 — Verify methods before trusting results**  
Plant a known field and confirm grep/method finds it. Empty result from broken pattern looks identical to empty result from clean tree.

**Order 4 — Watchpoints use named signals**  
Report state (ref, SHA, field read), not activity. Don't classify as stalled/blocked without naming the signal. Idle branches are normal; report movement.

---

## What Blocked Progress and Why

**Coordination output > verified output**: Four substantive errors in audits and story docs. Master corrected:
- Table audit: manual_pages/course_progress mistakes
- Type audit: 10 reported fields → 4 actual (six declared via Tenant)
- 14.B: three original violations deleted in correction

**Every correction cycle introduced a new error** while fixing an old one. This is unsustainable without parallel checking (not just production).

---

## Research Assistant Work in Flight

**Priority 1 (URGENT)**: Adversarial review of 14.1  
- Re-derive blind, attempt to break six specific claims
- lib/auth/otp.test.ts risk (first coverage, tests + code by same author)
- Findings must be in committed file with path, SHA, every command shown
- Gates Master's merge of 14.1 (if not already merged; see merge note below)

**Priority 2 (after review)**: Rewrite 14.B with:
- Both holes + both finding sets merged in one table
- Three missing violations re-included
- Heading/table/math corrected
- Real code line quoted exactly

---

## Unmerged Branches (Per Master's Handoff)

- Handoff letter: e03066f
- 14.B: 864e644 (now requires rewrite due to defects)
- Legendarium draft: f58f7cc (preserved, not reviewed)
- Table audit: b693a43 (under verification)
- Type audit: 704eb02 (under verification)
- Adversarial review: 17d8923 (13.1 review, in progress or result)

**Note on 14.1 merge**: Master's handoff says not merged pending adversarial review. During session, Sam merged both 14.1 (63362a8) and 14.A (0e71b3b) within 16 minutes. Merge authorization unclear in this context.

---

## Differences from Master's Handoff

Secretary tracked items Master may not have seen:
- **Hook security flaw** (8 files, 33 violations) — ranked below Migration 010, above other items
- **14.B defect details** — replacement-instead-of-merge root cause, three missing violations
- **Research Assistant work** — Firestore audit (done), 14.1 review (in progress), 14.B rewrite (deferred)
- **Table audit verification gate** — errors found, re-derivation in progress
- **Standing orders** — four established during 2026-08-23 session
- **Verification burden issue** — coordination output > verified output, unsustainable

Master's handoff included:
- **Four defects the seam exposed** (duplicate campaign, locations/undefined, Firestore types in public signatures, five collections narrower than contents)
- **verifyCode tests** — first coverage ever
- **Migration 003 analysis** — unadopted, only 2/17 tables live
- **Stories 14.4–14.9 risk** — written as create-then-backfill but tables existed since 003
- **Timestamp conventions** (Master named 8 items to decide; Secretary tracked these as standing item 8)

---

## For the Next Session

1. Read `AGENT_COORDINATION.md §10` standing orders first.
2. **Verify against code**, not documents.
3. Diff corrections before accepting them.
4. Report findings PRODUCED and SURVIVED separately.
5. Plant test data to validate grep/methods before trusting results.
6. Use named signals for watchpoints (ref, SHA, field).
7. Commit verification results with commands shown.
8. Prevent replacement-instead-of-merge errors via diff review.
9. Add parallel checking (not just production) when adding parallelism.

**The pattern**: A document is not evidence. Every wrong finding came from trusting a doc; every right one came from code.
