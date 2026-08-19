"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession, ROLE_COOKIE } from "@/lib/auth/session";
import { isRole } from "@/lib/auth/roles";

/**
 * Switches the current view to one of the user's granted roles.
 *
 * The permission check happens here rather than in the component: a server
 * action is a callable endpoint, so the UI only offering roles the user
 * actually holds is presentation, not enforcement. A role not in
 * `availableRoles` (the user's granted roles) is refused outright — there is
 * no separate "hat" permission layered on top of role grants.
 */
export async function wearHat(
  hat: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  if (!isRole(hat)) return { ok: false, error: "Unknown view." };
  if (!session.availableRoles.includes(hat)) {
    return { ok: false, error: "Your role cannot use that view." };
  }

  const jar = await cookies();
  jar.set(ROLE_COOKIE, hat, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
