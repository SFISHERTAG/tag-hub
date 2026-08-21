import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { getManualPage } from "@/lib/knowledge-base/db";
import { ManualPageEditor } from "./manual-page-editor";

export const dynamic = "force-dynamic";

export default async function KnowledgeBasePageAdminPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
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

  const { pageId } = await params;
  const page = await getManualPage(pageId);
  if (!page) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/knowledge-base" className="text-xs text-ink-3 hover:text-ink-2">
          ← Knowledge base
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{page.title}</h1>
      </div>

      <ManualPageEditor pageId={pageId} page={page} />
    </div>
  );
}
