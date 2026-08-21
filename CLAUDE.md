# TAG Project Instructions

This project (TAG - Tax Advisory Growth) is separate from Credit Counsel Elite (CCE).
The global identity rules in Sam's personal CLAUDE.md (Member terminology, CCE org chart,
EOS/L10 cadence references) apply to CCE work only and do NOT apply here.

## Terminology override
- Use "client" (not "Member") for this project's customers.
- No other CCE-specific identity rules apply unless explicitly stated in this file.

## Story status discipline
- A story's code and its `docs/stories/*.md` Status/Tasks are one unit of work. Never land
  the code in a commit without updating Status and checking off Tasks in the same commit,
  and never flip Status to Done without the code actually being in that commit.
- Implement stories via the `bmad-dev-story` skill, not ad hoc edits or `bmad-quick-dev`,
  when the work is scoped to a story doc. dev-story tracks status as part of its steps.
- A pre-commit hook (`.git/hooks/pre-commit` calling `scripts/check-story-status.mjs`, also
  runnable as `npm run check:story-status`) blocks commits where a story's Status contradicts
  its own Tasks checklist, or where a commit touches a story's referenced files without
  staging that story's doc. Do not bypass with `--no-verify` to skip a real status update,
  fix the doc instead. If the hook is flagging a false positive, fix the check, don't route
  around it.

## Architecture isolation (prevent cross-contamination)
Each integration (GHL, Meta, Google Drive, Slack) is a module with zero imports from
sibling integrations. Shared utility (HTTP, auth, logging) goes to `lib/` and is
imported by all. Cross-integration calls go through the API, never direct function
imports.

Enforce via ESLint: `app/ghl/**` cannot import from `app/meta/**`, etc.
Exception: `lib/**` may import anywhere; integrations may import from `lib/**`.
Do not relax this boundary to avoid a refactor. If you want to call GHL logic
from Meta, add an API endpoint instead.

This boundary prevented the audit's duplicate GHL client (`functions/src/ghl.ts` 
vs. `lib/ghl/`) from drifting into silent failure. Without it, each integration
re-implements the same auth/retry logic independently.

## Data model as contract (one source of truth)
All data stores (Firestore, Postgres, cache TTLs) are documented in a single
file: `docs/data-model.md`. Schema changes, table adds, collection structure,
and the reason each store exists (primary vs. cache vs. audit log) live here.

Code may not declare a new Firestore collection or Postgres table without
updating `docs/data-model.md` in the same commit. Pre-commit hook enforces this.

If a data model change would cause a split-brain (same entity in two stores with
no backfill plan), the hook blocks the commit. This prevents the Firestore→Postgres
migration from being declared Done in docs but unfinished in code (the audit's
high-severity finding on data integrity).

## Permission model as API contract (not inline strings)
All roles and permissions are defined in one place: `lib/auth/roles.ts`.
No role string may appear in component code, templates, or route guards except
via a direct reference to `ROLES.*` or a call to `PermissionService`.

Example: ✗ `if (role === "tag_admin")`, ✓ `if (hasRole(ROLES.ADMIN))`.

This constraint is enforced by a grep pre-commit check. It catches the audit's
`"tag_admin"` vs. `"admin"` mismatch at commit time, not in production.

## Error handling strategy (one pattern for all)
All HTTP/Firestore/external-API calls go through one error interceptor.
`lib/api/errorInterceptor.ts` defines the contract: network errors, 40x, 50x,
timeout, and rate-limit all log to the same place and return a typed result,
never silent-catch-to-empty.

No service may catch and swallow an error. Catch only to enrich context, then
re-throw or log + return `{ error, data: null }`. This prevents the audit's
"revoked token renders as $0 spend" pattern.

## Secrets &amp; environment (detect, never assume)
No hardcoded GCP project, API key, or database URL anywhere in code. All config
reads from environment or a secret manager at startup. `lib/config.ts` is the
only place that reads `process.env`, and it validates every key at import time.

A missing or invalid config key throws immediately on app start. This catches
the audit's fallback to production project ID silently when a dev deploys
without `GOOGLE_CLOUD_PROJECT` set.

Seed scripts (`scripts/setup-*.ts`) detect `NODE_ENV` and the target GCP
project before any `.set()` write. No exceptions.

## Build + test as the gate (not code review)
Phases of work have gates. A phase is not done until `npm run build && npm run test --watch=false && npm run lint` all pass.

`npm run build` is `next build`, which never compiles `functions/src`. Any story touching
`functions/**` must also pass `npm run check:functions` (the functions workspace's own `tsc`
and `eslint`). Story 1.8 landed functions-side auth code against a green root gate that
proved nothing about it, which is the whole reason this line exists.

Do not report progress based on reading the code. Do not say "this should work."
Only green output counts. If the build fails, the phase is not done.

This prevents the audit's scenario where code is "ready to ship" but the closer's
query waterfall and Postgres pool bounds were never actually tested under load.

## Definition of done (for every PR/story)
1. Code compiles (`npm run build`)
2. Tests pass (`npm run test --watch=false`)
3. Linter passes (`npm run lint`)
4. If the story touches `functions/**`, `npm run check:functions` passes
5. Story Status and Tasks are updated in `docs/stories/*.md` (same commit)
6. If a story touches a data model, `docs/data-model.md` is updated
7. If a story adds a permission check, `lib/auth/roles.ts` is updated
8. Pre-commit hooks pass (never `--no-verify`)

## Carry over from global instructions
- No em dashes.
- Tone: corporate, concise, executive.
- Response pattern: outcome, driver, next_action.
- Explicit permission required before: sending messages on Sam's behalf, modifying/deleting
  files, scheduling/canceling calendar events, making changes in external systems.
