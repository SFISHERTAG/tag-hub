# TAG Project Instructions

This project (TAG - Tax Advisory Growth) is separate from Credit Counsel Elite (CCE).
The global identity rules in Sam's personal CLAUDE.md (Member terminology, CCE org chart,
EOS/L10 cadence references) apply to CCE work only and do NOT apply here.

This worktree (`worktree-angular-migration`) is migrating the frontend from Next.js/React
to Angular. The backend (Firebase Functions in `functions/`, and the `lib/` service layer)
is unaffected by this migration and keeps its existing contracts below unchanged. When this
branch merges back, these become the project's live instructions.

## Working alongside other sessions (read before touching a shared ref)
Several Claude sessions work this repo concurrently, in the main checkout and in worktrees
under `.claude/worktrees/`, sharing one `.git`, one `main`, and one set of hooks. **Read
`docs/AGENT_COORDINATION.md` before moving `main`, before acting on a worktree you do not
own, and before reporting that anything is verified.** The short version:
- Re-read state in the same command as the action. A reading seconds old is a guess.
- Name the commit a check ran against. `cd`-ing into the repo does not tell you the branch —
  the main checkout usually sits on a feature branch, not `main`.
- Never move another session's commits or uncommitted files. Surface them and ask.
- Say what you did *not* do, and ship the undo for anything shared you moved.
- Secrets go from a terminal to their destination, never through a session transcript.

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
  imports from any sibling integration module. Exact target paths are defined in
  `docs/frontend-file-tree.md`, and the boundary is enforced by the `no-restricted-imports`
  zones in `web/eslint.config.js`, which are written directly from that document — move a
  directory in one and you move it in the other, same commit. (Mirrors the backend's
  `lib/**` exception: `core/` and `shared/` may be imported anywhere; integration modules
  may import from them, never from each other. `web/src/app/widget-loaders.ts` is the one
  declared exemption, as the registry's composition root.)
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

## Loop discipline (open one, close one)

Every branch is a promise, and this repo accumulated enough open ones that nothing in
the workflow ever merged, deleted, or declared them dead. Run `npm run loops` for the
current count rather than trusting a number written here; an earlier draft of this
paragraph hardcoded "30", which its own generator already disagreed with. The cost is
not disk: it is that "what is the state of this repo" stops being answerable from refs
and starts requiring a transcript archaeology dig, which is exactly how work gets redone.

- **A session ends by closing its own loop, and saying which.** Merge it, delete the
  branch, push it, or rename it `keep/<reason>`. Four outcomes, no fifth. "Left it on the
  branch" is not a close, and neither is a summary that says the work is ready.
- **`keep/` is the only way to hold a branch open.** The prefix is the declaration, and
  the reason in the name is the point: `keep/awaiting-sam-phase2-call` closes the loop by
  naming who it is waiting on. An undeclared branch older than three days is drift.
- **Never report a loop closed without the ref to prove it.** Name the branch and the SHA,
  and state which of the four outcomes happened. This is the same rule as
  "only green output counts", applied to git rather than to the build.
- **Status is generated, never written.** `npm run loops` prints open branches, stale ones,
  local-only ones, detached and dirty worktrees, read from refs alone. Do not create
  `MERGE_STATUS_<date>.md` or any dated status doc; a file named `-FINAL` next to one named
  `-UPDATED` is the failure this replaces. `npm run check:loops` is the same check with a
  non-zero exit, for CI or a hard session gate.
- **A branch you did not open is not yours to close.** Surface it, per
  `docs/AGENT_COORDINATION.md`. Rescuing work nobody was losing still adds a branch.
- **Infrastructure lands alone, and lands immediately.** A change to `CLAUDE.md`, a hook,
  `.claude/settings.json`, or `scripts/check-*.mjs` goes to `main` as its own commit in the
  session that writes it. Never bundled with feature work, never parked on a branch that
  lives for days. **A rule that is not on `main` does not exist**, and it is inert exactly
  when it would have helped. This check was itself written on a feature branch and sat
  unmerged, so the thing built to police unclosed loops was an unclosed loop. The precedent
  to copy is commit `9ed822b`, where a `check-story-status` fix found mid-story was split
  into its own commit rather than riding along.

## Where the loop report is actually read

**At the start of a session, not the end.** `.claude/settings.json` has a Stop hook that
prints the report, and that is a convenience, not the gate. A Stop hook only fires when a
session stops cleanly. It does not fire on a crash, a kill, a context exhaustion, or a
usage limit — and those are precisely the sessions that strand work. On 2026-08-24 a
session lost two running workflows to a hard usage limit mid-flight; no Stop hook ran.
Relying on it means the report reaches every session that was going to be tidy anyway and
misses every session that actually created the mess.

So a session **begins** by running `npm run loops` and naming what it inherited. A session
start always happens. Reading it at both ends is fine; reading it only at the end is the
failure mode this paragraph exists to prevent.

**`--strict` belongs in CI, not in `pre-commit`.** `npm run check:loops` exits non-zero and
runs in the Contracts job. Blocking a *commit* because some other branch is old trains you
to bypass hooks, and that habit would eventually be carried into `check-secret-scan`.
Blocking a *merge to `main`* is different: aggregate repo state is exactly what `main`
should gate on.

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

The root `npm run build` is **`npm run web:build && stage-angular-bundle && next build`**, not
`next build` alone — corrected 2026-08-26, this paragraph said the latter and the wrong reading
turned CI red. Two consequences, and the second is the one that bit:

- It **never compiles `functions/src`**, so a green root gate proves nothing about functions-side
  code. Story 1.8 landed auth code that way, which is why this is called out rather than left
  implied. `npm run check:functions` runs the functions workspace's own `tsc` and `eslint`.
- It **shells into the `web` workspace first**, so it needs `web/node_modules`. Running it after a
  root-only `npm ci` fails with `ng: not found`. Any job or script invoking the root build must
  install the web workspace's dependencies too.

`functions/` is a separate workspace with its own lockfile and its own `vitest.config.ts`. Without
that local config, `vitest` walks up to the root `vitest.config.mts` and cannot resolve
`vitest/config` from `functions/node_modules` — a resolution error that reads as broken tooling
rather than wrong config.

Do not report progress based on reading the code. Do not say "this should work." Only green
output counts. If the build fails, the phase is not done. This prevents the audit's
scenario where code is "ready to ship" but the closer's query waterfall and Postgres pool
bounds were never actually tested under load.

## Definition of done (for every PR/story/phase)
1. Frontend build compiles (`ng build --configuration production`); backend build compiles
   (`npm run build` in `functions/`)
2. Tests pass (`ng test --watch=false`; `npm run test --watch=false` in `functions/`)
3. Linters pass (`ng lint`; `npm run lint` in `functions/`)
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
