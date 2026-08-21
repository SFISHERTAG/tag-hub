import { NextResponse, type NextRequest } from "next/server";
import { removeMemberFromGroup } from "@/lib/auth/groups";
import { ROLES } from "@/lib/auth/roles";
import { handle, requireApiRole } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/users/groups/[groupId]/members/[uid]
 * 200: { ok: true }
 *
 * Admin only. Removes membership only; the user keeps the claims they were
 * last given. Clearing a list is not the same intent as revoking access, and
 * conflating them makes the safer-looking action the more dangerous one.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string; uid: string }> },
) {
  const { groupId, uid } = await params;
  const context = `DELETE /api/admin/users/groups/${groupId}/members/${uid}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    await removeMemberFromGroup(groupId, uid);
    return NextResponse.json({ ok: true });
  });
}
