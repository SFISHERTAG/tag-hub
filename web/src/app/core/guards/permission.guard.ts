import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';
import type { Role } from '../models/role.model';

/**
 * Route data gate: { permission: Role[] }. Cosmetic/UX only, same as
 * *hasPermission — the API is the real enforcement point.
 *
 * Usage: { path: 'admin', canActivate: [authGuard, permissionGuard], data: { permission: ['admin'] } }
 */
export const permissionGuard: CanActivateFn = (route) => {
  const permission = inject(PermissionService);
  const router = inject(Router);

  const allowed = route.data['permission'] as readonly Role[] | undefined;
  if (!allowed || permission.hasAnyRole(allowed)) return true;

  return router.createUrlTree(['/']);
};
