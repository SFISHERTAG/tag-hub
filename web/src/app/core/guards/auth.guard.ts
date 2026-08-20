import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RBAC_SERVICE } from '../services/rbac.service';
import { isPublicRoute } from './public-route';

/**
 * Session check — port of the intent behind getSession()/requireSession().
 *
 * Honours `PUBLIC_ROUTE` for one reason: without it, attaching this guard to
 * `/signin` (an easy habit, since every other route has it) redirects a
 * signed-out visitor from the sign-in page back to the sign-in page, forever.
 * Cheaper to make the guard correct than to rely on nobody making that mistake.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const rbac = inject(RBAC_SERVICE);
  const router = inject(Router);

  if (isPublicRoute(route)) return true;

  if (rbac.session()) return true;

  return router.createUrlTree(['/signin'], { queryParams: { next: state.url } });
};
