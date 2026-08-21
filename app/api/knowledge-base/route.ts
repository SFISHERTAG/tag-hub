import { NextResponse } from "next/server";
import { listManualPages } from "@/lib/knowledge-base/db";
import { isInternalRole } from "@/lib/auth/session";
import { requireApiSession } from "@/lib/auth/api-session";
import { forbidden, handle } from "../admin/_lib/http";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/knowledge-base";

/**
 * GET /api/knowledge-base
 * 200: { pages: ManualPageSummary[] }  // { id, num, title, eyebrow, status }
 *
 * TAG staff only, read-only. The gate is `isInternalRole` from
 * lib/auth/session.ts rather than a local list: it is the same allowlist the
 * legacy page's TAG_STAFF_ROLES spelled out, and keeping one copy means a role
 * added to ROLES later is not silently treated as internal here.
 */
export async function GET() {
  return handle(CONTEXT, async () => {
    const gate = await requireApiSession(CONTEXT);
    if (!gate.ok) return gate.response;
    if (!isInternalRole(gate.session.currentRole)) {
      throw forbidden("Only TAG staff can access the knowledge base.");
    }

    return NextResponse.json({ pages: await listManualPages() });
  });
}
