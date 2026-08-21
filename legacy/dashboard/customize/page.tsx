import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { loadDashboardConfig } from "@/lib/dashboard/customization";
import { getAvailableWidgets, WIDGET_REGISTRY } from "@/lib/dashboard/widget-definitions";
import { CustomizeClient } from "./customize-client";

export const dynamic = "force-dynamic";

export default async function CustomizePage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const config = await loadDashboardConfig(session.uid, session.currentRole);
  const availableWidgets = getAvailableWidgets(session.currentRole);
  const currentPageId = config.pages[config.currentPage]?.id;

  if (!currentPageId) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-canvas px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Customize Dashboard</h1>
          <p className="mt-1 text-sm text-chrome-ink-2">
            Arrange and manage widgets for your {session.currentRole} dashboard
          </p>
        </div>

        <CustomizeClient
          config={config}
          availableWidgets={availableWidgets}
          currentPageId={currentPageId}
          currentRole={session.currentRole}
        />
      </div>
    </div>
  );
}
