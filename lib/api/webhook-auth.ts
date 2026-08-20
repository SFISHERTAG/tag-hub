import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession, isInternalRole } from "@/lib/auth/session";

/**
 * Authentication for the onboarding trigger routes.
 *
 * These endpoints have two legitimate callers with nothing in common: TAG
 * staff clicking a button in the admin UI, and a machine (a GHL webhook, a
 * scripted backfill) with no session at all. Before this existed they had a
 * third: anyone. Both accepted an anonymous POST carrying a real client's
 * locationId and started that client's provisioning pipeline against
 * whatever data the body contained.
 *
 * So there are exactly two ways in — a signed-in TAG staff session, or the
 * phase's shared secret as a bearer token — and no third.
 *
 * Unlike the warn-only check on the Cloud Functions side, this rejects. An
 * unconfigured secret with no session is a 500 rather than a pass: failing
 * open on a half-finished deploy is the failure mode being closed here.
 */

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function authorizeOnboardingTrigger(
  source: string,
  request: NextRequest,
  secretEnvVar: string,
): Promise<NextResponse | null> {
  const session = await getSession();
  if (session && isInternalRole(session.currentRole)) return null;

  const authHeader = request.headers.get("authorization");
  const match = authHeader ? /^Bearer\s+(.+)$/i.exec(authHeader) : null;
  const expected = process.env[secretEnvVar]?.trim();

  if (!expected) {
    console.error(
      `[${source}] ${secretEnvVar} is not configured and the caller has no staff session — ` +
        "refusing rather than accepting the request unverified.",
    );
    return NextResponse.json({ error: "Endpoint authentication is not configured." }, { status: 500 });
  }

  if (!match || !tokensMatch(match[1].trim(), expected)) {
    console.warn(`[${source}] Rejected a call with no staff session and a missing or invalid bearer token.`);
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}
