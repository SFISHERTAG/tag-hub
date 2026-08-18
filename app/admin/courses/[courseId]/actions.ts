"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import {
  updateCourseMeta,
  createSection,
  updateSection,
  deleteSection,
  createSubsection,
  updateSubsection,
  deleteSubsection,
  createCheckbox,
  updateCheckbox,
  deleteCheckbox,
} from "@/lib/course/db";

type Result = { ok: true } | { ok: false; error: string };

/** Every action re-checks this — a server action is directly callable and doesn't go through the page's own guard. */
async function requireAdmin(): Promise<Result | null> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (session.currentRole !== "admin") {
    return { ok: false, error: "Only admins can edit courses." };
  }
  return null;
}

function refresh(courseId: string) {
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses");
}

export async function updateCourseMetaAction(
  courseId: string,
  title: string,
  description: string,
): Promise<Result> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!title.trim()) return { ok: false, error: "Title is required." };

  await updateCourseMeta(courseId, { title: title.trim(), description: description.trim() });
  refresh(courseId);
  return { ok: true };
}

export async function createSectionAction(courseId: string, title: string): Promise<Result> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!title.trim()) return { ok: false, error: "Title is required." };

  await createSection(courseId, title.trim());
  refresh(courseId);
  return { ok: true };
}

export async function updateSectionAction(
  courseId: string,
  sectionId: string,
  title: string,
): Promise<Result> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!title.trim()) return { ok: false, error: "Title is required." };

  await updateSection(sectionId, title.trim());
  refresh(courseId);
  return { ok: true };
}

export async function deleteSectionAction(courseId: string, sectionId: string): Promise<Result> {
  const denied = await requireAdmin();
  if (denied) return denied;

  await deleteSection(sectionId);
  refresh(courseId);
  return { ok: true };
}

export async function createSubsectionAction(
  courseId: string,
  sectionId: string,
  title: string,
): Promise<Result> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!title.trim()) return { ok: false, error: "Title is required." };

  await createSubsection(sectionId, { title: title.trim(), content: "" });
  refresh(courseId);
  return { ok: true };
}

export async function updateSubsectionAction(
  courseId: string,
  subsectionId: string,
  fields: { title: string; loomId: string; content: string },
): Promise<Result> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!fields.title.trim()) return { ok: false, error: "Title is required." };

  await updateSubsection(subsectionId, {
    title: fields.title.trim(),
    loomId: fields.loomId.trim(),
    content: fields.content,
  });
  refresh(courseId);
  return { ok: true };
}

export async function deleteSubsectionAction(courseId: string, subsectionId: string): Promise<Result> {
  const denied = await requireAdmin();
  if (denied) return denied;

  await deleteSubsection(subsectionId);
  refresh(courseId);
  return { ok: true };
}

export async function createCheckboxAction(
  courseId: string,
  subsectionId: string,
  label: string,
): Promise<Result> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!label.trim()) return { ok: false, error: "Label is required." };

  await createCheckbox(subsectionId, label.trim());
  refresh(courseId);
  return { ok: true };
}

export async function updateCheckboxAction(
  courseId: string,
  checkboxId: string,
  label: string,
): Promise<Result> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!label.trim()) return { ok: false, error: "Label is required." };

  await updateCheckbox(checkboxId, label.trim());
  refresh(courseId);
  return { ok: true };
}

export async function deleteCheckboxAction(courseId: string, checkboxId: string): Promise<Result> {
  const denied = await requireAdmin();
  if (denied) return denied;

  await deleteCheckbox(checkboxId);
  refresh(courseId);
  return { ok: true };
}
