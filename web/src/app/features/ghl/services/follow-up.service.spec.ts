import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FollowUpService } from './follow-up.service';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import type { FollowUpResponse } from './ghl.model';

/**
 * Story: one endpoint, two screens, and the enrichment flag is the only
 * difference between them.
 *
 * The today panel must ask with enrich=0 (Story 2.8 AC5 — no per-row fetch
 * while the day renders) and the dedicated screen with enrich=1. Both get the
 * same membership, because membership is `resolveFollowUpQueue` server-side.
 * That is the function which refuses to treat a CANCELLED appointment as a
 * rebooking, and the reason neither screen computes its own: when they did,
 * they disagreed about the same contact, and the more forgiving one deleted
 * exactly the lead the queue exists to surface.
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
    service: TestBed.inject(FollowUpService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

function queue(overrides: Partial<FollowUpResponse> = {}): FollowUpResponse {
  return {
    config: { mode: 'days', value: 7 },
    canConfigure: false,
    lookaheadDays: 30,
    lookbackDays: 90,
    total: 0,
    truncated: false,
    enriched: false,
    configFallback: false,
    candidates: [],
    ...overrides,
  };
}

describe('FollowUpService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks for the cheap queue by default', async () => {
    const { service, httpMock } = setup();

    const pending = service.queue('loc1');
    const request = httpMock.expectOne(
      (candidate) => candidate.url === '/api/ghl/locations/loc1/follow-up',
    );

    expect(request.request.params.get('enrich')).toBe('0');
    expect(request.request.params.get('limit')).toBe('50');

    request.flush(queue());
    await pending;
    httpMock.verify();
  });

  it('asks for the enriched queue when the dedicated screen wants it', async () => {
    const { service, httpMock } = setup();

    const pending = service.queue('loc1', { enrich: true });
    const request = httpMock.expectOne(
      (candidate) => candidate.url === '/api/ghl/locations/loc1/follow-up',
    );

    expect(request.request.params.get('enrich')).toBe('1');

    request.flush(queue({ enriched: true }));
    await pending;
    httpMock.verify();
  });

  it('reports a config fallback rather than hiding it', async () => {
    const { service, httpMock } = setup();

    const pending = service.queue('loc1');
    httpMock
      .expectOne((candidate) => candidate.url === '/api/ghl/locations/loc1/follow-up')
      .flush(queue({ configFallback: true }));

    const result = await pending;

    // The threshold decides who ages out of the queue, so a fallback changes
    // the list itself. It is a fact about the answer, not an internal detail.
    expect(result.data?.configFallback).toBe(true);
    httpMock.verify();
  });

  it('saves a threshold as a PUT to the config endpoint', async () => {
    const { service, httpMock } = setup();

    const pending = service.saveConfig('loc1', { mode: 'attempts', value: 3 });
    const request = httpMock.expectOne('/api/ghl/locations/loc1/follow-up/config');

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ mode: 'attempts', value: 3 });

    request.flush({ config: { mode: 'attempts', value: 3 }, canConfigure: true });
    await pending;
    httpMock.verify();
  });

  it('surfaces a refused threshold change as an error', async () => {
    const { service, httpMock } = setup();

    const pending = service.saveConfig('loc1', { mode: 'days', value: 14 });
    httpMock
      .expectOne('/api/ghl/locations/loc1/follow-up/config')
      .flush(
        { message: 'Only a closing manager or owner can change this.', status: 403 },
        { status: 403, statusText: 'Forbidden' },
      );

    const result = await pending;

    // Hiding the control is cosmetic; this is the check that decides.
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(403);
    httpMock.verify();
  });
});
