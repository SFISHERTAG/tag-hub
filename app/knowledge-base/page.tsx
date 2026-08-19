import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { listManualPages } from "@/lib/knowledge-base/db";
import { DarkScope } from "../dashboard/dark-scope";
import { TAG_STAFF_ROLES } from "./roles";

export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  if (!hasAnyRole(session.currentRole, TAG_STAFF_ROLES)) {
    return (
      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">Only TAG staff can access the knowledge base.</p>
      </div>
    );
  }

  const pages = await listManualPages();

  return (
    <DarkScope>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Knowledge base</h1>
          <span className="text-sm text-ink-3">TAG CSM Operating Manual</span>
        </div>

        <div className="divide-y divide-line rounded-lg border border-line">
          {pages.map((page) => (
            <Link
              key={page.id}
              href={`/knowledge-base/${page.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-hover"
            >
              <div>
                <p className="text-xs text-ink-3">
                  {page.num} · {page.eyebrow}
                </p>
                <p className="text-sm font-medium text-ink">{page.title}</p>
              </div>
              <span className="shrink-0 text-xs text-ink-3">{page.status}</span>
            </Link>
          ))}
        </div>
      </div>
    </DarkScope>
  );
}
