import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { APP_CONFIG } from '../config/app-config';
import { errorInterceptor } from '../interceptors/error.interceptor';
import type { ApiResult } from '../models/api-result.model';

/**
 * Story: CLAUDE.md's error rule is that a failure must never be silently
 * flattened into an empty value — the audit's case was a revoked token
 * rendering as "$0 spend" rather than as an error. An Observable that errors
 * invites exactly that flattening at the call site, so this service moves the
 * failure into the returned value where a caller has to acknowledge it.
 *
 * The distinction these tests exist to protect: `{ data: [], error: null }` is
 * a real empty result, `{ data: null, error }` is a failure, and the two must
 * never be confused.
 */

function configure(apiBaseUrl = '') {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])),
      provideHttpClientTesting(),
      { provide: APP_CONFIG, useValue: { production: false, apiBaseUrl } },
    ],
  });
  return {
    api: TestBed.inject(ApiService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('ApiService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wraps a successful response as ok', () => {
    const { api, httpMock } = configure();
    let result: ApiResult<{ id: string }> | undefined;

    api.get<{ id: string }>('/api/thing').subscribe((r) => (result = r));
    httpMock.expectOne('/api/thing').flush({ id: 'a' });

    expect(result).toEqual({ data: { id: 'a' }, error: null });
    httpMock.verify();
  });

  it('does not confuse an empty array with a failure', () => {
    const { api, httpMock } = configure();
    let result: ApiResult<string[]> | undefined;

    api.get<string[]>('/api/things').subscribe((r) => (result = r));
    httpMock.expectOne('/api/things').flush([]);

    // The whole reason this contract exists.
    expect(result?.data).toEqual([]);
    expect(result?.error).toBeNull();
    httpMock.verify();
  });

  it('returns a failure as a value rather than erroring the stream', () => {
    const { api, httpMock } = configure();
    let result: ApiResult<unknown> | undefined;
    let errored = false;

    api.get('/api/thing').subscribe({
      next: (r) => (result = r),
      error: () => (errored = true),
    });
    httpMock.expectOne('/api/thing').flush(null, { status: 500, statusText: 'Server Error' });

    expect(errored).toBe(false);
    expect(result?.data).toBeNull();
    expect(result?.error?.status).toBe(500);
    httpMock.verify();
  });

  it('carries the server message through on a typed error body', () => {
    const { api, httpMock } = configure();
    let result: ApiResult<unknown> | undefined;

    api.get('/api/thing').subscribe((r) => (result = r));
    httpMock.expectOne('/api/thing').flush(
      // Shape produced by lib/auth/api-session.ts.
      { message: 'No access to location loc9', context: 'GET /api/thing', status: 403 },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(result?.error?.message).toBe('No access to location loc9');
    httpMock.verify();
  });

  it('completes after a failure so a caller is not left waiting', () => {
    const { api, httpMock } = configure();
    let completed = false;

    api.get('/api/thing').subscribe({ complete: () => (completed = true) });
    httpMock.expectOne('/api/thing').flush(null, { status: 500, statusText: 'Server Error' });

    expect(completed).toBe(true);
    httpMock.verify();
  });

  it('serialises query params', () => {
    const { api, httpMock } = configure();

    api.get('/api/things', { stage: 'ascension', limit: 10, open: true }).subscribe();
    const req = httpMock.expectOne((r) => r.url === '/api/things');

    expect(req.request.params.get('stage')).toBe('ascension');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('open')).toBe('true');
    req.flush({});
    httpMock.verify();
  });

  it('prefixes paths with apiBaseUrl when one is configured', () => {
    const { api, httpMock } = configure('/backend');

    api.get('/api/thing').subscribe();
    httpMock.expectOne('/backend/api/thing').flush({});
    httpMock.verify();
  });

  it.each([
    ['post', 'POST'],
    ['put', 'PUT'],
    ['patch', 'PATCH'],
  ])('sends a body on %s', (method, verb) => {
    const { api, httpMock } = configure();
    const body = { name: 'x' };

    (api[method as 'post' | 'put' | 'patch'])('/api/thing', body).subscribe();
    const req = httpMock.expectOne('/api/thing');

    expect(req.request.method).toBe(verb);
    expect(req.request.body).toEqual(body);
    req.flush({});
    httpMock.verify();
  });

  it('sends delete without a body', () => {
    const { api, httpMock } = configure();

    api.delete('/api/thing').subscribe();
    const req = httpMock.expectOne('/api/thing');

    expect(req.request.method).toBe('DELETE');
    req.flush({});
    httpMock.verify();
  });
});
