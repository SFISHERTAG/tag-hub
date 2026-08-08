"use client";

import { useRef, useState, useTransition } from "react";
import { createNote } from "./actions";

export function NoteForm({
  locationId,
  contactId,
}: {
  locationId: string;
  contactId: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const body = String(formData.get("body") ?? "");
    setError(null);

    startTransition(async () => {
      const result = await createNote(locationId, contactId, body);
      if (result.ok) {
        if (textareaRef.current) textareaRef.current.value = "";
      } else {
        // Leave the text in place so nothing typed is lost on failure.
        setError(result.error);
      }
    });
  }

  return (
    <form action={submit} className="space-y-2">
      <textarea
        ref={textareaRef}
        name="body"
        rows={3}
        placeholder="Add a note…"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-[#ebc507] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add note"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </form>
  );
}
