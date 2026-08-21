import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, convertToParamMap } from '@angular/router';
import { Subject } from 'rxjs';
import { injectLocationId } from './location-id';

/**
 * Story: two ways this could silently return the wrong client.
 *
 * The screens sit UNDER `l/:locationId`, and that parent renders a component
 * (the workspace tab bar). Angular's default params inheritance only passes a
 * parent's params down through component-less routes, so reading the child's
 * own paramMap returns null and every request goes to
 * `/api/ghl/locations//...`. Walking the tree is what makes the id reachable
 * whether or not that parent has a component today.
 *
 * And switching clients reuses these components. A value read once at
 * construction keeps showing the previous client's data under the new client's
 * URL — the worst shape of this bug, because everything on screen looks
 * plausible.
 */

function routeChain(childParams: Record<string, string>, parentParams: Record<string, string>) {
  const parent = {
    snapshot: { paramMap: convertToParamMap(parentParams) },
    parent: null,
  };
  return {
    snapshot: { paramMap: convertToParamMap(childParams) },
    parent,
  };
}

function setup(route: unknown, events: Subject<NavigationEnd>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: ActivatedRoute, useValue: route },
      { provide: Router, useValue: { events } },
    ],
  });

  return TestBed.runInInjectionContext(() => injectLocationId());
}

describe('injectLocationId', () => {
  it('finds the id on an ancestor route', () => {
    const events = new Subject<NavigationEnd>();
    const locationId = setup(routeChain({}, { locationId: 'loc1' }), events);

    expect(locationId()).toBe('loc1');
  });

  it('prefers the id on the route itself when there is one', () => {
    const events = new Subject<NavigationEnd>();
    const locationId = setup(routeChain({ locationId: 'own' }, { locationId: 'parent' }), events);

    expect(locationId()).toBe('own');
  });

  it('re-reads when the router switches client', () => {
    const events = new Subject<NavigationEnd>();
    const route = routeChain({}, { locationId: 'loc1' });
    const locationId = setup(route, events);

    expect(locationId()).toBe('loc1');

    // The router swaps the parameter without destroying the screen.
    route.parent.snapshot.paramMap = convertToParamMap({ locationId: 'loc2' });
    events.next(new NavigationEnd(1, '/l/loc2/pipeline', '/l/loc2/pipeline'));

    expect(locationId()).toBe('loc2');
  });

  it('reports no client rather than guessing one', () => {
    const events = new Subject<NavigationEnd>();
    const locationId = setup(routeChain({}, {}), events);

    // The screens turn this into "No client selected" instead of asking the
    // API for `/api/ghl/locations//pipeline`.
    expect(locationId()).toBe('');
  });
});
