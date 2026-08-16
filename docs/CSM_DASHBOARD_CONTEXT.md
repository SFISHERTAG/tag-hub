# CSM Dashboard Build Context Window

**Date:** August 15, 2026  
**Status:** Phase 1 In Progress (Portfolio Dashboard)  
**Project:** TAG - Tax Advisory Growth  
**Timeline:** Build complete by end of week

---

## Current State

### Completed ✅
- Health scoring system (`lib/dashboard/health-scoring.ts`)
  - Dynamic, adjustable weights (ROAS 35%, Spend 25%, Leads 25%, SLA 15%)
  - Component score calculations (0-100)
  - Status mapping (excellent, healthy, at-risk, critical, alert)
  - Normalize weights function for custom CSM overrides
  
- CSM Dashboard page route (`app/csm-dashboard/page.tsx`)
  - Access control (tag_csm, tag_exec, tag_sales_manager only)
  - Server component with auth check

- Scope document (`docs/csm-dashboard-scope.md`)
  - Full feature list
  - Data architecture
  - Implementation phases
  - 9 stakeholder questions answered

- Test auth system (`app/api/auth/test-signin/route.ts`)
  - Role selector at login (enable: TEST_AUTH_ENABLED=true in .env.local)
  - Firebase custom token exchange workflow

- Live data integration
  - Google Drive API (`lib/google/drive.ts`)
  - GHL data fetchers (`lib/dashboard/data-fetchers.ts`)
  - Role-based location selection (`lib/dashboard/location-selection.ts`)

- **CSM Portfolio Components** (all Phase 1) ✅
  - `csm-portfolio.tsx` — Main component with state, search, filters, view switcher
  - `client-card.tsx` — Individual client card with health score stars display
  - `views/grid-view.tsx` — 3-4 column grid layout
  - `views/list-view.tsx` — Sortable table layout with all key metrics
  - `views/kanban-view.tsx` — 5 status-based columns (alert→excellent)
  - `modals/client-detail-modal.tsx` — Framework with 3 tabs
  - `modals/tabs/overview-tab.tsx` — Health metrics, KPIs, recent alerts
  - `modals/tabs/creatives-tab.tsx` — Creative asset gallery from Drive
  - `modals/tabs/campaigns-tab.tsx` — Placeholder for Phase 2

- **Data Layer** ✅
  - `lib/dashboard/csm-clients.ts` — Firestore queries, filtering, sorting
  - `scripts/setup-csm-test-data.ts` — Test data population script

### In Progress 🔄
- Firestore schema initialization (need to run setup script)
- Health weights config UI (CSM adjustment modal)

### TODO 📋

**Phase 1 (Remaining):**
1. ✅ Health scoring system
2. ✅ Dashboard page route
3. ✅ CSMPortfolio component
4. ✅ ClientCard component
5. ✅ View selector (grid/list/kanban)
6. ✅ Search & filter UI
7. ✅ Client modal framework
8. ✅ Overview tab
9. ✅ Creatives tab
10. ⏳ **Firestore schema** (run setup-csm-test-data.ts)
11. ⏳ **CSM weights config UI** (adjust health formula in modal)
12. ⏳ **Fix test auth** (Firebase credential re-sync issue)

---

## Known Issues & Next Steps

### Firebase Credentials Issue
The test-signin endpoint (`/api/auth/test-signin`) encounters a Firebase credential error:
- Error: "reauth related error (invalid_rapt)"
- Root cause: Service account credentials may need refresh or server time sync
- Workaround: Can manually populate Firestore test data and bypass auth testing

### To Complete Phase 1:
1. **Set up Firestore test data:**
   - Run: `npx ts-node scripts/setup-csm-test-data.ts`
   - Creates Casey Williams Co test client with alerts and creatives
   
2. **Fix Firebase credentials** (for auth testing):
   - Check server time sync: `date`
   - Regenerate Firebase service account key if needed
   - Update GOOGLE_APPLICATION_CREDENTIALS path
   
3. **Health weights modal:**
   - Create `app/csm-dashboard/modals/health-settings-modal.tsx`
   - Add sliders for ROAS/spend/leads/SLA weights
   - Save weights to firestore.csm_settings/{csmEmail}

---

## Architecture Overview

### Page Structure
```
/csm-dashboard
├── page.tsx                    (server: auth check, layout)
├── csm-portfolio.tsx          (client: portfolio grid, search, filter)
├── client-card.tsx            (client: individual client card)
├── views/
│   ├── grid-view.tsx          (grid layout)
│   ├── list-view.tsx          (table layout)
│   └── kanban-view.tsx        (status columns)
├── modals/
│   ├── client-detail-modal.tsx (framework, 3 tabs)
│   ├── tabs/
│   │   ├── overview-tab.tsx   (health, KPIs, alerts)
│   │   ├── creatives-tab.tsx  (upload, approval)
│   │   └── campaigns-tab.tsx  (placeholder for Meta integration)
│   └── health-settings-modal.tsx (CSM weight adjustment)
```

### Data Flow
```
CSM Login (test auth or OTP)
  ↓
Session → getLocationForDashboard(session)
  ↓ (CSM = TAG_GROWTH, or multi-client view)
  ↓
CSMPortfolio (server: fetch clients)
  ├─ fetchAssignedClients(csmEmail)
  ├─ calculateHealthScore() for each
  ├─ fetchAlerts() for each
  ├─ fetchUpcomingCalls() (optional, for alerts)
  │
  └─ Client Grid (client component)
     ├─ ClientCard × N
     │  ├─ Health score display
     │  ├─ Key metrics (ROAS, spend, leads)
     │  ├─ Alert count
     │  └─ Click → ClientDetailModal
     │
     ├─ View Selector (grid/list/kanban)
     ├─ Search input
     └─ Filters (status, alert type, sort)
```

### Firestore Schema (To Create)

```firestore
firestore/
├── clients/{clientId}
│   ├── name: string
│   ├── ghl_location_id: string
│   ├── meta_ad_account_id: string (optional, for Phase 2)
│   ├── drive_folder_id: string
│   ├── csm_assigned: string (email)
│   ├── health_targets: {
│   │   roas_target: number (default 3.5x),
│   │   monthly_spend_target: number,
│   │   monthly_leads_target: number,
│   │   response_sla_hours: number (default 24)
│   │ }
│   ├── health_weights: {  // CSM can override defaults
│   │   roas: number,
│   │   spend: number,
│   │   leads: number,
│   │   sla: number
│   │ }
│   ├── last_health_score: number
│   ├── last_health_update: timestamp
│   ├── active: boolean
│   │
│   ├── alerts/{alertId}
│   │   ├── type: string (critical, warning, info)
│   │   ├── title: string
│   │   ├── message: string
│   │   ├── created_at: timestamp
│   │   ├── resolved_at: timestamp (optional)
│   │
│   ├── creatives/{creativeId}
│   │   ├── filename: string
│   │   ├── status: string (draft, pending, approved, rejected)
│   │   ├── format: string (image, video, carousel)
│   │   ├── platforms: array (meta, fb, ig, tiktok)
│   │   ├── drive_file_id: string
│   │   ├── uploaded_by: string (email)
│   │   ├── uploaded_at: timestamp
│   │   ├── rejection_reason: string (optional)
│   │   ├── campaigns_using: array (for Phase 2)
│   │
│   └── campaigns/{campaignId}  // Phase 2
│       ├── meta_campaign_id: string
│       ├── name: string
│       ├── status: string (active, paused, ended)
│       ├── spend_last_7d: number
│       ├── leads_last_7d: number
│
├── csm_settings/{csmEmail}
│   ├── name: string
│   ├── assigned_clients: array (clientIds)
│   ├── health_weights: {  // Custom weights (optional override)
│   │   roas: number,
│   │   spend: number,
│   │   leads: number,
│   │   sla: number
│   │ }
│   ├── role: string (csm, manager, exec)
│   ├── slack_user_id: string (optional, for notifications)
```

---

## Test Data Setup

### Test Client: Casey Williams Co

**Location ID:** `cMIc51hn6ziLwWtC8t0n`  
**Drive Folder ID:** `1xtentcq18ioOH9m0dIqQV9vxX6aqLM51`  
**GHL Appointment:** Samuel (test data)

**Firestore Doc to Create:**
```json
{
  "clients/cMIc51hn6ziLwWtC8t0n": {
    "name": "Casey Williams Co",
    "ghl_location_id": "cMIc51hn6ziLwWtC8t0n",
    "drive_folder_id": "1xtentcq18ioOH9m0dIqQV9vxX6aqLM51",
    "csm_assigned": "test@taxadvisorygrowth.net",
    "health_targets": {
      "roas_target": 3.5,
      "monthly_spend_target": 25000,
      "monthly_leads_target": 150,
      "response_sla_hours": 24
    },
    "last_health_score": 75,
    "last_health_update": "2026-08-15T12:00:00Z",
    "active": true
  }
}
```

**Mock Health Metrics (for testing):**
```
ROAS: 3.2x (91% of target) → ROAS score: 85
Spend: $24,500 (98% of budget) → Spend score: 100
Leads: 140 (93% of target) → Leads score: 85
SLA: 98% on-time responses → SLA score: 100

Health Score = (85 × 0.35) + (100 × 0.25) + (85 × 0.25) + (100 × 0.15)
            = 29.75 + 25 + 21.25 + 15
            = 91 → Status: Excellent (●●●●●)
```

---

## Key Dependencies

### Installed Packages
- `googleapis` (Google Drive API)
- `firebase` (Firestore)
- `google-auth-library` (service account auth)

### Env Variables Required
```bash
# .env.local additions needed:

# Test auth (optional, for dev)
TEST_AUTH_ENABLED=true

# Google Drive (already present in drive.ts)
# Service account auth via Firebase

# Slack webhooks (Phase with notifications)
SLACK_WEBHOOK_CSM_ALERTS=https://hooks.slack.com/services/...
```

---

## Core Functions to Build

### 1. CSM Client Assignment (Firestore query)
```typescript
async function getAssignedClients(csmEmail: string): Promise<ClientData[]>
  // Query: firestore().collection('clients')
  //        .where('csm_assigned', '==', csmEmail)
  //        .where('active', '==', true)
  // Return: array of client docs with health scores
```

### 2. Health Score Calculation (batch)
```typescript
async function recalculateClientHealth(clientId: string): Promise<ClientHealth>
  // 1. Fetch GHL metrics (ROAS, spend, leads, SLA)
  // 2. Load CSM's custom weights (or defaults)
  // 3. Call calculateHealthScore(metrics, weights)
  // 4. Store result in Firestore
  // 5. Generate alerts if score dropped
  // Return: ClientHealth object
```

### 3. Alert Generation
```typescript
async function generateAlerts(clientId: string, oldScore: number, newScore: number): Promise<void>
  // If score dropped 15%+ → warning alert
  // If ROAS down 30%+ → critical alert
  // If SLA missed 3+ times → critical alert
  // Store in firestore.collection('clients/{clientId}/alerts')
```

### 4. Client Filtering
```typescript
function filterClients(
  clients: ClientData[],
  options: {
    search?: string,
    statusFilter?: "all" | "excellent" | "healthy" | "at-risk" | "critical" | "alert",
    sortBy?: "name" | "health" | "roas" | "spend",
    sortOrder?: "asc" | "desc"
  }
): ClientData[]
```

---

## Component Hierarchy (Phase 1)

```
CSMPortfolio (client)
├─ Header
│  ├─ "CSM Dashboard: My Clients"
│  ├─ View selector (grid/list/kanban)
│  ├─ Search input
│  └─ Filter chips (status, sort)
│
├─ ViewComponent (dynamic: GridView | ListView | KanbanView)
│  └─ ClientCard × N
│     ├─ Health score star display (●●●○○)
│     ├─ Client name + logo
│     ├─ Metrics: ROAS, spend, leads
│     ├─ Alert count badge
│     ├─ Last activity timestamp
│     └─ onClick → ClientDetailModal
│
└─ ClientDetailModal (when selected)
   ├─ Header (client name, health score)
   ├─ Tabs: Overview | Creatives | Campaigns
   └─ TabContent (varies by tab)
      ├─ OverviewTab
      │  ├─ Health status
      │  ├─ KPI grid (ROAS, spend, leads, conversion)
      │  ├─ Performance chart (7-day ROAS trend)
      │  ├─ Recent alerts list
      │  └─ Quick actions
      ├─ CreativesTab
      │  ├─ Creative grid
      │  ├─ Upload button
      │  ├─ Filter/sort
      │  └─ Creative cards (with approval actions)
      └─ CampaignsTab (placeholder, Phase 2)
         └─ "Awaiting Meta integration..."
```

---

## Next Immediate Actions

**Priority Order for Next Chat:**

1. **Create CSMPortfolio component** (`app/csm-dashboard/csm-portfolio.tsx`)
   - State: view mode (grid/list/kanban), search, filters
   - Fetch assigned clients from Firestore
   - Display client grid

2. **Create ClientCard component** (`app/csm-dashboard/client-card.tsx`)
   - Display health score visually (stars)
   - Show key metrics
   - Click handler to open modal

3. **Create grid/list/kanban view components**
   - `GridView`: Card grid (3-4 columns)
   - `ListView`: Table with sortable columns
   - `KanbanView`: 5 columns by health status

4. **Create search & filter UI**
   - Search input (by name)
   - Status filter chips
   - Sort dropdown

5. **Create ClientDetailModal framework**
   - Tab system (Overview | Creatives | Campaigns)
   - Tab content routing

6. **Create OverviewTab**
   - Health status header
   - KPI cards grid
   - Performance chart
   - Alerts list

7. **Set up Firestore schema**
   - Create clients/{cMIc51hn6ziLwWtC8t0n} doc (Casey Williams Co)
   - Add test alerts
   - Add test creatives

8. **Build health settings modal** (CSM weight adjustment)
   - Sliders for ROAS/spend/leads/SLA weights
   - Save to firestore.csm_settings/{csmEmail}

---

## Design System Integration

All components use existing TAG design tokens:
- Colors: `text-accent`, `text-ok`, `text-warn`, `text-danger`, `text-ink`, `text-ink-2`, `text-ink-3`
- Backgrounds: `bg-canvas`, `bg-surface`, `bg-raised`, `bg-sunken`
- Utilities: `lift`, `glass`
- Components: `Panel`, `Badge`, `Stat`, `Fold` (from `app/ui.tsx`)

**Dark mode:** Automatic via CSS variables ✅

---

## File Checklist

### Created Files ✅
- `lib/dashboard/health-scoring.ts`
- `app/csm-dashboard/page.tsx`
- `docs/csm-dashboard-scope.md`

### To Create 📝
- `app/csm-dashboard/csm-portfolio.tsx` (main component)
- `app/csm-dashboard/client-card.tsx`
- `app/csm-dashboard/views/grid-view.tsx`
- `app/csm-dashboard/views/list-view.tsx`
- `app/csm-dashboard/views/kanban-view.tsx`
- `app/csm-dashboard/modals/client-detail-modal.tsx`
- `app/csm-dashboard/modals/tabs/overview-tab.tsx`
- `app/csm-dashboard/modals/tabs/creatives-tab.tsx`
- `app/csm-dashboard/modals/health-settings-modal.tsx`
- `lib/dashboard/csm-clients.ts` (Firestore queries)
- `scripts/setup-csm-test-data.ts` (one-time setup for Casey Williams Co)

---

## Testing Strategy

### Manual Testing
1. Login as CSM (use test auth: role `tag_csm`)
2. Navigate to `/csm-dashboard`
3. See Casey Williams Co client card
4. Click card → Opens modal
5. Switch tabs → See Overview/Creatives/Campaigns
6. Filter/search → Works
7. Change health weights → Updates score in real-time

### Data Validation
- Health score recalculates correctly
- Weights normalize to 100%
- Status badges match score ranges
- Alerts generate on metric changes

---

## Notes for Next Session

- **No external APIs yet** (Meta integration in Phase 2)
- **Mock GHL data** OK for Phase 1 testing
- **Firestore rules:** Use existing auth rules (CSM can read/write their assigned clients)
- **Performance:** Cache health scores in Firestore, recalculate daily (or on-demand)
- **Notifications:** Slack integration in separate Phase
- **Responsive:** Test mobile view of client cards

---

## Stakeholder Questions (Answered)

1. ✅ Health weighting: Dynamic, adjustable by CSM
2. ✅ Alerts: Auto-resolve on recovery
3. ✅ Campaign creation: CSMs can create new campaigns (Phase 2)
4. ✅ Creative approval: CSM approves before live
5. ✅ Notifications: Slack/email alerts enabled
6. ✅ Meta API: Read-only for now, write in Phase 2

---

**Ready to build Phase 1: CSM Portfolio Dashboard**

All context, dependencies, and design decisions documented.  
Start with CSMPortfolio component and ClientCard.  
Target: Functional portfolio grid + modal by end of week.
