import { requireSession } from "@/lib/auth/session";
import { devLocationId } from "@/lib/ghl/tokens";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();

  if (!session || !["client_owner", "client_manager"].includes(session.role)) {
    return (
      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">Only client owners and managers can view the dashboard.</p>
      </div>
    );
  }

  const locationId = devLocationId();
  if (!locationId) {
    return (
      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Setup needed</h2>
        <p className="mt-2 text-sm">
          No location configured. Set <code>GHL_LOCATION_ID</code> in{" "}
          <code>hub/.env.local</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
      </div>

      <div className="max-w-4xl rounded-lg border border-danger/30 bg-danger-tint p-6 text-danger">
        <h2 className="text-base font-semibold">Blocked on Meta setup</h2>
        <p className="mt-2 text-sm">
          Dashboard requires <code>Story 4.1</code> (Meta Business Manager + Marketing API setup).
          Once Austyn completes the Meta setup, the following will be available:
        </p>
        <ul className="mt-3 list-inside space-y-1 text-sm">
          <li>✗ Story 4.2 — Spend and delivery by ad</li>
          <li>✗ Story 4.3 — Funnel counts (leads, booked, showed, closed)</li>
          <li>✗ Story 4.4 — ROAS per ad</li>
          <li>✗ Story 4.5 — &ldquo;As of&rdquo; freshness indicator</li>
          <li>✓ Story 4.6 — Owner&rsquo;s calendar view (ready)</li>
        </ul>
      </div>

      {/* Placeholder sections for stories 4.2-4.6 */}
      <div className="space-y-4">
        <div className="rounded-lg border border-line bg-raised p-4">
          <h2 className="text-sm font-semibold text-ink-2">
            4.2 Spend and delivery by ad
          </h2>
          <p className="mt-1 text-xs text-ink-3">Awaiting Meta API setup</p>
        </div>

        <div className="rounded-lg border border-line bg-raised p-4">
          <h2 className="text-sm font-semibold text-ink-2">
            4.3 Funnel counts
          </h2>
          <p className="mt-1 text-xs text-ink-3">Awaiting Meta API setup</p>
        </div>

        <div className="rounded-lg border border-line bg-raised p-4">
          <h2 className="text-sm font-semibold text-ink-2">
            4.4 ROAS per ad
          </h2>
          <p className="mt-1 text-xs text-ink-3">Awaiting Meta API setup</p>
        </div>

        <div className="rounded-lg border border-line bg-raised p-4">
          <h2 className="text-sm font-semibold text-ink-2">
            4.5 Freshness indicator
          </h2>
          <p className="mt-1 text-xs text-ink-3">Awaiting Meta API setup</p>
        </div>

        <div className="rounded-lg border border-line bg-raised p-4">
          <h2 className="text-sm font-semibold text-ink-2">
            4.6 Owner&rsquo;s calendar
          </h2>
          <p className="mt-1 text-xs text-ink-3">Ready — awaiting implementation</p>
        </div>
      </div>
    </div>
  );
}
