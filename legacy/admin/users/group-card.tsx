"use client";

import { useState, useTransition } from "react";
import {
  updateGroupAction,
  deleteGroupAction,
  addMemberAction,
  removeMemberAction,
} from "./actions";
import type { Group } from "@/lib/auth/groups";
import type { DirectoryUser } from "@/lib/auth/user-directory";
import { ROLE_LIST, HAT_LABELS } from "@/lib/auth/role-labels";

const inputClass =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-accent disabled:opacity-60";

export function GroupCard({
  group,
  members,
  ungrouped,
}: {
  group: Group;
  /** Full user records for this group's current memberUids, resolved by the page. */
  members: DirectoryUser[];
  /** Users belonging to no group — the only ones addable here, per the one-group-at-a-time rule. */
  ungrouped: DirectoryUser[];
}) {
  const [role, setRole] = useState(group.role);
  const [locations, setLocations] = useState(group.locations.join(", "));
  const [addUid, setAddUid] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateGroupAction(group.id, role, locations);
      if (!result.ok) setError(result.error);
      else setSaved(true);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteGroupAction(group.id);
    });
  }

  function handleAddMember(event: React.FormEvent) {
    event.preventDefault();
    if (!addUid) return;
    setError(null);
    startTransition(async () => {
      const result = await addMemberAction(group.id, addUid);
      if (!result.ok) setError(result.error);
      else setAddUid("");
    });
  }

  function handleRemoveMember(uid: string) {
    startTransition(async () => {
      await removeMemberAction(group.id, uid);
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{group.name}</h3>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="text-xs text-danger underline-offset-2 hover:underline disabled:opacity-60"
        >
          Delete group
        </button>
      </div>

      <form onSubmit={handleSave} className="mt-3 space-y-3">
        <fieldset disabled={pending} className="space-y-3" onChange={() => setSaved(false)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-ink-3">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className={inputClass}
              >
                {ROLE_LIST.map((r) => (
                  <option key={r} value={r}>
                    {HAT_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-3">
                Locations (comma-separated, blank = unrestricted)
              </label>
              <input
                value={locations}
                onChange={(e) => setLocations(e.target.value)}
                placeholder="loc_…, loc_…"
                className={inputClass}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-ink hover:bg-raised disabled:opacity-60"
            >
              Save — applies to every member now
            </button>
            {saved && <span className="text-xs text-ok">Saved.</span>}
          </div>
        </fieldset>
      </form>

      <div className="mt-4 border-t border-line pt-3">
        <p className="mb-2 text-xs font-medium text-ink-2">
          {members.length} {members.length === 1 ? "member" : "members"}
        </p>
        <ul className="space-y-1.5">
          {members.map((m) => (
            <li key={m.uid} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-ink">{m.email ?? m.uid}</span>
              <button
                type="button"
                onClick={() => handleRemoveMember(m.uid)}
                disabled={pending}
                className="shrink-0 text-xs text-ink-3 underline-offset-2 hover:text-danger hover:underline disabled:opacity-60"
              >
                Remove
              </button>
            </li>
          ))}
          {members.length === 0 && (
            <li className="text-xs text-ink-3">No members yet.</li>
          )}
        </ul>

        {ungrouped.length > 0 && (
          <form onSubmit={handleAddMember} className="mt-3 flex items-center gap-2">
            <select
              value={addUid}
              onChange={(e) => setAddUid(e.target.value)}
              disabled={pending}
              className={inputClass}
            >
              <option value="">Add a user…</option>
              {ungrouped.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.email ?? u.uid}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending || !addUid}
              className="shrink-0 rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-ink hover:bg-raised disabled:opacity-60"
            >
              Add
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
