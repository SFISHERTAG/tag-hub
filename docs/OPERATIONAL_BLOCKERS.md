# Operational Blockers — Gate & Deployment

**Status:** Active issues that block gates or deplete bandwidth. Last updated 2026-08-23.

---

## 1. Migration 010 Unapplied (Postgres)

**File:** `functions/sql/010_course_progress_reporting.sql`  
**What it does:** Creates index on `course_progress(course_id)` for query performance  
**Status:** On disk, not applied to database  
**Blocker:** `npm run check:migrations` reports drift and fails the gate  

**Root cause:** Migration requires `CREATE INDEX` privilege. The application user (`tag_app_user`) has read-write on tables but not schema modification rights. Migrations must be applied by the owner or a superuser.

**How to fix:**
1. Connect to Postgres as the owner or a user with schema-modification privilege
2. Run `psql -U <owner> -d tag_db < functions/sql/010_course_progress_reporting.sql`
3. Manually insert a row into `schema_migrations`:
   ```sql
   INSERT INTO schema_migrations (filename, checksum, applied_at)
   VALUES (
     '010_course_progress_reporting.sql',
     '<sha256-hash>',
     now()
   );
   ```
   (Get the sha256 hash from running `npm run check:migrations` — it will show in the comparison.)
4. Re-run `npm run check:migrations` — should report "No drift"

**Permanent solution:** Decide the migration privilege model:
- **Option A:** Have ops apply all Postgres migrations with owner privilege, once per environment setup
- **Option B:** Drop the migration (index can be added by application code at startup if not exists)
- **Option C:** Change the migration to use conditional logic that works with `tag_app_user` privilege level

**Impact:** Non-blocking for dev (migrations report drift but build continues). Blocking for production deploys if the check is gated. Check if `npm run check:migrations` is in the production gate before shipping 10.4.

---

## 2. Root npm ci in check:functions Gate (Performance)

**Issue:** `npm run check:functions` runs `npm ci` at the root, which installs the whole monorepo (5m20s on the current machine).

**Why it exists:** The functions linter needs eslint, which was not declared in `functions/package.json`, so the build fell back to the root. With root installed, eslint plugins and the Next.js config were also pulled in.

**Status:** Fixed (2026-08-23)
- Added `eslint` and `eslint-plugin-import` to `functions/package.json` devDependencies
- Created `functions/eslint.config.mjs` with a minimal config that doesn't reference Next.js plugins
- Scope change: `npm --prefix functions run build` and `npm --prefix functions run lint` now install only functions dependencies

**Expected improvement:** Gate time should drop from 5m20s to ~1m (functions only, no root node_modules bloat)

**Verification:** Run `npm --prefix functions ci && npm --prefix functions run build && npm --prefix functions run lint` locally and time it.

---

## Next Steps (Before 10.4 Start)

- [ ] **Migration 010:** Determine privilege model (A/B/C above) and implement permanent fix, or manually apply + verify `check:migrations` passes
- [ ] **check:functions gate:** Verify new timing with `npm --prefix functions ci` and confirm it's sub-2min
- [ ] If either is still blockedby ops access, document and defer; neither blocks code work, only gates
