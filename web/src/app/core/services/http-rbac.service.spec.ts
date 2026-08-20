import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpRbacService } from './http-rbac.service';
import { ImpersonationService } from './impersonation.service';
import { RBAC_SERVICE } from './rbac.service';
import { APP_CONFIG } from '../config/app-config';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { ROLES } from '../models/role.model';
import type { Session } from '../models/session.model';

/**
 * Story: the session used to be a hardcoded literal. These tests pin the two
 * rules that make the real one safe.
 *
 * A hat switch REPLACES the whole session. `locations` is derived from
 * `currentRole` on the server, and for the wide hats it is the result of a
 * lookup, so a client that patched `currentRole` alone would keep the previous
 * hat's tenant list and report access the new hat does not have.
 *
 * And `load()` resolves rather than rejects when signed out. It runs inside the
 * app initializer, so a rejection there means the app never boots for anyone who
 * has not signed in yet.
 */

function session(overrides: Partial<Session> = {}): Session {
  return {
    uid: 'u-1',
    email: 'someone@taxadvisorygrowth.net',
    currentRole: ROLES.TAG_EXEC,
    availableRoles: [ROLES.TAG_EXEC, ROLES.CLIENT_CLOSER],
    locations: ['loc-1', 'loc-2', 'loc-3'],
    impersonation: null,
    ...overrides,
  };
}

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])),
      provideHttpClientTesting(),
      { provide: APP_CONFIG, useValue: { production: false, apiBaseUrl: '' } },
      HttpRbacService,
      { provide: RBAC_SERVICE, useExisting: HttpRbacService },
    ],
  });
  return {
    rbac: TestBed.inject(HttpRbacService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('HttpRbacService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the session from the probe endpoint', async () => {
    const { rbac, httpMock } = setup();

    const loading = rbac.load();
    httpMock.expectOne('/api/auth/session').flush(session());
    await loading;

    expect(rbac.session()?.uid).toBe('u-1');
    httpMock.verify();
  });

  it('resolves with a null session on a 401 rather than rejecting', async () => {
    const { rbac, httpMock } = setup();

    const loading = rbac.load();
    httpMock
      .expectOne('/api/auth/session')
      .flush({ message: 'Not signed in', context: 'x', status: 401 }, { status: 401, statusText: 'Unauthorized' });

    // Rejecting here fails the app initializer, so the app never boots for a
    // visitor who simply has not signed in.
    await expect(loading).resolves.toBeUndefined();
    expect(rbac.session()).toBeNull();
    httpMock.verify();
  });

  it('replaces the whole session on a hat switch, narrowing locations', async () => {
    const { rbac, httpMock } = setup();
    const loading = rbac.load();
    httpMock.expectOne('/api/auth/session').flush(session());
    await loading;

    const switching = rbac.switchRole(ROLES.CLIENT_CLOSER);
    const req = httpMock.expectOne('/api/session/role');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ role: ROLES.CLIENT_CLOSER });
    req.flush(session({ currentRole: ROLES.CLIENT_CLOSER, locations: ['loc-1'] }));
    await switching;

    expect(rbac.session()?.currentRole).toBe(ROLES.CLIENT_CLOSER);
    // The failure this guards: keeping loc-2 and loc-3 from the wide hat.
    expect(rbac.session()?.locations).toEqual(['loc-1']);
    httpMock.verify();
  });

  it('posts the switch to /api/session/role, not /api/auth/role', async () => {
    const { rbac, httpMock } = setup();

    const switching = rbac.switchRole(ROLES.CLIENT_CLOSER);
    // proxy.ts exempts /api/auth from its cookie gate and the authInterceptor
    // skips its 401 refresh for that prefix, so a hat switch there would
    // hard-fail on an expired cookie.
    httpMock.expectNone('/api/auth/role');
    httpMock.expectOne('/api/session/role').flush(session({ currentRole: ROLES.CLIENT_CLOSER }));
    await switching;

    httpMock.verify();
  });

  it('leaves the session untouched when a switch is refused', async () => {
    const { rbac, httpMock } = setup();
    const loading = rbac.load();
    httpMock.expectOne('/api/auth/session').flush(session());
    await loading;

    const switching = rbac.switchRole(ROLES.CLIENT_CLOSER);
    httpMock
      .expectOne('/api/session/role')
      .flush({ message: 'nope', context: 'x', status: 403 }, { status: 403, statusText: 'Forbidden' });
    const result = await switching;

    expect(result.error?.status).toBe(403);
    // No optimistic update to roll back: the UI never renders a hat the server
    // refused.
    expect(rbac.session()?.currentRole).toBe(ROLES.TAG_EXEC);
    httpMock.verify();
  });
});

describe('ImpersonationService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads its state off the session rather than keeping a copy', async () => {
    const { rbac, httpMock } = setup();
    const impersonation = TestBed.inject(ImpersonationService);

    const loading = rbac.load();
    httpMock.expectOne('/api/auth/session').flush(session({ impersonation: { locationId: 'loc-9' } }));
    await loading;

    // Survives a reload because it rides on the session, not on local state —
    // the hub_impersonation cookie is httpOnly and unreadable here.
    expect(impersonation.isImpersonating()).toBe(true);
    expect(impersonation.current()).toEqual({ locationId: 'loc-9' });
    httpMock.verify();
  });

  it('applies the returned session on enter', async () => {
    const { rbac, httpMock } = setup();
    const impersonation = TestBed.inject(ImpersonationService);

    const entering = impersonation.enter('loc-9');
    const req = httpMock.expectOne('/api/impersonation/enter');
    expect(req.request.body).toEqual({ locationId: 'loc-9' });
    req.flush(session({ impersonation: { locationId: 'loc-9' } }));
    await entering;

    expect(rbac.session()?.impersonation).toEqual({ locationId: 'loc-9' });
    httpMock.verify();
  });

  it('clears the state on exit', async () => {
    const { rbac, httpMock } = setup();
    const impersonation = TestBed.inject(ImpersonationService);

    const loading = rbac.load();
    httpMock.expectOne('/api/auth/session').flush(session({ impersonation: { locationId: 'loc-9' } }));
    await loading;

    const exiting = impersonation.exit();
    httpMock.expectOne('/api/impersonation/exit').flush(session({ impersonation: null }));
    await exiting;

    // A banner that outlives the access it describes is the failure here.
    expect(impersonation.isImpersonating()).toBe(false);
    httpMock.verify();
  });

  it('does not clear the state when exit fails', async () => {
    const { rbac, httpMock } = setup();
    const impersonation = TestBed.inject(ImpersonationService);

    const loading = rbac.load();
    httpMock.expectOne('/api/auth/session').flush(session({ impersonation: { locationId: 'loc-9' } }));
    await loading;

    const exiting = impersonation.exit();
    httpMock
      .expectOne('/api/impersonation/exit')
      .flush({ message: 'nope', context: 'x', status: 403 }, { status: 403, statusText: 'Forbidden' });
    await exiting;

    // The server still considers it open, so the UI must too.
    expect(impersonation.isImpersonating()).toBe(true);
    expect(rbac.session()?.uid).toBe('u-1');
    httpMock.verify();
  });
});
