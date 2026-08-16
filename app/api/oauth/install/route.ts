import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { installUrl, OAuthConfigError, SCOPES } from "@/lib/ghl/oauth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "ghl_oauth_state";

/**
 * Starts the install. Visit /api/oauth/install to begin.
 *
 * Optional `?scopes=a,b,c` narrows the request for diagnosis — see installUrl.
 * Example: /api/oauth/install?scopes=locations.readonly
 */
export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("scopes");
  const scopes = requested
    ? requested
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : SCOPES;

  let target: string;
  const state = randomBytes(16).toString("hex");

  try {
    target = installUrl(state, scopes);
  } catch (error) {
    if (error instanceof OAuthConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // ten minutes to complete the install
  });

  return NextResponse.redirect(target);
}
