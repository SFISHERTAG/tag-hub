import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { ROLES } from '../../core/models/role.model';

/**
 * Matches the endpoint's gate exactly: `[TAG_SETTER, CLIENT_SETTER, TAG_EXEC]`.
 *
 * Narrower than the `/setter` nav entry currently is — nav-items.ts also lists
 * the two setter-manager hats. That entry is wider than both this guard and the
 * API, so a setter manager clicking it today would be bounced. Flagged in the
 * report for whoever owns nav-items.ts rather than widened here: this list
 * mirrors what the server actually allows, and guessing wider is how a link
 * becomes a redirect.
 */
export const SETTER_ROLES = [ROLES.TAG_SETTER, ROLES.CLIENT_SETTER, ROLES.TAG_EXEC] as const;

export const routes: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: SETTER_ROLES },
    loadComponent: () =>
      import('./setter-dashboard/setter-dashboard').then((m) => m.SetterDashboard),
  },
];
