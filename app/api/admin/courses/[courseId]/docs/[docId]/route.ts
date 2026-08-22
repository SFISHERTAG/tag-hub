import { NextResponse, type NextRequest } from "next/server";
import { deleteDoc, updateDoc } from "@/lib/course/db";
import { ROLES } from "@/lib/auth/roles";
import { badRequest, handle, readJson, requiredString, requireApiRole } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

function requireHttpUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw badRequest("That reference link is not a valid URL.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw badRequest("A reference link must be an http or https URL.");
  }
  return parsed.toString();
}

/**
 * PATCH /api/admin/courses/[courseId]/docs/[docId]
 * Body: { label: string, url: string }
 * 200:  { ok: true }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; docId: string }> },
) {
  const { courseId, docId } = await params;
  const context = `PATCH /api/admin/courses/${courseId}/docs/${docId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    await updateDoc(docId, {
      label: requiredString(body, "label"),
      url: requireHttpUrl(requiredString(body, "url")),
    });

    return NextResponse.json({ ok: true });
  });
}

/**
 * DELETE /api/admin/courses/[courseId]/docs/[docId]
 * 200: { ok: true }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string; docId: string }> },
) {
  const { courseId, docId } = await params;
  const context = `DELETE /api/admin/courses/${courseId}/docs/${docId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    await deleteDoc(docId);
    return NextResponse.json({ ok: true });
  });
}
