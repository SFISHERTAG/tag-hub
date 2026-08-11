/**
 * Every number below this line that is not explicitly marked otherwise is
 * sample data, not a reading. A blank would be safer than a demo figure that
 * looks real enough to act on — see the comment on `Pending` in ui.tsx — but
 * a whole page of blanks says nothing about what this becomes, so the
 * compromise is real-shaped numbers plus a banner nobody can miss.
 */
export function SampleDataBanner() {
  return (
    <div
      role="note"
      className="mb-6 flex items-center gap-2.5 rounded-lg border border-warn/30 bg-warn-tint px-4 py-2.5 text-warn"
    >
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
      <p className="text-xs font-medium">
        Sample data — spend, funnel, and ROAS figures below are placeholders
        shaped like the real thing. Live numbers ship with Meta setup
        (Story&nbsp;4.1).
      </p>
    </div>
  );
}
