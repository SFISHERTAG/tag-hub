# Portfolio Epic Execution Roadmap

**Decision:** Option B — Complete 10.4 (Angular calibration story) before shipping portfolio Phase 2.

**Rationale:** Avoids dual endpoint implementations (Next + Angular), ensures calibration discipline, produces measurement data for 10.5–10.7 estimates. Defers CSM portfolio Phase 2 from user-visible standpoint, but unblocks clean architecture.

**Status:** Active. Last updated 2026-08-23.

---

## Phase 0: Unblock 10.4 (Now)

**Owner:** Architecture lead  
**Timeline:** 1 week (parallel with 11.5 finalization)

### Checkpoint: 11.5 Merges

Story 11.5 (Endpoint Inventory) must complete. Once merged:
- ✅ The script `node scripts/inventory-endpoints.mjs` produces the count and shape of endpoints portfolio + bug reports need.
- ✅ This count informs 10.4 scope. Without it, estimates are guesses.

**Blocker:** 11.5 is "In Progress." Current status unknown; check with the session running it.

### Checkpoint: 10.3 Lands

Story 10.3 (Responsive Shell) must merge. Without it:
- ❌ Navigation tree does not exist.
- ❌ Portfolio and bug reports have nowhere to mount.

**Blocker:** 10.3 is "In Progress." ETA unknown.

### Checkpoint: Endpoint Contract Approved

**Already drafted:** `docs/portfolio-endpoint-contract.md`

This document defines:
- `GET /api/portfolio/list` — returns tenant list with Fulfillment stage
- `GET /api/portfolio/{tenantId}/health` — returns show rate, DQ rate, close rate, stall count

**Action:** Review contract for:
1. Shape matches backend capability (can we query Fulfillment and appointments efficiently?).
2. Auth re-checks are specified (server-side enforcement, not client-side gates).
3. Error handling is explicit (one bad tenant doesn't fail the whole list).

**Approval:** This is a prerequisite to starting 10.4. Do not start 10.4 without approval; it shapes implementation.

---

## Phase 1: Build 10.4 (Calibration Story)

**Owner:** Angular feature lead  
**Timeline:** 2–3 weeks (after 11.5 + 10.3 merge)  
**Worktree:** Isolated per Epic 10 discipline  
**Gate:** `ng build --configuration production && ng lint && ng test --watch=false` + `npm run check:functions`

### Step 1.1: Endpoint Inventory (1 hr)

Run 11.5 script on portfolio + bug reports:
```bash
node scripts/inventory-endpoints.mjs --area=portfolio
node scripts/inventory-endpoints.mjs --area=bug-reports
```

Record the endpoint count and record it in 10.4 story doc.

### Step 1.2: Build Endpoints (10–15 hrs estimated)

Implement both portfolio endpoints in `app/api/portfolio/`:

```
app/api/portfolio/list/route.ts        — GET /api/portfolio/list
app/api/portfolio/[tenantId]/health/route.ts  — GET /api/portfolio/{tenantId}/health
```

Per contract:
- Auth guard on session, re-check permissions server-side.
- Fetch Fulfillment stage from tenant's GHL account (hardcoded pipeline ID, per 3.1 Phase 2 assumption).
- Compute health metrics from GHL appointment outcomes (last 30 days).
- Handle errors gracefully (one bad tenant ≠ whole list fails).

**Tests:** Unit tests for each endpoint. Mock GHL responses. Test auth boundary. Test error cases.

### Step 1.3: Shared M3 Primitives (8–10 hrs estimated, one-time)

Build reusable components in `web/src/app/shared/ui/`:

```
shared/ui/page-shell/
shared/ui/empty-state/
shared/ui/error-state/
shared/ui/loading-state/
shared/ui/data-table/
shared/ui/confirm-dialog/
```

Each component:
- `OnPush` change detection.
- Standalone.
- No raw hex colors (M3 tokens only).
- `@if`, `@for`, `@switch` (new control flow).
- Comprehensive `.spec.ts`.

**Reusability test:** Both portfolio and bug reports use at least 3 of these. If a component is built but unused by either, do not ship it yet (defer to 10.5).

### Step 1.4: Port Portfolio Screen (8–12 hrs estimated)

Create `web/src/app/features/portfolio/`:

```
features/portfolio/portfolio.component.ts     — list + detail
features/portfolio/portfolio.service.ts        — calls /api/portfolio/* endpoints
features/portfolio/portfolio.routes.ts         — lazy route guard
```

Consume endpoint responses:
- List shows all tenants with stage badge + health indicator.
- Click tenant → enter-tenant action (calls 3.3 impersonation endpoint, already exists).
- Error states: one unreachable tenant doesn't empty the list.
- Empty state: "No clients assigned."

**Styling:** Use shared primitives from 1.3. No raw colors. M3 tokens only.

### Step 1.5: Port Bug Reports Screen (6–8 hrs estimated)

Create `web/src/app/features/bug-reports/`:

```
features/bug-reports/list/bug-reports-list.component.ts
features/bug-reports/form/bug-reports-form.component.ts
features/bug-reports/bug-reports.service.ts
features/bug-reports/bug-reports.routes.ts
```

Form submits to `POST /api/bug-reports` (endpoint already exists in Next, port contract).  
List fetches from `GET /api/bug-reports` (same).

**Tests:** Form validation, list load, error states.

### Step 1.6: Nav Wiring (2–3 hrs)

Add both routes to `nav.tsx` (Next) with `roleGuard` gating:

```
- Portfolio (visible to tag_csd, tag_csm, tag_exec)
- Bug Reports (visible to all authenticated users)
```

When clicked, nav router points to Angular route.

### Step 1.7: Delete Next Pages, Repoint Routes (1 hr)

Delete:
```
app/portfolio/page.tsx
app/bug-reports/page.tsx
```

Repoint `next.config.js` redirects (if any) to Angular routes.

Verify no dead imports remain.

### Step 1.8: Run Gate, Record Calibration Numbers (1 hr)

```bash
ng build --configuration production
ng lint
ng test --watch=false
npm run check:functions
```

All pass. ✅

Record in 10.4 story doc:
1. **Hours per endpoint:** (total hours in 1.2 ÷ 2 endpoints) = X hours/endpoint
2. **Hours per screen:** (portfolio hours in 1.4 + bug reports hours in 1.5 ÷ 2 screens) = Y hours/screen
3. **One-time primitive cost:** (hours in 1.3)
4. **Post-gate defects:** (bugs found in integration tests / new issues during acceptance)

---

## Phase 2: Unblock 3.1 & 3.2 Phase 2 (After 10.4 Merges)

**Owner:** CSM portfolio lead  
**Timeline:** 1–2 weeks (after 10.4 ✅)

Once 10.4 merges and endpoints are live, 3.1 and 3.2 Phase 2 are unblocked:

- 3.1 P2: Calls new `/api/portfolio/list` endpoint. Fulfillment stage populates from response.
- 3.2 P2: Calls new `/api/portfolio/{tenantId}/health` endpoint. Health metrics populate from response.

**Effort:** Much smaller than Phase 1 (just wiring endpoints to existing UI). Both Phase 1s already have the components built.

---

## Phase 3: Deploy and Measure (After 3.1/3.2 P2 Merge)

**Owner:** DevOps + QA  
**Timeline:** 1 week

Deploy to production:
- ✅ Portal.Next still hosts API (`app/api/**`).
- ✅ Angular bundle served same-origin.
- ✅ `hub_session` cookie (httpOnly SameSite=lax) shared.
- ✅ Both endpoints hitting live GHL.

Monitoring:
- Endpoint latency (GHL API call time).
- Error rates (GHL timeout, malformed appointment data).
- CSM adoption (portfolio views, health signal clicks).

---

## Critical Path Summary

```
Now (2026-08-23):
  └─ 11.5 close to merge
  └─ 10.3 in progress
  └─ Endpoint contract drafted

Week of 2026-08-26:
  └─ 11.5 merges ✅
  └─ 10.3 merges ✅
  └─ 10.4 starts

Week of 2026-09-02:
  └─ 10.4 in progress (estimated mid-week)

Week of 2026-09-09:
  └─ 10.4 gate passes ✅
  └─ Calibration numbers recorded
  └─ 3.1/3.2 Phase 2 unblocked

Week of 2026-09-16:
  └─ 3.1/3.2 Phase 2 merge ✅
  └─ Portfolio + health live in Angular ✅

Week of 2026-09-23:
  └─ 10.5 estimable (using calibration numbers)
  └─ 10.6/10.7 parallelize
```

**Total to live portfolio:** ~4 weeks from now.

---

## Risk Factors & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| 11.5 endpoint count grows beyond current estimate | Medium | 10.4 scope expands 1–2 weeks | Re-run inventory before 10.4 starts. Re-estimate if count > 50% growth. |
| 10.2 (Google Identity Services) uncovers net-new work | Low | Delays 10.3 → 10.4 by 1+ week | Start 10.2 in parallel. If blocker surfaces, escalate immediately. |
| Merge collision on `app/api/**` | Medium | Forced rebase, rework, date slip | Lock 10.4 to isolated worktree. No other feature touches endpoint layer while running. |
| GHL rate limits hit during 10.4 testing | Low | Endpoint design must handle 429/retry | Monitor GHL API quota in tests. Design retry loop per error contract. |
| 10.4 post-gate defects (integration test failures) | Medium | Discoveries during acceptance | Measure defect count as part of calibration number. Block release if defect rate > 2 per feature. |

---

## Success Criteria

✅ **10.4 is complete when:**
1. `ng build`, `ng lint`, `ng test` all pass.
2. `npm run check:functions` passes.
3. Both endpoints serve real GHL data (verified against live tenant).
4. Four calibration numbers recorded in story doc.
5. Story status updated to Done.

✅ **3.1/3.2 Phase 2 unblocked when:**
- 10.4 merges and endpoints are live.
- Endpoint contract has been validated by 3.1/3.2 owners.

✅ **Portfolio is live when:**
- 3.1/3.2 Phase 2 merges.
- Deployed to production.
- CSM can see live clients + health signals in Angular.

---

## Decisions Locked In

1. **Endpoint design first, implementation second.** Contract in `portfolio-endpoint-contract.md` must be approved before code starts. Changes during implementation require re-approval.

2. **One endpoint implementation, not two.** No Next page version of Endpoint 2 lives during 10.4. Only HTTP, only Angular consumption.

3. **Calibration is non-negotiable.** 10.4 must record the four numbers. No estimates for 10.5–10.7 until those numbers exist. Story 11.4 enforces this.

4. **Merge discipline per Epic 10.** 10.4 runs in isolated worktree. Explicit rebase + merge step before landing on main. No fast-forward merges.

---

## Next Actions (Today)

- [ ] Get approval on `docs/portfolio-endpoint-contract.md` from architecture lead.
- [ ] Confirm 11.5 ETA with the session running it.
- [ ] Confirm 10.3 ETA with the session running it.
- [ ] Once both above are clear, 10.4 can start the moment both merge.

**Owner:** Claude Code (this session). Will track and report progress.
