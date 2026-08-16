/**
 * Symbols.
 *
 * Drawn on a 24 box with a 2 stroke, `currentColor`, no fills. That geometry is
 * lucide's, which is what CCE ships — matching it means a glyph added here and a
 * glyph borrowed from there sit at the same weight instead of one looking
 * hand-drawn next to the other. Still inline rather than a package: the set is
 * small, and components inherit colour from their nav item's own state without a
 * prop.
 *
 * Size is the caller's decision, as with lucide: pass `h-4 w-4` for text-side
 * marks, `h-5 w-5` for the nav bar. The 24 in the attributes is the intrinsic
 * box, not the rendered size, so a caller that forgets gets 24px rather than
 * something unbounded.
 */

type IconProps = { className?: string };

function Svg({
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? "h-4 w-4 shrink-0"}
    >
      {children}
    </svg>
  );
}

/** Pipeline — kanban columns */
export const PipelineIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="5" height="16" rx="1.5" />
    <rect x="9.5" y="4" width="5" height="10.5" rx="1.5" />
    <rect x="16" y="4" width="5" height="13.5" rx="1.5" />
  </Svg>
);

/** Today — a day on a calendar */
export const TodayIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
    <path d="M3.5 9.5h17M8 2.5v4M16 2.5v4" />
    <circle cx="12" cy="15" r="1.75" fill="currentColor" stroke="none" />
  </Svg>
);

/** Contacts — people */
export const ContactsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 5a3.5 3.5 0 0 1 0 6.4M18 20a6.4 6.4 0 0 0-2.4-5" />
  </Svg>
);

/** Portfolio — every client at once */
export const PortfolioIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </Svg>
);

/** Dashboard — performance */
export const DashboardIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 20h18" />
    <path d="M6 20v-6.75M12 20V6M18 20v-9.75" />
  </Svg>
);

/** Follow-up — flagged for action */
export const FollowUpIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 21.5V3.5" />
    <path d="M5.5 4.5h11.5l-2.25 3.75L17 12.5H5.5z" />
  </Svg>
);

/** Onboarding — checklist */
export const OnboardingIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.5 5.25h12M8.5 12h12M8.5 18.75h12" />
    <path d="M3.5 5.4l1.35 1.35 2-2.4M3.5 12.15l1.35 1.35 2-2.4" />
    <circle cx="4.5" cy="18.75" r="1.35" />
  </Svg>
);

/** Admin — permissions */
export const AdminIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.5l7.5 3v6.15c0 4.05-3 7.575-7.5 9.6-4.5-2.025-7.5-5.55-7.5-9.6V5.5z" />
    <path d="M9 12l2.1 2.1L15.5 9.75" />
  </Svg>
);

/** User admin — a person plus a settings badge, distinct from Contacts' plain people mark */
export const UserAdminIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9.5" cy="7.5" r="3.5" />
    <path d="M3.5 20a6 6 0 0 1 12 0" />
    <circle cx="18.5" cy="17.5" r="3" />
    <path d="M18.5 13v1.1M18.5 20.9V22M22 17.5h-1.1M16.1 17.5H15M20.7 14.8l-.8.8M17.1 19.9l-.8.8M20.7 20.2l-.8-.8M17.1 15.1l-.8-.8" />
  </Svg>
);

/** Escalation — needs attention */
export const EscalationIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5L21.75 20.25H2.25z" />
    <path d="M12 9.75v4.75" />
    <circle cx="12" cy="17.4" r="1.15" fill="currentColor" stroke="none" />
  </Svg>
);

export const ChevronIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.75 9.5L12 14.75 17.25 9.5" />
  </Svg>
);

export const SunIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2.25v2.1M12 19.65v2.1M21.75 12h-2.1M4.35 12H2.25M18.9 5.1l-1.5 1.5M6.6 17.4l-1.5 1.5M18.9 18.9l-1.5-1.5M6.6 6.6l-1.5-1.5" />
  </Svg>
);

export const MoonIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.25 14.4A8.6 8.6 0 0 1 9.6 3.75a8.6 8.6 0 1 0 10.65 10.65z" />
  </Svg>
);

/**
 * More — the bottom bar's overflow.
 *
 * Filled dots rather than stroked circles: at 20px a 2-stroke ring of this
 * radius closes up into a blob, so the fill is what keeps three marks reading as
 * three.
 */
export const MoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </Svg>
);

/** Close — dismiss a sheet or dialog */
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

/** Bug — report a problem */
export const BugIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="7" y="8" width="10" height="11" rx="5" />
    <path d="M9.5 8a2.5 2.5 0 0 1 5 0" />
    <path d="M12 8v11M3.5 13h3.5M17 13h3.5M4.5 8.5l2.5 2M19.5 8.5l-2.5 2M4.5 19l2.7-2.3M19.5 19l-2.7-2.3" />
  </Svg>
);

/** Sign out — leave the session */
export const SignOutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 4.5h3.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H15" />
    <path d="M10.5 8L6.5 12l4 4M6.5 12H15" />
  </Svg>
);

/** Book — courses and training */
export const BookIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.5a2.5 2.5 0 0 1-2.5-2.5v-12A2.5 2.5 0 0 1 6.5 2z" />
  </Svg>
);
