import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { ROLE_LIST } from '../../core/models/role.model';

/**
 * Story 10.9. Every signed-in hat has an account and this shows them their own,
 * so the list is `ROLE_LIST` — a role added to `ROLES` is a role with an
 * account, and a hand-written array of thirteen is the one that goes stale.
 *
 * NOT `PUBLIC_ROUTE`. That marker exempts a route from `authGuard` as well, and
 * a settings page for nobody in particular is not a page.
 *
 * There is nothing here another user could read: every value comes from the
 * caller's own session.
 */
export const SETTINGS_ROLES = ROLE_LIST;

export const routes: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: SETTINGS_ROLES },
    loadComponent: () => import('./settings').then((m) => m.Settings),
  },
];
