import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { apiError, rejectCrossSite } from "@/lib/auth/session-cookie";
import { buildSessionPayload } from "@/lib/auth/session-payload";
import { getImpersonation, IMPERSONATION_COOKIE } from "@/lib/auth/session";
import { closeImpersonationEntry } from "@/lib/audit/store";

export const dynamic = "force-dynamic";

/**
 * Story 3.4 exit. HTTP replacement for `exitImpersonation`.
 *
 * Authenticates first. The previous server action read the cookie and went
 * straight to Firestore, so the audit write was reachable without proving who
 * was asking — and every value it used came from an unsigned cookie.
 */
const CONTEXT = "POST /api/impersonation/exit";

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSite(request, CONTEXT);
  if (crossSite) return crossSite;

  const gate = await requireApiSession(CONTEXT);
  if (!gate.ok) return gate.response;

  const impersonation = await getImpersonation();

  if (impersonation) {
    // The cookie is unsigned, so actorId is a claim, not a fact.
    // closeImpersonationEntry verifies it against the stored document and
    // refuses a mismatch; checking it here as well means a caller presenting
    // someone else's cookie never reaches Firestore at all.
    if (impersonation.actorId !== gate.session.uid) {
      return apiError("That impersonation does not belong to this session.", CONTEXT, 403);
    }

    // ORDER IS LOAD-BEARING, mirroring enter: close the entry BEFORE clearing
    // the cookie, because the cookie holds the only copy of the correlation id.
    // Clear it first and the entry stays open forever, reading as access that
    // never ended.
    await closeImpersonationEntry(
      impersonation.locationId,
      impersonation.auditEntryId,
      gate.session.uid,
    );
  }

  // Explicitly null: the cookie is cleared on this response, so re-reading the
  // incoming jar would report the impersonation we just ended as still active.
  const payload = buildSessionPayload(gate.session, null);

  const response = NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(IMPERSONATION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
