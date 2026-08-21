import type { ApiError } from '../../../core/models/api-result.model';

/**
 * Turns a typed ApiError into the notice a GHL screen shows.
 *
 * The legacy pages branched on the exception class — GhlConfigError rendered
 * "Setup needed", LocationNotAuthorizedError rendered "Location not reachable",
 * anything else rendered the raw message. Those distinctions survive across the
 * network as a `code` field on the error body, but the shared
 * core/interceptors/error.interceptor.ts keeps only `message`, `context` and
 * `status` (its ApiError type is the contract, and it is not this feature's
 * file to widen). So this classifies on status, which preserves every
 * distinction the screens actually act on except one: 503 covers both
 * "never installed the app" and "token no longer reaches this location", and
 * they share a notice here. The server's own sentence is shown underneath and
 * says which it is.
 *
 * `retryable` is the load-bearing output. A 503 is a job for a human with
 * admin access, and a "Try again" button that cannot help is worse than no
 * button — it converts a clear instruction into a loop.
 */
export type GhlFailureKind = 'setup' | 'access' | 'missing' | 'upstream' | 'unknown';

export interface GhlFailure {
  readonly kind: GhlFailureKind;
  /** The headline. Says what happened in the reader's terms. */
  readonly title: string;
  /** The server's own sentence. Always shown: it is the actionable half. */
  readonly detail: string;
  readonly retryable: boolean;
}

export function classifyGhlError(error: ApiError): GhlFailure {
  const detail = error.message;

  switch (error.status) {
    case 401:
      return {
        kind: 'access',
        title: 'Your session has expired',
        detail,
        // authInterceptor already tried a refresh. A second attempt from here
        // repeats a call that has been answered.
        retryable: false,
      };
    case 403:
      return { kind: 'access', title: 'No access to this client', detail, retryable: false };
    case 404:
      return { kind: 'missing', title: 'Not found', detail, retryable: false };
    case 503:
      return {
        kind: 'setup',
        title: 'This client is not connected to GoHighLevel',
        detail,
        retryable: false,
      };
    case 502:
      return {
        kind: 'upstream',
        title: 'GoHighLevel rejected the request',
        detail,
        retryable: true,
      };
    default:
      return { kind: 'unknown', title: 'That did not load', detail, retryable: true };
  }
}
