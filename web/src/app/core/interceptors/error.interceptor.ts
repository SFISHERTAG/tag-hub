import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import type { ApiError } from '../models/api-result.model';

/**
 * Client-side counterpart of lib/api/errorInterceptor.ts's contract: every
 * HttpClient call flows through here, every failure is logged (never a
 * silent catch-to-empty), and callers get a typed ApiError instead of a raw
 * HttpErrorResponse to pattern-match on ad hoc.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((cause: unknown) => {
      const status = cause instanceof HttpErrorResponse ? cause.status : undefined;
      const message =
        cause instanceof HttpErrorResponse
          ? (cause.error?.message ?? cause.message)
          : cause instanceof Error
            ? cause.message
            : String(cause);

      const apiError: ApiError = { message, context: req.urlWithParams, status };
      console.error(`[${apiError.context}]`, cause);

      return throwError(() => apiError);
    }),
  );
};
