"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Jumps to the edit page for a location id that has no tenant document yet.
 * `getTenant()` already returns defaults for a missing doc and the edit page
 * saves through the same `saveTenant()` path — this is the only entry point
 * to that page for a location no document exists for yet, since the table
 * above only lists ids that already have one.
 */
export function NewTenantForm() {
  const router = useRouter();
  const [locationId, setLocationId] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = locationId.trim();
    if (!trimmed) return;
    router.push(`/admin/tenants/${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="space-y-1">
        <label htmlFor="new-tenant-location" className="block text-xs text-ink-3">
          GHL location id
        </label>
        <input
          id="new-tenant-location"
          value={locationId}
          onChange={(e) => setLocationId(e.currentTarget.value)}
          placeholder="loc_…"
          className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-accent"
        />
      </div>
      <button
        type="submit"
        className="rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink hover:bg-raised"
      >
        Add tenant
      </button>
    </form>
  );
}
