import { NextResponse, type NextRequest } from "next/server";
import { listManualPageVersions } from "@/lib/knowledge-base/db";
import { ROLES } from "@/lib/auth/roles";
import { handle, requireApiRole } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/knowledge-base/[pageId]/versions
 * 200: { versions: ManualPageVersion[] }  // newest first
 *
 * Admin only. Each version carries the full page as it was, plus authorUid,
 * authorEmail and createdAt.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const { pageId } = await params;
  const context = `GET /api/admin/knowledge-base/${pageId}/versions`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    return NextResponse.json({ versions: await listManualPageVersions(pageId) });
  });
}
