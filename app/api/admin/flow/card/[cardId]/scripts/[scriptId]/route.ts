import { NextResponse, type NextRequest } from "next/server";
import { deleteScript, getCardOrgId, getScript, logChange, updateScript } from "@/lib/flow/db";
import { ROLES } from "@/lib/auth/roles";
import {
  badRequest,
  handle,
  notFound,
  optionalStringArray,
  readJson,
  requireApiRole,
  type JsonBody,
} from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

const FLOW_ADMIN_ROLES = [ROLES.TAG_EXEC, ROLES.ADMIN] as const;

/**
 * Per-script FLOW routes.
 *
 * These handlers previously lived on the collection route one level up
 * (`.../scripts/route.ts`) and recovered the script id with
 * `url.pathname.split("/").pop()`. On that path the last segment is the
 * literal string "scripts", so every PATCH and DELETE looked up a script whose
 * id was "scripts", found nothing, and returned 404. The handlers were
 * documented as `.../scripts/[scriptId]` but no such segment existed. This
 * file is that segment; the id now comes from the route params.
 *
 * Two ids arrive per request and both are checked. The script must actually
 * belong to `cardId` — otherwise the card in the path is decoration and any
 * script in the system is editable through any card's URL. And `org_id` for
 * the audit entry is resolved from the card via `getCardOrgId`, never read
 * from the request: a caller-supplied org id lets an edit be recorded against
 * an org it did not happen in, which is the one thing an audit log must not
 * allow.
 */

/**
 * `undefined` means "leave this field alone"; an explicit `null` clears it.
 * `updateScript` skips undefined and writes null, so collapsing the two (as
 * `body.why ?? null` would) turns a partial edit into a silent wipe of every
 * field the caller did not mention.
 */
function readOptionalNullableString(body: JsonBody, key: string): string | null | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw badRequest(`"${key}" must be a string or null.`);
  return value;
}

async function loadOwnedScript(cardId: string, scriptId: string) {
  const script = await getScript(scriptId);
  if (!script || script.card_id !== cardId) {
    throw notFound("Script not found on this card.");
  }
  return script;
}

/**
 * PATCH /api/admin/flow/card/[cardId]/scripts/[scriptId]
 * Body: { content?, why?, notes?, version_tag?, tags? }   // omit to leave unchanged, null to clear
 * 200:  FlowScript
 * 404:  script does not exist, or does not belong to this card
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string; scriptId: string }> },
) {
  const { cardId, scriptId } = await params;
  const context = `PATCH /api/admin/flow/card/${cardId}/scripts/${scriptId}`;

  return handle(context, async () => {
    const gate = await requireApiRole(FLOW_ADMIN_ROLES, context);
    if (!gate.ok) return gate.response;

    const existing = await loadOwnedScript(cardId, scriptId);
    const body = await readJson(request);

    const content = readOptionalNullableString(body, "content");
    if (content === null) throw badRequest('"content" cannot be null.');
    const why = readOptionalNullableString(body, "why");
    const notes = readOptionalNullableString(body, "notes");
    const versionTag = readOptionalNullableString(body, "version_tag");
    const tags = optionalStringArray(body, "tags");

    // Values are whatever column changed, so `unknown` is the honest type —
    // this is written straight to the audit log and never read back here.
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    if (content !== undefined && content !== existing.content) {
      changes.content = { old: existing.content, new: content };
    }
    if (why !== undefined && why !== existing.why) {
      changes.why = { old: existing.why, new: why };
    }
    if (notes !== undefined && notes !== existing.notes) {
      changes.notes = { old: existing.notes, new: notes };
    }

    const updated = await updateScript(scriptId, {
      content,
      why,
      notes,
      version_tag: versionTag,
      tags,
      updated_by: gate.session.email ?? gate.session.uid,
    });

    if (Object.keys(changes).length > 0) {
      const orgId = await getCardOrgId(cardId);
      if (orgId) {
        await logChange(
          orgId,
          "flow_scripts",
          scriptId,
          "update",
          changes,
          gate.session.email ?? gate.session.uid,
        );
      }
    }

    return NextResponse.json(updated);
  });
}

/**
 * DELETE /api/admin/flow/card/[cardId]/scripts/[scriptId]
 * 200: { ok: true }
 * 404: script does not exist, or does not belong to this card
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string; scriptId: string }> },
) {
  const { cardId, scriptId } = await params;
  const context = `DELETE /api/admin/flow/card/${cardId}/scripts/${scriptId}`;

  return handle(context, async () => {
    const gate = await requireApiRole(FLOW_ADMIN_ROLES, context);
    if (!gate.ok) return gate.response;

    const existing = await loadOwnedScript(cardId, scriptId);
    await deleteScript(scriptId);

    const orgId = await getCardOrgId(cardId);
    if (orgId) {
      await logChange(
        orgId,
        "flow_scripts",
        scriptId,
        "delete",
        { content: { old: existing.content, new: null } },
        gate.session.email ?? gate.session.uid,
      );
    }

    return NextResponse.json({ ok: true });
  });
}
