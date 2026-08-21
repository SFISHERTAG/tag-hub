import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { ROLE_LIST } from '../../core/models/role.model';

/**
 * Every hat gets a dashboard.
 *
 * `ROLE_LIST` from the role model rather than a hand-written list of thirteen
 * roles, and rather than marking the route public. Both alternatives are worse
 * for the same reason: `permissionGuard` is default-deny by design, and a route
 * that opts out with `PUBLIC_ROUTE` stops being covered the day a role is
 * added. Spelling out every `ROLES.*` by name is that same exposure with an
 * extra maintenance step and one more chance to miss one.
 *
 * This is the right shape for the dashboard specifically and not a pattern to
 * copy onto other routes. What a viewer actually sees is decided by their saved
 * layout and by each widget's own `availableFor` list, which the server
 * enforces three times over — on save (403), on read (stripped and reported),
 * and at every widget data endpoint (403). Gating the whole page by role would
 * be the wrong control at the wrong level: it would hide the shell from someone
 * who is entitled to two widgets on it.
 */
export const DASHBOARD_ROLES = ROLE_LIST;

export const routes: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: DASHBOARD_ROLES },
    loadComponent: () => import('./dashboard-shell/dashboard-shell').then((m) => m.DashboardShell),
  },
  {
    path: 'customize',
    canActivate: [permissionGuard],
    data: { permission: DASHBOARD_ROLES },
    loadComponent: () =>
      import('./customize/dashboard-customize').then((m) => m.DashboardCustomize),
  },
];
