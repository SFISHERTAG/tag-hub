import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { apiError, rejectCrossSite } from "@/lib/auth/session-cookie";
import { buildSessionPayload } from "@/lib/auth/session-payload";
import {
  getImpersonation,
  resolveSession,
  ROLE_COOKIE,
  IMPERSONATION_COOKIE,
} from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/admin";
import { isRole } from "@/lib/auth/roles";
import { closeImpersonationEntry } from "@/lib/audit/store";

export const dynamic = "force-dynamic";

/**
 * Switches the active hat. HTTP replacement for the `switchRole` server action
 * in app/role-switcher-actions.ts.
 *
 * Deliberately NOT under /api/auth. proxy.ts:19-23 exempts that whole prefix
 * from the optimistic cookie gate, and
 * web/src/app/core/interceptors/auth.interceptor.ts skips its 401 refresh for
 * any URL containing /api/auth/ — so a hat switch on an expired cookie would
 * hard-fail with no refresh attempt, which CLAUDE.md's interceptor contract
 * says should not happen.
 *
 * Returns the whole re-derived session, because a hat change is not a change to
 * one field. `locations` is derived from the new role, and for tag_exec,
 * tag_csd and admin that means an awaited listAllLocationIds(). The client
 * replaces its session wholesale from this response.
 */
const CONTEXT = "POST /api/session/role";

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSite(request, CONTEXT);
  if (crossSite) return crossSite;

  const gate = await requireApiSession(CONTEXT);
  if (!gate.ok) return gate.response;

  let requested: unknown;
  try {
    const body: unknown = await request.json();
    requested = typeof body === "object" && body !== null ? (body as { role?: unknown }).role : undefined;
  } catch {
    return apiError("Malformed request.", CONTEXT, 400);
  }

  if (!isRole(requested)) return apiError("Unknown role.", CONTEXT, 400);

  // Server-side authorization, not a UI convenience. This is a callable
  // endpoint; the hat switcher only rendering available roles is presentation.
  if (!gate.session.availableRoles.includes(requested)) {
    return apiError("You do not have access to that role.", CONTEXT, 403);
  }

  // Close any open impersonation BEFORE switching.
  //
  // Both lib/auth/session.ts and lib/auth/api-session.ts gate the impersonation
  // grant on currentRole === tag_csm. Switching to any other hat therefore
  // leaves a live cookie and a visible banner attached to a grant that no
  // longer works, and the audit entry never closes — so the record says that
  // access is still open. The old server action did not handle this at all.
  const impersonation = await getImpersonation();
  if (impersonation) {
    await closeImpersonationEntry(
      impersonation.locationId,
      impersonation.auditEntryId,
      gate.session.uid,
    );
  }

  // Resolve the session AS THE NEW HAT, rather than patching the one we hold.
  // `locations` is derived from the role's own grant, so carrying the previous
  // hat's list across would report tenant access the new hat does not have —
  // switching down from tag_exec would keep every location. resolveSession
  // re-derives it from the grants and re-validates the role, so this cannot
  // widen anything.
  const cookieValue = request.cookies.get(SESSION_COOKIE)?.value;
  if (!cookieValue) return apiError("Not signed in", CONTEXT, 401);

  const switched = await resolveSession(cookieValue, requested);
  if (!switched) return apiError("Not signed in", CONTEXT, 401);

  // impersonation is null: either there was none, or it was just closed above.
  const payload = buildSessionPayload(switched, null);

  const response = NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });

  response.cookies.set(ROLE_COOKIE, requested, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  if (impersonation) {
    response.cookies.set(IMPERSONATION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}
