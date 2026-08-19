# Angular frontend file tree

The target structure for `web/src/app`, and the thing CLAUDE.md's architecture
isolation rule is written against.

This document is load-bearing, not descriptive. The ESLint zones in
`web/eslint.config.js` and the matching check in `scripts/check-story-status.mjs`
are written directly from the boundaries below, so moving a directory here means
moving it there in the same commit.

## Boundaries

Five rules, in the order they matter:

1. **`core/` and `shared/` are importable from anywhere.** They are the shared
   layer, the frontend counterpart of the backend's `lib/**` exception.
2. **Nothing outside `features/` may import `features/`.** The shell must not
   know what features exist; it resolves them by route and by widget id.
3. **`features/` may not import `layout/`.** A feature that reaches into the
   shell cannot be lazy-loaded independently, and cannot be deleted when its
   Next.js counterpart is retired.
4. **Integration modules may not import each other.** `ghl`, `meta`, `drive` and
   `slack` are isolated. A cross-integration join goes through one backend
   endpoint, never a direct import. This is the rule that stopped the duplicate
   GHL client in the August audit from recurring on the frontend.
5. **Non-integration features may not import an integration module.** The
   dashboard and the clients book both need integration data; they get it from
   their own typed services calling endpoints, not by importing `features/meta`.

`web/src/app/widget-loaders.ts` is the single exemption. It is the composition
root for the widget registry, so it is the one file allowed to name
`features/*/widgets`, and only through dynamic `import()`. Without a declared
exemption, either the registry cannot be wired or rule 2 has to be softened for
every file.

The `shared/` prohibition deliberately does **not** cover `core/services/`.
`shared/directives/has-permission.directive.ts` imports `PermissionService`, and
CLAUDE.md mandates both halves of that pairing: one `PermissionService`, and a
`*hasPermission` directive for UI gating. A zone barring it would fail `ng lint`
on code the contract requires.

## Tree

```
web/src/app/
├── app.config.ts                    composition root
├── app.routes.ts                    one lazy entry per feature module
├── app.ts | app.html | app.scss     bootstrap host; the shell lives in layout/
└── widget-loaders.ts                registry composition root; the ONLY file that
                                     may name features/*/widgets, via dynamic
                                     import() only. Exempt from the zones.

core/                                singletons. May import shared/.
│                                    MUST NOT import features/ or layout/.
├── config/
│   ├── app-config.ts                AppConfig interface + APP_CONFIG token
│   └── app-config.validator.ts      throws in provideAppInitializer on a missing key
├── http/
│   └── api.service.ts               the only class that injects HttpClient;
│                                    returns ApiResult<T>
├── guards/
│   ├── auth.guard.ts                awaits a settled session; no synchronous null bounce
│   ├── permission.guard.ts          default-deny; data.public opts a route out
│   └── location-access.guard.ts     mirror of lib/auth/session.ts#requireLocationAccess
├── interceptors/
│   ├── error.interceptor.ts         OUTERMOST in app.config.ts
│   └── auth.interceptor.ts          INNERMOST; single in-flight 401 refresh
├── models/
│   ├── role.model.ts                keyed ROLES + ROLE_LIST + Role + isRole
│   ├── session.model.ts             Session + RoleGrant
│   ├── impersonation.model.ts       ImpersonationState
│   ├── location.model.ts
│   └── api-result.model.ts          ApiError, ApiResult<T>, ok(), fail()
└── services/
    ├── rbac.service.ts              RbacService interface + RBAC_SERVICE token
    ├── http-rbac.service.ts         real impl; switchRole round-trips to the server
    ├── mock-rbac.service.ts         dev only; provided behind isDevMode()
    ├── permission.service.ts        the single RBAC choke point
    ├── impersonation.service.ts     enter/exit + banner state
    └── theme.service.ts             three-state light/dark/system

layout/                              the one responsive shell.
│                                    May import core/ and shared/.
│                                    MUST NOT import features/.
├── shell/                           mat-toolbar + mat-sidenav >=840px,
│                                    mat-toolbar + bottom nav <840px, one tree
├── nav/
│   ├── nav-items.ts                 single source of truth; ROLES.*, never literals
│   ├── nav.service.ts               visible items derived from PermissionService
│   ├── side-nav/ | bottom-nav/      breakpoint halves of the same item list
│   └── more-sheet/                  closes on router NavigationEnd
├── hat-switcher/                    hidden when availableRoles.length < 2
├── impersonation-banner/            stacks above the toolbar; drives shell offset
└── theme-toggle/

shared/                              importable from anywhere.
│                                    MUST NOT import features/ or layout/.
├── ui/                              M3 rebuild of app/ui.tsx. Zero raw hex,
│   │                                zero !important, zero ::ng-deep.
│   ├── panel/ fold/ stat/ badge/ notice/ empty-state/ pending/ health-badge/
│   ├── donut/                       inline SVG, token-colored
│   └── bar-chart/                   inline SVG, token-colored
├── directives/
│   └── has-permission.directive.ts  selector [hasPermission]; UI gating only
├── pipes/
└── widgets/
    ├── widget.model.ts
    ├── widget-registry.service.ts   definitions + registerLoader/loadComponent
    ├── widget-host.ts               resolves by id + required permission at runtime
    └── widget-grid.ts               responsive grid + CDK drag-drop reorder

features/                            all lazy-loaded, standalone, OnPush.
│                                    May import core/ and shared/.
│                                    MUST NOT import layout/.
├── auth/
│   ├── signin/                      email step -> 6-digit OTP step
│   ├── google-button/               GIS rendered button, wrapped not reproduced
│   └── services/auth.service.ts
├── portfolio/
├── bug-reports/
├── dashboard/                       widget shell. Knows NO integration by name.
│   ├── customize/
│   └── services/dashboard-config.service.ts
├── ghl/                             INTEGRATION
│   ├── location/                    parent route: locationId resolver + guard
│   ├── pipeline/                    kanban, stage move, close won/lost
│   ├── today/                       appointments, status controls, call prep,
│   │                                follow-up queue
│   ├── contacts/                    search, detail, attribution, notes
│   ├── services/
│   └── widgets/                     pipeline-board, day-view, leads-funnel,
│                                    owner-calendar
├── meta/                            INTEGRATION
│   ├── services/                    campaigns, creatives, ad spend, conversions
│   └── widgets/                     spend-roas, kpi-summary
├── drive/                           INTEGRATION
│   └── services/creatives.service.ts
├── slack/                           INTEGRATION
│   └── services/slack.service.ts
├── clients/                         book of business. NOT an integration module:
│   ├── book/                        grid | list | kanban | escalation
│   ├── client-detail/               overview | campaigns | creatives | status
│   ├── services/                    cross-integration data arrives through ONE
│   │                                backend endpoint, never a sibling import
│   └── widgets/                     client-health, portfolio, team-health-rollup,
│                                    department-overview, team-performance
├── onboarding/
│   ├── checklist/                   route is /onboarding/:locationId
│   └── launch/                      one wizard component + a form state service
├── flow/
├── courses/
├── admin/                           tenants, users, courses
└── success/
```

## Notes

Each feature directory carries its own `*.routes.ts`. Nothing outside
`app.routes.ts` and `widget-loaders.ts` references a feature by path.

Widget components live inside the feature that owns their data, not in a shared
widgets folder. A GHL pipeline widget importing GHL services is correct; the
dashboard resolving it by id without knowing GHL exists is what keeps rule 2
true.
