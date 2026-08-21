"use client";

import { usePathname, useRouter } from "next/navigation";

/**
 * Preserves the current sub-route (pipeline/today/contacts/...) when switching
 * tenants, so picking a new client from e.g. Today lands you on their Today
 * rather than bouncing back to the pipeline.
 */
function subPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean); // ["l", locationId, ...rest]
  return parts.slice(2).join("/");
}

export function LocationSwitcher({
  current,
  locations,
}: {
  current: string;
  locations: { locationId: string; name: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const rest = subPath(pathname);

  return (
    <select
      value={current}
      onChange={(e) => {
        const next = e.currentTarget.value;
        router.push(`/l/${next}/${rest}`);
      }}
      className="max-w-[12rem] rounded-md border border-line-strong bg-surface px-2 py-1.5 text-sm font-medium text-ink"
      aria-label="Switch client"
    >
      {locations.map((location) => (
        <option key={location.locationId} value={location.locationId}>
          {location.name}
        </option>
      ))}
    </select>
  );
}
