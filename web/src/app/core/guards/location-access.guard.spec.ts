import { TestBed } from '@angular/core/testing';
import { UrlTree, convertToParamMap, provideRouter } from '@angular/router';
import type { ActivatedRouteSnapshot } from '@angular/router';
import { signal } from '@angular/core';
import { locationAccessGuard } from './location-access.guard';
import { RBAC_SERVICE, type RbacService } from '../services/rbac.service';
import { ROLES, type Role } from '../models/role.model';
import type { Session } from '../models/session.model';

/**
 * Story: this mirrors requireLocationAccess in lib/auth/session.ts, and the two
 * have to agree. A divergence shows a screen the API will refuse, or hides one
 * it would have served.
 *
 * The case that catches a careless implementation is the CSM. Their static grant
 * does NOT contain their book — entering a tenant is what grants access — so
 * gating purely on `session.locations` would deny every legitimate CSM and break
 * Story 3.3 entirely.
 */

function snapshot(locationId: string | null): ActivatedRouteSnapshot {
  return {
    paramMap: convertToParamMap(locationId === null ? {} : { locationId }),
  } as unknown as ActivatedRouteSnapshot;
}

function configure(session: Session | null) {
  const rbac: RbacService = {
    session: signal(session).asReadonly(),
    load: () => Promise.resolve(),
    switchRole: () => Promise.resolve({ data: null, error: { message: 'stub', context: 'test' } }),
    applySession: () => undefined,
  };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: RBAC_SERVICE, useValue: rbac }],
  });
}

function session(currentRole: Role, overrides: Partial<Session> = {}): Session {
  return {
    uid: 'u-1',
    email: 'u@example.com',
    currentRole,
    availableRoles: [currentRole],
    locations: [],
    impersonation: null,
    ...overrides,
  };
}

function run(route: ActivatedRouteSnapshot) {
  return TestBed.runInInjectionContext(() =>
    locationAccessGuard(route, {} as never),
  );
}

describe('locationAccessGuard', () => {
  it.each([ROLES.TAG_EXEC, ROLES.TAG_CSD, ROLES.ADMIN])(
    'allows %s into any location',
    (role) => {
      configure(session(role, { locations: [] }));

      expect(run(snapshot('loc-anything'))).toBe(true);
    },
  );

  it('allows a location on the session grant', () => {
    configure(session(ROLES.CLIENT_CLOSER, { locations: ['loc-1', 'loc-2'] }));

    expect(run(snapshot('loc-2'))).toBe(true);
  });

  it('denies a location not on the grant', () => {
    configure(session(ROLES.CLIENT_CLOSER, { locations: ['loc-1'] }));

    expect(run(snapshot('loc-9'))).toBeInstanceOf(UrlTree);
  });

  it('allows a CSM into the tenant they are actively impersonating', () => {
    // The grant is empty, which is normal for a CSM: impersonation IS the grant.
    configure(
      session(ROLES.TAG_CSM, { locations: [], impersonation: { locationId: 'loc-9' } }),
    );

    expect(run(snapshot('loc-9'))).toBe(true);
  });

  it('denies a CSM a different tenant from the one they entered', () => {
    configure(
      session(ROLES.TAG_CSM, { locations: [], impersonation: { locationId: 'loc-9' } }),
    );

    expect(run(snapshot('loc-8'))).toBeInstanceOf(UrlTree);
  });

  it('denies a CSM with no impersonation at all', () => {
    configure(session(ROLES.TAG_CSM, { locations: [] }));

    expect(run(snapshot('loc-9'))).toBeInstanceOf(UrlTree);
  });

  it('does not extend the impersonation path to other roles', () => {
    // Only tag_csm gets access from an impersonation, matching session.ts.
    configure(
      session(ROLES.CLIENT_CLOSER, { locations: [], impersonation: { locationId: 'loc-9' } }),
    );

    expect(run(snapshot('loc-9'))).toBeInstanceOf(UrlTree);
  });

  it('sends a signed-out visitor to sign-in', () => {
    configure(null);

    expect(run(snapshot('loc-1'))).toBeInstanceOf(UrlTree);
  });

  it('refuses a route wired without a locationId param', () => {
    configure(session(ROLES.TAG_EXEC));

    // A wiring mistake, and refusing is the safe reading of it.
    expect(run(snapshot(null))).toBeInstanceOf(UrlTree);
  });
});
