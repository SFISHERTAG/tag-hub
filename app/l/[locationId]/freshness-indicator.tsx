"use client";

import { useTransition } from "react";
import { formatTimeAgo } from "@/lib/format/time-ago";
import { refreshFreshness } from "./freshness-actions";

export function FreshnessIndicator({
  locationId,
  timestamp,
}: {
  locationId: string;
  timestamp: number | null;
}) {
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      await refreshFreshness(locationId);
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
