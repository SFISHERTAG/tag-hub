import { DestroyRef, inject, signal, type Signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** The route parameter every screen in this feature hangs off. */
export const LOCATION_ID_PARAM = 'locationId';

/**
 * The location id for the current workspace, read from whichever ancestor route
 * declares it.
 *
 * Walking the route tree rather than reading `route.snapshot.paramMap` directly
 * is deliberate. Angular's default `paramsInheritanceStrategy` only passes a
 * parent's params down through COMPONENT-LESS routes, and `l/:locationId`
 * renders a workspace component (the tab bar). Reading the child's own paramMap
 * would therefore return null, and the screens would ask the API for
 * `/api/ghl/locations//pipeline`. Walking up works whether or not that parent
 * ever grows or loses a component, so a later layout change cannot break every
 * screen at once.
 *
 * Re-read on NavigationEnd because switching tenants reuses these components:
 * the router swaps the param without destroying the screen, and a value read
 * once at construction would keep showing the previous client's data.
 *
 * This is a lookup, never a permission. `locationAccessGuard` decides what
 * renders and `requireApiLocationAccess` decides what is returned.
 */
export function injectLocationId(): Signal<string> {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);

  const read = (): string => {
    let current: ActivatedRoute | null = route;
    while (current !== null) {
      const value = current.snapshot.paramMap.get(LOCATION_ID_PARAM);
      if (value !== null && value !== '') return value;
      current = current.parent;
    }
    return '';
  };

  const locationId = signal(read());

  const subscription = router.events
    .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
    .subscribe(() => locationId.set(read()));
  destroyRef.onDestroy(() => subscription.unsubscribe());

  return locationId.asReadonly();
}
