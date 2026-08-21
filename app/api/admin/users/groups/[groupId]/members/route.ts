import { NextResponse, type NextRequest } from "next/server";
import { addMemberToGroup } from "@/lib/auth/groups";
import { ROLES } from "@/lib/auth/roles";
import { handle, readJson, requiredString, requireApiRole } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/groups/[groupId]/members
 * Body: { uid: string }
 * 200:  { ok: true }
 *
 * Admin only. Detaches the user from whatever group they were in first — a
 * user belongs to at most one group — and writes the group's claims onto them.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await params;
  const context = `POST /api/admin/users/groups/${groupId}/members`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    await addMemberToGroup(groupId, requiredString(body, "uid"));
    return NextResponse.json({ ok: true });
  });
}
