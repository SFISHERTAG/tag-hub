import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { apiError, rejectCrossSite } from "@/lib/auth/session-cookie";
import { buildSessionPayload } from "@/lib/auth/session-payload";
import { IMPERSONATION_COOKIE, type ImpersonationState } from "@/lib/auth/session";
import { ROLES } from "@/lib/auth/roles";
import { isValidLocationId } from "@/lib/ghl/tenants";
import { createImpersonationEntry } from "@/lib/audit/store";

export const dynamic = "force-dynamic";

/**
 * Story 3.3 — enter a client tenant. This replaced the `enterImpersonation`
 * Server Action, which redirected and so could not be called from an SPA. That
 * action was deleted 2026-08-23 (story 11.5) once it had no callers left; it
 * was the last `"use server"` file in the repo.
 *
 * Deliberately not under /api/auth: that prefix is exempt from proxy.ts's
 * optimistic cookie gate and from the Angular interceptor's 401 refresh, and
 * this is an authenticated mutation, not a session-establishing route.
 *
 * Only tag_csm needs this. Roles that can already reach a location (tag_exec,
 * tag_csd, admin) do so through their own grant, so granting them an
 * impersonation on top would only muddy the audit trail with entries that
 * explain nothing.
 *
 * Coverage is permitted: a CSM may enter a client outside their own book. That
 * matches the recorded three-tier model, where books roll up to a CS Director
 * with cross-visibility precisely so someone can cover. The gate is therefore
 * role plus tenant-registry membership, and the audit entry is what makes the
 * access accountable rather than the gate being narrow.
 */
const CONTEXT = "POST /api/impersonation/enter";

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSite(request, CONTEXT);
  if (crossSite) return crossSite;

  const gate = await requireApiSession(CONTEXT);
  if (!gate.ok) return gate.response;

  if (gate.session.currentRole !== ROLES.TAG_CSM) {
    return apiError("Only client services can enter a tenant.", CONTEXT, 403);
  }

  let locationId: unknown;
  try {
    const body: unknown = await request.json();
    locationId =
      typeof body === "object" && body !== null
        ? (body as { locationId?: unknown }).locationId
        : undefined;
  } catch {
    return apiError("Malformed request.", CONTEXT, 400);
  }

  if (typeof locationId !== "string" || !isValidLocationId(locationId)) {
    return apiError("Unknown location.", CONTEXT, 400);
  }

  // ORDER IS LOAD-BEARING. The audit document is created BEFORE the cookie is
  // set, for two reasons: the cookie carries the Firestore auto-id, which does
  // not exist until the document does; and a crash between the two must leave a
  // record with no access rather than access with no record. Reversing these is
  // the one change to this handler that would be invisible in testing and fatal
  // in an audit.
  const auditEntryId = await createImpersonationEntry(
    locationId,
    gate.session.uid,
    gate.session.currentRole,
  );

  const impersonation: ImpersonationState = {
    locationId,
    auditEntryId,
    actorId: gate.session.uid,
  };

  // The state is passed explicitly rather than re-read: getImpersonation() would
  // read the incoming jar and report the pre-request state, so this response
  // would tell the client no impersonation is active immediately after starting
  // one.
  const payload = buildSessionPayload(gate.session, impersonation);

  const response = NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(IMPERSONATION_COOKIE, JSON.stringify(impersonation), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return response;
}
