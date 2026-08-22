import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/ghl/oauth";
import {
  loadPrimaryCompanyId,
  saveAgencyToken,
  saveLocationToken,
} from "@/lib/ghl/store";

export const dynamic = "force-dynamic";

/**
 * A host-relative redirect.
 *
 * These handlers built an absolute URL from `request.nextUrl.origin`, which
 * inside Cloud Run is the container's own bind address rather than the address
 * the browser used, so a completed GHL install landed the installer on
 * https://0.0.0.0:8080/. A relative Location is resolved by the browser against
 * the request it already made and needs no host detection at all.
 *
 * 303 rather than the 307 NextResponse.redirect defaults to, so the browser
 * issues a plain GET for the destination.
 */
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

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
      // Agency install — this token reaches that company's sub-accounts by
      // minting short-lived location tokens on demand.
      //
      // Anyone can arrive here: the install link is not ours to gate, and a
      // client who runs their own agency may complete a company-level install
      // rather than picking a single location. That install is stored under
      // its own company and does not displace the primary, so it cannot take
      // the portfolio down with it. Flagging it in the redirect is what makes
      // it visible rather than merely harmless — an unexpected agency landing
      // here is worth someone looking at.
      const primaryBefore = await loadPrimaryCompanyId();

      await saveAgencyToken({
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        companyId: token.companyId,
        expiresAt,
        updatedAt: now,
      });

      const isPrimary = !primaryBefore || primaryBefore === token.companyId;
      return redirectTo(
        isPrimary
          ? "/?installed=agency"
          : `/?installed=agency-additional&companyId=${encodeURIComponent(token.companyId)}`,
      );
    }

    if (token.locationId) {
      // Direct install onto a single sub-account. This is the only path for a
      // client who stays inside their own agency, so it is a first-class case
      // rather than a testing convenience.
      await saveLocationToken(token.locationId, {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt,
        source: "direct-install",
        updatedAt: now,
      });

      return redirectTo(`/?installed=location&locationId=${token.locationId}`);
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
          "Token exchange succeeded but the credential was not stored, so " +
          "nothing was authorized. If this is local development, run " +
          "`gcloud auth application-default login`.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
