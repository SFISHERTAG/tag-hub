import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SetterService } from './setter.service';
import { formatMinutes } from './setter.model';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';

/**
 * Story: the setter is never a parameter, and an upstream failure is never a
 * board of zeros.
 *
 * An email in the query string would let any caller pull any setter's queue.
 * The endpoint reads it from the session and there is no field here to override
 * it.
 *
 * The 502 is the half of the contract the screen depends on: it is what lets
 * the client keep its last-good queue and show a staleness warning instead of
 * rendering "0 leads today" over a real backlog.
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
    service: TestBed.inject(SetterService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('SetterService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends no setter email — identity comes from the session', async () => {
    const { service, httpMock } = setup();

    const pending = service.load();
    const request = httpMock.expectOne(
      (candidate) => candidate.url === '/api/setter/dashboard',
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);

    request.flush({ locationId: 'loc1', setterEmail: 's@x.io', refreshedAt: '', metrics: {}, leads: [] });
    await pending;
    httpMock.verify();
  });

  it('passes a location id when one is known, which the server re-checks', async () => {
    const { service, httpMock } = setup();

    const pending = service.load('loc1');
    const request = httpMock.expectOne(
      (candidate) => candidate.url === '/api/setter/dashboard',
    );

    expect(request.request.params.get('locationId')).toBe('loc1');
    expect(request.request.params.keys()).toEqual(['locationId']);

    request.flush({ locationId: 'loc1', setterEmail: 's@x.io', refreshedAt: '', metrics: {}, leads: [] });
    await pending;
    httpMock.verify();
  });

  it('surfaces a 502 as a failure so the screen can keep its last-good data', async () => {
    const { service, httpMock } = setup();

    const pending = service.load('loc1');
    httpMock.expectOne((candidate) => candidate.url === '/api/setter/dashboard').flush(
      {
        message: 'Could not load this data from its source.',
        context: 'GET /api/setter/dashboard',
      },
      { status: 502, statusText: 'Bad Gateway' },
    );

    const result = await pending;

    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(502);
    httpMock.verify();
  });

  it('carries refreshedAt through, which is what the staleness warning counts from', async () => {
    const { service, httpMock } = setup();

    const pending = service.load();
    httpMock.expectOne((candidate) => candidate.url === '/api/setter/dashboard').flush({
      locationId: 'loc1',
      setterEmail: 's@x.io',
      refreshedAt: '2026-08-21T16:05:00.000Z',
      metrics: {},
      leads: [],
    });

    const result = await pending;

    expect(result.data?.refreshedAt).toBe('2026-08-21T16:05:00.000Z');
    httpMock.verify();
  });
});

describe('formatMinutes', () => {
  it('renders a missing reading as "-" rather than a plausible zero', () => {
    expect(formatMinutes(undefined)).toBe('-');
    expect(formatMinutes(0)).toBe('-');
  });

  it('renders minutes below an hour as minutes', () => {
    expect(formatMinutes(1)).toBe('1m');
    expect(formatMinutes(59)).toBe('59m');
  });

  it('splits an hour or more into hours and minutes', () => {
    expect(formatMinutes(60)).toBe('1h 0m');
    expect(formatMinutes(125)).toBe('2h 5m');
  });
});
