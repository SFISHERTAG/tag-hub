# Integration: Phase 2 → Phase 3 Auto-Trigger

**Status:** ✅ Complete  
**Date:** August 16, 2026

---

## Overview

Phase 2 (Intake submission) now automatically triggers Phase 3 (Meta account setup) when the intake form is submitted and processed.

**What changed:**
- Phase 2 webhook now calls Phase 3 webhook at the end
- Passes locationId, email, intakeData, slackChannelId
- Logs trigger success/failure to Postgres
- Gracefully handles Phase 3 errors (doesn't fail Phase 2)

---

## Flow

```
Client submits intake form
  ↓
Phase 2 webhook triggered
  ├─ Save intake data ✓
  ├─ Generate Google Doc ✓
  ├─ Create content (UVP, copy, script, charter) ✓
  ├─ Share with client ✓
  ├─ Update Firestore ✓
  │
  └─ TRIGGER PHASE 3 ← NEW
      ├─ Call Phase 3 webhook (HTTP POST)
      ├─ Pass: locationId, email, intakeData, slackChannelId
      ├─ Log to Postgres: phase3_triggered OR phase3_trigger_error
      └─ Return success (even if Phase 3 fails)
```

---

## Implementation Details

### Files Changed

**`functions/src/webhooks/phase2-intake-submit.ts`**
- Added import: `import { logAutomationEvent } from "../postgres"`
- Added Phase 3 trigger logic at end of handler
- Wraps Phase 3 call in try-catch for graceful degradation
- Logs outcomes to Postgres

### Phase 3 Trigger Logic

```typescript
// Get Phase 3 webhook URL from env or construct from CLOUD_FUNCTIONS_URL
const phase3Url = process.env.PHASE3_WEBHOOK_URL ||
  `${process.env.CLOUD_FUNCTIONS_URL}/webhook/phase3`;

// Make HTTP POST request to Phase 3
const phase3Response = await fetch(phase3Url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    locationId,
    email,
    intakeData,
    slackChannelId,
  }),
});

// Log result to Postgres
if (!phase3Response.ok) {
  // Log error but don't fail Phase 2
  await logAutomationEvent({...});
} else {
  // Log success
  await logAutomationEvent({...});
}
```

---

## Environment Variables

Add these to `.env.local`:

```bash
# Option 1: Direct Phase 3 webhook URL
PHASE3_WEBHOOK_URL=https://us-central1-tag-project.cloudfunctions.net/webhook/phase3

# Option 2: Or use CLOUD_FUNCTIONS_URL (if set)
CLOUD_FUNCTIONS_URL=https://us-central1-tag-project.cloudfunctions.net
```

---

## Postgres Logging

Phase 2 now logs Phase 3 trigger events:

| Event | Status | When |
|-------|--------|------|
| `phase3_triggered` | completed | Phase 3 webhook called successfully |
| `phase3_trigger_failed` | error | Phase 3 webhook returned error |
| `phase3_trigger_error` | error | Network/connection error calling Phase 3 |

**Query recent Phase 2→3 triggers:**
```sql
SELECT locationid, event, status, error, details, created_at
FROM automation_logs
WHERE phase = 'phase2' AND event LIKE 'phase3_%'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Error Handling

**If Phase 3 fails:**
- Phase 2 still completes successfully
- Error logged to Postgres with details
- Client can manually trigger Phase 3 later via API
- Slack notification still goes out (from Phase 2)

**Why graceful degradation?**
- Phase 2 (intake doc creation) is critical path
- Phase 3 (Meta setup) can be retried
- Better UX: client gets their doc even if Meta setup fails

---

## Testing the Integration

### Setup

1. **Postgres running** with schema created
2. **Env vars set:** `PHASE3_WEBHOOK_URL` or `CLOUD_FUNCTIONS_URL`
3. **Dev server running:** `npm run dev`

### Test Flow

**Manual Phase 2 trigger:**
```bash
curl -X POST http://localhost:3000/api/onboarding/phase2-intake-submit \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "test_location_123",
    "email": "client@example.com",
    "intakeData": {
      "clientName": "Test Client",
      "businessName": "Test Business",
      "metaAdAccountId": "act_123456789"
    }
  }'
```

**Expected response:**
```json
{
  "success": true,
  "googleDocId": "...",
  "status": "phase3_triggered",
  "nextStep": "Phase 3 started: Meta account setup"
}
```

**Check Postgres logs:**
```sql
-- Phase 2 events
SELECT event, status FROM automation_logs
WHERE location_id = 'test_location_123' AND phase = 'phase2'
ORDER BY created_at DESC;

-- Should see:
-- phase2_complete | completed
-- phase3_triggered | completed  ← Proof Phase 3 was called
```

### What happens automatically

1. ✅ Google Doc created for intake
2. ✅ Content generated (UVP, copy, script, charter)
3. ✅ Doc shared with client
4. ✅ **Phase 3 webhook called automatically**
5. ✅ Email sent to client (access request or setup guide)
6. ✅ Slack notification sent
7. ✅ Everything logged to Postgres

---

## Monitoring Integration

### Query Phase 2→3 flow for a client

```sql
-- Full audit trail for one client
SELECT 
  phase,
  event,
  status,
  CASE 
    WHEN details IS NOT NULL THEN details->>'status'
    ELSE NULL 
  END as meta_status,
  created_at
FROM automation_logs
WHERE location_id = 'test_location_123'
  AND phase IN ('phase2', 'phase3')
ORDER BY created_at;
```

### Expected output:
```
phase | event                  | status    | meta_status              | created_at
------|------------------------|-----------|--------------------------|------------------
phase2| phase2_complete        | completed | (null)                   | 2026-08-16 10:00:00
phase2| phase3_triggered       | completed | (null)                   | 2026-08-16 10:00:01
phase3| phase3_started         | started   | (null)                   | 2026-08-16 10:00:02
phase3| meta_account_check     | completed | (null)                   | 2026-08-16 10:00:03
phase3| meta_access_request_sent| completed | awaiting_access_grant   | 2026-08-16 10:00:04
```

---

## Fallback: Manual Trigger

If Phase 3 doesn't trigger automatically (for any reason), you can manually trigger it:

```bash
curl -X POST http://localhost:3000/api/onboarding/phase3-meta-setup \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "test_location_123",
    "email": "client@example.com",
    "intakeData": {...},
    "slackChannelId": "C123456789"
  }'
```

---

## Full Onboarding Pipeline (Now Complete)

```
┌─────────────────────────────────────────────┐
│ Phase 1: Provision Resources                │
│ (GHL checkbox + Closed Won)                 │
├─────────────────────────────────────────────┤
│ ✅ Clone GHL sub-account                    │
│ ✅ Create Slack channel                     │
│ ✅ Create Drive folder                      │
│ ✅ Send intake form email                   │
└────────────────┬────────────────────────────┘
                 │ Client submits form
                 ▼
┌─────────────────────────────────────────────┐
│ Phase 2: Intake Processing                  │
│ (Form submission webhook)                   │
├─────────────────────────────────────────────┤
│ ✅ Save intake data                         │
│ ✅ Create Google Doc                        │
│ ✅ Generate content (UVP, copy, script)    │
│ ✅ Share with client                        │
│ ✅ AUTO-TRIGGER PHASE 3 ← NEW!             │
└────────────────┬────────────────────────────┘
                 │ Automatic
                 ▼
┌─────────────────────────────────────────────┐
│ Phase 3: Meta Account Setup                 │
│ (Auto-triggered after Phase 2)              │
├─────────────────────────────────────────────┤
│ ✅ Check if client has Meta account         │
│ ✅ Request access (if exists)               │
│ ✅ Send setup guide (if new)                │
│ ✅ Notify Slack                             │
│ ✅ Log to Postgres                          │
└─────────────────────────────────────────────┘
         ↓ Awaiting client action
  (Grant access OR create account)
```

**Everything logged to Postgres** ✅

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Phase 3 not triggering | Check `PHASE3_WEBHOOK_URL` or `CLOUD_FUNCTIONS_URL` env var |
| Phase 3 URL not found (404) | Ensure webhook is deployed, check URL format |
| Phase 2 fails (timeout) | Check Phase 3 webhook is responsive, may need longer timeout |
| Events not in Postgres | Check Phase 3 webhook, Postgres logging may have failed |
| Email not sent from Phase 3 | Check `MAIL_*` env vars |
| Slack not notified | Check `SLACK_BOT_TOKEN`, verify channel ID |

---

## Next Steps

1. ✅ **Phase 2→3 integration complete**
2. **Test** with real client through full pipeline
3. **Verify** Postgres logging
4. **Monitor** Slack notifications
5. **Verify** email delivery

---

## Files Modified

- `functions/src/webhooks/phase2-intake-submit.ts` — Added Phase 3 trigger
- `functions/docs/PHASE_3_META_SETUP.md` — Phase 3 docs
- `functions/docs/INTEGRATION_PHASE2_TO_PHASE3.md` — This file

---

## Sign-Off

✅ **Phase 2 → Phase 3 Integration: COMPLETE**

Phase 2 now automatically triggers Phase 3 with full error handling, Postgres logging, and graceful degradation.

Ready to test full pipeline! 🚀

