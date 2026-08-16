import { getPhase3Status } from "@/lib/dashboard/phase3-status";

export const dynamic = "force-dynamic";

export default async function TestPhase3Page() {
  const testLocationId = "test_client_phase3";
  const phase3Status = await getPhase3Status(testLocationId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-2 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Phase 3 Status Test</h1>
          <p className="text-ink-3">Testing Postgres integration + Phase 3 status display</p>
        </div>

        {phase3Status ? (
          <div className="space-y-6">
            <div className="rounded-lg border border-line bg-sunken p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-ink-3">Location ID</p>
                  <p className="font-mono text-sm">{phase3Status.locationId}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-3">Current Status</p>
                  <p className="text-lg font-semibold capitalize">{phase3Status.status}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-line space-y-2">
                <p className="text-xs text-ink-3">Last Event</p>
                <p className="font-mono text-sm text-ink-2">{phase3Status.lastEvent}</p>
              </div>

              {phase3Status.lastEventTime && (
                <div className="pt-4 border-t border-line space-y-2">
                  <p className="text-xs text-ink-3">Last Updated</p>
                  <p className="text-sm">
                    {new Date(phase3Status.lastEventTime).toLocaleString()}
                  </p>
                </div>
              )}

              {phase3Status.hasMetaAccount !== undefined && (
                <div className="pt-4 border-t border-line space-y-2">
                  <p className="text-xs text-ink-3">Meta Account</p>
                  <p className="text-sm">
                    {phase3Status.hasMetaAccount ? "✅ Existing account" : "📋 New account"}
                  </p>
                </div>
              )}

              {phase3Status.errorMessage && (
                <div className="pt-4 border-t border-line space-y-2">
                  <p className="text-xs text-danger">Error</p>
                  <p className="text-sm text-danger">{phase3Status.errorMessage}</p>
                </div>
              )}
            </div>

            {/* Status Timeline */}
            <div className="space-y-3">
              <h2 className="font-semibold text-sm">Status Journey</h2>
              <div className="space-y-2">
                {phase3Status.status === "pending" && (
                  <div className="flex items-center gap-2 text-sm text-ink-3">
                    <div className="w-2 h-2 rounded-full bg-ink-3"></div>
                    Phase 3 not yet started
                  </div>
                )}
                {["in_progress", "meta_access_requested", "setup_guide_sent", "complete"].includes(
                  phase3Status.status
                ) && (
                  <div className="flex items-center gap-2 text-sm text-ok">
                    <div className="w-2 h-2 rounded-full bg-ok"></div>
                    ✓ Detected Meta account status
                  </div>
                )}
                {["meta_access_requested", "setup_guide_sent", "complete"].includes(
                  phase3Status.status
                ) && (
                  <div className="flex items-center gap-2 text-sm text-ok">
                    <div className="w-2 h-2 rounded-full bg-ok"></div>
                    ✓ Routed to appropriate action
                  </div>
                )}
                {phase3Status.status === "complete" && (
                  <div className="flex items-center gap-2 text-sm text-ok">
                    <div className="w-2 h-2 rounded-full bg-ok"></div>
                    ✓ Meta account setup complete
                  </div>
                )}
                {phase3Status.status === "error" && (
                  <div className="flex items-center gap-2 text-sm text-danger">
                    <div className="w-2 h-2 rounded-full bg-danger"></div>
                    ✗ Error occurred
                  </div>
                )}
              </div>
            </div>

            {/* Query Result */}
            <div className="rounded-lg border border-ok/30 bg-ok-tint/10 p-4">
              <p className="text-xs text-ok font-semibold mb-2">✅ Postgres Connection Successful</p>
              <p className="text-xs text-ok-2">
                Data retrieved from automation_logs table for location_id: {testLocationId}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-warn/30 bg-warn-tint/10 p-6 text-center">
            <p className="text-sm text-warn">No Phase 3 data found for test location</p>
            <p className="text-xs text-warn-2 mt-2">Create test data first with:</p>
            <p className="text-xs font-mono text-warn-2 mt-1">INSERT INTO automation_logs ...</p>
          </div>
        )}

        {/* Technical Info */}
        <div className="rounded-lg border border-line bg-sunken p-4 space-y-2">
          <p className="text-xs text-ink-3 font-semibold">Technical Details</p>
          <ul className="text-xs text-ink-3 space-y-1 list-disc list-inside">
            <li>Database: tag_automation (Postgres)</li>
            <li>Table: automation_logs</li>
            <li>Test Location: {testLocationId}</li>
            <li>Server-side data fetch: lib/dashboard/phase3-status.ts</li>
            <li>Postgres queries: getPhase3Status(), getPhase3History()</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
