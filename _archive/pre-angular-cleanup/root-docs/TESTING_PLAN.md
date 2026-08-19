# Phase 3 Testing Plan

**Test Date:** August 16, 2026  
**Test Type:** End-to-end integration test  
**Success Criteria:** All phases fire automatically, data flows correctly, CSM + client see updates

---

## Pre-Test Checklist

- [ ] Postgres running locally (`psql -U tag_app_user -d tag_automation`)
- [ ] Hub dev server running (`npm run dev` on port 3000)
- [ ] Functions deployed or accessible
- [ ] GHL API credentials configured
- [ ] Meta API credentials configured
- [ ] Slack webhook configured
- [ ] Email service configured

---

## Test Scenario: Complete Onboarding Flow

### Step 1: Create Test Client in GHL
1. Go to GHL agency dashboard
2. Create new sub-account (or use existing test location)
3. Note the `location_id` — you'll need it for verification

**Expected:** Sub-account created, location_id captured

---

### Step 2: Trigger Phase 1 (CSM action)
1. In GHL, mark client as "Closed Won"
2. Check "Initiate Onboarding" checkbox
3. Phase 1 webhook fires automatically

**Expected:**
- [ ] Slack channel created for client
- [ ] Google Drive folder created (cubby)
- [ ] Intake form email sent to client contact
- [ ] Postgres log entry: `phase1_started` + `phase1_complete`

**Verify:**
```sql
SELECT * FROM automation_logs 
WHERE location_id = 'YOUR_LOCATION_ID' 
AND phase = 'phase1' 
ORDER BY created_at DESC;
```

---

### Step 3: Client Submits Intake Form
1. Client receives intake form email
2. Client fills out form + submits
3. Phase 2 webhook fires automatically

**Expected:**
- [ ] Intake data saved to Firestore
- [ ] Google Doc created with generated content
- [ ] Phase 3 auto-trigger fires (should happen immediately)
- [ ] Postgres log entries: `phase2_started`, `phase3_triggered`

**Verify:**
```sql
SELECT * FROM automation_logs 
WHERE location_id = 'YOUR_LOCATION_ID' 
AND phase IN ('phase2', 'phase3')
ORDER BY created_at DESC;
```

---

### Step 4: Phase 3 Detects Meta Account & Routes
Phase 3 webhook runs automatically after Phase 2

**Two scenarios:**

**Scenario A: Client has existing Meta account**
- [ ] Meta account detection succeeds
- [ ] Access request email sent to client
- [ ] Postgres log: `meta_account_check`, `meta_access_request_sent`

**Scenario B: Client has no Meta account**
- [ ] Meta account check shows no account
- [ ] Setup guide email sent to client
- [ ] Postgres log: `meta_account_check`, `meta_setup_guide_sent`

**Verify:**
```sql
SELECT * FROM automation_logs 
WHERE location_id = 'YOUR_LOCATION_ID' 
AND phase = 'phase3'
ORDER BY created_at DESC;
```

---

### Step 5: CSM Views Phase 3 Status
1. CSM logs into hub at http://localhost:3000
2. CSM navigates to CSM Dashboard
3. CSM clicks on test client
4. CSM clicks on "Meta Setup (Phase 3)" tab

**Expected:**
- [ ] Phase 3 Status tab shows current state
- [ ] Status badge displays correctly
- [ ] Shows: account type (existing/new), current action
- [ ] Shows last event timestamp
- [ ] If error, displays error message

**Expected States:**
```
Status: in_progress → meta_access_requested (if existing account)
Status: in_progress → setup_guide_sent (if new account)
```

---

### Step 6: Client Views Phase 3 Progress
1. Client logs into hub
2. Client navigates to /onboarding
3. Client sees Phase 3 Status Screen

**Expected:**
- [ ] Shows 3-step visual flow
- [ ] Current step highlighted
- [ ] Action items displayed based on account state
- [ ] Status auto-refreshes every 10 seconds

**Expected to show:**
- Step 1: "Check Account Status" ✓ (complete)
- Step 2: "Request Access" or "Create Account" (in progress)
- Step 3: "Launch Campaigns" (upcoming)

---

## Verification Queries

### See all events for a client
```sql
SELECT location_id, phase, event, created_at, details
FROM automation_logs 
WHERE location_id = 'YOUR_LOCATION_ID'
ORDER BY created_at DESC;
```

### See latest status per client/phase
```sql
SELECT * FROM client_automation_status 
WHERE location_id = 'YOUR_LOCATION_ID';
```

### See all errors
```sql
SELECT * FROM automation_errors 
LIMIT 10;
```

### See Phase 3 trigger results from Phase 2
```sql
SELECT * FROM automation_logs 
WHERE phase = 'phase2' 
AND event LIKE 'phase3_%'
ORDER BY created_at DESC;
```

---

## Error Scenarios to Test

### Error 1: Phase 3 fails (e.g., Meta API timeout)
**Action:** Restart functions with invalid Meta credentials temporarily

**Expected:**
- [ ] Phase 2 still completes successfully (graceful degradation)
- [ ] Error logged to Postgres with details
- [ ] CSM sees error in Phase 3 Status tab
- [ ] Error message helps CSM understand what happened

**Verify:**
```sql
SELECT * FROM automation_errors 
WHERE location_id = 'YOUR_LOCATION_ID';
```

### Error 2: Client location not found in Postgres
**Action:** Manually delete test Postgres logs for client

**Expected:**
- [ ] Phase 3 Status tab shows "Phase 3 not yet started"
- [ ] No errors thrown
- [ ] Graceful empty state

---

## Test Success Criteria

✅ **Phase 1 fires** automatically when CSM initiates  
✅ **Phase 2 fires** automatically when client submits  
✅ **Phase 3 fires** automatically after Phase 2  
✅ **All 3 phases logged** to Postgres with correct events  
✅ **CSM can see** Phase 3 status in dashboard  
✅ **Client can see** Phase 3 progress on onboarding screen  
✅ **Status auto-refreshes** without page reload  
✅ **Errors don't block** Phase 2 completion  
✅ **Email notifications** sent correctly  
✅ **Slack alerts** posted correctly  

---

## Test Timeline

| Step | Expected Time | Actual Time | Status |
|------|---------------|-------------|--------|
| Setup (Postgres, hub, functions) | 5 min | | |
| Create test client in GHL | 2 min | | |
| Trigger Phase 1 | <1 min | | |
| Verify Phase 1 in Postgres | 2 min | | |
| Client submits form (Phase 2/3) | 5 min | | |
| Verify Phase 2/3 in Postgres | 2 min | | |
| CSM views Phase 3 tab | 2 min | | |
| Client views onboarding | 2 min | | |
| Test error scenario | 5 min | | |
| **Total** | **~26 min** | | |

---

## What to Look For

### ✅ Success Indicators
- Slack channel appears within 30s of Phase 1 trigger
- Email arrives within 1min of completion
- Postgres log entries appear within 2-3s of event
- CSM dashboard updates within 10s refresh
- No console errors in hub
- No errors in Cloud Functions logs

### ⚠️ Warning Signs
- Email never arrives (check email config)
- Postgres entries missing (check DB connection)
- Phase 3 event says "error" (check Meta credentials)
- CSM tab shows "Failed to load" (check Postgres connection from hub)
- Graceful degradation fails (check Phase 2 → Phase 3 try/catch)

---

## After Testing

If **all tests pass:**
1. Document results in TESTING_RESULTS.md
2. Get approval to deploy to production
3. Deploy hub + functions
4. Monitor first real client through flow

If **any test fails:**
1. Document failure in TESTING_FAILURES.md
2. Debug using queries above
3. Check logs: functions, hub, Postgres
4. Fix issue + re-test

---

## Commands to Have Ready

```bash
# Check Postgres is running
psql -U tag_app_user -d tag_automation -c "SELECT COUNT(*) FROM automation_logs;"

# Check hub dev server logs
tail -f /tmp/hub-dev.log

# Check functions logs (if deployed)
gcloud functions logs read phase3-meta-setup --limit 50

# Restart hub if needed
npm run dev

# Tail Postgres logs
psql -U tag_app_user -d tag_automation -c "SELECT * FROM automation_logs ORDER BY created_at DESC LIMIT 20;"

# Watch for new entries (every 2s)
watch -n 2 'psql -U tag_app_user -d tag_automation -c "SELECT * FROM automation_logs WHERE created_at > NOW() - INTERVAL 5 MINUTES ORDER BY created_at DESC LIMIT 10;"'
```

---

**Ready to test! 🧪**
