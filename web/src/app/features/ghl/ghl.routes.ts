import type { Routes } from '@angular/router';
import { locationAccessGuard } from '../../core/guards/location-access.guard';
import { permissionGuard } from '../../core/guards/permission.guard';
import { ROLES } from '../../core/models/role.model';

/**
 * The hats that may open a client's GHL workspace.
 *
 * Two guards run together and they answer different questions.
 * `permissionGuard` asks "is this a hat that works inside a client tenant at
 * all", and this list is that answer. `locationAccessGuard` asks "this tenant,
 * specifically" — claim locations, the all-access internal hats, or a CSM's
 * active impersonation. Both are cosmetic: every endpoint under
 * `/api/ghl/locations/{id}` re-derives the second question from the session
 * cookie, and answers 403 whatever the router allowed.
 *
 * The list is drawn from who can actually arrive here. The five client hats
 * work in their own tenant; ADMIN/TAG_EXEC/TAG_CSD reach every tenant;
 * TAG_CSM reaches one at a time by impersonation. TAG_SALES_MANAGER is included
 * because the portfolio screen's "Enter" already navigates them to
 * `/l/{id}/pipeline` — excluding them would send a working flow into a
 * redirect. The TAG-internal sales/setter hats are not: their pipeline is TAG's
 * own, not a client's, and nothing routes them here.
 */
export const GHL_WORKSPACE_ROLES = [
  ROLES.ADMIN,
  ROLES.TAG_EXEC,
  ROLES.TAG_CSD,
  ROLES.TAG_CSM,
  ROLES.TAG_SALES_MANAGER,
  ROLES.CLIENT_OWNER,
  ROLES.CLIENT_MANAGER,
  ROLES.CLIENT_CLOSER,
  ROLES.CLIENT_SETTER_MANAGER,
  ROLES.CLIENT_SETTER,
] as const;

/**
 * Mount at `l`, so these resolve to `/l/:locationId/...` — the paths the Next
 * app used and the ones `features/portfolio` already navigates to after
 * entering a tenant.
 *
 *   { path: 'l', loadChildren: () => import('./features/ghl/ghl.routes').then(m => m.routes) }
 *
 * `:locationId` lives inside this file rather than in app.routes.ts on purpose:
 * the segment, the guard that checks it and the screens that read it are one
 * unit, and splitting them is how a route gains a tenant parameter that nothing
 * validates.
 *
 * Every child restates `permissionGuard` and its permission list. The parent's
 * guard already covers them, so this is redundant by design: permissionGuard is
 * default-deny, and a child that is ever re-parented or deep-linked keeps its
 * own answer instead of inheriting whatever it lands under.
 */
export const routes: Routes = [
  {
    path: ':locationId',
    canActivate: [permissionGuard, locationAccessGuard],
    data: { permission: GHL_WORKSPACE_ROLES },
    loadComponent: () =>
      import('./location/location-workspace').then((m) => m.LocationWorkspace),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'pipeline' },
      {
        path: 'pipeline',
        canActivate: [permissionGuard],
        data: { permission: GHL_WORKSPACE_ROLES },
        title: 'Pipeline',
        loadComponent: () => import('./pipeline/pipeline-board').then((m) => m.PipelineBoard),
      },
      {
        path: 'today',
        canActivate: [permissionGuard],
        data: { permission: GHL_WORKSPACE_ROLES },
        title: 'Today',
        loadComponent: () => import('./today/today-view').then((m) => m.TodayView),
      },
      {
        path: 'contacts',
        canActivate: [permissionGuard],
        data: { permission: GHL_WORKSPACE_ROLES },
        title: 'Contacts',
        loadComponent: () => import('./contacts/contacts-list').then((m) => m.ContactsList),
      },
      {
        path: 'contacts/:contactId',
        canActivate: [permissionGuard],
        data: { permission: GHL_WORKSPACE_ROLES },
        title: 'Contact',
        loadComponent: () => import('./contacts/contact-detail').then((m) => m.ContactDetail),
      },
      {
        path: 'follow-up',
        canActivate: [permissionGuard],
        data: { permission: GHL_WORKSPACE_ROLES },
        title: 'Follow-up',
        loadComponent: () => import('./follow-up/follow-up-page').then((m) => m.FollowUpPage),
      },
    ],
  },
];
