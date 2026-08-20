import { inject, isDevMode } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';
import { isPublicRoute } from './public-route';
import type { Role } from '../models/role.model';

/**
 * Route data gate: `{ permission: Role[] }`.
 *
 * Default-DENY. A route that declares no permission list is refused, not
 * allowed. The previous default-allow meant forgetting `data.permission` on a
 * new route silently published it to every role — the failure mode was
 * invisible, because the route worked perfectly for whoever wrote it.
 *
 * A route that genuinely needs no permission says so explicitly with
 * `data: PUBLIC_ROUTE`.
 *
 * Still cosmetic, exactly as before: this decides what renders, and the API
 * decides what is reachable. A hidden route is not a security control, which is
 * why lib/auth/api-session.ts re-checks server-side on every request.
 *
 * Usage:
 *   {
 *     path: 'admin',
 *     canActivate: [authGuard, permissionGuard],
 *     data: { permission: [ROLES.ADMIN] },
 *     loadChildren: () => import('./features/admin/admin.routes').then(m => m.routes),
 *   }
 */
export const permissionGuard: CanActivateFn = (route) => {
  const permission = inject(PermissionService);
  const router = inject(Router);

  if (isPublicRoute(route)) return true;

  const allowed = route.data['permission'] as readonly Role[] | undefined;

  if (!allowed || allowed.length === 0) {
    if (isDevMode()) {
      // Loud in development, because the symptom otherwise is "my new route
      // redirects home" with nothing explaining why.
      console.error(
        `[permissionGuard] Route "${route.routeConfig?.path ?? route.url.join('/')}" declares no ` +
          `data.permission and is not marked PUBLIC_ROUTE, so it is denied. Add one or the other.`,
      );
    }
    return router.createUrlTree(['/']);
  }

  if (permission.hasAnyRole(allowed)) return true;

  return router.createUrlTree(['/']);
};
