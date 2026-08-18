# TAG Structural Constraints

This document explains the enforcement mechanisms in place to prevent the classes
of bugs surfaced in the August 2026 launch audit.

## Enforcement layers

### 1. ESLint (architecture isolation)

**File:** `eslint.config.mjs`

Prevents cross-integration imports. Each integration module (GHL, Meta, Drive,
Slack) is isolated—it can only import from `lib/**` (shared utilities) and 
internal to its own folder. Cross-integration calls go through the API.

**Example blocks:**
- ✗ `app/ghl/page.tsx` importing from `app/meta/`
- ✗ `app/dashboard/` importing from `functions/`
- ✓ `app/ghl/` importing from `lib/ghl/` or `lib/auth/`

**Why:** The August audit found a duplicate GHL client (`functions/src/ghl.ts`
vs. `lib/ghl/`) that drifted silently. Enforcing isolation at the import level
catches this at commit time.

### 2. Pre-commit hook (data model, role strings, seed scripts)

**File:** `scripts/check-story-status.mjs`

Runs before every commit and validates:

#### 2a. Role string literals
- **Rule:** No inline role strings like `"admin"` or `"tag_admin"`. 
- **Enforcement:** grep for role literals and flag unless `ROLES.*` or imports are present.
- **Why:** The audit found `"tag_admin"` hardcoded but the real role is `"admin"`.
  Centralizing in `lib/auth/roles.ts` with strong typing catches typos + drift.

#### 2b. Data model sync
- **Rule:** If this commit touches `lib/firestore.ts`, `lib/postgres.ts`, 
  `functions/sql/`, or `app/actions.ts`, then `docs/data-model.md` must also 
  be staged.
- **Enforcement:** pre-commit hook checks staged files.
- **Why:** The audit found Postgres schema defined but no application writes,
  with Firestore as the "true" system despite schema claiming otherwise. 
  Syncing code + docs forces you to answer "why is this in Postgres?" at commit time.

#### 2c. Seed script guards
- **Rule:** Every seed script (`scripts/setup-*.ts` or `.mjs`) must check 
  `NODE_ENV` and `GOOGLE_CLOUD_PROJECT` before any `.set()` write.
- **Enforcement:** pre-commit hook parses script content.
- **Why:** The audit found seed scripts with hardcoded client ID, no environment
  checks, silent fallback to production project. These guards prevent production
  data corruption.

### 3. Documentation (single source of truth)

**File:** `docs/data-model.md`

Documents every data store, table/collection, why it exists, sync/backfill status,
and replicas. When this file and code get out of sync, the pre-commit hook catches
it (see 2b above).

**Also reference:**
- `lib/auth/roles.ts` — every role definition (replaces inline strings)
- `CLAUDE.md` — architectural and story discipline rules

---

## What the audit would have caught with these constraints

| Finding | Constraint | Caught at |
|---|---|---|
| Duplicate GHL client drifting | ESLint isolation | commit time |
| Seed scripts overwriting prod clients | pre-commit (seed guard) | commit time |
| Role `"tag_admin"` vs. `"admin"` mismatch | pre-commit (role strings) | commit time |
| Postgres schema but no code writes | pre-commit + docs | commit time |
| CSM portfolio data source unclear | `docs/data-model.md` | commit time + future reads |
| Onboarding webhooks open (no verification) | N/A—this is a design decision | code review only |

The webhooks and access control bugs require code review; constraints enforce
the architectural decisions that make those bugs less likely to hide.

---

## How to apply constraints to new work

Every story or feature checklist should include:

1. **Run pre-commit checks locally before pushing:**
   ```bash
   npm run check:story-status
   ```
   This runs the full suite (story drift + role strings + data model + seed scripts).

2. **ESLint must pass:**
   ```bash
   npm run lint
   ```
   New integration modules must respect the isolation boundary.

3. **If this touches data:**
   - Add table/collection to `docs/data-model.md` and explain why it exists.
   - If modifying an existing entity, note whether it's now in two stores
     (and why a backfill plan is paired with it).

4. **If this adds a permission check:**
   - Add the role constant to `lib/auth/roles.ts`.
   - Use `ROLES.*` in code, never inline strings.

---

## Overrides and exceptions

**Never use `--no-verify` to skip pre-commit checks.** If the hook is wrong:
- Fix the hook (it lives in `scripts/`).
- Fix the doc (it lives in `docs/`).
- Re-stage, then commit.

If the hook needs to be smarter, file a note in the CLAUDE.md `## Improvements`
section and fix it before the next story. Bypassing teaches the team that
constraints are optional, which is exactly how the audit gaps accumulated.

---

## Maintenance

As architecture changes, keep three files in sync:
1. `CLAUDE.md` — the rule in plain language
2. `eslint.config.mjs` or `scripts/check-story-status.mjs` — the enforcement
3. `docs/data-model.md` (or similar single-source docs) — the canonical reference

A constraint that is documented but not enforced is eventually ignored.
A constraint that is enforced but not documented confuses future engineers.
Both must be kept together.
