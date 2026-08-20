import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { ok, type ApiError, type ApiResult } from '../models/api-result.model';

/**
 * The only class in the app that injects HttpClient.
 *
 * CLAUDE.md: "All HTTP goes through typed service layers. No raw HttpClient
 * calls in components." Feature services inject this, components inject those.
 *
 * Everything returns `ApiResult<T>` and nothing throws. That is the point: it is
 * the same contract lib/api/errorInterceptor.ts enforces on the server, where
 * the rule exists because a caught-and-flattened error renders as "$0 spend"
 * instead of "we could not load your spend". An Observable that errors invites
 * exactly that flattening at the call site (`catchError(() => of([]))`), so the
 * failure is moved into the value where a caller has to look at it.
 *
 * A genuine empty result is still `{ data: [], error: null }`. Only a real
 * failure has `error !== null`.
 *
 * Note the division of labour with the interceptors: errorInterceptor logs and
 * converts to a typed ApiError, authInterceptor may retry a 401 once. By the
 * time an error reaches here it is already an ApiError and already logged, so
 * this only has to place it in the result.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<ApiResult<T>> {
    return this.request(this.http.get<T>(this.url(path), { params: toParams(params) }), path);
  }

  post<T>(path: string, body?: unknown): Observable<ApiResult<T>> {
    return this.request(this.http.post<T>(this.url(path), body ?? null), path);
  }

  put<T>(path: string, body?: unknown): Observable<ApiResult<T>> {
    return this.request(this.http.put<T>(this.url(path), body ?? null), path);
  }

  patch<T>(path: string, body?: unknown): Observable<ApiResult<T>> {
    return this.request(this.http.patch<T>(this.url(path), body ?? null), path);
  }

  delete<T>(path: string): Observable<ApiResult<T>> {
    return this.request(this.http.delete<T>(this.url(path)), path);
  }

  private url(path: string): string {
    return `${this.config.apiBaseUrl}${path}`;
  }

  private request<T>(source: Observable<T>, path: string): Observable<ApiResult<T>> {
    return source.pipe(
      map((data) => ok(data)),
      catchError((cause: unknown) => of({ data: null, error: toApiError(cause, path) })),
    );
  }
}

function toParams(params?: Record<string, string | number | boolean>): HttpParams | undefined {
  if (!params) return undefined;
  let result = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    result = result.set(key, String(value));
  }
  return result;
}

/**
 * errorInterceptor has normally already produced an ApiError. The fallback
 * covers anything that bypassed it — a synchronous throw, or a test harness
 * configured without the interceptor chain — so a caller can rely on
 * `error.message` existing rather than reading "[object Object]".
 */
function toApiError(cause: unknown, context: string): ApiError {
  if (isApiError(cause)) return cause;
  return {
    message: cause instanceof Error ? cause.message : String(cause),
    context,
  };
}

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ApiError).message === 'string' &&
    typeof (value as ApiError).context === 'string'
  );
}
