import { Routes } from '@angular/router';

/**
 * Empty until Phase 3 adds one lazy-loaded route per feature module. Each
 * entry follows this shape:
 *
 *   {
 *     path: 'admin',
 *     canActivate: [authGuard, permissionGuard],
 *     data: { permission: [ROLES] as const },
 *     loadChildren: () => import('./features/admin/admin.routes').then(m => m.routes),
 *   }
 */
export const routes: Routes = [];
