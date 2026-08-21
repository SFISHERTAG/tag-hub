import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { ROLES } from '../../core/models/role.model';

/**
 * Hats that may reach the client book.
 *
 * A verbatim mirror of `CSM_BOOK_ROLES` in
 * `app/api/dashboard/_lib/access.ts`, which is itself a verbatim port of
 * `legacy/csm-dashboard/actions/access.ts`. The boundary is staff versus
 * client-facing, NOT per-CSM ownership: any internal CS role can open any
 * client's record. That openness is the deliberate "jump in and help" coverage
 * design documented on `getClientsForCsm` in `lib/dashboard/csm-clients.ts`, so
 * it is not narrowed here — narrowing the guard while the API stays open would
 * hide a page that is still reachable, which is worse than either answer.
 *
 * Cosmetic regardless. `GET /api/clients` calls `requireApiRole` with this same
 * list, and `scope=mine` is keyed on `session.email`, so a role that slipped
 * past this guard would see its own book or a 403, never someone else's rows.
 *
 * NOTE for whoever wires this into app.routes.ts: `layout/nav/nav-items.ts`
 * lists `/clients` for exec, CSD and CSM but not admin, while this guard and
 * the API both admit admin. That is a nav item narrower than its guard — an
 * admin can reach the page but has no link to it. Adding ROLES.ADMIN to that
 * nav entry closes the gap; the alternative (dropping admin here) would put the
 * guard out of step with the endpoint instead.
 */
export const CLIENT_BOOK_ROLES = [
  ROLES.TAG_CSM,
  ROLES.TAG_CSD,
  ROLES.TAG_EXEC,
  ROLES.ADMIN,
] as const;

/**
 * `/clients` and `/clients/:clientId`.
 *
 * The detail is a route rather than the reference implementation's modal, so a
 * client has a URL that can be linked to, opened in a new tab and reloaded.
 * `:clientId` binds to the component's `clientId` input via
 * `withComponentInputBinding()`, already configured in app.config.ts.
 *
 * The book reads `?view=grid|list|kanban|escalations`. That query parameter is
 * the contract `features/portfolio/portfolio.routes.ts` redirects into with
 * `?view=escalations`; it resolves here, and an unrecognised value falls back
 * to the grid rather than rendering nothing.
 */
export const routes: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: CLIENT_BOOK_ROLES },
    loadComponent: () => import('./book/clients-book').then((m) => m.ClientsBook),
  },
  {
    path: ':clientId',
    canActivate: [permissionGuard],
    data: { permission: CLIENT_BOOK_ROLES },
    loadComponent: () => import('./client-detail/client-detail').then((m) => m.ClientDetail),
  },
];
