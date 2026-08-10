import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getSession } from "@/lib/auth/session";
import {
  wearableHats,
  HAT_LABELS,
  HAT_DESCRIPTIONS,
} from "@/lib/auth/roles";
import { HatSwitcher } from "./hat-switcher";

export const metadata: Metadata = {
  title: "TAG Hub",
  description: "From ad spend to closed won, in one place.",
};

const NAV = [
  { href: "/", label: "Pipeline" },
  { href: "/today", label: "Today" },
  { href: "/contacts", label: "Contacts" },
];

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Chrome belongs to the signed-in app. Sign-in renders bare, so it never
  // shows navigation to routes the visitor cannot reach yet.
  const session = await getSession();

  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        {session ? (
          <div className="flex min-h-screen">
            {/* Left chrome — black, white text, gold active state */}
            <aside className="flex w-60 shrink-0 flex-col bg-black text-white">
              <div className="px-5 py-6">
                <div className="text-lg font-semibold tracking-tight">
                  <span className="text-[#ebc507]">TAG</span> Hub
                </div>
              </div>

              <div className="px-3 pb-4">
                <HatSwitcher
                  current={session.hat}
                  options={wearableHats(session.role).map((hat) => ({
                    value: hat,
                    label: HAT_LABELS[hat],
                    description: HAT_DESCRIPTIONS[hat],
                  }))}
                />
              </div>

              <nav className="flex flex-col gap-1 px-3">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-900 hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-auto space-y-2 px-5 py-4">
                <p className="truncate text-xs text-neutral-500">
                  {session.email ?? session.uid}
                </p>
                <form action="/api/auth/signout" method="post">
                  <button
                    type="submit"
                    className="text-xs text-neutral-400 underline-offset-2 transition-colors hover:text-white hover:underline"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              {/* Top chrome — black */}
              <header className="flex h-14 items-center border-b border-neutral-800 bg-black px-6">
                <span className="text-sm text-neutral-400">
                  Connected to GoHighLevel
                </span>
              </header>

              <main className="flex-1 overflow-x-auto p-6">{children}</main>
            </div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
