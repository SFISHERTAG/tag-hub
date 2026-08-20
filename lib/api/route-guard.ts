import "server-only";
import { NextResponse } from "next/server";
import { ForbiddenError, UnauthenticatedError } from "@/lib/auth/session";

/**
 * Turns an ownership failure into the HTTP status it actually is.
 *
 * Route handlers wrap their bodies in `try/catch` and log-and-500 whatever
 * comes out. That is right for a Postgres timeout and wrong for "this tenant
 * isn't yours" — a 403 rendered as a 500 tells the caller the server broke
 * and tells the operator nothing. Returns `null` for anything that is not an
 * access failure, so the caller's existing handling runs unchanged.
 */
export function toErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof UnauthenticatedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return null;
}
