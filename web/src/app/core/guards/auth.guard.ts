import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RBAC_SERVICE } from '../services/rbac.service';

/** Session check — port of the intent behind getSession()/requireSession(). */
export const authGuard: CanActivateFn = (_route, state) => {
  const rbac = inject(RBAC_SERVICE);
  const router = inject(Router);

  if (rbac.session()) return true;

  return router.createUrlTree(['/signin'], { queryParams: { next: state.url } });
};
