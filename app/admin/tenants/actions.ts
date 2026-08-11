"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { getTenant, saveTenant, isValidLocationId, type Service } from "@/lib/ghl/tenants";

export type TenantEdits = {
  services: Record<Service, boolean>;
  ownerModel: "client" | "tag";
  metaAdAccountId: string;
  metaBusinessId: string;
  metaPixelId: string;
};

/**
 * Writes tenant entitlements and Meta ids. The only path that calls
 * `saveTenant()` — Firestore has no other write route for this collection, so
 * this is the sole place a tenant document is created or changed.
 *
 * Meta ids are stored as `""` rather than omitted when cleared.
 * `firestore()` sets `ignoreUndefinedProperties: true`, which makes
 * `undefined` a no-op under `merge: true` — an admin clearing a field would
 * silently leave the old value in place instead of removing it.
 */
export async function saveTenantAction(
  locationId: string,
  edits: TenantEdits,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (session.role !== "tag_exec") {
    return { ok: false, error: "Only executives can manage tenants." };
  }
  // A server action is directly callable and doesn't have to go through the
  // page's own guard, so the id gets checked again here rather than trusted.
  if (!isValidLocationId(locationId)) {
    return { ok: false, error: "Invalid location id." };
  }

  try {
    const current = await getTenant(locationId);
    await saveTenant({
      ...current,
      services: edits.services,
      ownerModel: edits.ownerModel,
      metaAdAccountId: edits.metaAdAccountId.trim(),
      metaBusinessId: edits.metaBusinessId.trim(),
      metaPixelId: edits.metaPixelId.trim(),
    });
    revalidatePath("/admin/tenants");
    revalidatePath(`/admin/tenants/${locationId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
