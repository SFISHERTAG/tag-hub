# Creatives-to-campaigns linking — API reference

Renamed 2026-08-23. This was `docs/PHASE_3_API_REFERENCE.md`, and "Phase 3"
named two unrelated workstreams at once: the CSM dashboard work this file
describes, and the client-provisioning webhook that is now story 5.13. Nothing
but context distinguished them.

**The code this describes is live** (`lib/meta/creatives.ts`,
`app/api/clients/[clientId]/creatives/route.ts`) **and no story or epic owns
it.** That is a gap, not a claim the work is unwanted. See
`AGENT_COORDINATION.md` §11.

Reference for the functions and types introduced by that work.

---

## Server-Side Functions

### lib/meta/creatives.ts

#### `getCreativesForCampaign(campaignId: string): Promise<MetaCreative[]>`

Fetch all ads (creatives) for a given campaign from Meta API.

**Parameters:**
- `campaignId` (string) — Meta campaign ID (e.g., "123456789")

**Returns:**
- Array of `MetaCreative` objects sorted by creation date (newest first)
- Empty array if Meta is not configured or API call fails

**Example:**
```typescript
const creatives = await getCreativesForCampaign("123456789");
console.log(creatives); // [ { id, name, status, ... } ]
```

**Error handling:**
- Logs error to console
- Returns empty array (doesn't throw)

---

#### `getCreativeDetail(creativeId: string): Promise<MetaCreative | null>`

Fetch detailed information about a specific ad/creative.

**Parameters:**
- `creativeId` (string) — Meta ad ID

**Returns:**
- `MetaCreative` object or null if not found
- null if Meta is not configured

**Example:**
```typescript
const creative = await getCreativeDetail("987654321");
if (creative) {
  console.log(creative.name); // "Spring Campaign Video"
}
```

---

#### `mapCreativesToCampaignLinks(creatives: MetaCreative[], campaignId: string, campaignName: string, campaignStatus: string): CreativeCampaignLink[]`

Helper to format creatives into campaign reference objects.

**Parameters:**
- `creatives` — Array of MetaCreative objects
- `campaignId` — Meta campaign ID
- `campaignName` — Human-readable campaign name
- `campaignStatus` — Campaign status (ACTIVE, PAUSED, etc.)

**Returns:**
- Array of `CreativeCampaignLink` objects

**Example:**
```typescript
const creatives = await getCreativesForCampaign("campaign_id");
const links = mapCreativesToCampaignLinks(
  creatives,
  "campaign_id",
  "Spring Campaign",
  "ACTIVE"
);
// Returns: [{ campaignId: "...", campaignName: "Spring Campaign", status: "ACTIVE" }, ...]
```

---

### lib/meta/campaigns.ts

#### `getCampaignCreativeCount(campaignId: string): Promise<number>`

Get the count of ads in a campaign (no details, just count).

**Parameters:**
- `campaignId` (string) — Meta campaign ID

**Returns:**
- Number of ads in the campaign
- 0 if Meta is not configured or API call fails

**Example:**
```typescript
const count = await getCampaignCreativeCount("campaign_id");
console.log(count); // 5
```

**Performance note:**
- Lightweight query (only returns ID field)
- Good for badges/counters

---

### Server Actions

#### `getCampaignsWithCreativesForClient(clientId: string): Promise<CampaignWithCreativeCount[]>`

**File:** `app/csm-dashboard/actions/get-campaigns-with-creatives.ts`

Server action that enriches campaigns with creative counts.

**Flow:**
1. Loads client from Firestore
2. Gets Meta ad account ID from client.meta_ad_account_id
3. Fetches campaigns from Meta API
4. For each campaign, adds creative count (parallel)
5. Returns enriched campaigns

**Parameters:**
- `clientId` (string) — Firestore client ID

**Returns:**
- Array of `CampaignWithCreativeCount`:
  ```typescript
  interface CampaignWithCreativeCount extends MetaCampaign {
    creative_count: number;
  }
  ```

**Example:**
```typescript
// In a Client Component
const campaigns = await getCampaignsWithCreativesForClient(clientId);
// [ { id, name, status, ..., creative_count: 5 }, ... ]
```

**Error handling:**
- Returns empty array if client not found
- Returns empty array if no Meta account configured
- Returns empty array if API call fails (logged to console)

---

#### `getCreativesWithCampaigns(clientId: string, locationId: string): Promise<CreativeWithCampaigns[]>`

**File:** `app/csm-dashboard/actions/get-creatives-with-campaigns.ts`

Server action that enriches Google Drive cubby creatives with Meta campaign data.

**Flow:**
1. Fetches creatives from Google Drive cubby folder (via data-fetchers)
   - Cubby = Client's creative submission folder (alternative to paid actors)
2. Loads meta_creatives collection from Firestore
3. Merges campaign references into creatives
4. Returns enriched creatives (or empty campaigns_using on failure)

**Parameters:**
- `clientId` (string) — Firestore client ID
- `locationId` (string) — GHL location ID

**Returns:**
- Array of `CreativeWithCampaigns`:
  ```typescript
  interface CreativeWithCampaigns extends CreativeForDisplay {
    campaigns_using?: CampaignRef[];
  }
  ```

**Example:**
```typescript
// In a Client Component
const creatives = await getCreativesWithCampaigns(clientId, locationId);
// [
//   {
//     id: "file_123",
//     title: "Hero Video",
//     campaigns_using: [
//       { campaignId: "c1", campaignName: "Spring", status: "ACTIVE" }
//     ]
//   },
//   ...
// ]
```

**Error handling:**
- Falls back to creatives without campaign data if Firestore fails
- campaigns_using is empty array if lookup fails
- Logs errors to console

---

#### `syncCreativeToCampaignMappings(clientId: string): Promise<void>`

**File:** `app/csm-dashboard/actions/sync-creative-campaigns.ts`

Server action to sync Meta creative-campaign mappings to Firestore.

**Flow:**
1. Gets client and Meta ad account ID from Firestore
2. Fetches all campaigns from Meta API
3. For each campaign, fetches its ads
4. Stores ads in clients/{clientId}/meta_creatives/{adId}
5. Populates campaigns_using array (avoids duplicates)
6. Updates last_synced timestamp
7. Uses batch writes for efficiency

**Parameters:**
- `clientId` (string) — Firestore client ID

**Returns:**
- Promise that resolves when sync completes

**Example:**
```typescript
// Sync creatives for a client
await syncCreativeToCampaignMappings(clientId);
console.log("Creative mappings synced!");

// Then load the synced data
const creatives = await getCreativesWithCampaigns(clientId, locationId);
```

**Error handling:**
- Throws error if client not found
- Logs warnings if Meta not configured
- Logs error details to console if API fails
- Partial sync on failure (already-written batches commit)

**Performance:**
- Batch writes (efficient)
- Parallel creative fetches (one API call per campaign)
- Safe for large account (100 ads per campaign limit)

---

## Type Definitions

### MetaCreative

```typescript
interface MetaCreative {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  created_time: string;
  effective_status?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
}
```

**Fields:**
- `id` — Meta ad ID (from ads table)
- `name` — Ad name/creative name
- `status` — Current ad status
- `effective_status` — Actual status (may differ from status field)
- `created_time` — ISO timestamp when ad was created
- `adset_id` — Ad set ID (parent of ad)
- `adset_name` — Ad set name (optional)
- `campaign_id` — Campaign ID (parent of ad set)
- `campaign_name` — Campaign name (optional, populated by caller)

---

### CreativeCampaignLink

```typescript
interface CreativeCampaignLink {
  campaignId: string;
  campaignName: string;
  status: string;
}
```

**Purpose:** Lightweight reference to a campaign from a creative.

**Fields:**
- `campaignId` — Meta campaign ID
- `campaignName` — Display name for UI
- `status` — Campaign status (ACTIVE, PAUSED, etc.)

---

### CampaignWithCreativeCount

```typescript
interface CampaignWithCreativeCount extends MetaCampaign {
  creative_count: number;
}
```

**Extends:** `MetaCampaign` (from lib/meta/campaigns.ts)

**Additional field:**
- `creative_count` — Number of ads in this campaign

---

### CreativeWithCampaigns

```typescript
interface CreativeWithCampaigns extends CreativeForDisplay {
  campaigns_using?: CampaignRef[];
}
```

**Extends:** `CreativeForDisplay` (from lib/dashboard/data-fetchers.ts)

**Additional field:**
- `campaigns_using?` — Array of campaign references (optional, defaults to [])

**Type of CampaignRef:**
```typescript
interface CampaignRef {
  campaignId: string;
  campaignName: string;
  status: string;
}
```

---

## Firestore Schema

### clients/{clientId}/meta_creatives/{creativeId}

Document structure for storing creative-campaign mappings:

```typescript
{
  // Meta API fields
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
  last_synced: string; // ISO timestamp
}
```

**Index recommendations:**
- Composite on `(campaigns_using.campaignId, last_synced)` for efficient lookups

---

## Environment Variables

All Phase 3 functions check for Meta configuration via:

```typescript
import { isMetaConfigured } from "@/lib/meta/client";

if (!isMetaConfigured()) {
  // Meta API not available
}
```

**Required env vars:**
- `META_BUSINESS_ID`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_SYSTEM_USER_TOKEN`

See `.env.example` for setup details.

---

## Error Patterns

All Phase 3 functions follow graceful degradation:

```typescript
// Pattern 1: Return empty array on error
const creatives = await getCreativesForCampaign(id);
// Returns [] if error

// Pattern 2: Return null on error
const creative = await getCreativeDetail(id);
// Returns null if error

// Pattern 3: Throw on sync action
await syncCreativeToCampaignMappings(id);
// Throws if client not found

// Pattern 4: Fallback in server action
const creatives = await getCreativesWithCampaigns(clientId, locationId);
// Falls back to creatives without campaign data if Firestore lookup fails
```

**Console logging:**
- All errors logged to console with context
- Warnings logged for missing config
- Errors logged with function name and parameters

---

## Usage Patterns

### Pattern 1: Load campaigns with creative counts (CampaignsTab)

```typescript
"use client";
import { getCampaignsWithCreativesForClient } from "@/app/csm-dashboard/actions/get-campaigns-with-creatives";

export function CampaignsTab({ client }: CampaignsTabProps) {
  const [campaigns, setCampaigns] = useState([]);
  
  useEffect(() => {
    async function load() {
      const data = await getCampaignsWithCreativesForClient(client.id);
      setCampaigns(data);
    }
    load();
  }, [client.id]);

  return campaigns.map(campaign => (
    <div key={campaign.id}>
      {campaign.name}
      {campaign.creative_count > 0 && (
        <span className="badge">{campaign.creative_count} creatives</span>
      )}
    </div>
  ));
}
```

### Pattern 2: Load creatives with campaign links (CreativesTab)

```typescript
"use client";
import { getCreativesWithCampaigns } from "@/app/csm-dashboard/actions/get-creatives-with-campaigns";

export function CreativesTab({ client }: CreativesTabProps) {
  const [creatives, setCreatives] = useState([]);
  
  useEffect(() => {
    async function load() {
      const data = await getCreativesWithCampaigns(client.id, client.ghl_location_id);
      setCreatives(data);
    }
    load();
  }, [client.id, client.ghl_location_id]);

  return creatives.map(creative => (
    <div key={creative.id}>
      {creative.title}
      {creative.campaigns_using?.length > 0 && (
        <div>Used in {creative.campaigns_using.length} campaigns</div>
      )}
    </div>
  ));
}
```

### Pattern 3: Sync creative mappings on demand

```typescript
import { syncCreativeToCampaignMappings } from "@/app/csm-dashboard/actions/sync-creative-campaigns";

// Button click handler
async function handleSync() {
  try {
    await syncCreativeToCampaignMappings(clientId);
    console.log("Creative mappings synced!");
    // Optionally refresh data
  } catch (error) {
    console.error("Sync failed:", error);
  }
}
```

---

## Testing

### Test with setup script

```bash
# Populate test Firestore data
npx ts-node scripts/setup-phase3-test-data.ts

# Run dev server
npm run dev

# Navigate to dashboard
# Sign in as test@taxadvisorygrowth.net
# View Casey Williams Co
# Check CampaignsTab and CreativesTab
```

### Test API directly (server action)

```typescript
import { getCampaignsWithCreativesForClient } from "@/app/csm-dashboard/actions/get-campaigns-with-creatives";

// In a server component or action
const campaigns = await getCampaignsWithCreativesForClient("cMIc51hn6ziLwWtC8t0n");
console.log(campaigns);
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Meta not configured" error | Set all 4 env vars (META_BUSINESS_ID, etc.) |
| Empty creatives array | Check if creatives exist in Meta Ads Manager |
| campaigns_using always empty | Run setup-phase3-test-data.ts or sync action |
| Firestore lookup fails | Check Firestore security rules allow reads |
| Performance slow | Consider caching or batch optimization (Phase 3.5) |

---

## Migration Guide

### From Phase 2 → Phase 3

**CampaignsTab update:**
```diff
- import { getCampaignsForClient } from "../actions/get-campaigns";
+ import { getCampaignsWithCreativesForClient } from "../actions/get-campaigns-with-creatives";

- const data = await getCampaignsForClient(client.id);
+ const data = await getCampaignsWithCreativesForClient(client.id);

- campaigns.map(campaign => (
+ campaigns.map((campaign: CampaignWithCreativeCount) => (
    <CampaignCard key={campaign.id} campaign={campaign} />
  ))
```

**CreativesTab update:**
```diff
- const data = await fetchCreatives(client.ghl_location_id);
+ const data = await getCreativesWithCampaigns(client.id, client.ghl_location_id);
```

---
