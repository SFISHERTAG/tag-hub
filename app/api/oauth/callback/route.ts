import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/ghl/oauth";
import { saveAgencyToken, saveLocationToken } from "@/lib/ghl/store";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "ghl_oauth_state";

function statesMatch(a: string | undefined, b: string | null): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // Length must match before timingSafeEqual, which throws on mismatched sizes.
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const error = params.get("error");
  if (error) {
    return NextResponse.json(
      { error, description: params.get("error_description") },
      { status: 400 },
    );
  }

  const code = params.get("code");
  if (!code) {
    return NextResponse.json(
      { error: "No authorization code in callback." },
      { status: 400 },
    );
  }

  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  if (!statesMatch(expected, params.get("state"))) {
    return NextResponse.json(
      { error: "State mismatch — restart the install at /api/oauth/install." },
      { status: 400 },
    );
  }
  jar.delete(STATE_COOKIE);

  let token;
  try {
    token = await exchangeCode(code);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  const now = Date.now();
  const expiresAt = now + token.expires_in * 1000;

  try {
    if (token.userType === "Company" && token.companyId) {
      // Agency install — this one token reaches every sub-account by minting
      // short-lived location tokens on demand.
      await saveAgencyToken({
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        companyId: token.companyId,
        expiresAt,
        updatedAt: now,
      });

      return NextResponse.redirect(
        new URL("/?installed=agency", request.nextUrl.origin),
      );
    }

    if (token.locationId) {
      // Direct install onto a single sub-account. Useful for testing one client
      // before rolling out agency-wide.
      await saveLocationToken(token.locationId, {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt,
        source: "direct-install",
        updatedAt: now,
      });

      return NextResponse.redirect(
        new URL(
          `/?installed=location&locationId=${token.locationId}`,
          request.nextUrl.origin,
        ),
      );
    }

    return NextResponse.json(
      {
        error:
          "Install returned neither a company nor a location id, so there is " +
          "nothing to scope requests to.",
        userType: token.userType,
      },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Token exchange succeeded but saving to Firestore failed. Run " +
          "`gcloud auth application-default login` for local development.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
