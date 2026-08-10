import type { Metadata } from "next";
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
          <div className="flex min-h-screen">
            {/* Rail — black in both themes. See globals.css for why. */}
            <aside className="flex w-60 shrink-0 flex-col border-r border-chrome-line bg-chrome text-white">
              <div className="px-5 py-5">
                <Logo />
              </div>

              <div className="px-3 pb-3">
                <HatSwitcher
                  current={session.hat}
                  options={wearableHats(session.role).map((hat) => ({
                    value: hat,
                    label: HAT_LABELS[hat],
                    description: HAT_DESCRIPTIONS[hat],
                  }))}
                />
              </div>

              <Nav hat={session.hat} />

              <div className="mt-auto space-y-3 px-3 py-4">
                <ThemeToggle />
                <div className="space-y-1.5 px-2">
                  <p className="truncate text-xs text-chrome-ink-2">
                    {session.email ?? session.uid}
                  </p>
                  <form action="/api/auth/signout" method="post">
                    <button
                      type="submit"
                      className="text-xs text-chrome-ink-2 underline-offset-2 transition-colors hover:text-white hover:underline"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex h-12 shrink-0 items-center gap-3 border-b border-chrome-line bg-chrome px-6">
                <span className="flex items-center gap-2 text-xs text-chrome-ink-2">
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 rounded-full bg-ok"
                  />
                  Connected to GoHighLevel
                </span>
              </header>

              <main className="flex-1 overflow-x-auto bg-canvas p-6">
                {children}
              </main>
            </div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
