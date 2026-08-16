# Phase 3 Verification Checklist

Use this checklist to verify Phase 3 implementation is working correctly.

---

## Pre-Testing Setup

- [ ] Clone latest code from `feat/brand-cockpit-foundation` branch
- [ ] Install dependencies: `npm install`
- [ ] Set Meta API env vars in `.env.local`:
  ```
  META_BUSINESS_ID=your_business_id
  META_APP_ID=your_app_id
  META_APP_SECRET=your_app_secret
  META_SYSTEM_USER_TOKEN=your_system_user_token
  ```
- [ ] Set Firestore credentials (should already be set)
- [ ] Start dev server: `npm run dev`

---

## File Existence Checks

### New Files
- [ ] `lib/meta/creatives.ts` exists
- [ ] `app/csm-dashboard/actions/get-campaigns-with-creatives.ts` exists
- [ ] `app/csm-dashboard/actions/get-creatives-with-campaigns.ts` exists
- [ ] `app/csm-dashboard/actions/sync-creative-campaigns.ts` exists
- [ ] `scripts/setup-phase3-test-data.ts` exists
- [ ] `docs/PHASE_3_IMPLEMENTATION.md` exists
- [ ] `docs/PHASE_3_API_REFERENCE.md` exists

### Modified Files
- [ ] `lib/meta/campaigns.ts` has `getCampaignCreativeCount()`
- [ ] `app/csm-dashboard/modals/tabs/campaigns-tab.tsx` imports new action
- [ ] `app/csm-dashboard/modals/tabs/creatives-tab.tsx` imports new action
- [ ] `lib/dashboard/csm-clients.ts` uses `firestore()` not `db`

---

## Test Data Setup

- [ ] Run test data script: `npx ts-node scripts/setup-phase3-test-data.ts`
- [ ] Script completes without errors
- [ ] Firestore shows `clients/{clientId}/meta_creatives/` collection created
- [ ] `meta_creatives` documents have `campaigns_using` array
- [ ] Each campaign ref has `{ campaignId, campaignName, status }`

---

## CampaignsTab Verification

1. **Navigate to dashboard:**
   - [ ] Open http://localhost:3000
   - [ ] Sign in as `test@taxadvisorygrowth.net`
   - [ ] Role shows as `tag_csm`
   - [ ] Casey Williams Co appears in client list

2. **Open Casey Williams Co:**
   - [ ] Client detail modal opens
   - [ ] Multiple tabs visible (Overview, Campaigns, Creatives)

3. **Click CampaignsTab:**
   - [ ] Tab loads without errors
   - [ ] Shows "Loading campaigns..." briefly (or immediately)
   - [ ] Campaigns display (if Meta configured and campaigns exist)

4. **Verify campaign cards:**
   - [ ] Campaign name displays
   - [ ] Campaign ID displays
   - [ ] Status badge shows (ACTIVE/PAUSED/etc.)
   - [ ] 24h metrics show (Spend, Impressions, Clicks, Leads)

5. **Creative count badge (NEW):**
   - [ ] Badge shows next to campaign name (e.g., "3 creatives")
   - [ ] Badge color is accent theme
   - [ ] Badge only shows if creative_count > 0
   - [ ] Count is accurate (matches Meta API)

---

## CreativesTab Verification

1. **Click CreativesTab:**
   - [ ] Tab loads without errors
   - [ ] Shows "Loading creatives..." briefly (or immediately)
   - [ ] Creatives display from Google Drive

2. **Verify creative cards:**
   - [ ] Title displays
   - [ ] Format icon shows (🎬 video, 🖼 image, etc.)
   - [ ] Status badge shows (draft, pending-approval, approved, etc.)
   - [ ] Platform badge shows

3. **Campaign usage display (NEW):**
   - [ ] "Used in X campaigns" section appears (if campaigns_using populated)
   - [ ] Section only shows for creatives with campaign links
   - [ ] Campaign names list (up to 2)
   - [ ] "+N more" message shows for creatives in 3+ campaigns

4. **Campaign link accuracy:**
   - [ ] Campaign names match what's in CampaignsTab
   - [ ] Campaign IDs are correct
   - [ ] Campaign status is current

---

## Graceful Degradation Tests

### Test 1: Meta Not Configured
1. [ ] Remove or comment out META_* env vars
2. [ ] Restart dev server
3. [ ] Open CampaignsTab:
   - [ ] Shows empty state (not error)
   - [ ] Message says "No active campaigns found"
4. [ ] Open CreativesTab:
   - [ ] Still shows creatives from Google Drive
   - [ ] campaigns_using is empty
   - [ ] No errors in console

### Test 2: No Test Data
1. [ ] Don't run setup-phase3-test-data.ts
2. [ ] Open CreativesTab:
   - [ ] Shows creatives without campaign links
   - [ ] campaigns_using array is empty
   - [ ] No errors

### Test 3: Firestore Unavailable (Simulate)
1. [ ] Temporarily break Firestore connection (in dev)
2. [ ] Open CreativesTab:
   - [ ] Falls back to creatives without campaign data
   - [ ] Shows creatives successfully
   - [ ] Error logged (should see in console)

---

## Data Sync Verification

1. **Manual sync test:**
   ```typescript
   // In browser console (after navigating to dashboard)
   await syncCreativeToCampaignMappings("cMIc51hn6ziLwWtC8t0n")
   ```
   - [ ] No errors in console
   - [ ] Firestore `meta_creatives` collection updated
   - [ ] `last_synced` timestamp is current

2. **Verify synced data:**
   - [ ] Check Firestore console
   - [ ] `clients/{clientId}/meta_creatives/` documents exist
   - [ ] Documents have `campaigns_using` arrays
   - [ ] Arrays not empty (if campaigns exist)

---

## Performance Checks

1. **CampaignsTab load time:**
   - [ ] Loads in < 2 seconds
   - [ ] No console errors
   - [ ] No memory warnings

2. **CreativesTab load time:**
   - [ ] Loads in < 2 seconds
   - [ ] No console errors
   - [ ] Smooth scrolling through creatives

3. **Network requests:**
   - [ ] CampaignsTab makes campaign API call
   - [ ] CreativesTab makes Firestore read (if data available)
   - [ ] No duplicate requests
   - [ ] No failed requests

---

## TypeScript & Linting

- [ ] No TypeScript errors in Phase 3 files (excluding pre-existing Pages Router issues)
- [ ] All new functions are typed correctly
- [ ] Server actions have "use server" directive
- [ ] Imports are correct (no missing modules)

---

## Browser Compatibility

- [ ] Test in Chrome/Chromium
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Responsive design works (test on mobile view if applicable)

---

## Edge Cases

1. **Creative in many campaigns:**
   - [ ] Shows "Used in 10+ campaigns" correctly
   - [ ] List truncates with "+X more" message
   - [ ] No layout breaks

2. **Campaign with no creatives:**
   - [ ] Badge shows "0 creatives" (or doesn't show)
   - [ ] No errors

3. **Very long campaign names:**
   - [ ] Text truncates or wraps gracefully
   - [ ] No UI breaks

4. **Special characters in names:**
   - [ ] Displays correctly
   - [ ] No encoding issues

---

## Sign-Off

### Testing Complete?
- [ ] All checks above passed
- [ ] No unexpected errors
- [ ] Data displays accurately
- [ ] Performance acceptable

### Issues Found?
Document them here:
```
Issue: [description]
Severity: [critical/high/medium/low]
Steps to reproduce: [...]
Expected: [...]
Actual: [...]
```

### Ready for Production?
- [ ] All critical issues resolved
- [ ] Acceptable trade-offs documented
- [ ] Team has signed off

---

## Rollback Plan

If issues found during production deployment:

1. [ ] Revert git commits for Phase 3
2. [ ] Redeploy previous working version
3. [ ] Document issue in GitHub
4. [ ] Schedule follow-up fix in next sprint

---

## Post-Deployment

- [ ] Monitor error logs for first 24 hours
- [ ] Check Firestore write quota
- [ ] Verify no performance regression
- [ ] Gather CSM feedback
- [ ] Plan Phase 3.5 enhancements based on feedback

