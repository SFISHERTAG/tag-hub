import { NextResponse, type NextRequest } from "next/server";
import { deleteGroup, updateGroupRole } from "@/lib/auth/groups";
import { isRole, ROLES } from "@/lib/auth/roles";
import { badRequest, handle, readJson, requireApiRole } from "../../../_lib/http";
import { readLocations, withLocationValidation } from "../../_locations";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/users/groups/[groupId]
 * Body: { role: Role, locations?: string[], locationsRaw?: string }
 * 200:  { ok: true }
 *
 * Admin only. `updateGroupRole` re-applies the new grant to every current
 * member, so this is a live permission change, not a label edit.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await params;
  const context = `PATCH /api/admin/users/groups/${groupId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    const role = body.role;
    if (!isRole(role)) throw badRequest("Invalid role.");

    const locations = readLocations(body);
    await withLocationValidation(() => updateGroupRole(groupId, role, locations));
    return NextResponse.json({ ok: true });
  });
}

/**
 * DELETE /api/admin/users/groups/[groupId]
 * 200: { ok: true }
 *
 * Admin only. Deletes the group record; members keep the claims they were last
 * given. Bookkeeping, not a bulk revoke — see the note on `deleteGroup`.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await params;
  const context = `DELETE /api/admin/users/groups/${groupId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    await deleteGroup(groupId);
    return NextResponse.json({ ok: true });
  });
}
