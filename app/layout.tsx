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
import { Nav } from "./nav";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "./logo";
import { SignOutIcon } from "./icons";

export const metadata: Metadata = {
  title: "TAG Hub",
  description: "From ad spend to closed won, in one place.",
  // Same file as the rail lockup — one asset, so replacing the brand mark is
  // replacing one file rather than remembering there was a second copy.
  icons: {
    icon: "/lion.png",
    apple: "/lion.png",
  },
};

/**
 * Sets `data-theme` before first paint.
 *
 * This has to be a blocking inline script, not an effect. React runs effects
 * after paint, so a stored dark preference applied in `useEffect` shows one
 * white frame on every navigation — the flash is worst on the screen a
 * dark-mode user looks at most. Reading localStorage synchronously here costs
 * well under a millisecond and removes it entirely.
 */
const THEME_SCRIPT = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') {
    document.documentElement.setAttribute('data-theme', t);
  }
} catch (e) {}
`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Chrome belongs to the signed-in app. Sign-in renders bare, so it never
  // shows navigation to routes the visitor cannot reach yet.
  const session = await getSession();

  return (
    // suppressHydrationWarning: browser extensions write attributes onto <html>
    // before React hydrates — Scribe adds data-scribe-recorder-ready, password
    // managers and theme switchers do similar. The server cannot know about
    // them, so React reports a mismatch we can neither cause nor fix. This
    // covers this element's own attributes only, not children, so a real
    // mismatch inside the app still surfaces. The theme script below writes
    // data-theme onto this same element and is covered for the same reason.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-canvas text-ink antialiased">
        {session ? (
          <div className="min-h-screen">
            {/* Top bar and bottom nav — black in both themes. See globals.css for why. */}
            <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-chrome-line bg-chrome px-4 text-white">
              <Link href="/" className="shrink-0">
                <Logo width={112} />
              </Link>

              <span className="hidden flex-1 items-center justify-center gap-2 text-xs text-chrome-ink-2 sm:flex">
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full bg-ok"
                />
                Connected to GoHighLevel
              </span>
              <span className="flex-1 sm:hidden" />

              <div className="flex shrink-0 items-center gap-2">
                {wearableHats(session.role).length > 1 && (
                  <div className="w-44">
                    <HatSwitcher
                      current={session.hat}
                      options={wearableHats(session.role).map((hat) => ({
                        value: hat,
                        label: HAT_LABELS[hat],
                        description: HAT_DESCRIPTIONS[hat],
                      }))}
                    />
                  </div>
                )}

                <ThemeToggle />

                <p className="hidden max-w-[10rem] truncate text-xs text-chrome-ink-2 md:block">
                  {session.email ?? session.uid}
                </p>

                <form action="/api/auth/signout" method="post">
                  <button
                    type="submit"
                    aria-label="Sign out"
                    title="Sign out"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-chrome-ink-2 transition-colors hover:bg-chrome-hover hover:text-white"
                  >
                    <SignOutIcon className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </header>

            <Nav hat={session.hat} />

            <main className="min-h-screen overflow-x-auto bg-canvas px-4 pt-[calc(3.5rem+1.5rem)] pb-[calc(3.5rem+1.5rem+env(safe-area-inset-bottom))] sm:px-6">
              {children}
            </main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
