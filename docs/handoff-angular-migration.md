# Handoff — TAG Angular migration

Written 2026-08-20 for a session with zero prior context. Everything here was
verified, not recalled. Where a claim proved wrong during the work, the
correction is recorded rather than the original.

---

## Start here

```
Repo:     /Users/home/projects/TAG
Worktree: /Users/home/projects/TAG/.claude/worktrees/phase-3-readiness-f8d481
Branch:   claude/phase-3-readiness-f8d481  (== main, fast-forwarded)
```

Read `CLAUDE.md` first. It is binding and it is enforced by hooks, not honour.

`main` is **32 commits ahead of `origin/main`** and has not been pushed.
`origin/main` is what production runs. **Pushing `main` deploys all 32.**

---

## State of the world

**Production (`origin/main`)** is the Next.js app, serving clients today at
`https://hub.taxadvisorygrowth.com` and `https://tag-hub-git-vdsoboedgq-uc.a.run.app`.
It has working auth: `app/signin/*`, the OTP endpoints, `lib/auth/roles.ts`,
multi-role claims. Do not let anyone tell you otherwise; an adversarial review
claimed production "has no login at all" and it was wrong.

**The Angular app** is at `web/`. Foundation complete, screens almost absent:
1 real route (`/signin`), 6 components, 3,919 LOC mostly infrastructure. The
Next app is 15,006 LOC across 29 page routes.

**Nothing has been cut over.** No Angular route is served to anyone.

---

## The three facts that shape everything

**1. The Angular bundle is not shipped and nothing routes to it.**
`Dockerfile:31` runs `npm run build` (Next only) and `:48-50` copy
`.next/standalone`. `web/` is never built. There is also no way for an Angular
nav item to reach a Next page: the shell renders every entry as an in-app
`routerLink`, `app.routes.ts` has no wildcard, and two nav paths (`/clients`,
`/flow`) match no Next route at all. **This is the critical path.** No feature
port matters until this exists. It is story 10.5, unwritten.

**2. Angular cannot call this backend.**
39 exported Server Actions across 21 `use server` files have no HTTP equivalent,
and 24 of 25 data-reading pages import `lib/` directly inside a React Server
Component. Roughly 43 to 67 endpoints must exist before screens can move. They
are mostly mechanical wraps of existing `lib/` functions.

**3. The data never moves.**
State lives in Firestore, Cloud SQL Postgres and GoHighLevel. A rebuilt screen
pointed at the same stores reads the same live data. There is no migration, no
backfill, no dual-write. This is why REBUILD is a real option per feature rather
than only MIGRATE.

---

## Do this next, in this order

### 10.4 — Ship the hardening (story exists: `docs/stories/10.4-production-hardening-release.md`)

Deploy the 32 commits and soak them **before any Angular route is flipped**, so a
failure has one cause rather than thirty-three.

Preconditions to verify and record first:
- `hub.taxadvisorygrowth.com` certificate issued (was confirmed 2026-08-20)
- GHL Marketplace redirect URI **exactly** equals `_GHL_REDIRECT_URI` in
  `cloudbuild.yaml`. User reported updating it; re-confirm.
- `_FIREBASE_API_KEY` substitution is actually set on the Cloud Build trigger.
  It defaults to `""` in the file and both sign-in paths now need it
  server-side.
- Name the rollback revision explicitly.

Two behaviour changes on this deploy that are easy to miss:
- `APP_ORIGIN` is now set, so the CSRF check demands that exact origin instead of
  comparing Origin against Host. Sign-in at the `run.app` URL starts failing.
- `proxy.ts` no longer auth-gates `.js`, `.css`, `.map`, fonts or the service
  worker.

### 10.5 — Shipping topology (not written)

Dockerfile builds `web/`; Next serves the bundle same-origin; a route allowlist
decides which paths Angular owns; `NavItem` gains `external: boolean` so the
shell renders `[href]` for unported features and the browser does a real
navigation. Nothing else can start until this lands.

### Then features

Verdicts exist per feature (migrate / rebuild / drop) from a nine-agent
assessment. Ask the user for the decision table; the short version is that
~3,900 LOC should be dropped rather than ported, contacts and FLOW are the
cleanest migrations, and Today, Pipeline and the dashboard shell should be
rebuilt because their logic is server-action-shaped or mock-backed.

**Honest scale: ~93 engineer-days and 67 endpoints for full parity, ~55 days and
43 endpoints for every `client_*` role in Angular.** Do not promise less.

---

## Traps. Every one of these cost time today

**Node.** The machine default is v24.14.0, below the Angular CLI floor
(`^22.22.3 || ^24.15.0 || >=26.0.0`). `npx ng` aborts printing nothing. Use:
```
export PATH="/opt/homebrew/opt/node@26/bin:$PATH"
```

**Angular version.** 22.1.2 is installed and stays. Verify APIs against
`web/node_modules`, never from memory; model recall about Angular runs several
majors stale. Specifically: `@angular/animations` is **not** a Material peer in
22, so `provideNoopAnimations` is unavailable and should not be added.
`provideAppInitializer` exists and awaits returned promises.

**Never add `withEnabledBlockingInitialNavigation()`** to `provideRouter`. The
session is resolved in `provideAppInitializer` and route activation waits for it;
that flag registers a competing initializer and navigates concurrently. The
comment in `app.config.ts` says so.

**Interceptor order is load-bearing.** `withInterceptors` composes via
`reduceRight`, so the LAST entry is outermost. `[errorInterceptor,
authInterceptor]` is correct. Reversing it makes the 401 refresh dead code, and
`auth.interceptor.spec.ts` fails if you do.

**The pre-commit hook will block you.** It refuses a commit that touches a
story's referenced files without staging that story's doc, and it catches inline
role strings in `.ts` **and** `.html`. Both are correct. Fix the cause, never
`--no-verify`.

**`gcloud auth login` is interactive.** You cannot run it. Ask the user.

**Story docs 10.5 onward do not exist.** The epic table in `docs/epics.md` has
rows; the files do not. Authoring them is unowned work sitting in front of every
lane.

---

## Gates. Only green output counts

```
export PATH="/opt/homebrew/opt/node@26/bin:$PATH"
npm run web:gate            # ng build --configuration production && lint && test
npx vitest run              # Next tests
npx tsc --noEmit -p tsconfig.json
npm run check:role-parity
npm run check:story-status  # after git add
```

All five exit 0 on the current branch. Angular tests: 115. Initial bundle:
301.67 kB raw, 81.24 kB transfer, against a 500 kB warn budget.

---

## Known-unfixed, deliberately

- **`permissionGuard`'s allow path has never executed.** Zero routes declare
  `data.permission`; the only match in the repo is a doc comment. It needs a real
  permission-gated feature route. Do not treat the guard as proven.
- **47 `no-explicit-any` errors** in `app/` (22), `lib/` (13), `test/` (3),
  `functions/` (3). CLAUDE.md forbids `any`. Pre-existing, verified identical on
  HEAD.
- **26 files read `process.env` directly** despite `lib/config.ts` existing and
  CLAUDE.md naming it the only reader.
- **`getMockMetrics` feeds `csm-clients.ts:62`**, so every client's health score
  is exactly 80 and every book sorts identically.
- **Google sign-in is configured but unproven in production.** Endpoint and
  wrapped GIS button ship; no real user has completed the flow.

---

## How to work here

The single most useful habit from the last session: **the defects all lived in
code nothing consumed.** Green tests, clean builds, never executed. `fail()` had
diverged across the network boundary, the `*hasPermission` directive had never
rendered, `permissionGuard`'s allow path had never run. Tests passing is not
evidence that a path works. Ask what actually calls it.

Second: verify before asserting, especially about Google's platform. Today's
wrong-from-memory list includes Cloud Run domain mapping being the standard path
(it is Preview and Google says not production-ready), the OAuth consent screen's
location (moved to Google Auth Platform), the 100-user cap (scope-triggered, not
status-triggered), and brand verification timelines (minutes, not weeks).

Third: the user is decisive and reverses bad recommendations quickly. State a
recommendation with its reasoning, then follow their call.
