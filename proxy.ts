import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth gate.
 *
 * In Next 16 `middleware` was renamed to `proxy`, and the exported function
 * must be named `proxy` — see docs/01-app/02-guides/upgrading/version-16.md.
 *
 * This only checks whether a session cookie is present, so an unauthenticated
 * visitor is redirected without rendering anything. It deliberately does not
 * verify the cookie: that happens in `lib/auth/session.ts`, close to the data,
 * where a forged cookie would otherwise do damage. A cookie proves nothing —
 * it only earns the right to be checked properly.
 */

const SESSION_COOKIE = "hub_session";

/** Paths reachable without a session. */
const PUBLIC_PREFIXES = [
  "/signin",
  "/api/auth", // establishing or clearing a session
  "/api/oauth", // GHL install callback — GHL carries no Hub session
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const signin = new URL("/signin", request.nextUrl.origin);
  // Preserve where they were headed so sign-in can return them there.
  if (pathname !== "/") signin.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(signin);
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
