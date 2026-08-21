"use client";

import Link from "next/link";
import type { DashboardPage } from "@/lib/dashboard/widget";

export function PageTabs({
  pages,
  currentPageId,
}: {
  pages: DashboardPage[];
  currentPageId: string;
}) {
  return (
    <div className="flex gap-2 border-b border-chrome-line pb-4">
      {pages.map((page) => (
        <Link
          key={page.id}
          href={`/dashboard?page=${page.id}`}
          className={`px-4 py-2 rounded-t-md font-medium transition-colors ${
            page.id === currentPageId
              ? "bg-chrome text-white border-b-2 border-accent"
              : "text-chrome-ink-2 hover:text-chrome-ink"
          }`}
        >
          {page.icon && <span className="mr-2">{page.icon}</span>}
          {page.title}
        </Link>
      ))}
    </div>
  );
}
