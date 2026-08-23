import { NextResponse, type NextRequest } from "next/server";
import { createDoc } from "@/lib/course/db";
import { ROLES } from "@/lib/auth/roles";
import {
  badRequest,
  handle,
  readJson,
  requiredString,
  requireApiRole,
} from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Reference links are rendered as anchors, so the scheme is the whole control. */
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
 * POST /api/admin/courses/[courseId]/subsections/[subsectionId]/docs
 * Body: { label: string, url: string }
 * 201:  { docId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; subsectionId: string }> },
) {
  const { courseId, subsectionId } = await params;
  const context = `POST /api/admin/courses/${courseId}/subsections/${subsectionId}/docs`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    const docId = await createDoc(subsectionId, {
      label: requiredString(body, "label"),
      url: requireHttpUrl(requiredString(body, "url")),
    });

    return NextResponse.json({ docId }, { status: 201 });
  });
}
