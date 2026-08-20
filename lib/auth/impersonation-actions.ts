"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  requireSession,
  getImpersonation,
  isInternalRole,
  ForbiddenError,
  IMPERSONATION_COOKIE,
} from "./session";
import { isValidLocationId } from "../ghl/tenants";
import { createImpersonationEntry, closeImpersonationEntry } from "../audit/store";

/**
 * Story 3.3 — enter a client tenant.
 *
 * Only `tag_csm` needs this: other roles that can already reach a location
 * (tag_exec, tag_csd, admin) do so through their static/dynamic grant, not
 * impersonation. The audit event is written before the cookie so a crash
 * between the two never grants access without a trail.
 */
export async function enterImpersonation(locationId: string): Promise<void> {
  const session = await requireSession();

  // Entering a tenant is what grants a CSM access to it, so this action is
  // the gate on `requireLocationAccess`, not a caller of it — which is
  // exactly why it needs its own role check. Without one, any signed-in
  // user (a client_closer included) could enter any tenant, and the audit
  // entry it writes would be read by the 30-day escalation rule as a
  // genuine CSM check-in, masking a neglected client.
  if (!isInternalRole(session.currentRole)) {
    throw new ForbiddenError("Only TAG staff can enter a client account.");
  }
  if (!isValidLocationId(locationId)) throw new Error("Unknown location.");

  const auditEntryId = await createImpersonationEntry(locationId, session.uid, session.currentRole);

  const jar = await cookies();
  jar.set(
    IMPERSONATION_COOKIE,
    JSON.stringify({ locationId, auditEntryId, actorId: session.uid }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    },
  );

  redirect(`/l/${locationId}/pipeline?impersonate=true`);
}

/**
 * Story 3.3/3.4 exit — clears the flag and updates the same audit entry
 * `enterImpersonation` created with an exit time (Story 3.5 AC3).
 */
export async function exitImpersonation(): Promise<void> {
  // Exit closes an audit entry, so it authenticates too — and it only
  // closes an entry the caller themselves opened. An unauthenticated call
  // could otherwise write an exit time onto someone else's open session.
  const session = await requireSession();
  const impersonation = await getImpersonation();

  if (impersonation && impersonation.actorId === session.uid) {
    await closeImpersonationEntry(impersonation.locationId, impersonation.auditEntryId);
  }

  const jar = await cookies();
  jar.delete(IMPERSONATION_COOKIE);

  redirect("/portfolio");
}
