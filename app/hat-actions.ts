"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession, HAT_COOKIE } from "@/lib/auth/session";
import { canWear, isRole } from "@/lib/auth/roles";

/**
 * Switches the current view.
 *
 * The permission check happens here rather than in the component: a server
 * action is a callable endpoint, so the UI only offering permitted hats is
 * presentation, not enforcement.
 */
export async function wearHat(
  hat: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  if (!isRole(hat)) return { ok: false, error: "Unknown view." };
  if (!canWear(session.role, hat)) {
    return { ok: false, error: "Your role cannot use that view." };
  }

  const jar = await cookies();
  jar.set(HAT_COOKIE, hat, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
