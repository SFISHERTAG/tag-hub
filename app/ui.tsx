import { ChevronIcon } from "./icons";

/**
 * Layout primitives.
 *
 * Four pieces carry the whole cockpit: a panel, a folding section, a stat, and
 * a badge. Everything else composes from them, which is what keeps twelve
 * screens looking like one product instead of twelve.
 *
 * `Fold` is native `<details>` rather than a `useState` disclosure. It keeps
 * keyboard and screen-reader behaviour for free, it renders open-able without
 * JavaScript, and — the reason that matters here — the browser's find-in-page
 * can open a closed section to reveal a match. A div-and-state version silently
 * hides content from Cmd-F, which on a dense operations dashboard means a CSM
 * searching a client name gets told it isn't there.
 */

export function Panel({
  title,
  meta,
  children,
  glass = false,
  className = "",
}: {
  title?: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  /** Translucent over the ambient wash. Only for panels that sit on one. */
  glass?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg lift ${
        glass ? "glass" : "border border-line bg-surface"
      } ${className}`}
    >
      {title && (
        <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-medium text-ink">{title}</h2>
          {meta && <div className="text-xs text-ink-3">{meta}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Fold({
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-line bg-surface lift"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-medium text-ink">{title}</span>
        <span className="flex items-center gap-3">
          {meta && (
            <span className="text-xs tabular-nums text-ink-3">{meta}</span>
          )}
          <ChevronIcon className="h-4 w-4 shrink-0 text-ink-3 transition-transform duration-150 group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t border-line px-4 py-3">{children}</div>
    </details>
  );
}

export function Stat({
  label,
  value,
  delta,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  delta?: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
}) {
  const deltaTone = {
    neutral: "text-ink-3",
    ok: "text-ok",
    warn: "text-warn",
    danger: "text-danger",
  }[tone];

  return (
    <div className={`rounded-lg border px-4 py-3 lift ${
      tone === "danger" ? "border-danger/30 bg-danger-tint" : "border-line bg-surface"
    }`}>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
        {value}
      </p>
      {delta && <p className={`mt-0.5 text-xs ${deltaTone}`}>{delta}</p>}
    </div>
  );
}

/**
 * Status only. Gold is not an option here on purpose — it is reserved for
 * interactive and brand state, so a gold pill always means "selected" and never
 * "needs attention". `warn` is orange rather than amber for the same reason:
 * amber sitting next to the accent is not distinguishable at badge size.
 */
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "ok" | "warn" | "danger" | "info";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-raised text-ink-2 border-line",
    ok: "bg-ok-tint text-ok border-ok/25",
    warn: "bg-warn-tint text-warn border-warn/25",
    danger: "bg-danger-tint text-danger border-danger/25",
    info: "bg-info-tint text-info border-info/25",
  }[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones}`}
    >
      {children}
    </span>
  );
}

const TONE_VAR = {
  ok: "var(--ok)",
  warn: "var(--warn)",
  danger: "var(--danger)",
  info: "var(--info)",
  accent: "var(--color-accent)",
  neutral: "var(--line-strong)",
} as const;

export type Segment = {
  label: string;
  value: number;
  tone: keyof typeof TONE_VAR;
};

/**
 * Donut, drawn with stroke-dasharray rather than a charting library.
 *
 * CCE reached for recharts here. For one ring of four segments that is ~500kB
 * of client JavaScript and a "use client" boundary on a page that otherwise
 * renders entirely on the server — this version is ~40 lines, ships no runtime,
 * and inherits theme colours from CSS variables so it flips with the rest of
 * the page for free.
 */
export function Donut({
  segments,
  size = 132,
  thickness = 14,
  centerLabel,
}: {
  segments: Segment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
        className="shrink-0 -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={thickness}
        />
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => {
              const len = (s.value / total) * c;
              const el = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={TONE_VAR[s.tone]}
                  strokeWidth={thickness}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
        {centerLabel && (
          <text
            x={size / 2}
            y={size / 2}
            textAnchor="middle"
            dominantBaseline="central"
            className="rotate-90 fill-ink text-lg font-semibold tabular-nums"
            style={{ transformOrigin: "center" }}
          >
            {centerLabel}
          </text>
        )}
      </svg>

      <ul className="min-w-0 space-y-1.5">
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <li key={s.label} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: TONE_VAR[s.tone] }}
              />
              <span className="truncate text-ink-2">{s.label}</span>
              <span className="ml-auto shrink-0 tabular-nums text-ink">
                {s.value}
              </span>
              <span className="w-9 shrink-0 text-right tabular-nums text-ink-3">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type BarSeries = { label: string; value: number; tone: keyof typeof TONE_VAR };
export type BarGroup = { label: string; series: BarSeries[] };

/**
 * Grouped horizontal bars, same reasoning as `Donut` — plain CSS widths
 * rather than a charting library. Horizontal rather than vertical because bar
 * labels here are ad names and lead-source names, which run long; a vertical
 * bar chart would need to rotate them, and rotated axis labels are the
 * single most common charting-library readability complaint there is.
 */
export function BarChart({
  groups,
  legend,
}: {
  groups: BarGroup[];
  /** One entry per series key, in the order each group's `series` uses. */
  legend: { label: string; tone: keyof typeof TONE_VAR }[];
}) {
  const max = Math.max(1, ...groups.flatMap((g) => g.series.map((s) => s.value)));

  return (
    <div className="space-y-4">
      {legend.length > 1 && (
        <ul className="flex flex-wrap gap-3 text-xs">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: TONE_VAR[l.tone] }}
              />
              <span className="text-ink-2">{l.label}</span>
            </li>
          ))}
        </ul>
      )}

      <ul className="space-y-3">
        {groups.map((g) => (
          <li key={g.label}>
            <p className="mb-1 truncate text-xs text-ink-2">{g.label}</p>
            <div className="space-y-1">
              {g.series.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line/60">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, (s.value / max) * 100)}%`,
                        background: TONE_VAR[s.tone],
                      }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs tabular-nums text-ink-3">
                    {s.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Explicit empty state.
 *
 * Used wherever a metric has no data path yet. It deliberately shows nothing
 * numeric — a placeholder "0" or a demo figure on an operations dashboard is
 * worse than a blank, because it is indistinguishable from a real reading and
 * someone will make a call on it.
 */
export function Pending({ story, note }: { story: string; note?: string }) {
  return (
    <div className="rounded-md border border-dashed border-line px-3 py-4 text-center">
      <p className="text-xs text-ink-3">
        No data path yet — <span className="text-ink-2">{story}</span>
      </p>
      {note && <p className="mt-1 text-[11px] text-ink-3">{note}</p>}
    </div>
  );
}

/** Health maps to the three states `getClientHealth()` already returns. */
export function HealthBadge({
  status,
}: {
  status: "healthy" | "at-risk" | "critical";
}) {
  const tone = (
    { healthy: "ok", "at-risk": "warn", critical: "danger" } as const
  )[status];
  return <Badge tone={tone}>{status}</Badge>;
}
