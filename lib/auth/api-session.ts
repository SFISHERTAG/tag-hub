import "server-only";
import { NextResponse } from "next/server";
import { getSession, getImpersonation, type Session } from "./session";
import { ROLES } from "./roles";
import type { ApiError } from "../api/errorInterceptor";

/**
 * Session and tenant checks for route handlers.
 *
 * `requireSession()` / `requireLocationAccess()` in session.ts answer an
 * unauthenticated caller with `redirect("/signin")`, which is right for a page
 * and wrong for an API: an XHR asking for JSON gets a 307 and then an HTML
 * sign-in document, so the client sees a successful navigation rather than a
 * failure it can act on. Nothing in this repo returned 401 before this file,
 * which is also why the Angular authInterceptor's refresh-on-401 had nothing to
 * fire on.
 *
 * The response body is an `ApiError` verbatim — the same type the backend uses
 * for every other failure and the same one the Angular errorInterceptor reads
 * `message` off. One shape across the network boundary, no translation layer.
 *
 * Usage in a route handler:
 *
 *   const gate = await requireApiSession("GET /api/dashboard/widgets");
 *   if (!gate.ok) return gate.response;
 *   // gate.session is a verified Session from here on
 *
 * The discriminated union is deliberate: there is no way to reach `gate.session`
 * without having handled the failure branch first.
 */

export type ApiSessionResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse<ApiError> };

function errorResponse(message: string, context: string, status: number): NextResponse<ApiError> {
  const body: ApiError = { message, context, status };
  // Logged for the same reason the error interceptor logs: a 401/403 that only
  // ever appears in a browser devtools panel is a failure nobody on the team
  // finds out about.
  console.error(`[${context}]`, `${status} ${message}`);
  return NextResponse.json(body, { status });
}

/**
 * Verified session, or a 401 JSON response. `context` identifies the caller in
 * logs and in the error body, e.g. "GET /api/dashboard/widgets".
 */
export async function requireApiSession(context: string): Promise<ApiSessionResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, response: errorResponse("Not signed in", context, 401) };
  }
  return { ok: true, session };
}

/**
 * Verified session that also has access to `locationId`, or a 401/403 JSON
 * response.
 *
 * Mirrors requireLocationAccess()'s rules exactly, including the impersonation
 * path: a CSM's static claim does not list their whole book, so entering a
 * client tenant is what grants access — scoped to that one location, for that
 * one actor, for as long as the impersonation cookie lives. Any divergence
 * between this and requireLocationAccess() is a tenant-isolation bug, so the
 * two must be changed together.
 */
export async function requireApiLocationAccess(
  locationId: string,
  context: string,
): Promise<ApiSessionResult> {
  const gate = await requireApiSession(context);
  if (!gate.ok) return gate;

  const { session } = gate;

  if (
    session.currentRole === ROLES.TAG_EXEC ||
    session.currentRole === ROLES.TAG_CSD ||
    session.currentRole === ROLES.ADMIN
  ) {
    return gate;
  }

  if (session.locations.includes(locationId)) return gate;

  if (session.currentRole === ROLES.TAG_CSM) {
    const impersonation = await getImpersonation();
    if (
      impersonation &&
      impersonation.locationId === locationId &&
      impersonation.actorId === session.uid
    ) {
      return gate;
    }
  }

  // The message deliberately does not enumerate the caller's permitted
  // locations the way requireLocationAccess()'s thrown Error does. That text
  // reaches a server log; this one reaches a browser, and telling a caller
  // which other tenants exist is not something a 403 should do.
  return {
    ok: false,
    response: errorResponse(`No access to location ${locationId}`, context, 403),
  };
}
