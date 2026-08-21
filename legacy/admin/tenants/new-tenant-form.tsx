"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Matches `isValidLocationId` in `lib/ghl/tenants.ts`, duplicated here rather
 * than imported because that module is `server-only` and can't be pulled
 * into a client component. This copy is a client-side convenience so a
 * malformed id never gets typed in the first place; the server module is
 * still the authority that actually guards the Firestore write.
 */
const LOCATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

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
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = locationId.trim();
    if (!trimmed) return;
    if (!LOCATION_ID_PATTERN.test(trimmed)) {
      setError("Location id can only contain letters, numbers, - and _.");
      return;
    }
    setError(null);
    router.push(`/admin/tenants/${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2">
      <div className="space-y-1">
        <label htmlFor="new-tenant-location" className="block text-xs text-ink-3">
          GHL location id
        </label>
        <input
          id="new-tenant-location"
          value={locationId}
          onChange={(e) => {
            setLocationId(e.currentTarget.value);
            setError(null);
          }}
          placeholder="loc_…"
          className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-accent"
        />
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
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
