# Flow Framework

Configurable sales coaching scaffold for TAG. Admins can create and edit scripts organized into tabs, sections, and cards. Closers and setters access the framework for real-time coaching during calls.

## Setup

### 1. Create PostgreSQL Tables

Run the migration in `sql/flow-schema.sql`:

```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f sql/flow-schema.sql
```

### 2. Initialize Framework for an Org

```bash
curl -X POST http://localhost:3000/api/admin/flow/org/{locationId}/init \
  -H "Cookie: hub_session=..." \
  -H "Content-Type: application/json"
```

This seeds the framework with the default call-flow structure (Triage, Diagnostic, Sales, Follow-Up).

## API Endpoints

### For Closers/Setters (Read-Only)

```
GET /api/flow/org/{orgId}/framework
  Returns the full active framework with all tabs, sections, cards, and scripts
```

### For Admins

```
# Script management (hotpath)
POST   /api/admin/flow/card/{cardId}/scripts?org_id={orgId}
  { content, why?, notes?, version_tag?, tags? }
  
PATCH  /api/admin/flow/card/{cardId}/scripts/{scriptId}?org_id={orgId}
  { content?, why?, notes?, version_tag?, tags? }
  
DELETE /api/admin/flow/card/{cardId}/scripts/{scriptId}?org_id={orgId}

# Audit log
GET    /api/admin/flow/org/{orgId}/audit-log
  ?limit=100&offset=0
  
# Revert changes
POST   /api/admin/flow/org/{orgId}/audit-log/{changeId}/revert
```

## Architecture

### Database Schema

- `flow_frameworks` — Framework versions and metadata
- `flow_tabs` — Tabs within a framework (Triage, Diagnostic, Sales, Follow-Up)
- `flow_sections` — Sections within tabs (Opening, Discovery, Goals, etc.)
- `flow_cards` — Cards within sections (specific coaching points)
- `flow_scripts` — Script content for each card (versioned)
- `flow_audit_log` — Audit trail of all changes (revert-capable)

### Hotpath Optimization

The script API (POST/PATCH/DELETE) is optimized for fast edits:
- Direct card-to-script relationship (no deep query chains)
- Indexed on `card_id` for quick retrieval
- Audit logging on every write
- Revert capability via transaction-safe rollback

## Usage

### Seed Initial Framework

```typescript
import { seedFlowFramework } from "@/lib/flow/seed";

const frameworkId = await seedFlowFramework(orgId, userEmail);
```

### Fetch Full Framework

```typescript
import { getFullFramework } from "@/lib/flow/db";

const framework = await getFullFramework(orgId);
// Returns { id, version, tabs: [ { label, sections: [ { cards: [ { script } ] } ] } ] }
```

### Log a Change

```typescript
import { logChange } from "@/lib/flow/db";

const changeId = await logChange(
  orgId,
  "flow_scripts",
  scriptId,
  "update",
  { content: { old: "...", new: "..." } },
  userEmail,
  "Updated based on Q3 call review"
);
```

### Revert a Change

```typescript
import { revertChange } from "@/lib/flow/db";

await revertChange(changeId, userEmail);
```

## Notes

- All timestamps are UTC
- The framework is per-location (orgId)
- Scripts are immutable once created; edits create new versions
- Audit log stores complete change history with full old/new values
- Revert is transaction-safe: either all fields revert or none do
