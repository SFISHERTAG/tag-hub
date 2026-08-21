import { NextResponse } from "next/server";
import { listManualPages } from "@/lib/knowledge-base/db";
import { ROLES } from "@/lib/auth/roles";
import { handle, requireApiRole } from "../_lib/http";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/admin/knowledge-base";

/**
 * GET /api/admin/knowledge-base
 * 200: { pages: ManualPageSummary[] }  // { id, num, title, eyebrow, status }
 *
 * Admin only. The read-only viewer for TAG staff is GET /api/knowledge-base.
 */
export async function GET() {
  return handle(CONTEXT, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], CONTEXT);
    if (!gate.ok) return gate.response;

    return NextResponse.json({ pages: await listManualPages() });
  });
}
