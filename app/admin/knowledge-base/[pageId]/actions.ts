"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { updateManualPage, revertManualPage, listManualPageVersions } from "@/lib/knowledge-base/db";
import { withErrorHandling, type ApiResult } from "@/lib/api/errorInterceptor";
import type { ManualPage, ManualPageVersion } from "@/lib/knowledge-base/types";

type Result = { ok: true } | { ok: false; error: string };

/** Every action re-checks this — a server action is directly callable and doesn't go through the page's own guard. */
async function requireAdmin(): Promise<{ ok: false; error: string } | { uid: string; email: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!hasAnyRole(session.currentRole, ["admin"])) {
    return { ok: false, error: "Only admins can edit the knowledge base." };
  }
  return { uid: session.uid, email: session.email ?? session.uid };
}

function refresh(pageId: string) {
  revalidatePath(`/admin/knowledge-base/${pageId}`);
  revalidatePath(`/knowledge-base/${pageId}`);
  revalidatePath("/knowledge-base");
}

export async function updateManualPageAction(
  pageId: string,
  next: Omit<ManualPage, "id">,
): Promise<Result> {
  const actor = await requireAdmin();
  if ("error" in actor) return actor;
  if (!next.title.trim()) return { ok: false, error: "Title is required." };

  const result = await withErrorHandling(`updateManualPage(${pageId})`, () =>
    updateManualPage(pageId, next, actor),
  );
  if (result.error) return { ok: false, error: result.error.message };

  refresh(pageId);
  return { ok: true };
}

export async function revertManualPageAction(pageId: string, versionId: string): Promise<Result> {
  const actor = await requireAdmin();
  if ("error" in actor) return actor;

  const result = await withErrorHandling(`revertManualPage(${pageId}, ${versionId})`, () =>
    revertManualPage(pageId, versionId, actor),
  );
  if (result.error) return { ok: false, error: result.error.message };

  refresh(pageId);
  return { ok: true };
}

export async function getManualPageHistoryAction(pageId: string): Promise<ApiResult<ManualPageVersion[]>> {
  const actor = await requireAdmin();
  if ("error" in actor) return { data: null, error: { message: actor.error, context: "getManualPageHistoryAction" } };

  return withErrorHandling(`listManualPageVersions(${pageId})`, () => listManualPageVersions(pageId));
}
