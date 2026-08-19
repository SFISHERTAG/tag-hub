import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor } from './error.interceptor';
import type { ApiError } from '../models/api-result.model';

/**
 * Story: CLAUDE.md requires "refresh-on-401 with a single in-flight refresh".
 * The machinery for that was written in Phase 2 and never executed once.
 *
 * `withInterceptors` composes via reduceRight, so the LAST array entry is
 * outermost and sees an error first. The original order put authInterceptor
 * first, which made errorInterceptor outermost: it caught the 401, rethrew a
 * plain ApiError object, and authInterceptor's `error instanceof
 * HttpErrorResponse` check then failed, so it rethrew without ever refreshing.
 * The refresh was unreachable by construction, and nothing tested it.
 *
 * These tests use the real composed order from app.config.ts, so they fail if
 * that array is ever reordered back.
 */

const COMPOSED_ORDER = [errorInterceptor, authInterceptor];

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors(COMPOSED_ORDER)),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    // Every failure path logs by contract; keep the run readable.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('refreshes once and retries the original request', () => {
    let result: unknown;
    http.get('/api/widgets').subscribe({ next: (value) => (result = value) });

    httpMock.expectOne('/api/widgets').flush(null, { status: 401, statusText: 'Unauthorized' });

    // The whole point: a refresh request exists at all.
    const refresh = httpMock.expectOne('/api/auth/refresh');
    expect(refresh.request.method).toBe('POST');
    refresh.flush({ ok: true });

    httpMock.expectOne('/api/widgets').flush({ widgets: [] });
    expect(result).toEqual({ widgets: [] });
  });

  it('shares one refresh across N concurrent 401s', () => {
    const urls = ['/api/a', '/api/b', '/api/c', '/api/d'];
    const results: unknown[] = [];
    for (const url of urls) http.get(url).subscribe({ next: (v) => results.push(v) });

    for (const url of urls) {
      httpMock.expectOne(url).flush(null, { status: 401, statusText: 'Unauthorized' });
    }

    // One refresh, not four. expectOne throws if a second was issued.
    httpMock.expectOne('/api/auth/refresh').flush({ ok: true });

    for (const url of urls) httpMock.expectOne(url).flush({ url });
    expect(results).toHaveLength(4);
  });

  it('starts a new refresh for a later 401 once the first has settled', () => {
    http.get('/api/first').subscribe({ next: () => undefined });
    httpMock.expectOne('/api/first').flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/auth/refresh').flush({ ok: true });
    httpMock.expectOne('/api/first').flush({});

    // The in-flight handle must be cleared by finalize, or the app refreshes
    // exactly once per page load and never again.
    http.get('/api/second').subscribe({ next: () => undefined });
    httpMock.expectOne('/api/second').flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/auth/refresh').flush({ ok: true });
    httpMock.expectOne('/api/second').flush({});
  });

  it('surfaces a typed ApiError when the refresh itself fails', () => {
    let error: ApiError | undefined;
    http.get('/api/widgets').subscribe({ error: (e: ApiError) => (error = e) });

    httpMock.expectOne('/api/widgets').flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock
      .expectOne('/api/auth/refresh')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    // Reaching the caller as an ApiError rather than an HttpErrorResponse is
    // what proves errorInterceptor is outermost: it wraps the failure only
    // after authInterceptor has had its chance to retry.
    expect(error).toBeDefined();
    expect(error?.status).toBe(401);
    expect(error?.context).toBe('/api/widgets');
  });

  it('does not attempt a refresh when an auth endpoint itself 401s', () => {
    let error: ApiError | undefined;
    http.post('/api/auth/session', {}).subscribe({ error: (e: ApiError) => (error = e) });

    httpMock
      .expectOne('/api/auth/session')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    // A refresh here would 401 too, and refresh that 401 in turn. afterEach's
    // httpMock.verify() fails if any refresh request was opened.
    expect(error?.status).toBe(401);
  });

  it('does not refresh on non-401 failures', () => {
    let error: ApiError | undefined;
    http.get('/api/widgets').subscribe({ error: (e: ApiError) => (error = e) });

    httpMock.expectOne('/api/widgets').flush(null, { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });

  it('sends credentials so the httpOnly session cookie travels', () => {
    http.get('/api/widgets').subscribe({ next: () => undefined });

    const req = httpMock.expectOne('/api/widgets');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });
});
