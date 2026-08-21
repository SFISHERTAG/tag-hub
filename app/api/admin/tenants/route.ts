import { NextResponse } from "next/server";
import { getTenant, listAllLocationIds } from "@/lib/ghl/tenants";
import { ROLES } from "@/lib/auth/roles";
import { handle, requireApiRole } from "../_lib/http";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/admin/tenants";

/**
 * GET /api/admin/tenants
 * 200: { tenants: Tenant[] }
 *
 * Admin only. Every known location with its entitlements and Meta ids.
 */
export async function GET() {
  return handle(CONTEXT, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], CONTEXT);
    if (!gate.ok) return gate.response;

    const locationIds = await listAllLocationIds();
    const tenants = await Promise.all(locationIds.map((id) => getTenant(id)));

    return NextResponse.json({ tenants });
  });
}
