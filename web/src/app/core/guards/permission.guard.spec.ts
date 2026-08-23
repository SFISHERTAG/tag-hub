import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { signal } from '@angular/core';
import { permissionGuard } from './permission.guard';
import { authGuard } from './auth.guard';
import { PUBLIC_ROUTE } from './public-route';
import { RBAC_SERVICE, type RbacService } from '../services/rbac.service';
import { ROLES, type Role } from '../models/role.model';
import type { Session } from '../models/session.model';

/**
 * Story: permissionGuard was default-ALLOW — a route with no `data.permission`
 * was permitted for everyone. That failure mode is invisible, because a route
 * missing its permission list works perfectly for whoever wrote it and is only
 * wrong for the people who should never have seen it.
 *
 * Flipping to default-deny is not free: it makes `/signin` unreachable unless
 * something exempts it, and authGuard on `/signin` redirects a signed-out
 * visitor to the page they are already on. Both halves are pinned here.
 */

function snapshot(data: Record<string, unknown> = {}, path = 'test'): ActivatedRouteSnapshot {
  return {
    data,
    url: [],
    routeConfig: { path },
  } as unknown as ActivatedRouteSnapshot;
}

function state(url = '/test'): RouterStateSnapshot {
  return { url } as RouterStateSnapshot;
}

function configure(session: Session | null) {
  const rbac: RbacService = {
    session: signal(session).asReadonly(),
    load: () => Promise.resolve(),
    switchRole: () =>
      Promise.resolve({ data: null, error: { message: 'stub', context: 'test' } }),
    exitImpersonation: () => Promise.resolve({ data: null, error: null }) as never,
    signOut: () => Promise.resolve(),
    applySession: () => undefined,
  };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: RBAC_SERVICE, useValue: rbac }],
  });
}

// Without this, vi.spyOn on an already-spied console.error returns the existing
// mock, so mock.calls carries entries from earlier tests in this file.
afterEach(() => {
  vi.restoreAllMocks();
});

function sessionWith(currentRole: Role): Session {
  return {
    uid: 'u1',
    email: 'u@example.com',
    currentRole,
    availableRoles: [currentRole],
    locations: [],
    impersonation: null,
  };
}

describe('permissionGuard', () => {
  it('denies a route that declares no permission list', () => {
    configure(sessionWith(ROLES.TAG_EXEC));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = TestBed.runInInjectionContext(() => permissionGuard(snapshot(), state()));

    // The whole point of the change: silence is refusal, not consent.
    expect(result).toBeInstanceOf(UrlTree);
  });

  it('denies a route whose permission list is empty', () => {
    configure(sessionWith(ROLES.TAG_EXEC));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(snapshot({ permission: [] }), state()),
    );

    expect(result).toBeInstanceOf(UrlTree);
  });

  it('allows a role named in the permission list', () => {
    configure(sessionWith(ROLES.TAG_CSM));

    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(snapshot({ permission: [ROLES.TAG_CSM, ROLES.TAG_EXEC] }), state()),
    );

    expect(result).toBe(true);
  });

  it('denies a role absent from the permission list', () => {
    configure(sessionWith(ROLES.CLIENT_CLOSER));

    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(snapshot({ permission: [ROLES.ADMIN] }), state()),
    );

    expect(result).toBeInstanceOf(UrlTree);
  });

  it('allows an explicitly public route with no session at all', () => {
    configure(null);

    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(snapshot({ ...PUBLIC_ROUTE }, 'signin'), state('/signin')),
    );

    expect(result).toBe(true);
  });

  it('explains itself in dev when a route is denied for having no list', () => {
    configure(sessionWith(ROLES.TAG_EXEC));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    TestBed.runInInjectionContext(() => permissionGuard(snapshot({}, 'reports'), state()));

    // "My route redirects home and I don't know why" is the expensive version
    // of this bug. The message names the route and both ways to fix it.
    expect(logged).toHaveBeenCalled();
    const message = String(logged.mock.calls[0]?.[0] ?? '');
    expect(message).toContain('reports');
    expect(message).toContain('PUBLIC_ROUTE');
  });
});

describe('authGuard', () => {
  it('redirects a signed-out visitor to sign-in, preserving where they were headed', () => {
    configure(null);

    const result = TestBed.runInInjectionContext(() =>
      authGuard(snapshot(), state('/l/loc1/pipeline')),
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toContain(
      'next=%2Fl%2Floc1%2Fpipeline',
    );
  });

  it('allows a signed-in visitor', () => {
    configure(sessionWith(ROLES.TAG_EXEC));

    expect(TestBed.runInInjectionContext(() => authGuard(snapshot(), state()))).toBe(true);
  });

  it('does not bounce a signed-out visitor away from a public route', () => {
    configure(null);

    // Without this, attaching authGuard to /signin sends a signed-out visitor
    // from /signin to /signin, and the app never renders.
    const result = TestBed.runInInjectionContext(() =>
      authGuard(snapshot({ ...PUBLIC_ROUTE }, 'signin'), state('/signin')),
    );

    expect(result).toBe(true);
  });

  it('lets /signin render with both guards attached', () => {
    configure(null);
    const route = snapshot({ ...PUBLIC_ROUTE }, 'signin');

    // The exact combination that would otherwise deadlock.
    expect(TestBed.runInInjectionContext(() => authGuard(route, state('/signin')))).toBe(true);
    expect(TestBed.runInInjectionContext(() => permissionGuard(route, state('/signin')))).toBe(true);
  });
});
