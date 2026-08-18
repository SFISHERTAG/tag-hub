import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { DarkScope } from "../dashboard/dark-scope";
import { CSMPortfolio } from "./csm-portfolio";

export const dynamic = "force-dynamic";

export default async function CSMDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/signin");
  const { view } = await searchParams;

  // Only CSMs and managers can access
  if (!["tag_csm", "tag_exec", "tag_sales_manager"].includes(session.currentRole)) {
    return (
      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">Only CSMs can access this dashboard.</p>
      </div>
    );
  }

  return (
    <DarkScope>
      <div className="mx-auto max-w-7xl">
        <CSMPortfolio
          csmEmail={session.email || ""}
          userRole={session.currentRole}
          initialView={view === "escalations" ? "escalations" : undefined}
        />
      </div>
    </DarkScope>
  );
}
