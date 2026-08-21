import { inject } from '@angular/core';
import { Router, type CanActivateFn, type Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { ROLES } from '../../core/models/role.model';

/**
 * Hats that may reach this screen. Matches the `/portfolio` entry already in
 * layout/nav/nav-items.ts exactly — an item narrower than its guard hides a
 * reachable page, and an item wider than its guard sends people into a
 * redirect.
 *
 * Cosmetic either way. `GET /api/portfolio/tenants` derives the list from the
 * session and returns only that hat's own tenants, so a role that slipped past
 * this guard would see its own (possibly empty) list, never someone else's.
 */
export const PORTFOLIO_ROLES = [
  ROLES.TAG_EXEC,
  ROLES.TAG_CSD,
  ROLES.TAG_CSM,
  ROLES.TAG_SALES_MANAGER,
] as const;

/**
 * Where `?view=escalations` goes.
 *
 * The Next page redirected `/portfolio?view=escalations` to
 * `/csm-dashboard?view=escalations`, because the escalation view (Story 3.6)
 * lives where the health data model already exists. In the Angular tree that
 * view is the escalation mode of the clients book (Story 10.6,
 * docs/frontend-file-tree.md: `features/clients/book/` -> "grid | list | kanban
 * | escalation"), so the destination is named here, once.
 *
 * IT DOES NOT EXIST YET. Whoever lands 10.6 should confirm this path and this
 * query parameter against what the book actually reads. Until then the redirect
 * cannot match, and a deep link with this parameter fails to navigate rather
 * than silently showing the wrong screen.
 */
export const ESCALATIONS_PATH = '/clients';
const ESCALATIONS_VIEW = 'escalations';

/**
 * Preserves the legacy deep link. Not a security control and not a permission
 * check: it forwards one query parameter to the screen that owns that view.
 */
const escalationsRedirect: CanActivateFn = (route) => {
  if (route.queryParamMap.get('view') !== ESCALATIONS_VIEW) return true;

  return inject(Router).createUrlTree([ESCALATIONS_PATH], {
    queryParams: { view: ESCALATIONS_VIEW },
  });
};

export const routes: Routes = [
  {
    path: '',
    canActivate: [permissionGuard, escalationsRedirect],
    data: { permission: PORTFOLIO_ROLES },
    loadComponent: () => import('./portfolio-list/portfolio-list').then((m) => m.PortfolioList),
  },
];
