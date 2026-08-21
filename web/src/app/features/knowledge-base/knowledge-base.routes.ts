import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { ROLES } from '../../core/models/role.model';

/**
 * TAG staff only.
 *
 * This list mirrors `isInternalRole` in lib/auth/session.ts, which is what the
 * endpoints actually check. The guard is cosmetic — a client role reaching
 * these screens gets a 403 from the API and an error state, not the manual —
 * but a guard that is wider than the gate sends people into a page that can
 * only fail, and one that is narrower hides a page they are entitled to.
 *
 * If a role is added to the internal set in lib/auth/session.ts, it belongs
 * here too. scripts/check-role-parity.mjs guards the role NAMES; this
 * particular grouping is a judgement the two files have to keep in step by
 * hand.
 */
export const KNOWLEDGE_BASE_ROLES = [
  ROLES.ADMIN,
  ROLES.TAG_EXEC,
  ROLES.TAG_CSD,
  ROLES.TAG_CSM,
  ROLES.TAG_SALES_MANAGER,
  ROLES.TAG_SALES,
  ROLES.TAG_SETTER_MANAGER,
  ROLES.TAG_SETTER,
] as const;

export const routes: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: KNOWLEDGE_BASE_ROLES },
    loadComponent: () => import('./manual-list/manual-list').then((m) => m.ManualList),
  },
  {
    path: ':pageId',
    canActivate: [permissionGuard],
    data: { permission: KNOWLEDGE_BASE_ROLES },
    loadComponent: () => import('./manual-page/manual-page').then((m) => m.ManualPageView),
  },
];
