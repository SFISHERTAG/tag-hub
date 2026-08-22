import { NextResponse, type NextRequest } from "next/server";
import { createVideo, reorderVideos } from "@/lib/course/db";
import { parseVideoLink, isVideoProvider } from "@/lib/course/video-links";
import { ROLES } from "@/lib/auth/roles";
import {
  badRequest,
  handle,
  optionalString,
  optionalStringArray,
  readJson,
  requiredString,
  requireApiRole,
} from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/courses/[courseId]/subsections/[subsectionId]/videos
 * Body: { link: string, provider?: "loom"|"fathom"|"drive", label?: string }
 * 201:  { videoId: string }
 *
 * `link` takes a pasted share URL or a bare id. Parsing happens here rather
 * than in the client so the import path and the editor cannot disagree about
 * what a valid id is, and so an unrecognised link is a 400 instead of a row
 * that renders as a blank iframe.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; subsectionId: string }> },
) {
  const { courseId, subsectionId } = await params;
  const context = `POST /api/admin/courses/${courseId}/subsections/${subsectionId}/videos`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    const link = requiredString(body, "link");
    const stated = optionalString(body, "provider");
    const provider = isVideoProvider(stated) ? stated : undefined;

    const parsed = parseVideoLink(link, provider);
    if (!parsed) {
      throw badRequest(
        "That is not a Loom, Fathom or Google Drive video link. Paste the share URL, or pick a provider and give the id on its own.",
      );
    }

    const videoId = await createVideo(subsectionId, {
      provider: parsed.provider,
      externalId: parsed.externalId,
      label: optionalString(body, "label").trim() || undefined,
    });

    return NextResponse.json({ videoId }, { status: 201 });
  });
}

/**
 * PATCH /api/admin/courses/[courseId]/subsections/[subsectionId]/videos
 * Body: { orderedIds: string[] }
 * 200:  { ok: true }
 *
 * The whole order at once, in one transaction. Each UPDATE is also scoped to
 * the subsection, so an id belonging to another lesson silently matches
 * nothing rather than being reordered into this one.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; subsectionId: string }> },
) {
  const { courseId, subsectionId } = await params;
  const context = `PATCH /api/admin/courses/${courseId}/subsections/${subsectionId}/videos`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    const orderedIds = optionalStringArray(body, "orderedIds");
    if (!orderedIds || orderedIds.length === 0) {
      throw badRequest("orderedIds must be a non-empty array of video ids.");
    }

    await reorderVideos(subsectionId, orderedIds);
    return NextResponse.json({ ok: true });
  });
}
