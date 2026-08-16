import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { DarkScope } from "../dashboard/dark-scope";
import { SetterDashboard } from "./setter-dashboard";
import { getSetterMetrics, getSetterLeads } from "@/lib/dashboard/speed-to-lead";

export const dynamic = "force-dynamic";

export default async function SetterPage() {
  const session = await requireSession();

  const isSetterRole = ["tag_setter", "client_setter"].includes(session.hat);

  if (!session || (!isSetterRole && session.hat !== "tag_exec")) {
    return (
      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">Only setters can access this dashboard.</p>
      </div>
    );
  }

  const ghlLocationId = session.location || "";

  const [metrics, leads] = await Promise.all([
    getSetterMetrics(ghlLocationId, session.email || ""),
    getSetterLeads(ghlLocationId, session.email || ""),
  ]);

  return (
    <DarkScope>
      <div className="mx-auto max-w-7xl">
        <SetterDashboard
          ghlLocationId={ghlLocationId}
          setterEmail={session.email || ""}
          userRole={session.hat}
          initialMetrics={metrics}
          initialLeads={leads}
        />
      </div>
    </DarkScope>
  );
}
