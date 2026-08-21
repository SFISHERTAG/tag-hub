import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { listManualPages } from "@/lib/knowledge-base/db";

export const dynamic = "force-dynamic";

export default async function KnowledgeBaseAdminPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  if (!hasAnyRole(session.currentRole, ["admin"])) {
    return (
      <div className="max-w-2xl rounded-lg border border-danger/30 bg-danger-tint p-6 text-danger">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">Only admins can edit the knowledge base.</p>
      </div>
    );
  }

  const pages = await listManualPages();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Knowledge base</h1>
        <span className="text-sm text-ink-3">
          {pages.length} {pages.length === 1 ? "page" : "pages"}
        </span>
      </div>

      <div className="divide-y divide-line rounded-lg border border-line">
        {pages.map((page) => (
          <Link
            key={page.id}
            href={`/admin/knowledge-base/${page.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-hover"
          >
            <div>
              <p className="text-sm font-medium text-ink">{page.title}</p>
              <p className="text-xs text-ink-3">{page.eyebrow}</p>
            </div>
            <span className="font-mono text-xs text-ink-3">{page.num}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
