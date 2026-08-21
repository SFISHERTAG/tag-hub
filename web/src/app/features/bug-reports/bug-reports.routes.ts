import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { ROLE_LIST } from '../../core/models/role.model';

/**
 * Every signed-in hat may report a bug against the product it is using. That
 * matches the endpoint, which gates on authentication only.
 *
 * `ROLE_LIST` rather than a hand-written array of thirteen: a role added to
 * `ROLES` is a role that can report a bug, and a list copied by hand is a list
 * that goes stale the first time one is added. It is still ROLES.*, never a
 * string literal.
 *
 * NOT `PUBLIC_ROUTE`. That marker exempts a route from authGuard as well as
 * permissionGuard, which would publish this screen to signed-out visitors. The
 * endpoint would refuse them, so the result would be a permanent error page
 * rather than a leak, but a route that exists only to fail is not a route.
 */
export const BUG_REPORT_ROLES = ROLE_LIST;

export const routes: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: BUG_REPORT_ROLES },
    loadComponent: () =>
      import('./bug-reports-page/bug-reports-page').then((m) => m.BugReportsPage),
  },
];
