const UNITS: Array<{ ms: number; label: string }> = [
  { ms: 1000 * 60 * 60 * 24 * 365, label: "year" },
  { ms: 1000 * 60 * 60 * 24 * 30, label: "month" },
  { ms: 1000 * 60 * 60 * 24, label: "day" },
  { ms: 1000 * 60 * 60, label: "hour" },
  { ms: 1000 * 60, label: "minute" },
];

/** "3 hours ago", "never" if no timestamp has been recorded yet. */
export function formatTimeAgo(timestamp: number | null): string {
  if (timestamp === null) return "never";

  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "just now";

  for (const unit of UNITS) {
    const count = Math.floor(diff / unit.ms);
    if (count >= 1) return `${count} ${unit.label}${count === 1 ? "" : "s"} ago`;
  }
  return "just now";
}
