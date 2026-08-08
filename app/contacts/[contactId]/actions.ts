"use server";

import { revalidatePath } from "next/cache";
import { addNote } from "@/lib/ghl/contacts";

export async function createNote(
  locationId: string,
  contactId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
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
