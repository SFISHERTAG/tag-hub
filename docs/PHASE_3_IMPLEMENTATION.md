# CSM Dashboard Phase 3 - Implementation Summary

**Date:** August 16, 2026  
**Status:** Core infrastructure complete, ready for integration testing  
**Branch:** `feat/brand-cockpit-foundation`

---

## Overview

Phase 3 implements creatives-to-campaigns linking, enabling CSMs to see which client creatives (submitted to cubby) are used in which Meta Ads campaigns. This provides visibility into campaign composition and helps identify which client assets are driving performance, without requiring paid actor talent.

**Business Context:**
- Cubby folder = Client's creative submission space (alternative to hiring actors)
- Phase 3 links cubby creatives to Meta campaigns
- CSMs can now see: "This client asset is being used in these 3 campaigns"

---

## Architecture

### Data Flow

```
Meta API
  ├─ getCampaignsForClient()
  │   └─ Returns campaigns with 24h metrics
  │
  ├─ getCreativesForCampaign(campaignId)
  │   └─ Returns ads (creatives) in a campaign
  │
  └─ getCampaignCreativeCount(campaignId)
      └─ Returns count of ads per campaign

Firestore (clients/{clientId}/meta_creatives)
  ├─ Stores creative records
  ├─ campaigns_using: array of { campaignId, campaignName, status }
  ├─ last_synced: timestamp
  └─ Used for offline reference and quick lookup

UI Components
  ├─ CampaignsTab
  │   ├─ Shows campaigns with creative count badge
  │   └─ Counts loaded from Meta API (per-campaign query)
  │
  └─ CreativesTab
      ├─ Shows creatives from Google Drive
      ├─ Enriches with Firestore meta_creatives data
      └─ Displays campaign links in creative card
```

---

## Files Created

### 1. **lib/meta/creatives.ts** — Meta API integration
Core functions for fetching and mapping creatives from Meta API.

**Key exports:**
- `getCreativesForCampaign(campaignId)` — Fetch all ads in a campaign
- `getCreativeDetail(creativeId)` — Get single ad details
- `mapCreativesToCampaignLinks()` — Helper to format campaign references

**Data model:**
```typescript
interface MetaCreative {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  created_time: string;
  effective_status?: string;
  adset_id?: string;
  campaign_id?: string;
}

interface CreativeCampaignLink {
  campaignId: string;
  campaignName: string;
  status: string;
}
```

### 2. **lib/meta/campaigns.ts** — Enhanced campaign fetching
Added function to count creatives per campaign.

**New export:**
- `getCampaignCreativeCount(campaignId)` — Get ad count for a campaign

### 3. **app/csm-dashboard/actions/get-campaigns-with-creatives.ts**
Server action that enriches campaigns with creative counts.

**Functionality:**
- Fetches client's Meta ad account from Firestore
- Gets all campaigns via Meta API
- Enriches each campaign with creative count
- Returns `CampaignWithCreativeCount[]`

**Used by:** CampaignsTab (replaces direct getCampaignsForClient call)

### 4. **app/csm-dashboard/actions/get-creatives-with-campaigns.ts**
Server action that enriches Google Drive creatives with Meta campaign data.

**Functionality:**
- Fetches creatives from Google Drive via existing data-fetchers
- Looks up Meta creative records in Firestore (clients/{clientId}/meta_creatives)
- Merges campaign references into creative data
- Graceful fallback if Firestore lookup fails (returns empty campaigns_using)

**Used by:** CreativesTab (new integration point)

### 5. **app/csm-dashboard/actions/sync-creative-campaigns.ts**
Server action to sync Meta creative-campaign mappings to Firestore.

**Functionality:**
- Fetches all campaigns for client
- For each campaign, fetches its ads from Meta API
- Stores creatives with campaigns_using array in Firestore
- Updates last_synced timestamp
- Handles batch writes for performance

**Schema created:**
```
clients/{clientId}/meta_creatives/{creativeId}
  {
    id: string,
    name: string,
    status: string,
    effective_status: string,
    created_time: string,
    adset_id: string,
    campaigns_using: [
      { campaignId, campaignName, status }
    ],
    last_synced: ISO timestamp
  }
```

### 6. **scripts/setup-phase3-test-data.ts**
Script to populate Firestore with test creative-campaign mappings.

**Usage:**
```bash
npx ts-node scripts/setup-phase3-test-data.ts
```

Creates sample creatives linked to test campaigns for the Casey Williams Co test client.

---

## UI Updates

### CampaignsTab
**Changes:**
- Now imports `getCampaignsWithCreativesForClient` (new action)
- Displays creative count badge next to campaign name
- Badge shows: "X creatives" (singular/plural)
- Badge styling: accent color background with icon

**Before:**
```
Campaign Name (ID)
Spend | Impressions | Clicks | Leads
```

**After:**
```
Campaign Name  [3 creatives]  (ID)
Spend | Impressions | Clicks | Leads
```

### CreativesTab
**Changes:**
- Now imports `getCreativesWithCampaigns` (new action)
- Enriches Google Drive creatives with Meta campaign data
- Displays campaign usage in creative card

**Creative card now shows:**
```
[Thumbnail]
Title
Status | Platform
─────────────────
[If campaigns exist]
Used in X campaigns
  - Campaign Name
  - Campaign Name 2
  +1 more
```

---

## How to Use

### For CSMs

1. **View campaign composition:**
   - Open CampaignsTab
   - See number of creatives in each campaign
   - Click creative count badge (TODO: add drill-down)

2. **See creative usage:**
   - Open CreativesTab
   - Scroll through creatives
   - See which campaigns each creative is used in

3. **Cross-reference:**
   - Click campaign name in creative card (TODO: add navigation)
   - Jumps to CampaignsTab and highlights campaign

### For Developers

**Sync creative mappings manually:**
```typescript
import { syncCreativeToCampaignMappings } from "@/app/csm-dashboard/actions/sync-creative-campaigns";

// In a component or action
await syncCreativeToCampaignMappings(clientId);
```

**Fetch creatives with campaigns:**
```typescript
import { getCreativesWithCampaigns } from "@/app/csm-dashboard/actions/get-creatives-with-campaigns";

const creatives = await getCreativesWithCampaigns(clientId, locationId);
// Returns: CreativeWithCampaigns[]
```

**Fetch campaigns with creative counts:**
```typescript
import { getCampaignsWithCreativesForClient } from "@/app/csm-dashboard/actions/get-campaigns-with-creatives";

const campaigns = await getCampaignsWithCreativesForClient(clientId);
// Returns: CampaignWithCreativeCount[]
```

---

## Testing

### Manual Testing

1. **Setup test data:**
   ```bash
   npx ts-node scripts/setup-phase3-test-data.ts
   ```

2. **View in dashboard:**
   - Sign in as `test@taxadvisorygrowth.net` (role: `tag_csm`)
   - Navigate to Casey Williams Co client
   - Open CampaignsTab → See creative counts
   - Open CreativesTab → See campaign references

3. **Test graceful degradation:**
   - Disable Meta API (remove env vars)
   - CampaignsTab should show no campaigns (or empty state)
   - CreativesTab should still show creatives from Google Drive (no campaign data)

### Automated Testing (TODO)

- Unit tests for meta/creatives.ts
- Integration tests for server actions
- E2E tests for tab cross-navigation

---

## Known Limitations & Future Work

### Current Phase 3
- Creative counts loaded per-campaign (not batch-optimized)
- Campaign references in CreativesTab are read-only
- No cross-tab navigation (clicking campaign doesn't jump to CampaignsTab)
- Sync only runs on-demand (not scheduled)

### Phase 3.5 (Enhancement)
- [ ] Add click handler to campaign names → navigate to CampaignsTab
- [ ] Add drill-down from creative count badge → show creatives used in campaign
- [ ] Batch optimization for creative count queries
- [ ] Periodic sync job (daily/hourly)

### Phase 4 (Analytics)
- Trend analysis of creative usage over time
- Performance metrics by creative across campaigns
- A/B testing framework for creatives

---

## Error Handling

All functions degrade gracefully:

1. **Meta API not configured:**
   - Functions return empty arrays
   - UI shows "No campaigns found" or "No Meta data"
   - App continues to work with Google Drive creatives

2. **Firestore lookup fails:**
   - getCreativesWithCampaigns falls back to creatives without campaign data
   - campaigns_using array is empty
   - UI still renders, just without campaign section

3. **Individual campaign fails:**
   - That campaign is skipped
   - Other campaigns still process
   - Error logged to console

---

## Database Schema Reference

### Firestore: clients/{clientId}/meta_creatives/{creativeId}
```typescript
{
  // Creative data from Meta API
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  effective_status?: string;
  created_time: string;
  adset_id?: string;

  // Campaign references (Phase 3)
  campaigns_using: Array<{
    campaignId: string;
    campaignName: string;
    status: string;
  }>;

  // Sync metadata
  last_synced: ISO timestamp string;
}
```

---

## Integration Checklist

- [x] Core Meta API functions (lib/meta/creatives.ts)
- [x] Campaign enrichment (getCampaignCreativeCount)
- [x] Server actions for data fetching
- [x] CampaignsTab UI updates
- [x] CreativesTab UI updates
- [x] Firestore schema definitions
- [x] Test data scripts
- [ ] Cross-tab navigation (Phase 3.5)
- [ ] Scheduled sync jobs (Phase 4)
- [ ] Performance metrics (Phase 4)
- [ ] Automated tests

---

## Next Steps

1. **Test with real Meta API:**
   - Set Meta credentials in .env.local
   - Run app and verify campaigns load
   - Check creative counts display correctly

2. **Test Firestore sync:**
   - Run setup-phase3-test-data.ts
   - Verify meta_creatives collection populated
   - Check campaigns_using array in documents

3. **User acceptance testing:**
   - Have CSM test campaign viewing workflow
   - Verify creative-campaign links are accurate
   - Confirm no performance regressions

4. **Implement cross-navigation (Phase 3.5):**
   - Add click handlers to campaign names in CreativesTab
   - Add drill-down from creative count badge in CampaignsTab
   - Add tab switching logic

---

## References

- **Meta Marketing API docs:** https://developers.facebook.com/docs/marketing-api
- **Firestore structure:** docs/CSM_DASHBOARD_CONTEXT.md
- **Phase 2 context:** docs/PHASE_3_CONTEXT.md
- **Test data setup:** scripts/setup-phase3-test-data.ts
