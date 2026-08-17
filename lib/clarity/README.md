# Clarity Framework

Configurable sales coaching scaffold for TAG. Admins can create and edit scripts organized into tabs, sections, and cards. Closers and setters access the framework for real-time coaching during calls.

## Setup

### 1. Create PostgreSQL Tables

Run the migration in `sql/clarity-schema.sql`:

```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f sql/clarity-schema.sql
```

### 2. Initialize Framework for an Org

```bash
curl -X POST http://localhost:3000/api/admin/clarity/org/{locationId}/init \
  -H "Cookie: hub_session=..." \
  -H "Content-Type: application/json"
```

This seeds the framework with the default call-flow structure (Triage, Diagnostic, Sales, Follow-Up).

## API Endpoints

### For Closers/Setters (Read-Only)

```
GET /api/clarity/org/{orgId}/framework
  Returns the full active framework with all tabs, sections, cards, and scripts
```

### For Admins

```
# Script management (hotpath)
POST   /api/admin/clarity/card/{cardId}/scripts?org_id={orgId}
  { content, why?, notes?, version_tag?, tags? }
  
PATCH  /api/admin/clarity/card/{cardId}/scripts/{scriptId}?org_id={orgId}
  { content?, why?, notes?, version_tag?, tags? }
  
DELETE /api/admin/clarity/card/{cardId}/scripts/{scriptId}?org_id={orgId}

# Audit log
GET    /api/admin/clarity/org/{orgId}/audit-log
  ?limit=100&offset=0
  
# Revert changes
POST   /api/admin/clarity/org/{orgId}/audit-log/{changeId}/revert
```

## Architecture

### Database Schema

- `clarity_frameworks` — Framework versions and metadata
- `clarity_tabs` — Tabs within a framework (Triage, Diagnostic, Sales, Follow-Up)
- `clarity_sections` — Sections within tabs (Opening, Discovery, Goals, etc.)
- `clarity_cards` — Cards within sections (specific coaching points)
- `clarity_scripts` — Script content for each card (versioned)
- `clarity_audit_log` — Audit trail of all changes (revert-capable)

### Hotpath Optimization

The script API (POST/PATCH/DELETE) is optimized for fast edits:
- Direct card-to-script relationship (no deep query chains)
- Indexed on `card_id` for quick retrieval
- Audit logging on every write
- Revert capability via transaction-safe rollback

## Usage

### Seed Initial Framework

```typescript
import { seedClarityFramework } from "@/lib/clarity/seed";

const frameworkId = await seedClarityFramework(orgId, userEmail);
```

### Fetch Full Framework

```typescript
import { getFullFramework } from "@/lib/clarity/db";

const framework = await getFullFramework(orgId);
// Returns { id, version, tabs: [ { label, sections: [ { cards: [ { script } ] } ] } ] }
```

### Log a Change

```typescript
import { logChange } from "@/lib/clarity/db";

const changeId = await logChange(
  orgId,
  "clarity_scripts",
  scriptId,
  "update",
  { content: { old: "...", new: "..." } },
  userEmail,
  "Updated based on Q3 call review"
);
```

### Revert a Change

```typescript
import { revertChange } from "@/lib/clarity/db";

await revertChange(changeId, userEmail);
```

## Notes

- All timestamps are UTC
- The framework is per-location (orgId)
- Scripts are immutable once created; edits create new versions
- Audit log stores complete change history with full old/new values
- Revert is transaction-safe: either all fields revert or none do
