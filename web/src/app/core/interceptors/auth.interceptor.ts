import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, throwError } from 'rxjs';

/**
 * Session cookie is httpOnly (set by /api/auth/session), so this interceptor
 * doesn't attach a bearer token itself — it ensures credentials are sent, and
 * on a 401 attempts exactly one shared refresh before retrying, so N
 * concurrent requests that all 401 at once trigger one refresh call, not N.
 */
let refreshInFlight: Observable<boolean> | null = null;

/**
 * POST, not GET, and not /api/auth/session — that route is POST-only (it mints
 * a cookie from an ID token) so the old GET here would have 405'd even once the
 * interceptor ordering let it run.
 */
const REFRESH_URL = '/api/auth/refresh';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const http = inject(HttpClient);
  const authedReq = req.withCredentials ? req : req.clone({ withCredentials: true });

  return next(authedReq).pipe(
    catchError((error: unknown) => {
      const isAuthEndpoint = authedReq.url.includes('/api/auth/');
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }

      if (!refreshInFlight) {
        // An object body, not null: HttpClient only sets Content-Type when it
        // can infer one, and the refresh endpoint rejects anything that is not
        // application/json as part of its cross-site check. A null body would
        // send no Content-Type and 415.
        refreshInFlight = http.post(REFRESH_URL, {}, { withCredentials: true }).pipe(
          map(() => true),
          catchError(() => of(false)),
          finalize(() => {
            refreshInFlight = null;
          }),
          shareReplay(1),
        );
      }

      return refreshInFlight.pipe(
        switchMap((refreshed) => (refreshed ? next(authedReq) : throwError(() => error))),
      );
    }),
  );
};
