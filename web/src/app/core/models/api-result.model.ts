/**
 * The TYPES here mirror lib/api/errorInterceptor.ts, so a failure crosses the
 * network boundary without being reshaped and is never silently flattened into
 * an empty value at either layer.
 *
 * The constructors deliberately do NOT mirror. The server's `fail(context,
 * cause)` wraps a thrown exception: it derives a status from the cause and logs
 * it. There is nothing to wrap on this side, because errorInterceptor has
 * already converted an HttpErrorResponse into an ApiError before any caller
 * sees it. An earlier version of this file claimed the two were "the same shape
 * on both sides", which was true of the types and false of the functions, and
 * nobody noticed because the client-side `fail` had no callers at all.
 */
export interface ApiError {
  message: string;
  /** Where this failed — e.g. the request URL or a service method name. */
  context: string;
  status?: number;
}

export type ApiResult<T> = { data: T; error: null } | { data: null; error: ApiError };

export function ok<T>(data: T): ApiResult<T> {
  return { data, error: null };
}
