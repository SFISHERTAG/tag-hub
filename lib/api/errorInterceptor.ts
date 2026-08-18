import "server-only";

/**
 * One shape for "this call failed" across every external/Firestore fetch, so
 * a revoked token or a timeout renders as a visible error instead of a
 * silent "$0 spend" or "no clients assigned" — a failure and an empty result
 * are different states and the UI needs to tell them apart.
 */
export type ApiError = {
  message: string;
  /** Where this failed — function name plus the identifying argument, e.g. "getAdAccountCampaigns(act_123)". */
  context: string;
  /** Best-effort HTTP status, when the underlying error carries one. */
  status?: number;
};

export type ApiResult<T> = { data: T; error: null } | { data: null; error: ApiError };

export function ok<T>(data: T): ApiResult<T> {
  return { data, error: null };
}

function statusOf(cause: unknown): number | undefined {
  if (typeof cause !== "object" || cause === null) return undefined;
  const status = (cause as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

export function fail<T>(context: string, cause: unknown): ApiResult<T> {
  const message = cause instanceof Error ? cause.message : String(cause);
  console.error(`[${context}]`, cause);
  return { data: null, error: { message, context, status: statusOf(cause) } };
}

/**
 * Runs `fn`, converting a thrown error into `{ data: null, error }` instead
 * of letting each call site decide (usually wrongly, to `[]`/`null`) what a
 * failure should look like. A genuine empty result — zero campaigns, no
 * clients assigned — is still `{ data: [], error: null }`; only a thrown
 * error becomes `error !== null`.
 */
export async function withErrorHandling<T>(context: string, fn: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    return ok(await fn());
  } catch (cause) {
    return fail<T>(context, cause);
  }
}
