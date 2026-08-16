# CSM Dashboard Phase 3 - Continuation Prompt

**Date:** August 16, 2026  
**Status:** Phase 2 complete, ready for Phase 3  
**Branch:** `feat/brand-cockpit-foundation`

---

## Current State (End of Phase 2)

### Completed ✅
- **Phase 1:** CSM Portfolio Dashboard (9 components, Firestore data layer, test data)
- **Phase 2:** Live Meta Ads integration (campaigns fetcher, real-time metrics, CampaignsTab)

### Live in CampaignsTab
- Real campaign data from Meta Ads API
- 24h metrics: spend, impressions, clicks, leads, ROAS
- Status badges and performance cards
- Error handling for unconfigured Meta accounts

### Git History
- `be2479b` — Phase 2 docs update
- `6d97634` — Phase 2: Meta campaigns integration start
- `6907204` — Phase 1 stories update
- `ad61a03` — Phase 1 completion summary

---

## Phase 3 - Creatives Campaign Linking

### Goal
Link creatives (from CreativesTab) to campaigns (from CampaignsTab) so CSMs can see which assets are used in each campaign.

### Tasks
1. **Schema Update** — Add `campaigns_using` array to creatives in Firestore
   - Structure: `{ campaignId, campaignName, status }`

2. **Meta Integration** — Fetch creative usage from Meta API
   - Get ads per campaign → Extract creative IDs → Match to local creatives

3. **UI Updates**
   - CreativesTab: Show which campaigns each creative is in
   - CampaignsTab: Show creatives used in each campaign
   - Cross-navigation between tabs

4. **Data Sync**
   - Periodic sync of creative-to-campaign mapping from Meta
   - Handle deleted campaigns/creatives gracefully

### Files to Modify/Create
- `lib/meta/campaigns.ts` — Add getCreativesForCampaign()
- `lib/meta/creatives.ts` — NEW: Map creatives to campaigns
- `app/csm-dashboard/modals/tabs/creatives-tab.tsx` — Show campaign links
- `app/csm-dashboard/modals/tabs/campaigns-tab.tsx` — Show creatives used
- `lib/dashboard/csm-clients.ts` — Update creative schema

### Test Data Needed
- Update Casey Williams Co's creatives to include `campaigns_using` array
- Link test creatives to test campaign

---

## Testing Strategy

1. Start dev server with Meta credentials set
2. Test CampaignsTab loads live campaign data
3. Update test creative to link to test campaign
4. Verify cross-navigation in UI
5. Check error handling for missing campaigns

---

## Files to Check
- `lib/meta/client.ts` — Meta API client (already hooked up)
- `lib/meta/campaigns.ts` — Campaign data fetcher (Phase 2)
- `app/csm-dashboard/modals/tabs/campaigns-tab.tsx` — Campaign display (Phase 2)
- `app/csm-dashboard/modals/tabs/creatives-tab.tsx` — Creative display (Phase 1)
- `docs/PHASE_1_COMPLETION.md` — Full Phase 1 summary
- `docs/CSM_DASHBOARD_CONTEXT.md` — Full technical context

---

## Key Decisions Made

1. **Meta Credentials:** All in .env.local (META_BUSINESS_ID, META_APP_ID, META_APP_SECRET, META_SYSTEM_USER_TOKEN)
2. **Firestore Schema:** clients/{clientId} with meta_ad_account_id field
3. **View Mode:** Read-only (no campaign creation in Phase 2/3)
4. **Graceful Degradation:** Features work without Meta config, show helpful messages

---

## Next Steps After Phase 3

- Phase 1.5: Health weights adjustment modal
- Phase 4: Analytics & trend analysis
- Phase 5: Campaign creation & optimization

---

## To Start Phase 3

1. Verify Meta campaigns are showing in CampaignsTab
2. Create getCreativesForCampaign() in lib/meta/campaigns.ts
3. Update Firestore schema to add campaigns_using to creatives
4. Link CreativesTab and CampaignsTab with campaign references
5. Test cross-navigation and error cases

**Ready to build!** 🚀
