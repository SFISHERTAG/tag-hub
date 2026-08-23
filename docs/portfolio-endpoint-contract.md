# Portfolio Endpoints — HTTP Contract

**Purpose:** Defines the shape and behavior of the two endpoints portfolio features (3.1, 3.2, 10.4) consume. Built as part of Epic 10.4 (Angular migration, first feature story).

**Why this doc exists:** 3.1 and 3.2 Phase 2 cannot land until these endpoints exist. This contract unblocks endpoint design and prevents divergence during implementation.

**Status:** Draft, ready for review before 10.4 starts.

---

## Endpoint 1: List Portfolio with Fulfillment Stage

**Route:** `GET /api/portfolio/list`

**Auth:** `authGuard` (session required) + `permissionGuard(['tag_csd', 'tag_csm', 'tag_exec'])`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "tenantId": "cust_ABC123",
      "name": "Casey Williams Co",
      "location": {
        "id": "loc_XYZ789",
        "name": "Denver, CO"
      },
      "fulfillment": {
        "stage": "AP 2 - Ads Launched",
        "stagePosition": 5,
        "ghlPipelineId": "pipeline_123",
        "ghlOpportunityId": "opp_456",
        "updatedAt": "2026-08-23T14:30:00Z"
      },
      "health": {
        "status": "healthy",
        "reason": "Show rate 45%, no stalls"
      }
    }
  ],
  "error": null
}
```

**Behavior:**

- Returns only tenants assigned to the authenticated CSM (per `location.csm_uid` in registry).
- For admin/exec: returns all tenants.
- `fulfillment.stage` reads from the Fulfillment opportunity on the tenant's GHL account.
- If Fulfillment opportunity does not exist or is unreachable, include `error: "Fulfillment not found"` and omit `fulfillment` object. Do not fail the whole response.
- `health` is populated by story 3.2; see Endpoint 2.
- Returns 200 even if some tenants are unreachable (see error handling below).

**Error cases:**

- **401 Unauthorized:** Session invalid or expired. Handled by `authGuard`.
- **403 Forbidden:** User lacks CSM role. Handled by `permissionGuard`.
- **500 Internal Server Error:** GHL fetch failed, Firestore unreachable, etc. Log and return `{ success: false, error: "Internal server error" }`. Do not expose GHL/Firestore details.

**Server-side auth re-check:**

After deserializing the session from the httpOnly cookie, re-verify:
1. Session uid has a role in `ROLES.*` (from custom claims).
2. Session role has permission to reach this endpoint.
3. If CSM/CSD: session uid is assigned to the requested tenant(s) (from registry query).

The route guard is cosmetic. The API is the enforcer.

---

## Endpoint 2: Portfolio Health Signals

**Route:** `GET /api/portfolio/{tenantId}/health`

**Auth:** `authGuard` + `permissionGuard` + **tenant ownership check:**
  - If user is `client_*`: must be in tenant's own location.
  - If user is `tag_csd` or `tag_csm`: registry must list tenant as assigned to this user.
  - If `tag_exec` or `tag_admin`: no location restriction.

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "reason": "Show rate 45%, no delivery stalls",
    "metrics": {
      "showRate": 0.45,
      "dqRate": 0.12,
      "closeRate": 0.38,
      "deliveryStalls": 0,
      "metricsWindow": "last 30 days"
    },
    "thresholds": {
      "healthyShowRate": 0.30,
      "atRiskShowRate": 0.15,
      "stalls": 0
    }
  },
  "error": null
}
```

**Behavior:**

- Queries appointment outcomes from the tenant's GHL account for the last 30 days.
- `showRate` = showed ÷ booked (from outcomes).
- `dqRate` = DQ ÷ showed.
- `closeRate` = closed ÷ showed.
- `deliveryStalls` = count of won opportunities without a corresponding Fulfillment stage update (indicates churn risk).
- Status classification:
  - `healthy`: showRate > 30% AND deliveryStalls = 0.
  - `at-risk`: showRate 15–30% OR deliveryStalls > 0.
  - `critical`: showRate < 15%.
- If insufficient data (< 5 booked appointments in window), status = `unknown` with reason `"Insufficient data"`.

**Thresholds are server-side defaults.** Story 3.2 notes that CSM-configurable thresholds are Phase 1.5 (optional). For now, hardcoded. If CSM overrides are added later, return the configured thresholds in the response.

**Error cases:**

- **404 Not Found:** Tenant does not exist.
- **403 Forbidden:** User lacks access to this tenant (caught by tenant ownership check).
- **500 Internal Server Error:** GHL fetch failed, malformed appointment data, etc. Log and return `{ success: false, error: "Could not compute health" }`.
- If GHL is unreachable but the endpoint is reached, return `{ status: "unknown", reason: "GHL temporarily unavailable", metrics: null }` with 200. Portfolio still renders; health badge shows "?" instead of red.

**Server-side auth re-check:**

After deserializing session and tenantId from URL param:
1. Query registry: does this tenantId exist?
2. Does the session uid have access to it? (location assignment for CSM, admin check for exec, location membership for client_*).
3. Only then fetch GHL and compute health.

---

## Calling from the Frontend (Angular)

**Endpoint 1 (list):** Called on portfolio component init. No parameters.

```typescript
// In portfolio.service.ts
getPortfolioList(): Observable<PortfolioListResponse> {
  return this.http.get<PortfolioListResponse>('/api/portfolio/list');
}
```

**Endpoint 2 (health):** Called on portfolio card hover or detail view. Parameter is tenantId.

```typescript
getHealth(tenantId: string): Observable<HealthResponse> {
  return this.http.get<HealthResponse>(`/api/portfolio/${tenantId}/health`);
}
```

Both calls go through the `errorInterceptor` (per CLAUDE.md contract). Network errors, 40x, 50x are logged and returned as typed errors, never silently swallowed.

---

## Implementation Order (Story 10.4)

1. **Endpoint 1** (list portfolio): Build first. No GHL dependency—reads registry + Fulfillment opportunity link from Firestore.
2. **Endpoint 2** (health): Build second. Depends on appointment outcome queries (already working in Next, can be ported).
3. **Frontend (both):** Angular components consume endpoints. Can start once endpoints are in place and their routes are wired.

---

## Future: CSM-Configurable Thresholds (Story 3.2 Phase 1.5)

When Story 3.2 adds CSM-configurable thresholds:
- Endpoint 2 behavior unchanged; response includes the user's configured thresholds (or defaults if not set).
- Firestore collection `user_health_thresholds` or similar, keyed by `{uid}`.
- Story 3.2 owns the UI (settings modal on portfolio page). Story 10.4 does not.

---

## Notes

- **No caching.** Both endpoints fetch fresh on each call. Portfolio updates reflect GHL changes within the page-reload latency.
- **Resilience:** If one tenant is unreachable (GHL timeout, Firestore miss), return the rest of the list (Endpoint 1) or a 500 (Endpoint 2, since it's tenant-specific). Do not fail the whole response to one bad lookup.
- **Rate limits:** GHL enforces per-account limits on API calls. Monitor in 10.4 testing. If limits are hit, return 429 and let the frontend retry per the error contract.
