/**
 * Port of lib/api/errorInterceptor.ts's ApiError/ApiResult — same shape on
 * both sides of the network boundary, so a failure is never silently
 * flattened into an empty value at either layer.
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

export function fail<T>(context: string, message: string, status?: number): ApiResult<T> {
  return { data: null, error: { message, context, status } };
}
