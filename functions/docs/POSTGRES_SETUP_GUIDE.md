# Postgres Setup Guide

**Status:** ✅ Complete  
**Database:** tag_automation  
**User:** tag_app_user  
**Connection:** localhost:5432

---

## What Was Set Up

✅ **Database created:** `tag_automation`  
✅ **Tables created:**
- `automation_logs` — Full audit trail of all Phase 1, 2, 3 events
- Indexes for performance (location_id, phase, status, created_at, composite)

✅ **Views created:**
- `client_automation_status` — Latest status for each client/phase
- `automation_errors` — All errors for debugging

✅ **User created:** `tag_app_user`  
✅ **Permissions:** SELECT, INSERT on tables + sequence

---

## Database Details

### Connection String

```
postgresql://tag_app_user:tag_automation_dev@localhost:5432/tag_automation
```

### Tables

**automation_logs**
```sql
id (PRIMARY KEY)
location_id (VARCHAR) — GHL location/client ID
phase (VARCHAR) — 'phase1', 'phase2', 'phase3'
event (VARCHAR) — Event name (e.g., 'meta_access_request_sent')
status (VARCHAR) — 'started', 'in_progress', 'completed', 'error'
details (JSONB) — Event-specific data
error (TEXT) — Error message (if status='error')
metadata (JSONB) — Additional context
created_at (TIMESTAMP) — When event occurred
updated_at (TIMESTAMP) — Last update
```

### Indexes

- `idx_automation_logs_location_id` — Fast lookup by client
- `idx_automation_logs_phase` — Fast lookup by phase
- `idx_automation_logs_status` — Fast lookup by status
- `idx_automation_logs_created_at` — Fast time-range queries
- `idx_automation_logs_location_phase` — Composite index for common query

### Views

**client_automation_status**
- Latest event for each client/phase combination
- Use to see "where is client X in the pipeline?"

**automation_errors**
- All events with status='error'
- Use to debug failures

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# Postgres (pre-configured, no changes needed)
DB_USER=tag_app_user
DB_PASSWORD=tag_automation_dev
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tag_automation

# Cloud Functions URL (for local testing)
CLOUD_FUNCTIONS_URL=http://localhost:8080

# Meta API (get from Facebook)
META_BUSINESS_ID=your_business_id
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_SYSTEM_USER_TOKEN=your_system_user_token
META_SYSTEM_USER_ID=100001234567890

# Email (Gmail SMTP)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_app_password
MAIL_FROM=noreply@taxadvisorygrowth.com

# Team
TAG_TEAM_EMAIL=team@taxadvisorygrowth.net
```

---

## Testing Connection

### Test 1: Connect to database

```bash
psql -d tag_automation -c "SELECT current_database();"
```

Expected output:
```
 current_database
──────────────────
 tag_automation
(1 row)
```

### Test 2: Verify tables exist

```bash
psql -d tag_automation -c "
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';"
```

Expected output:
```
        table_name        
──────────────────────────
 automation_logs
 client_automation_status
 automation_errors
(3 rows)
```

### Test 3: Test insert

```bash
psql -d tag_automation -c "
INSERT INTO automation_logs 
  (location_id, phase, event, status, details)
VALUES 
  ('test_123', 'phase1', 'test_event', 'completed', '{\"test\":true}')
RETURNING id, location_id, event, created_at;"
```

Expected: Inserted 1 row with ID, timestamp, etc.

### Test 4: Query test data

```bash
psql -d tag_automation -c "
SELECT * FROM automation_logs WHERE location_id = 'test_123';"
```

Expected: Row with your test data

---

## Using in Node.js

The `functions/src/postgres.ts` module handles connection pooling:

```typescript
import { logAutomationEvent } from "../postgres";

await logAutomationEvent({
  locationId: "ghl_123",
  phase: "phase3",
  event: "meta_access_request_sent",
  status: "completed",
  details: { metaAdAccountId: "act_123" }
});
```

The module automatically:
- Creates connection pool
- Retries failed connections
- Handles errors gracefully
- Closes pool on app shutdown

---

## Common Queries

### Get all events for a client

```sql
SELECT phase, event, status, created_at 
FROM automation_logs 
WHERE location_id = 'ghl_123'
ORDER BY created_at DESC;
```

### Get client status (latest event per phase)

```sql
SELECT * FROM client_automation_status 
WHERE location_id = 'ghl_123'
ORDER BY created_at DESC;
```

### Get all errors

```sql
SELECT location_id, phase, event, error, created_at 
FROM automation_errors 
ORDER BY created_at DESC 
LIMIT 20;
```

### Get Phase 3 triggers from Phase 2

```sql
SELECT location_id, phase, event, status, details 
FROM automation_logs 
WHERE phase = 'phase2' AND event LIKE 'phase3_%'
ORDER BY created_at DESC;
```

### Timeline for one client

```sql
SELECT 
  phase, 
  event, 
  status, 
  created_at,
  CASE WHEN error IS NOT NULL THEN error ELSE '' END as error
FROM automation_logs 
WHERE location_id = 'ghl_123'
ORDER BY created_at;
```

### Daily event counts

```sql
SELECT 
  DATE(created_at) as date,
  phase,
  COUNT(*) as event_count,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
FROM automation_logs 
GROUP BY DATE(created_at), phase
ORDER BY date DESC;
```

---

## Monitoring

### Dashboard: Current Pipeline Status

```bash
watch -n 5 'psql -d tag_automation -c "
SELECT 
  location_id,
  phase,
  status,
  event,
  created_at
FROM client_automation_status 
ORDER BY created_at DESC 
LIMIT 10;"'
```

Refreshes every 5 seconds to see real-time updates.

### Check for stuck clients

```sql
SELECT 
  location_id,
  MAX(phase) as latest_phase,
  COUNT(*) as event_count
FROM automation_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY location_id
HAVING COUNT(*) < 5;  -- Less than 5 events in 24h might indicate stuck
```

### Recent errors

```sql
SELECT 
  location_id,
  phase,
  event,
  error,
  created_at
FROM automation_errors
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## Backup & Recovery

### Backup database

```bash
pg_dump -U tag_app_user -d tag_automation > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore from backup

```bash
psql -d tag_automation < backup_20260816_120000.sql
```

### Export data to CSV

```bash
psql -d tag_automation -c "
COPY automation_logs TO STDOUT WITH CSV HEADER;" > automation_logs.csv
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `role "tag_app_user" does not exist` | User already created, or role wasn't created. Run the role creation SQL above. |
| `database "tag_automation" does not exist` | Database created successfully. This shouldn't happen. |
| Connection timeout | Verify Postgres is running: `pg_isready -h localhost -p 5432` |
| Permission denied | Verify user has permissions: `GRANT SELECT, INSERT ON automation_logs TO tag_app_user;` |
| Can't connect from app | Check DB_* env vars match connection string above |
| Views return empty | Check that tables exist: `SELECT COUNT(*) FROM automation_logs;` |

---

## Data Retention

Current setup has **no automatic cleanup**. For production:

```sql
-- Delete logs older than 90 days (run monthly)
DELETE FROM automation_logs 
WHERE created_at < NOW() - INTERVAL '90 days';

-- Archive to separate table (optional)
CREATE TABLE automation_logs_archive AS 
SELECT * FROM automation_logs 
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## Test Data

Sample data already inserted:
- **test_client_001** — Full Phase 1 → 2 → 3 pipeline
- **test_client_002** — Phase 3 error scenario

Query to see:
```sql
SELECT location_id, COUNT(*) as event_count, MAX(created_at) as latest
FROM automation_logs
GROUP BY location_id;
```

---

## Summary

✅ **Postgres running:** localhost:5432  
✅ **Database created:** tag_automation  
✅ **Schema deployed:** tables, indexes, views  
✅ **User created:** tag_app_user (password: tag_automation_dev)  
✅ **Test data inserted:** test_client_001, test_client_002  
✅ **Env vars template:** functions/.env.example  

**Ready to test Phase 1 → 2 → 3 with full Postgres logging!** 🚀

