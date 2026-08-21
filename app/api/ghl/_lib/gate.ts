import "server-only";
import type { NextResponse } from "next/server";
import { requireApiLocationAccess } from "@/lib/auth/api-session";
import { hasAnyRole } from "@/lib/auth/roles";
import { ROLES, type Role } from "@/lib/auth/role-labels";
import type { Session } from "@/lib/auth/session";
import type { ApiError } from "@/lib/api/errorInterceptor";
import { badRequest, forbidden, isSafeGhlId, isValidLocationId } from "./respond";

/**
 * The gate every endpoint in this folder passes through.
 *
 * A route guard in the Angular app is cosmetic. This is the check that
 * actually decides, and it decides from the session cookie, never from the
 * `locationId` the caller put in the URL — that id is only ever the *question*
 * ("may I see this tenant?"), never the answer.
 *
 * `requireApiLocationAccess` carries the rules (claim locations, the all-access
 * internal roles, and a CSM's active impersonation of exactly one tenant). This
 * adds the shape check the path params need before they are interpolated into
 * an upstream GHL URL.
 */

export type LocationGate =
  | { ok: true; session: Session; locationId: string }
  | { ok: false; response: NextResponse<ApiError> };

export async function gateLocation(
  locationId: string,
  context: string,
): Promise<LocationGate> {
  if (!isValidLocationId(locationId)) {
    return { ok: false, response: badRequest(context, "Malformed location id.") };
  }

  const gate = await requireApiLocationAccess(locationId, context);
  if (!gate.ok) return { ok: false, response: gate.response };

  return { ok: true, session: gate.session, locationId };
}

/**
 * Same gate, plus a second path id (contact, opportunity, appointment).
 * The id is validated for shape only — whether it belongs to this tenant is
 * decided by GHL, which is queried under a token minted for this location and
 * cannot reach another one.
 */
export async function gateLocationAndId(
  locationId: string,
  id: string,
  label: string,
  context: string,
): Promise<LocationGate> {
  // Access first, shape second. An anonymous caller gets 401 whatever they put
  // in the path — answering their malformed id with a 400 would tell them
  // their request reached the handler, which is one bit more than a stranger
  // needs to know.
  const gate = await gateLocation(locationId, context);
  if (!gate.ok) return gate;

  if (!isSafeGhlId(id)) {
    return { ok: false, response: badRequest(context, `Malformed ${label} id.`) };
  }
  return gate;
}

/**
 * Who may change the follow-up queue's aging-out threshold.
 *
 * Story 2.8 calls it sales-manager-configurable; inside a client tenant that
 * is the closing manager or the owner above them. Kept exactly as the legacy
 * action had it — widening a permission during a transport migration is not a
 * migration, so an internal role that wants this needs a deliberate decision,
 * not a side effect of this port.
 */
export const FOLLOW_UP_CONFIG_ROLES: readonly Role[] = [
  ROLES.CLIENT_MANAGER,
  ROLES.CLIENT_OWNER,
];

export function canConfigureFollowUp(session: Session): boolean {
  return hasAnyRole(session.currentRole, FOLLOW_UP_CONFIG_ROLES);
}

export function requireFollowUpConfigRole(
  session: Session,
  context: string,
): NextResponse<ApiError> | null {
  if (canConfigureFollowUp(session)) return null;
  return forbidden(context, "Only a closing manager or owner can change this.");
}
