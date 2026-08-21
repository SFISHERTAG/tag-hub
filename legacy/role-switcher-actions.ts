"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession, ROLE_COOKIE } from "@/lib/auth/session";
import { isRole } from "@/lib/auth/roles";

/**
 * Switches to a different role.
 *
 * The permission check happens here rather than in the component: a server
 * action is a callable endpoint, so the UI only offering available roles is
 * presentation, not enforcement.
 */
export async function switchRole(
  role: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  if (!isRole(role)) return { ok: false, error: "Unknown role." };
  if (!session.availableRoles.includes(role)) {
    return { ok: false, error: "You don't have access to that role." };
  }

  const jar = await cookies();
  jar.set(ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
