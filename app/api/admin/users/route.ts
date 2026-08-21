import { NextResponse } from "next/server";
import { listGroups } from "@/lib/auth/groups";
import { listAllUsers } from "@/lib/auth/user-directory";
import { listCsmRecords } from "@/lib/dashboard/csm-directory";
import { ROLES } from "@/lib/auth/roles";
import { handle, requireApiRole } from "../_lib/http";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/admin/users";

/**
 * GET /api/admin/users
 *
 * Everything the admin Users screen renders, in one round trip: the Firebase
 * user directory, the groups that write their claims, and the CS reporting
 * lines keyed by email. Admin only — the same check the legacy page made, made
 * again here because an endpoint is directly callable and a route guard in the
 * Angular app decides nothing.
 */
export async function GET() {
  return handle(CONTEXT, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], CONTEXT);
    if (!gate.ok) return gate.response;

    const [groups, users, csmRecords] = await Promise.all([
      listGroups(),
      listAllUsers(),
      listCsmRecords(),
    ]);

    return NextResponse.json({ users, groups, csmRecords });
  });
}
