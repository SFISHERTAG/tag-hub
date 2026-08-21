import { NextResponse, type NextRequest } from "next/server";
import { createGroup } from "@/lib/auth/groups";
import { isRole, ROLES } from "@/lib/auth/roles";
import { badRequest, handle, readJson, requiredString, requireApiRole } from "../../_lib/http";
import { readLocations, withLocationValidation } from "../_locations";

export const dynamic = "force-dynamic";

const CONTEXT = "POST /api/admin/users/groups";

/**
 * POST /api/admin/users/groups
 * Body: { name: string, role: Role, locations?: string[], locationsRaw?: string }
 * 201:  { group: Group }
 *
 * Admin only. `createGroup` validates every location id and throws
 * InvalidLocationError, which surfaces as a 400 through HttpError below.
 */
export async function POST(request: NextRequest) {
  return handle(CONTEXT, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], CONTEXT);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    const name = requiredString(body, "name");
    const role = body.role;
    if (!isRole(role)) throw badRequest("Invalid role.");

    const locations = readLocations(body);
    const group = await withLocationValidation(() => createGroup(name, role, locations));
    return NextResponse.json({ group }, { status: 201 });
  });
}
