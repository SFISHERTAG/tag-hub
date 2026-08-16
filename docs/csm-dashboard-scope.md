# CSM Dashboard & Client Hub Scope Document

**Date:** August 15, 2026  
**Status:** PRD / Scope Definition  
**Owner:** TAG Product Team

---

## Executive Summary

The CSM Dashboard is the operational cockpit for Tax Advisory Growth's account management team. It provides a **book-level view** of all assigned clients with health scoring, and **drill-down modals** with detailed metrics, campaign management, and creative oversight.

**Key Features:**
- Portfolio health overview (grid/list/kanban)
- Client health scoring (ROAS, spend, leads, response SLA)
- Multi-tab client modal (Overview, Campaigns, Creatives)
- Meta Ads Manager integration (custom dashboard, not embedded)
- Centralized creative upload & approval workflow

---

## Part 1: CSM Portfolio Dashboard

### 1.1 Book Overview Screen

**Purpose:** At-a-glance view of all CSM's assigned clients and their health status.

**Layout:**
```
┌─────────────────────────────────────────────┐
│  CSM Dashboard: My Clients                   │
│  [Search] [View: Grid | List | Kanban]      │
├─────────────────────────────────────────────┤
│                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Acme     │  │ Casey    │  │ Global   │   │
│  │ Corp     │  │ Williams │  │ Services │   │
│  │          │  │ Co       │  │          │   │
│  │ ●●●●○    │  │ ●●●○○    │  │ ●●●●●    │   │
│  │ Health   │  │ Health   │  │ Health   │   │
│  │ ROAS: 4x │  │ ROAS: 3x │  │ ROAS: 5x │   │
│  │ Spend:OK │  │ Spend:OK │  │ Spend:OK │   │
│  │ Leads:OK │  │ Leads:⚠️  │  │ Leads:OK │   │
│  │ SLA: ✓   │  │ SLA: ✗   │  │ SLA: ✓   │   │
│  │ 2 alerts │  │ 5 alerts │  │ 0 alerts │   │
│  └──────────┘  └──────────┘  └──────────┘   │
│    Click →     Click →     Click →           │
│    Client      Client      Client            │
│    Modal       Modal       Modal             │
│                                               │
└─────────────────────────────────────────────┘
```

**Views:**
- **Grid** (default): 3-4 columns, card-based, sortable by health/name
- **List**: Sortable table (name, health score, spend, ROAS, alerts)
- **Kanban**: Columns by health status (Critical, At-Risk, Healthy, Excellent)

**Card Content (per client):**
- Client name + logo (if available)
- **Health score** (1-5 stars or 0-100)
- **Key metrics** (ROAS, spend, lead volume)
- **Alert count** (with indicators: critical, warning, info)
- **Last activity** timestamp
- **Click zone**: Opens Client Detail Modal

**Filtering & Search:**
- Search by client name
- Filter by health status (Critical, At-Risk, Healthy, Excellent)
- Filter by alert type (No alerts, Warnings, Critical)
- Sort by: Name, Health, ROAS, Spend, Last Updated

---

## Part 2: Health Scoring System

### 2.1 Health Score Calculation

**Formula:**
```
Health Score = (ROAS_score × 0.35) + (Spend_score × 0.25) + (Leads_score × 0.25) + (SLA_score × 0.15)

Each component is 0-100, then averaged:
Final Score = 0-100

Status Mapping:
  90-100 = Excellent (●●●●●, green)
   75-89 = Healthy   (●●●●○, green)
   60-74 = At-Risk   (●●●○○, amber)
   45-59 = Critical  (●●○○○, red)
    0-44 = Alert     (●○○○○, red + alert icon)
```

### 2.2 Component Metrics

#### ROAS Score (35% weight)
| Condition | Score |
|-----------|-------|
| Exceeds target by 20%+ | 100 |
| Meets target (±10%) | 85 |
| Below target 11-20% | 50 |
| Below target 20%+ | 0 |

**Data Source:** GHL Opportunities (closed won revenue / ad spend)  
**Calculation Frequency:** Daily  
**Target:** Configured per client in Firestore

#### Spend Score (25% weight)
| Condition | Score |
|-----------|-------|
| On budget (±5%) | 100 |
| Over budget 6-15% | 70 |
| Over budget 16-30% | 30 |
| Over budget 30%+ | 0 |

**Data Source:** GHL Contacts field or Meta API  
**Calculation Frequency:** Daily  
**Target:** Configured per client in Firestore

#### Lead Volume Score (25% weight)
| Condition | Score |
|-----------|-------|
| Exceeds MoM target | 100 |
| Meets MoM target (±10%) | 85 |
| Below target 11-25% | 50 |
| Below target 25%+ | 0 |

**Data Source:** GHL Contacts (opportunity count, lead status)  
**Calculation Frequency:** Daily  
**Target:** Configured per client in Firestore

#### Response SLA Score (15% weight)
| Condition | Score |
|-----------|-------|
| All responses ≤ 24h | 100 |
| 95%+ within 24h, max 48h | 85 |
| 85%+ within 48h, max 72h | 50 |
| SLA missed repeatedly | 0 |

**Data Source:** GHL custom field (last response time)  
**Calculation Frequency:** Daily  
**Target:** 24h default, overrideable per client

### 2.3 Alerts System

**Critical Alerts (red):**
- ROAS dropped >30% in last 7 days
- Spend overrun >25%
- Lead volume down >25%
- SLA missed 3+ times this week
- Campaign paused unintentionally

**Warnings (amber):**
- ROAS trending down (10-30% decline)
- Spend overrun 6-25%
- Lead volume down 10-25%
- SLA missed 1-2 times this week

**Info (blue):**
- Creative approval pending
- New campaign ready to launch
- Scheduled report due
- Upcoming budget review

**Alert Storage:** Firestore `clients/{clientId}/alerts`  
**Alert Retention:** 30 days, then archived

---

## Part 3: Client Detail Modal

### 3.1 Modal Structure

**Trigger:** Click client card on portfolio dashboard  
**Size:** ~90% viewport (large modal)  
**Tabs:** Overview | Campaigns | Creatives  
**Close:** ESC key, backdrop click, X button  
**Persist:** Tab selection in sessionStorage

### 3.2 Tab 1: Overview

**Purpose:** Client health dashboard, KPIs, recent activity.

**Content Sections:**

#### A. Health Status Header
```
┌──────────────────────────────┐
│ Acme Corp                    │
│ Health: ●●●●○ (85/100)      │
│ Status: Healthy              │
│ Last Updated: 2 hours ago    │
│                              │
│ ⚠️ 2 warnings │ ✓ 3 active campaigns
└──────────────────────────────┘
```

#### B. Key Metrics (4-column grid)
```
┌───────────┬───────────┬───────────┬───────────┐
│   ROAS    │  Spend    │   Leads   │  Conv.    │
│   4.2x    │ $24.5K    │   127     │   3.2%    │
│  ↑ 12%    │  On Bud   │  ↓ 5%     │  ↑ 2%     │
│   vs LM   │           │   vs LM   │  vs LM    │
└───────────┴───────────┴───────────┴───────────┘
```

#### C. Campaign Performance (last 30 days)
- Chart: ROAS trend (7-day bars or line)
- Table: Top 5 campaigns by spend
  - Campaign name
  - Platform (Meta, Google)
  - Spend
  - ROAS
  - Lead count
  - Status (active/paused)

#### D. Recent Alerts & Activity
- List of last 10 alerts (with timestamps)
- Last contact timestamp
- Last response time
- Pending approvals count

#### E. Quick Actions
- "View in Meta Ads Manager" (link to campaigns tab)
- "Upload Creative" (link to creatives tab)
- "Send Message" (opens compose modal)
- "Schedule Sync Call" (opens calendar modal)

### 3.3 Tab 2: Campaigns (Meta Ads Manager)

**Purpose:** Custom dashboard for managing Meta campaigns, not embedded iframe.

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Campaigns: Acme Corp                        │
│ [New Campaign] [Refresh] [View Settings]    │
├─────────────────────────────────────────────┤
│ Filter: [All] [Active] [Paused] [Ended]    │
│ Sort: [Name] [Spend] [ROAS] [Performance]  │
├─────────────────────────────────────────────┤
│                                               │
│  Campaign Name    │ Spend  │ ROAS │ Leads    │
│  ─────────────────┼────────┼──────┼──────    │
│  Summer Promo     │ $8.2K  │ 4.1x │   45     │
│  ⚪ Active        │ 7-day  │      │ ↑ 12%   │
│  [Edit] [Pause]   │        │      │          │
│  ─────────────────┼────────┼──────┼──────    │
│  Back-to-School   │ $6.5K  │ 3.8x │   38     │
│  🟠 Paused        │ 7-day  │      │ ↓ 8%    │
│  [Edit] [Resume]  │        │      │          │
│  ─────────────────┼────────┼──────┼──────    │
│  Holiday Blast    │ $9.8K  │ 4.5x │   54     │
│  ⚪ Active        │ 7-day  │      │ ↑ 18%   │
│  [Edit] [Pause]   │        │      │          │
│                                               │
└─────────────────────────────────────────────┘
```

**Columns:**
- Campaign name (clickable → campaign detail)
- Status badge (Active, Paused, Ended, Scheduled)
- Spend (last 7 days, formatted)
- ROAS (calculated from leads/spend)
- Lead count (from GHL or Meta Lead Gen)
- Trend indicator (↑/↓ vs. previous period)

**Actions per Campaign:**
- **Edit**: Opens campaign settings (Meta API integration)
  - Audience targeting
  - Budget
  - Bid strategy
  - Ad creative
  - Schedule
- **Pause/Resume**: Toggle campaign status (Meta API)
- **View Ads**: See active ads in this campaign
- **View Analytics**: Detailed performance breakdown

**Bulk Actions:**
- Select multiple campaigns
- "Pause All" / "Resume All"
- "Set Budget" (bulk update)
- "Download Report" (CSV)

**Campaign Creation Flow:**
1. Click "[New Campaign]"
2. Modal: Select campaign type
   - Lead Gen
   - Conversion
   - Awareness
   - Traffic
3. Configure:
   - Name
   - Budget
   - Audience (tied to client's GHL contacts)
   - Creatives (select from Creatives tab)
   - Schedule
4. Review & Launch
5. Syncs to Meta API
6. Updates GHL records

**Data Source:** Meta Ads Manager API  
**Sync Frequency:** Real-time on user action, cached every 15 min  
**Permissions:** Read campaigns (always), Write campaigns (CSM role only)

### 3.4 Tab 3: Creatives

**Purpose:** Upload, manage, approve, and track creatives for Meta campaigns.

**Layout:**
```
┌──────────────────────────────────────────────┐
│ Creatives: Acme Corp                         │
│ [Upload New] [Bulk Upload] [View All]        │
├──────────────────────────────────────────────┤
│ Filter: [All] [Approved] [Pending] [Rejected]│
│ Sort: [Date] [Status] [Platform] [Format]   │
├──────────────────────────────────────────────┤
│                                               │
│  ┌─────────────┐  ┌─────────────┐            │
│  │ [Image]     │  │ [Video]     │            │
│  │ Summer Ad   │  │ Promo Reel  │            │
│  │ ✓ Approved  │  │ ⏳ Pending   │            │
│  │ Meta, FB    │  │ Meta, Insta  │            │
│  │ [View]      │  │ [View]       │            │
│  │ [Download]  │  │ [Approve]    │            │
│  │ [Delete]    │  │ [Reject]     │            │
│  └─────────────┘  └─────────────┘            │
│                                               │
│  ┌─────────────┐  ┌─────────────┐            │
│  │ [Carousel]  │  │ [Collection]│            │
│  │ Product Set │  │ Shop Ads    │            │
│  │ ✗ Rejected  │  │ ✓ Approved  │            │
│  │ Meta, Insta │  │ Meta Shop   │            │
│  │ [View]      │  │ [View]      │            │
│  │ [Edit]      │  │ [In Use: 2]  │            │
│  │ [Resubmit]  │  │             │            │
│  └─────────────┘  └─────────────┘            │
│                                               │
└──────────────────────────────────────────────┘
```

**Creative Card:**
- **Thumbnail**: Preview image/video
- **Format**: Image, Video, Carousel, Collection
- **Title**: User-provided name
- **Status**: Badge (Approved, Pending, Rejected, Draft)
- **Platforms**: Meta, Facebook, Instagram, Audience Network
- **Actions**:
  - **View**: Full preview modal
  - **Edit**: Change name, platforms, metadata
  - **Approve**: CSM approves for use (marks status)
  - **Reject**: CSM rejects with feedback (notifies uploader)
  - **Download**: Export creative (original file)
  - **Delete**: Remove from system
  - **Use Count**: "In use by 3 campaigns"

**Upload Flow:**

1. **Click [Upload New]**
2. **Select Upload Type**:
   - Single creative
   - Bulk upload (CSV + zip of files)
3. **Form**:
   - File(s) selector (drag-drop)
   - Creative name
   - Format (auto-detect or select)
   - Platforms (Multi-select: Meta, FB, Insta, TikTok)
   - Campaign assignment (optional)
   - Notes/description
4. **Validation**:
   - File type check (PNG, JPG, MP4, MOV, GIF)
   - File size limits (image ≤ 4MB, video ≤ 4GB)
   - Dimensions check (recommend Meta specs)
5. **Upload & Processing**:
   - Store in Google Drive (Cubby folder)
   - Create Firestore doc with metadata
   - Set status: "Pending" → CSM approval
   - Notify CSM of pending approval
6. **Approval Workflow**:
   - CSM reviews creative
   - Approve → Status "Approved", available for campaigns
   - Reject → Status "Rejected", reason stored, notifier alerted
   - Request Changes → Status "Needs Revision", feedback sent

**Bulk Upload:**
- CSV format: `filename.ext, format, platforms, campaign_id`
- Zip file: all referenced creatives
- Validation: all files present, match CSV
- Batch approval queue

**Storage:**
- **Files**: Google Drive (Cubby, `{clientId}/creatives/` folder)
- **Metadata**: Firestore `clients/{clientId}/creatives/{creativeId}`
  - filename
  - status (draft, pending, approved, rejected)
  - uploaded_by (CSM email)
  - uploaded_at
  - format (image, video, carousel)
  - platforms (array)
  - campaigns_using (array of campaign IDs)
  - rejection_reason (if rejected)
  - notes

---

## Part 4: Meta Ads Manager Integration

### 4.1 API Scope

**Meta Graph API Endpoints:**
```
GET /me/campaigns
POST /me/campaigns (create)
GET /{campaign_id} (details)
PUT /{campaign_id} (update)
POST /{campaign_id}/pause (pause)
POST /{campaign_id}/resume (resume)

GET /me/adaccounts (list ad accounts for client)
GET /{ad_account_id}/campaigns (filtered)
GET /{ad_account_id}/adsets (ad sets within campaigns)
GET /{ad_account_id}/ads (individual ads)

GET /{ad_account_id}/leadgen_forms (lead gen forms)
GET /{leadgen_form_id}/leads (leads from forms)
```

### 4.2 Data Mapping

**Meta Account ↔ TAG Client:**
- Store Meta Ad Account ID in Firestore `clients/{clientId}.meta_ad_account_id`
- Store access token securely (Firebase Secret Manager)
- Map Meta "leads" to GHL contacts (via email or phone)

**Campaign → GHL Opportunity:**
- Create GHL custom field: "meta_campaign_id"
- Link campaigns to opportunities for ROI tracking
- Sync lead gen form submissions to GHL

### 4.3 Authentication

**Setup Flow:**
1. CSM clicks "Connect Meta Account"
2. OAuth flow: User grants permissions
   - `ads_management`
   - `leads_access`
   - `instagram_basic`
   - `pages_manage_metadata`
3. Store token in Firebase Secret Manager
4. Refresh token handling (auto-refresh on expiry)

**Scope:** `ads_management,leads_access,instagram_basic,pages_manage_metadata`

---

## Part 5: Data Architecture

### 5.1 Firestore Schema

```
firestore/
├── clients/{clientId}
│   ├── name: string
│   ├── ghl_location_id: string
│   ├── meta_ad_account_id: string
│   ├── drive_folder_id: string
│   ├── health_targets: {
│   │   roas_target: number,
│   │   monthly_spend_target: number,
│   │   monthly_leads_target: number,
│   │   response_sla_hours: number
│   │ }
│   ├── csm_assigned: string (email)
│   ├── last_health_update: timestamp
│   ├── active: boolean
│   │
│   ├── alerts/{alertId}
│   │   ├── type: string (critical, warning, info)
│   │   ├── message: string
│   │   ├── created_at: timestamp
│   │   ├── resolved_at: timestamp (optional)
│   │
│   ├── creatives/{creativeId}
│   │   ├── filename: string
│   │   ├── status: string (draft, pending, approved, rejected)
│   │   ├── format: string (image, video, carousel)
│   │   ├── platforms: array (meta, fb, ig)
│   │   ├── drive_file_id: string
│   │   ├── uploaded_by: string (email)
│   │   ├── uploaded_at: timestamp
│   │   ├── rejection_reason: string
│   │   ├── campaigns_using: array (campaign IDs)
│   │
│   └── campaigns/{campaignId}
│       ├── meta_campaign_id: string
│       ├── name: string
│       ├── status: string (active, paused, ended, scheduled)
│       ├── budget: number
│       ├── spend_last_7d: number
│       ├── leads_last_7d: number
│       ├── created_at: timestamp
│       ├── synced_at: timestamp
│
├── csm/{csmEmail}
│   ├── name: string
│   ├── assigned_clients: array (clientIds)
│   ├── meta_access_token: string (encrypted)
│   ├── meta_token_expiry: timestamp
│   ├── role: string (csm, manager, admin)
```

### 5.2 GHL Custom Fields

Create these custom fields in GHL for each location:

- `meta_campaign_id` (Campaign): Link to Meta campaign
- `meta_lead_source` (Contact): Whether lead came from Meta
- `last_response_time` (Contact): For SLA tracking
- `csm_assigned` (Contact/Opportunity): CSM owner
- `internal_notes` (Contact): Communication log

### 5.3 Real-Time Data Sync

**Frequency:**
- Health score: Recalculate daily (midnight UTC)
- Meta campaigns: Sync on view load + cache 15 min
- GHL metrics: Pull on dashboard load
- Alerts: Generated on score update, checked every 4 hours

**Triggers:**
- New campaign created in Meta → create Firestore record
- GHL lead created → check for Meta source, link to campaign
- Campaign paused → alert CSM
- ROAS drops 30%+ → critical alert

---

## Part 6: Implementation Phases

### Phase 1: CSM Dashboard Core (Week 1-2)
- [ ] Portfolio overview grid/list/kanban views
- [ ] Health score calculation & storage
- [ ] Client card component
- [ ] Search & filtering
- [ ] Firestore schema for clients & health

### Phase 2: Client Modal - Overview Tab (Week 2-3)
- [ ] Modal framework & tabs
- [ ] Health status header
- [ ] Key metrics display (ROAS, spend, leads, conversion)
- [ ] Campaign performance chart
- [ ] Recent alerts list
- [ ] Quick action buttons

### Phase 3: Meta Ads Integration (Week 3-4)
- [ ] OAuth flow setup
- [ ] Meta API client library
- [ ] Campaign listing from Meta
- [ ] Real-time campaign data sync
- [ ] Campaign edit/pause/resume UI
- [ ] Firestore campaign records

### Phase 4: Client Modal - Campaigns Tab (Week 4-5)
- [ ] Campaigns table view
- [ ] Campaign detail modal
- [ ] Campaign creation flow
- [ ] Meta API integration
- [ ] Budget & bid management
- [ ] Performance analytics

### Phase 5: Creatives Management (Week 5-6)
- [ ] Creative card component
- [ ] Upload flow (single & bulk)
- [ ] Approval workflow
- [ ] Creative-to-campaign linking
- [ ] Google Drive storage integration
- [ ] Firestore creative records

### Phase 6: Client Modal - Creatives Tab (Week 6-7)
- [ ] Creative grid/list view
- [ ] Filter & sort
- [ ] Upload UI
- [ ] Approval UI (for pending creatives)
- [ ] Download & delete actions

### Phase 7: Polish & Refinement (Week 7-8)
- [ ] Performance optimization
- [ ] Error handling & edge cases
- [ ] Mobile responsiveness
- [ ] Accessibility audit
- [ ] User testing & iteration
- [ ] Documentation

---

## Part 7: Dependencies & Risks

### Dependencies
- **Meta Ads Manager API**: Must be available & stable
- **GHL API**: Already integrated, need lead tracking
- **Google Drive API**: Already integrated, for creatives
- **Firestore**: Already integrated, need schema updates
- **Firebase Auth**: Already integrated

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Meta API rate limits | Campaign sync fails | Implement rate-limit queue, cache results |
| Meta auth token expiry | Broken integrations | Auto-refresh tokens, alert CSM to re-auth |
| GHL lead matching errors | ROAS calculation wrong | Manual verification, audit trail |
| Firestore cost scaling | Budget overrun | Implement index cleanup, archive old data |
| Creative upload failures | CSM workflow blocked | Retry logic, detailed error messages |
| Health score miscalculation | Wrong client prioritization | Unit test formula, manual spot checks |

---

## Part 8: Success Metrics

- **CSM Productivity**: 2x faster to view client health & alerts
- **Campaign Performance**: 15% improvement in tracked ROAS (via linked campaigns)
- **Creative Approval**: 50% faster approval workflow
- **Client Engagement**: CSMs send 3x more proactive alerts/updates
- **System Reliability**: 99.5% uptime for CSM dashboard

---

## Part 9: Questions for Stakeholder Review

1. **Health Score**: Is the weighting (35% ROAS, 25% spend, 25% leads, 15% SLA) correct?
2. **Alerts**: Should alerts auto-resolve or require manual resolution?
3. **Campaigns**: Should CSMs be able to create campaigns, or just view/manage existing?
4. **Creatives**: Who approves creatives—CSM, manager, or auto-approve?
5. **Notifications**: Should CSMs receive Slack/email alerts for critical health changes?
6. **Permissions**: Can client owners see their own health score in the client portal?
7. **Reporting**: Need CSV export of health scores for reporting?
8. **Mobile**: Is mobile support required for CSM dashboard?

---

**Next Step:** Stakeholder review & approval of scope, then proceed to Phase 1 implementation.
