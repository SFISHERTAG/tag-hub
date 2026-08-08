import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "TAG Success Hub",
  description: "Pipeline, appointments, and notes for Tax Advisory Growth.",
};

const NAV = [
  { href: "/", label: "Pipeline" },
  { href: "/today", label: "Today" },
  { href: "/contacts", label: "Contacts" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <div className="flex min-h-screen">
          {/* Left chrome — black, white text, gold active state */}
          <aside className="flex w-60 shrink-0 flex-col bg-black text-white">
            <div className="px-5 py-6">
              <div className="text-lg font-semibold tracking-tight">
                <span className="text-[#ebc507]">TAG</span> Success Hub
              </div>
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

            <div className="mt-auto px-5 py-4 text-xs text-neutral-500">
              Tax Advisory Growth
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
      </body>
    </html>
  );
}
