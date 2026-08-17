import { NextRequest, NextResponse } from "next/server";
import {
  createScript,
  updateScript,
  deleteScript,
  getScript,
  logChange,
} from "@/lib/flow/db";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

interface ScriptPayload {
  content: string;
  why?: string;
  notes?: string;
  version_tag?: string;
  tags?: string[];
  org_id: string; // Required for audit logging
}

/**
 * POST /api/admin/flow/card/[cardId]/scripts
 * Create a new script for a card (hotpath)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const session = await requireSession(request);
    if (!session || !["tag_exec", "tag_admin"].includes(session.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { cardId } = await params;
    const body: ScriptPayload = await request.json();

    if (!body.content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const script = await createScript(cardId, {
      content: body.content,
      why: body.why,
      notes: body.notes,
      version_tag: body.version_tag,
      tags: body.tags || [],
      created_by: session.email || "unknown",
      updated_by: session.email || "unknown",
    });

    // Log the change
    await logChange(
      body.org_id,
      "flow_scripts",
      script.id,
      "create",
      {
        content: { old: null, new: body.content },
        why: { old: null, new: body.why || null },
        notes: { old: null, new: body.notes || null },
      },
      session.email || "unknown"
    );

    return NextResponse.json(script, { status: 201 });
  } catch (error) {
    console.error("Error creating script:", error);
    return NextResponse.json(
      { error: "Failed to create script" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/flow/card/[cardId]/scripts/[scriptId]
 * Update a script (hotpath)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const session = await requireSession(request);
    if (!session || !["tag_exec", "tag_admin"].includes(session.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(request.url);
    const scriptId = url.pathname.split("/").pop();

    if (!scriptId) {
      return NextResponse.json(
        { error: "Script ID is required" },
        { status: 400 }
      );
    }

    const body: Partial<ScriptPayload> = await request.json();
    const existingScript = await getScript(scriptId);

    if (!existingScript) {
      return NextResponse.json(
        { error: "Script not found" },
        { status: 404 }
      );
    }

    // Track changes for audit
    const changes: Record<string, { old: any; new: any }> = {};

    if (body.content !== undefined && body.content !== existingScript.content) {
      changes["content"] = {
        old: existingScript.content,
        new: body.content,
      };
    }
    if (body.why !== undefined && body.why !== existingScript.why) {
      changes["why"] = { old: existingScript.why, new: body.why };
    }
    if (body.notes !== undefined && body.notes !== existingScript.notes) {
      changes["notes"] = { old: existingScript.notes, new: body.notes };
    }

    const updated = await updateScript(scriptId, {
      content: body.content,
      why: body.why,
      notes: body.notes,
      version_tag: body.version_tag,
      tags: body.tags,
      updated_by: session.email || "unknown",
    });

    // Log if there were changes
    if (Object.keys(changes).length > 0) {
      await logChange(
        body.org_id || "unknown",
        "flow_scripts",
        scriptId,
        "update",
        changes,
        session.email || "unknown"
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating script:", error);
    return NextResponse.json(
      { error: "Failed to update script" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/flow/card/[cardId]/scripts/[scriptId]
 * Delete a script
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const session = await requireSession(request);
    if (!session || !["tag_exec", "tag_admin"].includes(session.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(request.url);
    const scriptId = url.pathname.split("/").pop();
    const orgId = url.searchParams.get("org_id") || "unknown";

    if (!scriptId) {
      return NextResponse.json(
        { error: "Script ID is required" },
        { status: 400 }
      );
    }

    const existingScript = await getScript(scriptId);
    if (!existingScript) {
      return NextResponse.json(
        { error: "Script not found" },
        { status: 404 }
      );
    }

    await deleteScript(scriptId);

    // Log the deletion
    await logChange(
      orgId,
      "flow_scripts",
      scriptId,
      "delete",
      {
        content: { old: existingScript.content, new: null },
      },
      session.email || "unknown"
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting script:", error);
    return NextResponse.json(
      { error: "Failed to delete script" },
      { status: 500 }
    );
  }
}
