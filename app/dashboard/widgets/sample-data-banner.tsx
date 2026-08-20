/**
 * Every number below this line that is not explicitly marked otherwise is
 * sample data, not a reading. A blank would be safer than a demo figure that
 * looks real enough to act on — see the comment on `Pending` in ui.tsx — but
 * a whole page of blanks says nothing about what this becomes, so the
 * compromise is real-shaped numbers plus a banner nobody can miss.
 */
export function SampleDataBanner({
  what = "Spend, funnel, and ROAS figures below are placeholders shaped like the real thing. Live numbers ship with the Meta integration.",
}: {
  /** What specifically is sample here. Health scores and spend are different lies, and the banner should say which one it is covering. */
  what?: string;
}) {
  return (
    <div
      role="note"
      className="mb-6 flex items-center gap-2.5 rounded-lg border border-warn/30 bg-warn-tint px-4 py-2.5 text-warn"
    >
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
      <p className="text-xs font-medium">Sample data — {what}</p>
    </div>
  );
}
