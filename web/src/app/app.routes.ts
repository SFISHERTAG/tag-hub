import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { PUBLIC_ROUTE } from './core/guards/public-route';

/**
 * Two branches, and the split is load-bearing rather than tidy.
 *
 * `/signin` sits OUTSIDE the shell. A signed-out visitor is the only person who
 * sees it, and rendering it inside the shell would mean downloading the
 * toolbar, sidenav and nav list to show a page that has none of them.
 *
 * Everything else sits inside the shell, behind authGuard, so the chrome loads
 * only once there is a session to show it to.
 *
 * Feature modules are children of the shell route. Each carries its own
 * permissionGuard and `data.permission` inside its own `*.routes.ts`, so
 * nothing but the path and the loader belongs here. Deliberately no
 * `canActivate`/`data` on these parents: permissionGuard is default-deny, so a
 * parent carrying the guard with no permission list of its own would refuse
 * every child underneath it.
 *
 * The role lists stay in the feature files rather than being restated here.
 * Importing `ADMIN_ROLES`/`FLOW_ROLES`/etc. eagerly would pull each feature's
 * routes module into `main` and collapse the lazy boundary this file exists to
 * draw.
 */
export const routes: Routes = [
  {
    path: 'signin',
    // PUBLIC_ROUTE belongs on THIS route, not only on the '' child inside
    // auth.routes.ts, because this is the route the two guards are attached to
    // and guards run against their own snapshot. Route data inherits parent to
    // child, never child to parent, so with the marker one level down this
    // route's `data` was `{}`: authGuard saw a signed-out visitor on a
    // non-public route and redirected them to /signin — the page they were
    // already on — with a fresh `next` parameter each time, so the navigation
    // never settled. A signed-out visitor could not sign in at all.
    //
    // Proven, not reasoned: a router test navigating to /signin with a null
    // session hung the whole vitest run before this line and passes in
    // milliseconds after it. Pinned by app.routes.spec.ts.
    //
    // The whole /signin subtree is public, so inheriting the marker downward is
    // the intended effect rather than a side effect.
    data: PUBLIC_ROUTE,
    canActivate: [authGuard, permissionGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.routes),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      // Every hat has a dashboard (its routes gate on ROLE_LIST), so this is
      // the one destination that is correct for all thirteen.
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.routes),
      },
      {
        path: 'portfolio',
        loadChildren: () => import('./features/portfolio/portfolio.routes').then((m) => m.routes),
      },
      {
        path: 'clients',
        loadChildren: () => import('./features/clients/clients.routes').then((m) => m.routes),
      },
      {
        path: 'onboarding',
        loadChildren: () => import('./features/onboarding/onboarding.routes').then((m) => m.routes),
      },
      {
        path: 'flow',
        loadChildren: () => import('./features/flow/flow.routes').then((m) => m.routes),
      },
      {
        path: 'setter',
        loadChildren: () => import('./features/setter/setter.routes').then((m) => m.routes),
      },
      {
        path: 'courses',
        loadChildren: () => import('./features/courses/courses.routes').then((m) => m.routes),
      },
      {
        path: 'knowledge-base',
        loadChildren: () =>
          import('./features/knowledge-base/knowledge-base.routes').then((m) => m.routes),
      },
      {
        path: 'bug-reports',
        loadChildren: () => import('./features/bug-reports/bug-reports.routes').then((m) => m.routes),
      },
      {
        // Story 10.9. Reached from the user menu, not the nav: it is an account
        // screen rather than a destination in the product.
        path: 'settings',
        loadChildren: () => import('./features/settings/settings.routes').then((m) => m.routes),
      },
      {
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.routes),
      },
      {
        // The GHL client workspace: `/l/:locationId/{pipeline,today,contacts,follow-up}`.
        //
        // `:locationId` is declared inside ghl.routes.ts, not here, so the
        // segment and `locationAccessGuard` — the guard that checks the caller
        // may open that tenant — cannot be separated. A tenant parameter
        // mounted here with the guard left behind is a tenant parameter nothing
        // validates.
        path: 'l',
        loadChildren: () => import('./features/ghl/ghl.routes').then((m) => m.routes),
      },
      // Last, and last for a reason: an unmatched URL otherwise fails the whole
      // navigation and leaves the shell rendering an empty outlet at a URL that
      // looks live. Must stay at the end of this array — `**` matches anything.
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
