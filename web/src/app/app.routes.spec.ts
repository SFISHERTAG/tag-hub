import type { Route, Routes } from '@angular/router';
import { routes } from './app.routes';
import { NAV_ITEMS } from './layout/nav/nav-items';
import { ROLE_LIST, ROLES, isRole, type Role } from './core/models/role.model';

/**
 * The integration seam. Four feature agents built modules in parallel and none
 * of them was allowed to touch this file or nav-items.ts, so nothing until now
 * has checked that the two halves agree.
 *
 * A production build proves every component compiles. It does not prove any of
 * them is reachable, and it cannot prove the nav and the guards allow the same
 * hats — both of those are runtime facts about two data structures. That is
 * what this file checks, and it is why it walks the real `routes` and the real
 * `NAV_ITEMS` rather than fixtures.
 *
 * The rule under test, from CLAUDE.md: an item's permission list must be a
 * SUBSET of what its route guard allows. Wider sends people into a redirect;
 * narrower makes a feature undiscoverable. Both failures look fine in a browser
 * signed in as an admin, which is why they need a test rather than a review.
 */

const SHELL_PATH = '';

function shellChildren(): Routes {
  const shell = routes.find((route) => route.path === SHELL_PATH);
  if (!shell?.children) throw new Error('The shell route has no children array.');
  return shell.children;
}

/** Awaits a `loadChildren` and insists it produced a Routes array. */
async function load(route: Route): Promise<Routes> {
  const loader = route.loadChildren;
  if (!loader) throw new Error(`Route "${route.path}" has no loadChildren.`);
  const loaded = await loader();
  if (!Array.isArray(loaded)) {
    throw new Error(`Route "${route.path}" did not resolve to a Routes array.`);
  }
  return loaded;
}

/**
 * The permission list a guard would read off this route. Deliberately reads the
 * same `data.permission` key permissionGuard reads, so a rename breaks this
 * test rather than silently un-gating every route.
 */
function permissionOf(route: Route): readonly Role[] {
  const declared: unknown = route.data?.['permission'];
  if (!Array.isArray(declared)) return [];
  return declared.filter(isRole);
}

/** The entry component of a feature: its own `''` child, redirects excluded. */
function indexRoute(loaded: Routes, path: string): Route {
  const index = loaded.find((route) => route.path === '' && route.redirectTo === undefined);
  if (!index) throw new Error(`Feature "${path}" declares no '' route to land on.`);
  return index;
}

function firstSegment(navPath: string): string {
  return navPath.replace(/^\//, '').split('/')[0];
}

describe('app.routes wiring', () => {
  it('registers every feature that exists on disk as a lazy child of the shell', () => {
    const paths = shellChildren()
      .map((route) => route.path)
      .filter((path): path is string => path !== undefined);

    // 'l' is the GHL client workspace; ':locationId' lives inside ghl.routes.ts
    // with locationAccessGuard attached to it.
    expect(paths).toEqual(
      expect.arrayContaining([
        'dashboard',
        'portfolio',
        'clients',
        'onboarding',
        'flow',
        'setter',
        'courses',
        'knowledge-base',
        'bug-reports',
        'admin',
        'l',
      ]),
    );
  });

  it('lazy-loads every feature rather than importing it into main', () => {
    const featureChildren = shellChildren().filter(
      (route) => route.path !== '' && route.path !== '**',
    );

    // loadComponent here would be a feature in the initial bundle. The whole
    // point of this file is the lazy boundary.
    for (const route of featureChildren) {
      expect(route.loadChildren, `"${route.path}" is not lazy`).toBeDefined();
      expect(route.loadComponent).toBeUndefined();
    }
  });

  it('puts no permissionGuard on a feature parent', () => {
    // permissionGuard is default-deny and reads data.permission off the route
    // it is attached to. A parent carrying the guard with no permission list of
    // its own refuses every child underneath it, which is a whole feature going
    // dark for everyone.
    for (const route of shellChildren()) {
      if (route.loadChildren) expect(route.canActivate).toBeUndefined();
    }
  });

  it('sends the root and any unmatched URL somewhere every hat can go', () => {
    const children = shellChildren();
    const index = children.find((route) => route.path === '');
    const wildcard = children[children.length - 1];

    expect(index?.redirectTo).toBe('dashboard');
    expect(index?.pathMatch).toBe('full');
    // '**' matches anything, so anything after it is dead configuration.
    expect(wildcard.path).toBe('**');
    expect(wildcard.redirectTo).toBe('dashboard');
  });

  it('makes the page authGuard redirects to publicly reachable', () => {
    // The bug this pins: authGuard and permissionGuard hang off the `signin`
    // route, but PUBLIC_ROUTE was declared one level down on the '' child
    // inside auth.routes.ts. Route data inherits parent to child and never
    // child to parent, so this route's data was `{}` — authGuard saw a
    // signed-out visitor on a non-public route and redirected them to /signin,
    // the page they were already on, forever. Nobody could sign in.
    //
    // Asserted statically rather than by navigating. A live router test does
    // reproduce it, and that is how it was found, but the failure mode is an
    // unbounded redirect loop that starves the event loop: the run hangs
    // instead of failing, which in CI is a timeout with no useful message.
    const signin = routes.find((route) => route.path === 'signin');

    expect(signin?.canActivate?.length, 'signin lost its guards').toBeGreaterThan(0);
    expect(signin?.data?.['public'], 'signin is guarded but not marked public').toBe(true);
  });

  it('does not mark the signed-in half of the app public', () => {
    // The same marker on the wrong route publishes every screen behind it,
    // since data inherits downward.
    const shell = routes.find((route) => route.path === SHELL_PATH);

    expect(shell?.data?.['public']).toBeUndefined();
    expect(shell?.canActivate?.length, 'the shell lost authGuard').toBeGreaterThan(0);
  });

  it('resolves every lazy feature to a non-empty route table', async () => {
    // Proves the loaders are real. A typo'd path fails the import here rather
    // than at the moment a user clicks the link.
    for (const route of shellChildren().filter((child) => child.loadChildren)) {
      const loaded = await load(route);
      expect(loaded.length, `"${route.path}" loaded an empty route table`).toBeGreaterThan(0);
    }
  });

  it('guards every routed screen with a permission list', async () => {
    for (const route of shellChildren().filter((child) => child.loadChildren)) {
      const loaded = await load(route);
      for (const child of loaded) {
        if (child.redirectTo !== undefined) continue;
        expect(
          permissionOf(child).length,
          `"${route.path}/${child.path}" declares no data.permission`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe('nav-items against the guards they point at', () => {
  it('points every nav item at a registered route', () => {
    const paths = new Set(shellChildren().map((route) => route.path));

    for (const item of NAV_ITEMS) {
      expect(paths.has(firstSegment(item.path)), `${item.path} matches no route`).toBe(true);
    }
  });

  it('never shows a hat a link its guard refuses', async () => {
    for (const item of NAV_ITEMS) {
      const segment = firstSegment(item.path);
      const route = shellChildren().find((child) => child.path === segment);
      if (!route) throw new Error(`${item.path} matches no route`);

      const allowed = permissionOf(indexRoute(await load(route), segment));
      const refused = item.permission.filter((role) => !allowed.includes(role));

      // The redirect case: the nav offers a link the guard bounces.
      expect(refused, `${item.path} is shown to hats its guard refuses`).toEqual([]);
    }
  });

  it('never hides a link its guard permits', async () => {
    for (const item of NAV_ITEMS) {
      const segment = firstSegment(item.path);
      const route = shellChildren().find((child) => child.path === segment);
      if (!route) throw new Error(`${item.path} matches no route`);

      const allowed = permissionOf(indexRoute(await load(route), segment));
      const missing = allowed.filter((role) => !item.permission.includes(role));

      // The undiscoverable case: the guard lets them in and nothing links there.
      expect(missing, `${item.path} is hidden from hats its guard permits`).toEqual([]);
    }
  });

  it('gives every hat a nav set rather than an empty bar', () => {
    for (const role of ROLE_LIST) {
      const visible = NAV_ITEMS.filter((item) => item.permission.includes(role));
      expect(visible.length, `${role} has an empty nav`).toBeGreaterThan(0);
    }
  });

  it('gives tag_csd the department screens specifically', () => {
    // The original bug: in the Next app's nav a CS Director matched zero
    // entries, so they signed in to an empty tab bar and the team_health_rollup
    // widget built for them was unreachable. "Not empty" is not enough — a
    // director whose only link is Report a bug is the same bug wearing a hat.
    const visible = NAV_ITEMS.filter((item) => item.permission.includes(ROLES.TAG_CSD)).map(
      (item) => item.path,
    );

    expect(visible).toEqual(expect.arrayContaining(['/dashboard', '/portfolio', '/clients']));
  });

  it('lists each path once', () => {
    const paths = NAV_ITEMS.map((item) => item.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
