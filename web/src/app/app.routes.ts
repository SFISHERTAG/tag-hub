import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

/**
 * Two branches, and the split is load-bearing rather than tidy.
 *
 * `/signin` sits OUTSIDE the shell. A signed-out visitor is the only person who
 * sees it, and rendering it inside the shell would mean downloading the
 * toolbar, sidenav and nav list to show a page that has none of them.
 *
 * Everything else sits inside the shell, behind authGuard, so the chrome loads
 * only once there is a session to show it to.
 *
 * Feature modules become children of the shell route. Each carries its own
 * permissionGuard and `data.permission`; the shell route itself only requires a
 * session, because every signed-in role sees the shell. permissionGuard is
 * default-deny, so a child that forgets its permission list is refused rather
 * than published to everyone.
 *
 *   {
 *     path: 'admin',
 *     canActivate: [permissionGuard],
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
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [],
  },
];
