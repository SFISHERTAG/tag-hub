import { NextResponse, type NextRequest } from "next/server";
import { getManualPage, updateManualPage } from "@/lib/knowledge-base/db";
import type { ManualBlock } from "@/lib/knowledge-base/types";
import { ROLES } from "@/lib/auth/roles";
import {
  badRequest,
  handle,
  notFound,
  optionalString,
  readJson,
  requiredString,
  requireApiRole,
  type JsonBody,
} from "../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * `blocks` is a loose union by design (see lib/knowledge-base/types.ts): new
 * block types appear per-page in the source manual and the editor edits them
 * as raw JSON. The only invariant enforced here is the one every renderer
 * relies on — each block is an object carrying a string `type`.
 */
function readBlocks(body: JsonBody): ManualBlock[] {
  const raw = body.blocks;
  if (!Array.isArray(raw)) throw badRequest('"blocks" must be an array.');
  return raw.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw badRequest(`"blocks[${index}]" must be an object.`);
    }
    const block = entry as Record<string, unknown>;
    if (typeof block.type !== "string" || !block.type) {
      throw badRequest(`"blocks[${index}].type" is required.`);
    }
    return block as ManualBlock;
  });
}

/**
 * GET /api/admin/knowledge-base/[pageId]
 * 200: { page: ManualPage }
 * 404: page does not exist
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const { pageId } = await params;
  const context = `GET /api/admin/knowledge-base/${pageId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const page = await getManualPage(pageId);
    if (!page) throw notFound("Manual page not found.");

    return NextResponse.json({ page });
  });
}

/**
 * PUT /api/admin/knowledge-base/[pageId]
 * Body: Omit<ManualPage, "id">  // { num, title, eyebrow, lede, status, level, blocks }
 * 200:  { ok: true }
 *
 * Admin only. The write records the page's *current* content as a version
 * first, so history reads as "what it was, and who changed it away from that".
 * The actor is taken from the session, never from the body.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const { pageId } = await params;
  const context = `PUT /api/admin/knowledge-base/${pageId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const { session } = gate;
    const body = await readJson(request);

    await updateManualPage(
      pageId,
      {
        num: optionalString(body, "num").trim(),
        title: requiredString(body, "title"),
        eyebrow: optionalString(body, "eyebrow").trim(),
        lede: optionalString(body, "lede").trim(),
        status: optionalString(body, "status").trim(),
        level: optionalString(body, "level").trim(),
        blocks: readBlocks(body),
      },
      { uid: session.uid, email: session.email ?? session.uid },
    );

    return NextResponse.json({ ok: true });
  });
}
