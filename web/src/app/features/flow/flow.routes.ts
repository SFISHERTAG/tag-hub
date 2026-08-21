import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { ROLES } from '../../core/models/role.model';

/**
 * The hats the legacy page allowed: the people who run a script live, plus the
 * manager who reviews edits to it.
 *
 * Worth being explicit about what this guard is and is not. `GET
 * /api/flow/org/[orgId]/framework` checks the session and location access, but
 * no role — so this list is the only role gate on *reading* the framework, and
 * it is cosmetic, because the framework is readable by any hat with access to
 * that org. The gates that actually bite are on the writes: suggesting is
 * limited to [TAG_EXEC, CLIENT_CLOSER, TAG_SALES] and reviewing to [TAG_EXEC,
 * TAG_SALES_MANAGER], both enforced server-side.
 *
 * This differs from the current `/flow` nav entry, which lists CLIENT_MANAGER
 * (not in the legacy page's list) and omits CLIENT_SETTER and TAG_SETTER (which
 * were). Flagged in the report for whoever owns nav-items.ts rather than
 * reconciled unilaterally here — a setter working a booked call reads the same
 * scripts, so the legacy list is likely the right one, but that is a product
 * call, not a merge conflict.
 */
export const FLOW_ROLES = [
  ROLES.TAG_EXEC,
  ROLES.TAG_SALES_MANAGER,
  ROLES.TAG_SALES,
  ROLES.TAG_SETTER,
  ROLES.CLIENT_CLOSER,
  ROLES.CLIENT_SETTER,
] as const;

/** May propose a script edit. Mirrors SUGGESTER_ROLES in the endpoint. */
export const FLOW_SUGGESTER_ROLES = [
  ROLES.TAG_EXEC,
  ROLES.CLIENT_CLOSER,
  ROLES.TAG_SALES,
] as const;

/** May approve or reject one. Mirrors REVIEWER_ROLES in the endpoint. */
export const FLOW_REVIEWER_ROLES = [ROLES.TAG_EXEC, ROLES.TAG_SALES_MANAGER] as const;

export const routes: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: FLOW_ROLES },
    loadComponent: () => import('./flow-framework/flow-framework').then((m) => m.FlowFramework),
  },
];
