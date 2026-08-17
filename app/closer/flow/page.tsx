import { requireSession } from "@/lib/auth/session";
import { getLocationForDashboard } from "@/lib/dashboard/location-selection";
import { getFullFramework } from "@/lib/flow/db";
import { FlowFrameworkView } from "./flow-framework-view";

export const dynamic = "force-dynamic";

const ALLOWED_HATS = [
  "tag_exec",
  "client_closer",
  "client_setter",
  "tag_setter",
  "tag_sales",
];

export default async function FlowPage() {
  const session = await requireSession();

  if (!ALLOWED_HATS.includes(session.hat)) {
    return (
      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">Only closers and setters can access the FLOW framework.</p>
      </div>
    );
  }

  const orgId = getLocationForDashboard(session);
  const framework = await getFullFramework(orgId);

  return (
    <div className="mx-auto max-w-3xl">
      <FlowFrameworkView orgId={orgId} initialFramework={framework} />
    </div>
  );
}
