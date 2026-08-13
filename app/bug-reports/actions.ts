"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { submitBugReport } from "@/lib/bug-reports";

type Result = { ok: true } | { ok: false; error: string };

export async function submitReport(formData: FormData): Promise<Result> {
  const session = await requireSession();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const stepsToReproduce = String(formData.get("stepsToReproduce") ?? "").trim();
  const pageArea = String(formData.get("pageArea") ?? "").trim();

  if (!title) return { ok: false, error: "Give it a short title." };
  if (!description) return { ok: false, error: "Describe what happened." };

  await submitBugReport({
    userId: session.uid,
    userEmail: session.email ?? session.uid,
    title,
    description,
    stepsToReproduce: stepsToReproduce || undefined,
    pageArea: pageArea || undefined,
  });

  revalidatePath("/bug-reports");
  return { ok: true };
}
