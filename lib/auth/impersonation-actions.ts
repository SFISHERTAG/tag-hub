"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession, getImpersonation, IMPERSONATION_COOKIE } from "./session";
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
  const impersonation = await getImpersonation();

  if (impersonation) {
    await closeImpersonationEntry(impersonation.locationId, impersonation.auditEntryId);
  }

  const jar = await cookies();
  jar.delete(IMPERSONATION_COOKIE);

  redirect("/portfolio");
}
