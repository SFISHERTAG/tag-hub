import { NextResponse, type NextRequest } from "next/server";
import { revertManualPage } from "@/lib/knowledge-base/db";
import { ROLES } from "@/lib/auth/roles";
import { handle, requireApiRole } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/knowledge-base/[pageId]/versions/[versionId]/revert
 * 200: { ok: true }
 *
 * Admin only. Reverting is itself an edit: it records the pre-revert content
 * as a new version, so a revert can be reverted and nothing in the history is
 * ever overwritten. The actor comes from the session.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ pageId: string; versionId: string }> },
) {
  const { pageId, versionId } = await params;
  const context = `POST /api/admin/knowledge-base/${pageId}/versions/${versionId}/revert`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const { session } = gate;
    await revertManualPage(pageId, versionId, {
      uid: session.uid,
      email: session.email ?? session.uid,
    });

    return NextResponse.json({ ok: true });
  });
}
