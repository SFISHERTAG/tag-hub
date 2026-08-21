import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { DarkScope } from "../dashboard/dark-scope";
import { SetterDashboard } from "./setter-dashboard";
import { getSetterMetrics, getSetterLeads } from "@/lib/dashboard/speed-to-lead";

export const dynamic = "force-dynamic";

export default async function SetterPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const isSetterRole = ["tag_setter", "client_setter"].includes(session.currentRole);

  if (!isSetterRole && session.currentRole !== "tag_exec") {
    return (
      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">Only setters can access this dashboard.</p>
      </div>
    );
  }

  // Use first permitted location for this setter
  const ghlLocationId = session.locations[0] || "";

  // A failed fetch renders as an empty dashboard rather than a distinct error
  // state (see lib/api/errorInterceptor.ts) — the failure is still logged
  // server-side with full context now, instead of being indistinguishable
  // from "no leads today."
  const [metricsResult, leadsResult] = await Promise.all([
    getSetterMetrics(ghlLocationId, session.email || ""),
    getSetterLeads(ghlLocationId, session.email || ""),
  ]);
  const metrics = metricsResult.data ?? {
    totalLeadsToday: 0,
    contactedToday: 0,
    contactRate: 0,
    averageSpeedMinutes: 0,
    pendingCallbacks: 0,
    qualifiedLeads: 0,
    medianSpeedMinutes: 0,
  };
  const leads = leadsResult.data ?? [];

  return (
    <DarkScope>
      <div className="mx-auto max-w-7xl">
        <SetterDashboard
          ghlLocationId={ghlLocationId}
          setterEmail={session.email || ""}
          userRole={session.currentRole}
          initialMetrics={metrics}
          initialLeads={leads}
        />
      </div>
    </DarkScope>
  );
}
