import "server-only";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { fail, type ApiError } from "@/lib/api/errorInterceptor";
import { GhlError } from "@/lib/ghl/client";
import { GhlConfigError, LocationNotAuthorizedError } from "@/lib/ghl/tokens";
import { isValidLocationId } from "@/lib/ghl/tenants";

/**
 * The HTTP edge of lib/api/errorInterceptor.ts's contract, for the GHL
 * endpoints this story owns.
 *
 * `lib/api/route-guard.ts` is named in the story brief but does not exist on
 * this branch (checked at c5d1b75). Two sibling agents hit the same gap and
 * put byte-identical mirrors under the directories they own
 * (app/api/admin/_lib/http.ts, app/api/dashboard/_lib/http.ts). This file is
 * NOT a verbatim mirror of those, and the difference is deliberate: GHL fails
 * in ways the caller has to tell apart. "This tenant has never installed the
 * app" is a setup task for a human, "GHL returned a 500" is an outage to wait
 * out, and the legacy pipeline/today/contacts pages each rendered a different
 * notice for the two. That distinction cannot survive as a status code alone,
 * so the body carries a `code`.
 *
 * Whoever collapses the three into `lib/api/route-guard.ts`: the delta to
 * carry over is `code`, the GhlConfigError/LocationNotAuthorizedError/GhlError
 * arms of `classify`, and the fact that 502/503 pass their message through
 * while 500 does not (see `classify`).
 *
 * The body carries BOTH `message` and `error`, matching the sibling helpers:
 * the Angular errorInterceptor reads `message`, the app/api routes predating
 * the Angular cutover all emit `{ error }`, and emitting both means neither
 * reader has to change.
 */

export type GhlErrorCode =
  | "unauthenticated"
  | "bad_request"
  | "forbidden"
  | "not_found"
  | "ghl_not_configured"
  | "location_not_authorized"
  | "upstream_error"
  | "internal_error";

export type GhlApiError = ApiError & {
  code: GhlErrorCode;
  /** Same text as `message`. Present for the pre-Angular readers of `{ error }`. */
  error: string;
};

/** GHL ids are opaque alphanumerics, and every one of them is interpolated
 * into an upstream URL path. Same rule `isValidLocationId` applies to a
 * location id, applied to the rest for the same reason. */
const GHL_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function isSafeGhlId(value: string): boolean {
  return GHL_ID.test(value);
}

export { isValidLocationId };

/**
 * Thrown inside a `ghlJson` body when the thing being asked for does not
 * exist. A sentinel rather than an early return so the "fetch it, then decide"
 * flow stays inside one try block and the record is never fetched twice just
 * to answer 404 outside it.
 */
export class ResourceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceNotFoundError";
  }
}

/**
 * Builds the error body and logs the cause through the project's own
 * interceptor rather than a bare `console.error`, so a 502 from GHL lands in
 * the same log stream as every other failed external call.
 */
function loggedError(context: string, cause: unknown): ApiError {
  const outcome = fail<never>(context, cause);
  // `fail` only ever produces the error branch. The fallback is for the
  // compiler, which sees the ApiResult union rather than that guarantee.
  return (
    outcome.error ?? {
      message: cause instanceof Error ? cause.message : String(cause),
      context,
    }
  );
}

type Classification = {
  status: number;
  code: GhlErrorCode;
  /** Replaces the cause's own message in the response body. The original is still logged. */
  safeMessage?: string;
};

function isRedirect(cause: unknown): boolean {
  const digest = (cause as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

function classify(cause: unknown): Classification {
  // `requireLocationAccess` (lib/auth/session.ts), which lib/ghl/client.ts
  // calls on every request, answers an absent session with redirect("/signin").
  // Letting that through would hand an XHR a 307 and then an HTML sign-in
  // document, which reads as a successful navigation rather than a failure —
  // and the Angular authInterceptor's refresh-on-401 would never fire.
  if (isRedirect(cause)) {
    return { status: 401, code: "unauthenticated", safeMessage: "Not signed in." };
  }
  if (cause instanceof ResourceNotFoundError) {
    return { status: 404, code: "not_found" };
  }
  // Both of these name a setup task for a human and neither leaks
  // infrastructure, so their message is passed through: it is the whole
  // content of the "Setup needed" notice the legacy pages rendered.
  if (cause instanceof GhlConfigError) {
    return { status: 503, code: "ghl_not_configured" };
  }
  if (cause instanceof LocationNotAuthorizedError) {
    return { status: 503, code: "location_not_authorized" };
  }
  // GHL's own rejection, truncated to 500 chars by GhlError. The legacy pages
  // showed this verbatim because a tenant cannot act on "something went wrong".
  if (cause instanceof GhlError) {
    return { status: 502, code: "upstream_error" };
  }
  // lib/ghl/client.ts re-checks location access on every call, behind the
  // route's own gate. Reaching here means the two disagreed, which is a bug
  // worth logging loudly — but its message names the caller's other tenants,
  // so the browser gets a fixed string instead.
  if (cause instanceof Error && cause.message.startsWith("403 Forbidden")) {
    return { status: 403, code: "forbidden", safeMessage: "No access to this location." };
  }
  if (cause instanceof Error && cause.message.startsWith("Not signed in")) {
    return { status: 401, code: "unauthenticated", safeMessage: "Not signed in." };
  }
  if (cause instanceof Error && cause.message.startsWith("Not authorized")) {
    return { status: 403, code: "forbidden", safeMessage: "Not authorized." };
  }
  // Anything unrecognised is ours, not the caller's, and its message can name
  // Firestore, a project id, or a stack frame. It is logged, not returned.
  return { status: 500, code: "internal_error", safeMessage: "Something went wrong." };
}

function errorBody(
  context: string,
  message: string,
  status: number,
  code: GhlErrorCode,
): GhlApiError {
  return { message, error: message, context, status, code };
}

export function errorResponse(
  context: string,
  message: string,
  status: number,
  code: GhlErrorCode,
): NextResponse<GhlApiError> {
  console.error(`[${context}]`, `${status} ${message}`);
  return NextResponse.json(errorBody(context, message, status, code), {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function badRequest(context: string, message: string): NextResponse<GhlApiError> {
  return errorResponse(context, message, 400, "bad_request");
}

export function notFound(context: string, message: string): NextResponse<GhlApiError> {
  return errorResponse(context, message, 404, "not_found");
}

export function forbidden(context: string, message: string): NextResponse<GhlApiError> {
  return errorResponse(context, message, 403, "forbidden");
}

/**
 * Runs the handler body, returning its value as JSON or a classified error.
 *
 * `unstable_rethrow` runs after the redirect arm above has already claimed
 * NEXT_REDIRECT, so any other framework control-flow signal still reaches Next
 * instead of being flattened into a 500.
 */
export async function ghlJson<T>(context: string, fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    // NEXT_REDIRECT is claimed by `classify` and answered as a 401. Every
    // other framework control-flow signal has to reach Next rather than be
    // flattened into a 500 response.
    if (!isRedirect(cause)) unstable_rethrow(cause);
    const { status, code, safeMessage } = classify(cause);
    const error = loggedError(context, cause);
    return NextResponse.json(errorBody(context, safeMessage ?? error.message, status, code), {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

/** Parses a JSON body, returning null rather than throwing on malformed input. */
export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Reads a bounded positive integer from a query string. Null means "reject this". */
export function readLimit(raw: string | null, fallback: number, max: number): number | null {
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > max) return null;
  return value;
}
