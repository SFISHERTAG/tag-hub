"use client";

import { useState, useTransition } from "react";
import { createGroupAction } from "./actions";
import { ROLES, HAT_LABELS } from "@/lib/auth/role-labels";

const inputClass =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-accent disabled:opacity-60";

export function NewGroupForm() {
  const [name, setName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("tag_csm");
  const [locations, setLocations] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createGroupAction(name, role, locations);
      if (!result.ok) {
        setError(result.error);
      } else {
        setName("");
        setLocations("");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-line-strong border-dashed bg-raised p-4"
    >
      <h3 className="text-sm font-semibold text-ink">New group</h3>
      <fieldset disabled={pending} className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-ink-3">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sales Team"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-3">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className={inputClass}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {HAT_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-3">
            Locations (optional)
          </label>
          <input
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            placeholder="loc_…, loc_…"
            className={inputClass}
          />
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="mt-3 rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create group"}
      </button>
    </form>
  );
}
