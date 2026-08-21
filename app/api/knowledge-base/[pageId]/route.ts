import { NextResponse, type NextRequest } from "next/server";
import { getManualPage } from "@/lib/knowledge-base/db";
import { isInternalRole } from "@/lib/auth/session";
import { requireApiSession } from "@/lib/auth/api-session";
import { forbidden, handle, notFound } from "../../admin/_lib/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/knowledge-base/[pageId]
 * 200: { page: ManualPage }  // { id, num, title, eyebrow, lede, status, level, blocks }
 * 403: not TAG staff
 * 404: page does not exist
 *
 * Read-only. Editing is admin-only and lives under /api/admin/knowledge-base.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const { pageId } = await params;
  const context = `GET /api/knowledge-base/${pageId}`;

  return handle(context, async () => {
    const gate = await requireApiSession(context);
    if (!gate.ok) return gate.response;
    if (!isInternalRole(gate.session.currentRole)) {
      throw forbidden("Only TAG staff can access the knowledge base.");
    }

    const page = await getManualPage(pageId);
    if (!page) throw notFound("Manual page not found.");

    return NextResponse.json({ page });
  });
}
