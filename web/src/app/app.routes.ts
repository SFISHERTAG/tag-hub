import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

/**
 * One lazy-loaded entry per feature module.
 *
 * Every route carries both guards. permissionGuard is default-deny, so a route
 * that declares no `data.permission` is refused rather than published to
 * everyone; a route that genuinely needs no permission says so explicitly with
 * `data: PUBLIC_ROUTE`.
 *
 *   {
 *     path: 'admin',
 *     canActivate: [authGuard, permissionGuard],
 *     data: { permission: [ROLES.ADMIN] },
 *     loadChildren: () => import('./features/admin/admin.routes').then(m => m.routes),
 *   }
 */
export const routes: Routes = [
  {
    path: 'signin',
    canActivate: [authGuard, permissionGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.routes),
  },
];
