import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RBAC_SERVICE } from '../services/rbac.service';
import { ROLES } from '../models/role.model';

/**
 * Client-side mirror of requireLocationAccess in lib/auth/session.ts.
 *
 * COSMETIC, and the hazard here runs opposite to the usual one. Elsewhere the
 * warning is that a hidden button is not a security control. Here it is that a
 * VISIBLE screen is not an access grant: this guard stops someone typing a
 * location id into the URL bar and watching a shell render with empty panels and
 * a stack of 403s. The API decides what data comes back, every time.
 *
 * Reads the location id from the route's own params, never from a query string
 * or an input, so a parent route can apply it once and every child inherits the
 * check by construction.
 *
 * Usage:
 *   {
 *     path: 'l/:locationId',
 *     canActivate: [authGuard, permissionGuard, locationAccessGuard],
 *     ...
 *   }
 */
export const locationAccessGuard: CanActivateFn = (route) => {
  const rbac = inject(RBAC_SERVICE);
  const router = inject(Router);

  const session = rbac.session();
  if (!session) return router.createUrlTree(['/signin']);

  const locationId = route.paramMap.get('locationId');
  // A route using this guard without a :locationId param is a wiring mistake,
  // and refusing is the safe reading of it.
  if (!locationId) return router.createUrlTree(['/']);

  // The wide hats reach every tenant. Mirrors lib/auth/session.ts, and the two
  // must change together: a divergence here shows a screen the API will refuse,
  // or hides one it would have served.
  if (
    session.currentRole === ROLES.TAG_EXEC ||
    session.currentRole === ROLES.TAG_CSD ||
    session.currentRole === ROLES.ADMIN
  ) {
    return true;
  }

  if (session.locations.includes(locationId)) return true;

  // A CSM's static grant does not contain their book: entering a tenant is what
  // grants access, so an active impersonation for THIS location is the grant.
  if (
    session.currentRole === ROLES.TAG_CSM &&
    session.impersonation?.locationId === locationId
  ) {
    return true;
  }

  return router.createUrlTree(['/']);
};
