"use client";

import { useTransition } from "react";
import { formatTimeAgo } from "@/lib/format/time-ago";
import { refreshFreshness } from "./freshness-actions";

export function FreshnessIndicator({
  locationId,
  timestamp,
  revalidatePathOverride,
}: {
  locationId: string;
  timestamp: number | null;
  /**
   * Which route to invalidate on refresh. Defaults to this location's own
   * layout; the /dashboard route passes its own path, since revalidating
   * /l/<id> would leave the page the user is looking at untouched.
   */
  revalidatePathOverride?: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      await refreshFreshness(locationId, revalidatePathOverride);
    });
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isPending}
      className="whitespace-nowrap text-xs text-ink-3 hover:text-ink-2 disabled:opacity-60"
    >
      {isPending ? "Refreshing…" : `Updated ${formatTimeAgo(timestamp)} — Click to refresh`}
    </button>
  );
}
