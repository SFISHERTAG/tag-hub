"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { isRole, type Role } from "@/lib/auth/roles";
import {
  createGroup,
  updateGroupRole,
  deleteGroup,
  addMemberToGroup,
  removeMemberFromGroup,
  assignIndividualRole,
  InvalidLocationError,
} from "@/lib/auth/groups";

type Result = { ok: true } | { ok: false; error: string };

/** Every action re-checks this — a server action is directly callable and doesn't go through the page's own guard. */
async function requireExec(): Promise<Result | null> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (session.hat !== "tag_exec") {
    return { ok: false, error: "Only executives can manage users." };
  }
  return null;
}

function parseLocations(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function refresh() {
  revalidatePath("/admin/users");
}

export async function createGroupAction(
  name: string,
  role: string,
  locationsRaw: string,
): Promise<Result> {
  const denied = await requireExec();
  if (denied) return denied;

  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false, error: "Name is required." };
  if (!isRole(role)) return { ok: false, error: "Invalid role." };

  try {
    await createGroup(trimmedName, role, parseLocations(locationsRaw));
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function updateGroupAction(
  groupId: string,
  role: string,
  locationsRaw: string,
): Promise<Result> {
  const denied = await requireExec();
  if (denied) return denied;
  if (!isRole(role)) return { ok: false, error: "Invalid role." };

  try {
    await updateGroupRole(groupId, role, parseLocations(locationsRaw));
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function deleteGroupAction(groupId: string): Promise<Result> {
  const denied = await requireExec();
  if (denied) return denied;

  await deleteGroup(groupId);
  refresh();
  return { ok: true };
}

export async function addMemberAction(groupId: string, uid: string): Promise<Result> {
  const denied = await requireExec();
  if (denied) return denied;

  try {
    await addMemberToGroup(groupId, uid);
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function removeMemberAction(groupId: string, uid: string): Promise<Result> {
  const denied = await requireExec();
  if (denied) return denied;

  await removeMemberFromGroup(groupId, uid);
  refresh();
  return { ok: true };
}

export async function assignIndividualRoleAction(
  uid: string,
  role: string,
  locationsRaw: string,
): Promise<Result> {
  const denied = await requireExec();
  if (denied) return denied;
  if (!isRole(role)) return { ok: false, error: "Invalid role." };

  try {
    await assignIndividualRole(uid, role as Role, parseLocations(locationsRaw));
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

function message(error: unknown): string {
  if (error instanceof InvalidLocationError) return error.message;
  return error instanceof Error ? error.message : String(error);
}
