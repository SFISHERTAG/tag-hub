import { Routes } from '@angular/router';
import { PUBLIC_ROUTE } from '../../core/guards/public-route';

/**
 * Sign-in is the one place PUBLIC_ROUTE is load-bearing rather than
 * convenient: permissionGuard is default-deny, so without the marker this route
 * is refused, and authGuard would redirect a signed-out visitor to the page
 * they are already on.
 */
export const routes: Routes = [
  {
    path: '',
    data: PUBLIC_ROUTE,
    loadComponent: () => import('./signin/signin').then((m) => m.Signin),
  },
];
