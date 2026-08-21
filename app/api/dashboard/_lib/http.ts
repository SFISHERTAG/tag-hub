import "server-only";
import { NextResponse } from "next/server";
import { fail, type ApiError, type ApiResult } from "@/lib/api/errorInterceptor";
import { requireApiSession, type ApiSessionResult } from "@/lib/auth/api-session";
import { hasAnyRole, type Role } from "@/lib/auth/roles";

/**
 * The HTTP edge of lib/api/errorInterceptor.ts's contract, for the endpoints
 * this story owns (dashboard, clients).
 *
 * `lib/api/route-guard.ts` is named in the story brief but does not exist on
 * this branch (checked at c5d1b75). A sibling agent hit the same gap and put
 * the same mapping under the directory it owns (app/api/admin/_lib/http.ts).
 * This file is a verbatim mirror of that one — same exported names, same
 * status mapping, same response body — so the two collapse into a single
 * `lib/api/route-guard.ts` without either caller changing when one owner
 * exists for that path. Keep them byte-identical below this comment.
 *
 * The body carries BOTH `message` and `error`. The Angular errorInterceptor
 * reads `message`; the app/api routes predating the Angular cutover all emit
 * `{ error }`. Emitting both means neither reader has to change.
 */

/** A failure that already knows which status it deserves. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, message);
}

export function notFound(message: string): HttpError {
  return new HttpError(404, message);
}

export function forbidden(message: string): HttpError {
  return new HttpError(403, message);
}

/**
 * Maps a thrown error to a status.
 *
 * `requireRole` and `requireLocationAccess` in lib/auth/session.ts throw plain
 * Errors whose message is the only thing separating "not signed in" from "not
 * allowed". Those strings are matched here rather than the access rules being
 * re-derived, so this file stays a transport concern and lib/auth stays the
 * only place that decides who may do what.
 *
 * NEXT_REDIRECT is matched too: `requireSession()` / `requireLocationAccess()`
 * answer an absent session with `redirect("/signin")`, and lib/ functions that
 * call them internally (activateCampaign) can raise it from inside a route
 * handler. Without this it would surface as a 500 and the Angular
 * authInterceptor's refresh-on-401 would never fire.
 */
function statusFor(error: unknown): number {
  if (error instanceof HttpError) return error.status;
  if (error instanceof Error) {
    const digest = (error as Error & { digest?: unknown }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) return 401;
    if (error.message.startsWith("Not signed in")) return 401;
    if (error.message.startsWith("Not authorized")) return 403;
    if (error.message.startsWith("403 Forbidden")) return 403;
  }
  return 500;
}

/**
 * Turns a thrown error into a response. A 5xx deliberately does not echo the
 * underlying message — a Firestore, GHL or Meta failure string can name
 * internal infrastructure. 4xx messages are the caller's own fault and safe to
 * return.
 */
export function toErrorResponse(context: string, error: unknown): NextResponse {
  const status = statusFor(error);
  const result = fail(context, error);
  const message =
    status >= 500
      ? "Something went wrong handling this request."
      : (result.error?.message ?? "Request failed.");

  return NextResponse.json({ message, error: message, context }, { status });
}

/** Turns an ApiResult failure from lib/ into a 502 — the upstream source failed, not the caller. */
export function toUpstreamErrorResponse(error: ApiError): NextResponse {
  return NextResponse.json(
    {
      message: "Could not load this data from its source.",
      error: "Could not load this data from its source.",
      context: error.context,
    },
    { status: 502 },
  );
}

/** Carries an already-built response out of a nested helper. */
export class ResponseError extends Error {
  constructor(readonly response: NextResponse) {
    super("response");
    this.name = "ResponseError";
  }
}

/**
 * Unwraps an ApiResult or throws the HTTP response. Keeps every route's happy
 * path free of `if (result.error)` noise while making a failure impossible to
 * flatten into an empty list — the exact thing errorInterceptor.ts exists to
 * prevent, and the reason a widget can tell "no clients assigned" from "the
 * fetch failed".
 */
export function unwrap<T>(result: ApiResult<T>): T {
  if (result.error) throw new ResponseError(toUpstreamErrorResponse(result.error));
  return result.data;
}

/** One try/catch shape for every route in this story. */
export async function handle(
  context: string,
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ResponseError) return error.response;
    return toErrorResponse(context, error);
  }
}

/**
 * Verified session whose current hat is in `allowed`, or a 401/403 response.
 *
 * A route guard in the Angular app is cosmetic; this is the check that
 * decides. Roles are named through ROLES.* at the call sites, never as inline
 * strings, per the permission contract in CLAUDE.md.
 */
export async function requireApiRole(
  allowed: readonly Role[],
  context: string,
): Promise<ApiSessionResult> {
  const gate = await requireApiSession(context);
  if (!gate.ok) return gate;
  if (!hasAnyRole(gate.session.currentRole, allowed)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          message: "Your current role cannot perform this action.",
          error: "Your current role cannot perform this action.",
          context,
        },
        { status: 403 },
      ),
    };
  }
  return gate;
}

/* ── Typed body reading ──────────────────────────────────────────────────
 * `request.json()` is untyped. Reading fields through these keeps `any` out
 * of the routes and turns a malformed body into a 400 with a message naming
 * the field, rather than an unhandled TypeError three frames down in lib/.
 */

export type JsonBody = Record<string, unknown>;

export async function readJson(request: Request): Promise<JsonBody> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw badRequest("Body must be valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw badRequest("Body must be a JSON object.");
  }
  return parsed as JsonBody;
}

/** Required non-empty string, trimmed. */
export function requiredString(body: JsonBody, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw badRequest(`"${key}" is required.`);
  }
  return value.trim();
}

/** Optional string. Absent and null both become `fallback`; present-but-empty stays empty. */
export function optionalString(body: JsonBody, key: string, fallback = ""): string {
  const value = body[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") throw badRequest(`"${key}" must be a string.`);
  return value;
}

/** Optional string that keeps null distinct from absent — for nullable columns. */
export function nullableString(body: JsonBody, key: string): string | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw badRequest(`"${key}" must be a string.`);
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function requiredBoolean(body: JsonBody, key: string): boolean {
  const value = body[key];
  if (typeof value !== "boolean") throw badRequest(`"${key}" must be true or false.`);
  return value;
}

export function optionalStringArray(body: JsonBody, key: string): string[] | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw badRequest(`"${key}" must be an array of strings.`);
  }
  return value as string[];
}
