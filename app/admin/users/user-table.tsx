"use client";

import { useState, useTransition } from "react";
import { assignIndividualRoleAction } from "./actions";
import type { DirectoryUser } from "@/lib/auth/user-directory";
import { ROLES, HAT_LABELS } from "@/lib/auth/role-labels";

const inputClass =
  "rounded-md border border-line-strong bg-surface px-2 py-1 text-xs text-ink placeholder:text-ink-3 outline-none focus:border-accent disabled:opacity-60";

function UserRow({ user }: { user: DirectoryUser }) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(user.role ?? "client_closer");
  const [locations, setLocations] = useState(user.locations.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await assignIndividualRoleAction(user.uid, role, locations);
      if (!result.ok) setError(result.error);
      else setEditing(false);
    });
  }

  if (editing) {
    return (
      <tr className="border-t border-line">
        <td className="px-3 py-2 text-ink">{user.email ?? user.uid}</td>
        <td colSpan={3} className="px-3 py-2">
          <form onSubmit={handleSave} className="flex flex-wrap items-center gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              disabled={pending}
              className={inputClass}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {HAT_LABELS[r]}
                </option>
              ))}
            </select>
            <input
              value={locations}
              onChange={(e) => setLocations(e.target.value)}
              placeholder="loc_…, loc_… (blank = unrestricted)"
              disabled={pending}
              className={`${inputClass} min-w-48 flex-1`}
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={pending}
              className="text-xs text-ink-3 hover:text-ink"
            >
              Cancel
            </button>
            {error && <span className="w-full text-xs text-danger">{error}</span>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2 text-ink">{user.email ?? user.uid}</td>
      <td className="px-3 py-2 text-ink-2">
        {user.role ? HAT_LABELS[user.role] : "—"}
      </td>
      <td className="px-3 py-2 text-ink-2">{user.groupName ?? "—"}</td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-ink-3 underline-offset-2 hover:text-ink hover:underline"
        >
          Assign individually
        </button>
      </td>
    </tr>
  );
}

export function UserTable({ users }: { users: DirectoryUser[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-ink-3">
          <th className="px-3 py-2 font-medium">Email</th>
          <th className="px-3 py-2 font-medium">Role</th>
          <th className="px-3 py-2 font-medium">Group</th>
          <th className="px-3 py-2" />
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <UserRow key={u.uid} user={u} />
        ))}
      </tbody>
    </table>
  );
}
