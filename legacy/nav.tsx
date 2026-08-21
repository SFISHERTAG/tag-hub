"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ROLE_LIST, type Role } from "@/lib/auth/role-labels";
import {
  PipelineIcon,
  TodayIcon,
  ContactsIcon,
  PortfolioIcon,
  DashboardIcon,
  FollowUpIcon,
  OnboardingIcon,
  AdminIcon,
  UserAdminIcon,
  EscalationIcon,
  MoreIcon,
  CloseIcon,
  BookIcon,
  ScriptIcon,
} from "./icons";

/**
 * Navigation is filtered by hat, not by role.
 *
 * This is presentation only — a route absent from this list is still reachable
 * by URL, and every page does its own `requireSession()` check. Hiding a link
 * is a tidiness decision; the page's own guard is the security one. Conflating
 * the two is how a nav refactor turns into an access-control bug.
 */
const ITEMS: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hats: Role[];
}[] = [
  {
    href: "/",
    label: "Pipeline",
    icon: PipelineIcon,
    hats: ["tag_exec", "tag_sales", "tag_sales_manager", "client_manager", "client_closer"],
  },
  {
    href: "/today",
    label: "Today",
    icon: TodayIcon,
    hats: ["tag_exec", "tag_sales", "client_closer", "client_manager"],
  },
  {
    href: "/followup",
    label: "Follow-up",
    icon: FollowUpIcon,
    hats: ["tag_exec", "tag_sales", "client_closer", "client_manager"],
  },
  {
    href: "/contacts",
    label: "Contacts",
    icon: ContactsIcon,
    hats: ["tag_exec", "tag_sales", "tag_csm", "tag_csd", "client_closer", "client_manager"],
  },
  {
    href: "/success",
    label: "Client success",
    icon: EscalationIcon,
    hats: ["tag_exec", "tag_csm", "tag_csd"],
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    icon: PortfolioIcon,
    hats: ["tag_exec", "tag_csm", "tag_csd", "tag_sales_manager"],
  },
  {
    href: "/setter",
    label: "Setter",
    icon: TodayIcon,
    hats: ["tag_exec", "tag_setter", "tag_setter_manager", "client_setter", "client_setter_manager"],
  },
  {
    href: "/closer/flow",
    label: "FLOW",
    icon: ScriptIcon,
    hats: ["tag_exec", "client_closer", "client_setter", "tag_setter", "tag_sales"],
  },
  {
    href: "/onboarding",
    label: "Onboarding",
    icon: OnboardingIcon,
    hats: ["tag_exec", "tag_csm", "tag_csd"],
  },
  {
    href: "/courses",
    label: "Training",
    icon: BookIcon,
    hats: [
      "tag_exec",
      "tag_csm",
      "tag_csd",
      "tag_sales",
      "tag_sales_manager",
      "client_owner",
      "client_closer",
      "client_manager",
    ],
  },
  {
    href: "/dashboard",
    label: "Performance",
    icon: DashboardIcon,
    hats: ["tag_exec", "tag_csm", "tag_csd", "client_owner"],
  },
  {
    href: "/admin/tenants",
    label: "Admin",
    icon: AdminIcon,
    hats: ["admin"],
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: UserAdminIcon,
    hats: ["admin"],
  },
  {
    href: "/admin/courses",
    label: "Courses",
    icon: BookIcon,
    hats: ["admin"],
  },
];

/**
 * No role may end up with an empty bar.
 *
 * `tag_csd` was on none of the items above — a real, documented role whose
 * whole job is the CS department, and a CS Director signing in got a blank
 * nav and had to type every URL by hand. Nothing caught it because the list
 * is a filter, and filtering to nothing is not an error.
 *
 * This is a nav-completeness check, not an access check: the comment at the
 * top of this file still holds, every page guards itself.
 */
const ROLES_WITH_NO_NAV = ROLE_LIST.filter((role) => !ITEMS.some((item) => item.hats.includes(role)));
if (ROLES_WITH_NO_NAV.length > 0) {
  throw new Error(
    `Roles with an empty navigation bar: ${ROLES_WITH_NO_NAV.join(", ")}. ` +
      "Add them to at least one entry in app/nav.tsx's ITEMS.",
  );
}

/**
 * How many tabs sit directly on the bar before the rest fold into "More".
 *
 * Four plus the More tab itself is five slots, which is the point mobile tab
 * bars start crowding — TAG's own hats range from 1 item (client_owner today)
 * to all 9 (tag_exec), so the split has to hold at both ends. Order is
 * `ITEMS`' own order, already read top-to-bottom as most- to least-reached-for.
 */
const PRIMARY_COUNT = 4;

function routeMatches(href: string, pathname: string): boolean {
  // "/" would otherwise match every route.
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Nav({ role }: { role: Role }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // A route change is the user having chosen — the sheet has done its job.
  // Reset during render rather than in an effect: an effect would close the
  // sheet one paint late, showing it briefly pinned over the page it just
  // navigated away from.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMoreOpen(false);
  }

  const items = ITEMS.filter((i) => i.hats.includes(role));

  const primary = items.slice(0, PRIMARY_COUNT);
  const overflow = items.slice(PRIMARY_COUNT);
  const hasOverflow = overflow.length > 0;
  const overflowActive = overflow.some((i) => routeMatches(i.href, pathname));

  return (
    <>
      {hasOverflow && moreOpen && (
        <div
          aria-hidden
          onClick={() => setMoreOpen(false)}
          className="fixed inset-0 z-40 bg-black/40"
        />
      )}

      {hasOverflow && moreOpen && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50 px-2 pb-2">
          <div className="mx-auto max-w-md overflow-hidden rounded-xl border border-chrome-line bg-chrome lift-lg">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs font-medium tracking-wide text-chrome-ink-2 uppercase">
                More
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-chrome-ink-2 hover:bg-chrome-hover hover:text-white"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1 p-2">
              {overflow.map(({ href, label, icon: Icon }) => {
                const active = routeMatches(href, pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex flex-col items-center gap-1 rounded-lg py-3 text-center transition-colors ${
                      active ? "bg-chrome-hover" : "hover:bg-chrome-hover"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${active ? "text-accent" : "text-chrome-ink-2"}`}
                    />
                    <span
                      className={`text-[10px] leading-tight font-medium ${
                        active ? "text-accent" : "text-chrome-ink-2"
                      }`}
                    >
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-chrome-line bg-chrome pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex h-14 max-w-3xl items-stretch">
          {primary.map(({ href, label, icon: Icon }) => {
            const active = routeMatches(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 transition-colors"
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-accent"
                  />
                )}
                <Icon
                  className={`h-5 w-5 transition-colors ${
                    active ? "text-accent" : "text-chrome-ink-2"
                  }`}
                />
                <span
                  className={`truncate px-1 text-[10px] leading-tight font-medium transition-colors ${
                    active ? "text-accent" : "text-chrome-ink-2"
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          {hasOverflow && (
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 transition-colors"
            >
              {overflowActive && !moreOpen && (
                <span
                  aria-hidden
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-accent"
                />
              )}
              <MoreIcon
                className={`h-5 w-5 transition-colors ${
                  moreOpen || overflowActive ? "text-accent" : "text-chrome-ink-2"
                }`}
              />
              <span
                className={`text-[10px] leading-tight font-medium transition-colors ${
                  moreOpen || overflowActive ? "text-accent" : "text-chrome-ink-2"
                }`}
              >
                More
              </span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
