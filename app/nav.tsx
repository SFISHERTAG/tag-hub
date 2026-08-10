"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth/roles";
import {
  PipelineIcon,
  TodayIcon,
  ContactsIcon,
  PortfolioIcon,
  DashboardIcon,
  FollowUpIcon,
  OnboardingIcon,
  AdminIcon,
  EscalationIcon,
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
    hats: ["tag_exec", "tag_sales", "tag_csm", "client_closer", "client_manager"],
  },
  {
    href: "/success",
    label: "Client success",
    icon: EscalationIcon,
    hats: ["tag_exec", "tag_csm"],
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    icon: PortfolioIcon,
    hats: ["tag_exec", "tag_csm", "tag_sales_manager"],
  },
  {
    href: "/onboarding",
    label: "Onboarding",
    icon: OnboardingIcon,
    hats: ["tag_exec", "tag_csm"],
  },
  {
    href: "/dashboard",
    label: "Performance",
    icon: DashboardIcon,
    hats: ["tag_exec", "tag_csm", "client_owner"],
  },
  {
    href: "/admin/tenants",
    label: "Admin",
    icon: AdminIcon,
    hats: ["tag_exec"],
  },
];

export function Nav({ hat }: { hat: Role }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => i.hats.includes(hat));

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {items.map(({ href, label, icon: Icon }) => {
        // "/" would otherwise match every route.
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-chrome-hover text-white"
                : "text-chrome-ink-2 hover:bg-chrome-hover hover:text-white"
            }`}
          >
            <Icon
              className={`shrink-0 transition-colors ${
                active ? "text-accent" : "text-chrome-ink-2 group-hover:text-white"
              }`}
            />
            {label}
            {active && (
              <span
                aria-hidden
                className="ml-auto h-4 w-0.5 rounded-full bg-accent"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
