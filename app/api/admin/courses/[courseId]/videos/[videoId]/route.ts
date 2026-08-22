import { NextResponse, type NextRequest } from "next/server";
import { deleteVideo, updateVideo } from "@/lib/course/db";
import { parseVideoLink, isVideoProvider } from "@/lib/course/video-links";
import { ROLES } from "@/lib/auth/roles";
import {
  badRequest,
  handle,
  optionalString,
  readJson,
  requiredString,
  requireApiRole,
} from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/courses/[courseId]/videos/[videoId]
 * Body: { link: string, provider?: "loom"|"fathom"|"drive", label?: string }
 * 200:  { ok: true }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; videoId: string }> },
) {
  const { courseId, videoId } = await params;
  const context = `PATCH /api/admin/courses/${courseId}/videos/${videoId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    const stated = optionalString(body, "provider");
    const parsed = parseVideoLink(
      requiredString(body, "link"),
      isVideoProvider(stated) ? stated : undefined,
    );
    if (!parsed) {
      throw badRequest(
        "That is not a Loom, Fathom or Google Drive video link. Paste the share URL, or pick a provider and give the id on its own.",
      );
    }

    await updateVideo(videoId, {
      provider: parsed.provider,
      externalId: parsed.externalId,
      label: optionalString(body, "label").trim() || undefined,
    });

    return NextResponse.json({ ok: true });
  });
}

/**
 * DELETE /api/admin/courses/[courseId]/videos/[videoId]
 * 200: { ok: true }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string; videoId: string }> },
) {
  const { courseId, videoId } = await params;
  const context = `DELETE /api/admin/courses/${courseId}/videos/${videoId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    await deleteVideo(videoId);
    return NextResponse.json({ ok: true });
  });
}
