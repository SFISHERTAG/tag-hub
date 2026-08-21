import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PortfolioService } from './portfolio.service';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import type { Portfolio } from './portfolio.model';

/**
 * Story: the two things this service must never do are send a tenant id and
 * turn a failure into an empty book.
 *
 * The first is the audit's most-repeated bug: an endpoint that accepts a
 * caller-supplied location id and looks it up. There is no parameter here at
 * all, and this test pins the request shape so nobody "helpfully" adds one.
 *
 * The second is the reason the ApiResult contract exists. `{ data: [], error:
 * null }` means the user has no clients; `{ data: null, error }` means we do
 * not know what they have. A screen that cannot tell those apart tells a CSM
 * their book is empty during an outage.
 */

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])),
      provideHttpClientTesting(),
      { provide: APP_CONFIG, useValue: { production: false, apiBaseUrl: '', googleClientId: '' } },
    ],
  });

  return {
    service: TestBed.inject(PortfolioService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

function portfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    tenants: [{ locationId: 'loc1', name: 'Acme' }],
    unavailable: { count: 0, locationIds: [] },
    canEnter: true,
    ...overrides,
  };
}

describe('PortfolioService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks for the caller list with no parameters at all', async () => {
    const { service, httpMock } = setup();

    const pending = service.listTenants();
    const request = httpMock.expectOne('/api/portfolio/tenants');

    expect(request.request.method).toBe('GET');
    // The session is the query. A location id in the request would be a
    // second, forgeable opinion about who may see what.
    expect(request.request.params.keys()).toEqual([]);
    expect(request.request.body).toBeNull();

    request.flush(portfolio());
    await pending;
    httpMock.verify();
  });

  it('returns the tenants, the shortfall and the enter flag', async () => {
    const { service, httpMock } = setup();

    const pending = service.listTenants();
    httpMock.expectOne('/api/portfolio/tenants').flush(
      portfolio({
        tenants: [
          { locationId: 'loc1', name: 'Acme' },
          { locationId: 'loc2', name: 'Beta' },
        ],
        unavailable: { count: 1, locationIds: ['loc3'] },
        canEnter: false,
      }),
    );

    const result = await pending;

    expect(result.error).toBeNull();
    expect(result.data?.tenants).toHaveLength(2);
    expect(result.data?.unavailable).toEqual({ count: 1, locationIds: ['loc3'] });
    expect(result.data?.canEnter).toBe(false);
    httpMock.verify();
  });

  it('keeps a genuinely empty book distinguishable from a failure', async () => {
    const { service, httpMock } = setup();

    const pending = service.listTenants();
    httpMock.expectOne('/api/portfolio/tenants').flush(portfolio({ tenants: [] }));

    const result = await pending;

    expect(result.error).toBeNull();
    expect(result.data?.tenants).toEqual([]);
    httpMock.verify();
  });

  it('surfaces a failure as an error rather than as no clients', async () => {
    const { service, httpMock } = setup();

    const pending = service.listTenants();
    httpMock
      .expectOne('/api/portfolio/tenants')
      .flush(
        { message: 'Sign in to continue.', context: 'GET /api/portfolio/tenants', status: 401 },
        { status: 401, statusText: 'Unauthorized' },
      );

    const result = await pending;

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Sign in to continue.');
    expect(result.error?.status).toBe(401);
    httpMock.verify();
  });
});
