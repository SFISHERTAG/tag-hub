import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ClientsService } from './clients.service';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import type { ClientBookResponse } from './client.model';

/**
 * Story: this service has three jobs it must not get wrong.
 *
 * 1. Never send an identifier the caller could substitute. The audit found the
 *    caller-supplied-location-id bug fourteen times, and `/creatives` was one
 *    of them — it took a location straight off a client object and reached
 *    Google Drive with it. There is no location parameter anywhere in this file
 *    now, and these tests pin the request shapes so nobody adds one back as a
 *    convenience.
 * 2. Never send a blank filter. `?status=` is not "no filter" to the endpoint,
 *    it is an unknown status and a 400. A cleared search box must not become an
 *    error.
 * 3. Never flatten a failure. `{ data: [], error: null }` means the book is
 *    empty; `{ data: null, error }` means we do not know what is in it.
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
    service: TestBed.inject(ClientsService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

function book(overrides: Partial<ClientBookResponse> = {}): ClientBookResponse {
  return {
    scope: 'mine',
    csmEmail: 'csm@taxadvisorygrowth.net',
    clients: [],
    total: 0,
    sampleData: {
      isSample: true,
      fields: ['clients[].health'],
      source: 'lib/dashboard/mock-metrics.ts#getMockMetrics',
      notice: 'Sample data.',
    },
    ...overrides,
  };
}

describe('ClientsService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks for the caller book with no parameters at all', async () => {
    const { service, httpMock } = setup();

    const pending = service.listClients();
    const request = httpMock.expectOne('/api/clients');

    expect(request.request.method).toBe('GET');
    // The session is the query. `scope` defaults to `mine` server-side and is
    // keyed on session.email, so there is nothing here to point at a peer.
    expect(request.request.params.keys()).toEqual([]);

    request.flush(book());
    await pending;
    httpMock.verify();
  });

  it('drops empty filters rather than sending them as values', async () => {
    const { service, httpMock } = setup();

    const pending = service.listClients({ search: '', status: 'at-risk', sortBy: 'health' });
    const request = httpMock.expectOne((candidate) => candidate.url === '/api/clients');

    expect(request.request.params.has('search')).toBe(false);
    expect(request.request.params.get('status')).toBe('at-risk');
    expect(request.request.params.get('sortBy')).toBe('health');

    request.flush(book());
    await pending;
    httpMock.verify();
  });

  it('sends a coverage read as an explicit csm scope, never as a silent default', async () => {
    const { service, httpMock } = setup();

    const pending = service.listClients({ scope: 'csm', csmEmail: 'peer@taxadvisorygrowth.net' });
    const request = httpMock.expectOne((candidate) => candidate.url === '/api/clients');

    expect(request.request.params.get('scope')).toBe('csm');
    expect(request.request.params.get('csmEmail')).toBe('peer@taxadvisorygrowth.net');

    request.flush(book({ scope: 'csm', csmEmail: 'peer@taxadvisorygrowth.net' }));
    await pending;
    httpMock.verify();
  });

  it('never sends a location id when reading creatives', async () => {
    const { service, httpMock } = setup();

    const pending = service.getCreatives('client-1');
    const request = httpMock.expectOne('/api/clients/client-1/creatives');

    // The reference implementation passed a locationId here, taken from a
    // client-side object and used unchecked to reach Drive. The endpoint reads
    // it from the client's own record now, so there is no id to forge.
    expect(request.request.params.keys()).toEqual([]);

    request.flush({
      clientId: 'client-1',
      locationId: 'loc-1',
      creatives: [],
      campaignLinksIncluded: true,
    });
    await pending;
    httpMock.verify();
  });

  it('asks for creative counts only when they were requested', async () => {
    const { service, httpMock } = setup();

    const withoutCounts = service.getCampaigns('client-1');
    const plain = httpMock.expectOne((candidate) =>
      candidate.url === '/api/clients/client-1/campaigns',
    );
    expect(plain.request.params.keys()).toEqual([]);
    plain.flush({
      clientId: 'client-1',
      metaAdAccountId: null,
      campaigns: [],
      creativeCountsIncluded: false,
    });
    await withoutCounts;

    const withCounts = service.getCampaigns('client-1', true);
    const enriched = httpMock.expectOne((candidate) =>
      candidate.url === '/api/clients/client-1/campaigns',
    );
    expect(enriched.request.params.get('withCreativeCounts')).toBe('true');
    enriched.flush({
      clientId: 'client-1',
      metaAdAccountId: 'act_1',
      campaigns: [],
      creativeCountsIncluded: true,
    });
    await withCounts;

    httpMock.verify();
  });

  it('escapes a client id into the path instead of concatenating it raw', async () => {
    const { service, httpMock } = setup();

    const pending = service.getAlerts('a/b');
    const request = httpMock.expectOne('/api/clients/a%2Fb/alerts');

    request.flush({ clientId: 'a/b', alerts: [] });
    await pending;
    httpMock.verify();
  });

  it('returns a typed error rather than an empty book when the read fails', async () => {
    const { service, httpMock } = setup();

    const pending = service.listClients();
    httpMock
      .expectOne('/api/clients')
      .flush({ message: 'Firestore is unreachable.' }, { status: 503, statusText: 'Unavailable' });

    const result = await pending;

    // The distinction the whole ApiResult contract exists for: this is not
    // `{ data: <empty book>, error: null }`.
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Firestore is unreachable.');
    httpMock.verify();
  });

  it('reports a genuinely empty book as data, not as an error', async () => {
    const { service, httpMock } = setup();

    const pending = service.listClients();
    httpMock.expectOne('/api/clients').flush(book({ clients: [], total: 0 }));

    const result = await pending;

    expect(result.error).toBeNull();
    expect(result.data?.clients).toEqual([]);
    httpMock.verify();
  });
});
