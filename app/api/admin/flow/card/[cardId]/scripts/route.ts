import { NextResponse, type NextRequest } from "next/server";
import { createScript, getCardOrgId, logChange } from "@/lib/flow/db";
import { ROLES } from "@/lib/auth/roles";
import {
  handle,
  notFound,
  optionalStringArray,
  nullableString,
  readJson,
  requiredString,
  requireApiRole,
} from "../../../../_lib/http";

export const dynamic = "force-dynamic";

const FLOW_ADMIN_ROLES = [ROLES.TAG_EXEC, ROLES.ADMIN] as const;

/**
 * POST /api/admin/flow/card/[cardId]/scripts
 * Body: { content: string, why?: string | null, notes?: string | null,
 *         version_tag?: string | null, tags?: string[] }
 * 201:  FlowScript
 * 404:  the card does not exist
 *
 * Creates a script on a card. Scripts are append-only per card, so this is
 * also how a new version of an existing script is added.
 *
 * `org_id` used to be read from the request body and passed straight to the
 * audit log, defaulting to the string "unknown". It is now resolved from the
 * card itself via `getCardOrgId` — the same helper the suggestion flow uses
 * for the same reason. An audit entry whose org is chosen by the caller is
 * worse than no audit entry: it looks authoritative and points at the wrong
 * tenant.
 *
 * PATCH and DELETE used to be declared on this route and recovered a script id
 * from the URL's last path segment, which on this path is the literal string
 * "scripts" — so both were unreachable. They now live at
 * `.../scripts/[scriptId]/route.ts`, where the id is a real route parameter.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params;
  const context = `POST /api/admin/flow/card/${cardId}/scripts`;

  return handle(context, async () => {
    const gate = await requireApiRole(FLOW_ADMIN_ROLES, context);
    if (!gate.ok) return gate.response;

    const orgId = await getCardOrgId(cardId);
    if (!orgId) throw notFound("Card not found.");

    const body = await readJson(request);
    const content = requiredString(body, "content");
    const why = nullableString(body, "why");
    const notes = nullableString(body, "notes");
    const actor = gate.session.email ?? gate.session.uid;

    const script = await createScript(cardId, {
      content,
      why,
      notes,
      version_tag: nullableString(body, "version_tag"),
      tags: optionalStringArray(body, "tags") ?? [],
      created_by: actor,
      updated_by: actor,
    });

    await logChange(
      orgId,
      "flow_scripts",
      script.id,
      "create",
      {
        content: { old: null, new: content },
        why: { old: null, new: why },
        notes: { old: null, new: notes },
      },
      actor,
    );

    return NextResponse.json(script, { status: 201 });
  });
}
