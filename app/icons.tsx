/**
 * Symbols.
 *
 * Deliberately plain: 16px box, 1.5 stroke, `currentColor`, no fills. They read
 * as marks beside a label rather than as illustration, which is what keeps a
 * dense nav quiet. Inline rather than an icon package — nine glyphs is not worth
 * a dependency, and shipping them as components means they inherit colour from
 * the nav item's own state without a prop.
 */

type IconProps = { className?: string };

function Svg({
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? "shrink-0"}
    >
      {children}
    </svg>
  );
}

/** Pipeline — kanban columns */
export const PipelineIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="1.75" y="2.75" width="3.5" height="10.5" rx="1" />
    <rect x="6.25" y="2.75" width="3.5" height="7" rx="1" />
    <rect x="10.75" y="2.75" width="3.5" height="9" rx="1" />
  </Svg>
);

/** Today — a day on a calendar */
export const TodayIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="1.5" />
    <path d="M2.25 6.25h11.5M5.5 1.75v2.5M10.5 1.75v2.5" />
    <circle cx="8" cy="10" r="1.15" fill="currentColor" stroke="none" />
  </Svg>
);

/** Contacts — people */
export const ContactsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="5.5" r="2.5" />
    <path d="M1.75 13.5a4.25 4.25 0 0 1 8.5 0" />
    <path d="M10.5 3.4a2.5 2.5 0 0 1 0 4.2M11.75 13.5a4.3 4.3 0 0 0-1.6-3.35" />
  </Svg>
);

/** Portfolio — every client at once */
export const PortfolioIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </Svg>
);

/** Dashboard — performance */
export const DashboardIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 13.5h12" />
    <path d="M4 13.5V9M8 13.5V4M12 13.5V6.5" />
  </Svg>
);

/** Follow-up — flagged for action */
export const FollowUpIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.75 14.25V2.25" />
    <path d="M3.75 3h7.5l-1.5 2.5L11.25 8h-7.5z" />
  </Svg>
);

/** Onboarding — checklist */
export const OnboardingIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.75 3.5h8M5.75 8h8M5.75 12.5h8" />
    <path d="M2.25 3.6l.9.9 1.35-1.6M2.25 8.1l.9.9 1.35-1.6" />
    <circle cx="3" cy="12.5" r="0.9" />
  </Svg>
);

/** Admin — permissions */
export const AdminIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 1.75l5 2v4.1c0 2.7-2 5.05-5 6.4-3-1.35-5-3.7-5-6.4V3.75z" />
    <path d="M6 8l1.4 1.4L10.25 6.5" />
  </Svg>
);

/** Escalation — needs attention */
export const EscalationIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 2.25L14.5 13.5h-13z" />
    <path d="M8 6.5v3.25" />
    <circle cx="8" cy="11.6" r="0.75" fill="currentColor" stroke="none" />
  </Svg>
);

export const ChevronIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 6.25L8 9.75l3.5-3.5" />
  </Svg>
);

export const SunIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.5v1.4M8 13.1v1.4M14.5 8h-1.4M2.9 8H1.5M12.6 3.4l-1 1M4.4 11.6l-1 1M12.6 12.6l-1-1M4.4 4.4l-1-1" />
  </Svg>
);

export const MoonIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1z" />
  </Svg>
);
