# TAG Project Instructions

This project (TAG - Tax Advisory Growth) is separate from Credit Counsel Elite (CCE).
The global identity rules in Sam's personal CLAUDE.md (Member terminology, CCE org chart,
EOS/L10 cadence references) apply to CCE work only and do NOT apply here.

This worktree (`worktree-angular-migration`) is migrating the frontend from Next.js/React
to Angular. The backend (Firebase Functions in `functions/`, and the `lib/` service layer)
is unaffected by this migration and keeps its existing contracts below unchanged. When this
branch merges back, these become the project's live instructions.

## Terminology override
- Use "client" (not "Member") for this project's customers.
- No other CCE-specific identity rules apply unless explicitly stated in this file.

## Frontend stack (detect, do not assume)
Run `ng version` and `npm view @angular/core version` (and `npm view @angular/material
version`) before writing any Angular code. Target the installed/latest major. Verify the
Material theming API against that version's own docs before touching styles — the M3
token API has changed across releases. If the installed API differs from what you expect,
stop and report; do not guess. Do not hardcode a version number anywhere in code or docs.

## Non-negotiable frontend constraints
- Angular Material only. No Tailwind, no Bootstrap, no CSS-in-JS.
- Material Design 3 spec. Theme via `mat.theme()` / M3 system tokens.
- ZERO `!important`. Zero deep selectors (`::ng-deep`, `>>>`). If a visual result can't be
  achieved via M3 tokens, stop and say so instead of forcing it. Overriding M3 system
  tokens (`--mat-sys-*`) once beats fighting individual component styles forever.
- Standalone components. Signals for state. `inject()` over constructor DI. New control
  flow (`@if`, `@for`). `OnPush` everywhere.
- Strict TS. `strictTemplates: true`. No `any`. No non-null assertions.

## Theme contract
All color flows from token overrides in one file: `src/styles/_theme.scss`. Body
`#000000`. Widget/card surfaces and borders derive from `surface-container` /
`outline-variant` M3 tokens, NOT hardcoded hex — a raw near-black-on-black hex pairing
(e.g. `#0C0C0C` on `#000000`) reads as basically invisible on a phone in daylight, so let
the token system carry elevation instead of eyeballing contrast in a mockup. No component
`.scss` may declare a raw hex color. Ever. Font stack: `-apple-system, BlinkMacSystemFont,
Roboto, sans-serif`. No Product Sans — it is not licensed for third-party use.

One responsive shell, not two separate layouts: `mat-toolbar` + `mat-sidenav` at >=840px,
`mat-toolbar` + bottom nav at <840px, same component tree, breakpoint-driven.

## Google Identity Services (branding)
Google sign-in uses the Google Identity Services rendered button per Google's branding
guidelines. Do not rebuild or reskin it in Material — wrap it, don't reproduce it.

## PWA note
`ng add @angular/pwa` is fine for install/offline-cache basics, but iOS evicts storage
from unused home-screen web apps after roughly 7 days, and push requires the user to have
actually added the app to their home screen first. Do not architect anything
offline-critical (data integrity, queued writes) around PWA storage persistence.

## Architecture isolation (prevent cross-contamination)
Each integration (GHL, Meta, Google Drive, Slack) is a module with zero imports from
sibling integrations, in both the Angular frontend and the backend:
- Backend: shared utility (HTTP, auth, logging) goes to `lib/` and is imported by all
  integrations; cross-integration calls go through the API, never direct function imports.
- Frontend: each integration is a standalone, lazy-loaded Angular feature module with zero
  imports from any sibling integration module. Exact target paths are defined in the Phase
  1 file tree; enforce the boundary via ESLint import rules once that structure exists
  (mirroring the backend's `lib/**` exception: shared Angular services/pipes/directives may
  be imported anywhere, integration modules may import from shared, never from each other).
- Widgets register through a `WidgetRegistry` and are resolved at runtime by ID + required
  permission. The dashboard shell knows nothing about GHL, Meta, or any other integration.
- All HTTP goes through typed service layers. No raw `HttpClient` calls in components.

Do not relax this boundary to avoid a refactor. If you want to call GHL logic from Meta,
add an API endpoint instead. This boundary is what prevented the audit's duplicate GHL
client (`functions/src/ghl.ts` vs. `lib/ghl/`) from drifting into silent failure — without
it, each integration re-implements the same auth/retry logic independently.

## Data model as contract (one source of truth)
All data stores (Firestore, Postgres, cache TTLs) are documented in a single file:
`docs/data-model.md`. Schema changes, table adds, collection structure, and the reason
each store exists (primary vs. cache vs. audit log) live here. This is backend state and
is unaffected by the frontend framework migration.

Code may not declare a new Firestore collection or Postgres table without updating
`docs/data-model.md` in the same commit. Pre-commit hook enforces this.

If a data model change would cause a split-brain (same entity in two stores with no
backfill plan), the hook blocks the commit. This prevents the Firestore→Postgres migration
from being declared Done in docs but unfinished in code (the audit's high-severity finding
on data integrity).

## Security & permission contract
All roles and permissions are defined in one place: `lib/auth/roles.ts`. No role string
may appear in backend code, Angular components, templates, or route guards except via a
direct reference to `ROLES.*` or a call to `PermissionService`.

Example: ✗ `if (role === "tag_admin")`, ✓ `if (hasRole(ROLES.ADMIN))`. This constraint is
enforced by a grep pre-commit check. It catches the audit's `"tag_admin"` vs. `"admin"`
mismatch at commit time, not in production.

Angular-specific enforcement:
- `authGuard` (session) and `permissionGuard` (RBAC claim) on every route.
- Two interceptors: `authInterceptor` (token injection, refresh-on-401 with a single
  in-flight refresh) and `errorInterceptor` (see error handling strategy below).
- Permission checks in Angular go through one `PermissionService`. Never inline a role
  string in a component or template. Use a `*hasPermission` structural directive for UI
  gating.
- UI gating is cosmetic. Assume the API re-checks. Never treat a hidden button as a
  security control.

## Error handling strategy (one pattern for all)
Backend: all HTTP/Firestore/external-API calls go through one error interceptor,
`lib/api/errorInterceptor.ts` — network errors, 40x, 50x, timeout, and rate-limit all log
to the same place and return a typed result, never silent-catch-to-empty. No service may
catch and swallow an error; catch only to enrich context, then re-throw or log + return
`{ error, data: null }`. This prevents the audit's "revoked token renders as $0 spend"
pattern.

Frontend: the Angular `errorInterceptor` is the client-side counterpart of the same
contract — every `HttpClient` call flows through it, and it applies the same rule (log,
never silently swallow, surface a typed error to the component).

## Secrets & environment (detect, never assume)
No hardcoded GCP project, API key, or database URL anywhere in code. All config reads from
environment or a secret manager at startup. `lib/config.ts` is the only place that reads
`process.env`, and it validates every key at import time.

A missing or invalid config key throws immediately on app start. This catches the audit's
fallback to production project ID silently when a dev deploys without
`GOOGLE_CLOUD_PROJECT` set.

Seed scripts (`scripts/setup-*.ts`) detect `NODE_ENV` and the target GCP project before any
`.set()` write. No exceptions.

## Story discipline (BMAD)
- A story's code and its `docs/stories/*.md` Status/Tasks are one unit of work. Never land
  the code in a commit without updating Status and checking off Tasks in the same commit,
  and never flip Status to Done without the code actually being in that commit.
- Implement stories via the `bmad-dev-story` skill, not ad hoc edits or `bmad-quick-dev`,
  when the work is scoped to a story doc.
- A pre-commit hook (`.git/hooks/pre-commit` calling `scripts/check-story-status.mjs`, also
  runnable as `npm run check:story-status`) blocks commits where a story's Status
  contradicts its own Tasks checklist, or where a commit touches a story's referenced files
  without staging that story's doc. Do not bypass with `--no-verify` to skip a real status
  update, fix the doc instead. If the hook is flagging a false positive, fix the check,
  don't route around it.

## Output discipline
- Keep responses terse: state what changed and what's next, don't restate file contents,
  don't narrate implementation step by step. The diff is the report.
- Prefer `ng generate` over hand-writing boilerplate.
- Read a file once. Use grep/glob to target, not repeated full-file reads.
- Batch independent tool calls in a single round.
- No speculative work past a phase gate — stop and wait for approval.

## Build + test as the gate (not code review)
Frontend: a phase is not done until `ng build --configuration production && ng lint && ng
test --watch=false` all pass. Backend/`functions/`: unchanged — `npm run build && npm run
test --watch=false && npm run lint` (run from `functions/`) must pass.

Do not report progress based on reading the code. Do not say "this should work." Only green
output counts. If the build fails, the phase is not done. This prevents the audit's
scenario where code is "ready to ship" but the closer's query waterfall and Postgres pool
bounds were never actually tested under load.

## Definition of done (for every PR/story/phase)
1. Frontend build compiles (`ng build --configuration production`); backend build compiles
   (`npm run build` in `functions/`)
2. Tests pass (`ng test --watch=false`; `npm run test --watch=false` in `functions/`)
3. Linters pass (`ng lint`; `npm run lint` in `functions/`)
4. Story Status and Tasks are updated in `docs/stories/*.md` (same commit)
5. If a story touches a data model, `docs/data-model.md` is updated
6. If a story adds a permission check, `lib/auth/roles.ts` is updated
7. Pre-commit hooks pass (never `--no-verify`)

## Carry over from global instructions
- No em dashes.
- Tone: corporate, concise, executive.
- Response pattern: outcome, driver, next_action.
- Explicit permission required before: sending messages on Sam's behalf, modifying/deleting
  files, scheduling/canceling calendar events, making changes in external systems.
