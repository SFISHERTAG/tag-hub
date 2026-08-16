"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { addNote } from "@/lib/ghl/contacts";

export async function createNote(
  locationId: string,
  contactId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Server actions are callable endpoints in their own right. Guarding the page
  // that renders the form does not guard this, so it checks for itself.
  if (!(await getSession())) {
    return { ok: false, error: "Not signed in." };
  }

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Note is empty." };

  try {
    await addNote(locationId, contactId, trimmed);
    revalidatePath(`/contacts/${contactId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
