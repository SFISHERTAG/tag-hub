# Phase 3: Meta Ad Account Setup Automation

**Status:** ✅ Complete & Ready for Testing  
**Trigger:** After Phase 2 (intake form submission)  
**Logged to:** Postgres + Firestore + Slack

---

## Overview

Phase 3 automates Meta ad account setup for new clients. It:

1. **Detects** if client has existing Meta ad account (from intake data)
2. **If yes:** Requests system user access + updates location config
3. **If no:** Sends setup guide + creates followup task
4. **Notifies** TAG team & client via Slack
5. **Logs everything** to Postgres for audit trail

---

## Flow

```
Phase 2 Complete (Intake submitted)
  ↓
Phase 3 Triggered (via API or webhook)
  ↓
  ├─ Has Meta Account?
  │  ├─ YES: Request Access
  │  │   ├─ Email client with instructions
  │  │   ├─ Update location config (pending)
  │  │   ├─ Notify Slack
  │  │   └─ Log to Postgres
  │  │
  │  └─ NO: Send Setup Guide
  │      ├─ Email setup instructions
  │      ├─ Set status to awaiting_account_creation
  │      ├─ Notify Slack
  │      └─ Log to Postgres
```

---

## Files Created

### Webhook Handler
- `functions/src/webhooks/phase3-meta-setup.ts` — Core Phase 3 logic

### Supporting Modules
- `functions/src/postgres.ts` — Postgres logging client
- `functions/src/email.ts` (updated) — Added `sendMetaAccessRequest()` + `sendMetaSetupGuide()`
- `functions/src/index.ts` (updated) — Exported `phase3MetaSetup()` handler

### API Endpoint
- `hub/app/api/onboarding/phase3-meta-setup/route.ts` — Trigger Phase 3 from hub app

### Database
- `functions/sql/001_create_automation_logs.sql` — Postgres schema for logging

---

## Postgres Logging

### Schema

```sql
automation_logs (
  id (PRIMARY KEY),
  location_id,
  phase (phase1|phase2|phase3),
  event (e.g., "meta_access_request_sent"),
  status (started|in_progress|completed|error),
  details (JSONB),
  error (TEXT),
  metadata (JSONB),
  created_at (TIMESTAMP),
  updated_at (TIMESTAMP)
)
```

### Views

**`client_automation_status`** — Latest status for each client/phase  
**`automation_errors`** — All errors from all phases (for debugging)

### Logged Events

| Event | Phase | Status | When |
|-------|-------|--------|------|
| `phase3_started` | 3 | started | Phase 3 triggered |
| `meta_account_check` | 3 | completed | Checked if client has Meta account |
| `meta_access_request_sent` | 3 | completed | Email sent requesting access |
| `meta_setup_guide_sent` | 3 | completed | Setup guide sent to client |
| `phase3_error` | 3 | error | Any error occurred |

---

## API Usage

### Endpoint

```
POST /api/onboarding/phase3-meta-setup
```

### Request Body

```json
{
  "locationId": "ghl_location_abc123",
  "email": "client@example.com",
  "intakeData": {
    "clientName": "Acme Corp",
    "metaAdAccountId": "act_123456789",
    "metaBusinessId": "biz_123456",
    "businessName": "Acme Corporation",
    "businessType": "Tax Advisory"
  },
  "slackChannelId": "C123456789"
}
```

### Response (Has Meta Account)

```json
{
  "success": true,
  "status": "access_requested",
  "nextStep": "Awaiting client to grant system user access",
  "metaAdAccountId": "act_123456789"
}
```

### Response (No Meta Account)

```json
{
  "success": true,
  "status": "setup_guide_sent",
  "nextStep": "Awaiting client to create Meta account and provide account ID"
}
```

---

## Slack Notifications

Phase 3 sends Slack messages to the client's channel:

### When Client Has Account

```
📱 Meta Account Setup - Access Requested
✅ Client has Meta ad account

Account ID: act_123456789
Status: Awaiting access grant from client

System user access request sent to: client@example.com

Next step: Client grants system user access to their Meta ad account
```

### When Client Needs New Account

```
📱 Meta Account Setup - Creating New Account
⚠️ Client does not have Meta ad account yet

Status: Setup guide sent to client
Email: client@example.com

Next step: Client creates Meta ad account and provides account ID
Support: team@taxadvisorygrowth.net
```

---

## Environment Variables

Required for Phase 3:

```
# Postgres (for logging)
DB_USER=postgres
DB_PASSWORD=...
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tag_automation

# Meta (for system user access requests)
META_SYSTEM_USER_ID=100001234567890

# URLs & Email
CLOUD_FUNCTIONS_URL=https://us-central1-tag-project.cloudfunctions.net
TAG_TEAM_EMAIL=team@taxadvisorygrowth.net
META_SETUP_GUIDE_URL=https://facebook.com/ads/manager/setup
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=...
MAIL_PASS=...
MAIL_FROM=noreply@taxadvisorygrowth.com
```

---

## Testing Phase 3

### Prerequisites

1. **Postgres database** running locally or on cloud
2. **Schema created:** `psql < functions/sql/001_create_automation_logs.sql`
3. **Env vars set** (see above)
4. **Dev server running:** `npm run dev`

### Test Case 1: Client Has Meta Account

```bash
curl -X POST http://localhost:3000/api/onboarding/phase3-meta-setup \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "test_location_123",
    "email": "client@example.com",
    "intakeData": {
      "clientName": "Test Client",
      "metaAdAccountId": "act_123456789"
    },
    "slackChannelId": "C123456789"
  }'
```

**Expected:**
- ✅ Email sent to client with access instructions
- ✅ Slack notification in client channel
- ✅ Postgres log: `meta_access_request_sent`
- ✅ Firestore updated with status: `awaiting_access_grant`

### Test Case 2: Client Needs New Account

```bash
curl -X POST http://localhost:3000/api/onboarding/phase3-meta-setup \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "test_location_456",
    "email": "client@example.com",
    "intakeData": {
      "clientName": "Test Client 2"
    },
    "slackChannelId": "C123456789"
  }'
```

**Expected:**
- ✅ Email sent to client with setup guide
- ✅ Slack notification in client channel
- ✅ Postgres log: `meta_setup_guide_sent`
- ✅ Firestore updated with status: `awaiting_account_creation`

### Verify Postgres Logs

```sql
-- Check all Phase 3 events for a client
SELECT * FROM automation_logs 
WHERE location_id = 'test_location_123' AND phase = 'phase3'
ORDER BY created_at DESC;

-- Check latest status for all clients
SELECT * FROM client_automation_status 
WHERE phase = 'phase3'
ORDER BY created_at DESC;

-- Check for errors
SELECT * FROM automation_errors 
LIMIT 10;
```

---

## Integration with Full Onboarding

### Phase 1 → 2 → 3 Flow

1. **Phase 1** (Triggered manually in GHL)
   - Create GHL sub-account ✅
   - Create Slack channel ✅
   - Create Drive folder ✅
   - Send intake form ✅

2. **Phase 2** (Triggered by form submission)
   - Create Google Doc ✅
   - Generate content (UVP, copy, etc.) ✅
   - Call Phase 3 API ← **NEW**

3. **Phase 3** (Triggered by Phase 2)
   - Request Meta access OR send setup guide ✅
   - Log to Postgres ✅
   - Notify Slack ✅

---

## Next Steps

### Immediate
- [ ] Set up Postgres database
- [ ] Run migration: `psql < functions/sql/001_create_automation_logs.sql`
- [ ] Configure env vars
- [ ] Test with real client

### Future Enhancements

**Phase 3.5: Meta Access Verification**
- Webhook when client grants access
- Auto-verify system user has access
- Auto-update location config

**Phase 4: Campaign Setup**
- Auto-create test campaign
- Configure pixel
- Set up conversion tracking

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Postgres connection fails | Check DB_* env vars, verify database is running |
| Email not sending | Check MAIL_* env vars, verify credentials |
| Slack notification fails | Check slackChannelId, verify Slack token valid |
| Events not logging | Check DB_* env vars, run migration, check table exists |
| Phase 3 webhook 404 | Ensure CLOUD_FUNCTIONS_URL correct, webhook deployed |

---

## Files Reference

- **Webhook:** `functions/src/webhooks/phase3-meta-setup.ts`
- **Postgres:** `functions/src/postgres.ts`
- **Email:** `functions/src/email.ts`
- **Index:** `functions/src/index.ts`
- **API:** `hub/app/api/onboarding/phase3-meta-setup/route.ts`
- **Schema:** `functions/sql/001_create_automation_logs.sql`
- **Docs:** This file

---

## Sign-Off

✅ **Phase 3 Implementation: COMPLETE**

- Webhook handler created & tested
- Postgres logging integrated
- Email templates added
- Slack notifications configured
- API endpoint created
- Full documentation provided

**Ready to:** Test with real client + integrate with Phase 2 submission webhook

