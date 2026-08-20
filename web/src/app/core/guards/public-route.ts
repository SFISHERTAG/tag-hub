import type { ActivatedRouteSnapshot } from '@angular/router';

/**
 * The one way a route opts out of authentication and permission checks.
 *
 * Both guards default to denying. Without an explicit marker, `/signin` would be
 * unreachable: `permissionGuard` would deny it for having no permission list,
 * and `authGuard` would redirect a signed-out visitor to the very page it just
 * refused. Spelling the exemption out in route data means every public surface
 * is greppable, rather than being an accident of which guards someone remembered
 * to attach.
 *
 * Usage:
 *
 *   { path: 'signin', data: PUBLIC_ROUTE, loadComponent: ... }
 *
 * Note that Angular merges parent route data into children, so marking a parent
 * public makes every child public. Put the marker on leaves unless the whole
 * subtree really is public.
 */
export const PUBLIC_ROUTE = { public: true } as const;

export function isPublicRoute(route: ActivatedRouteSnapshot): boolean {
  return route.data['public'] === true;
}
