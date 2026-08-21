import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { getManualPage } from "@/lib/knowledge-base/db";
import { DarkScope } from "../../dashboard/dark-scope";
import { ManualBlocks } from "../manual-blocks";
import { TAG_STAFF_ROLES } from "../roles";

export const dynamic = "force-dynamic";

export default async function KnowledgeBasePagePage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
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

  const { pageId } = await params;
  const page = await getManualPage(pageId);
  if (!page) notFound();

  return (
    <DarkScope>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/knowledge-base" className="text-xs text-ink-3 hover:text-ink-2">
            ← Knowledge base
          </Link>
          <p className="mt-2 text-xs text-ink-3">
            {page.num} · {page.eyebrow}
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{page.title}</h1>
          <p className="mt-1 text-sm text-ink-2">{page.lede}</p>
          <p className="mt-1 text-xs text-ink-3">{page.status}</p>
        </div>

        <ManualBlocks blocks={page.blocks} />
      </div>
    </DarkScope>
  );
}
