"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/hooks";
import { type Phase3Progress } from "@/lib/dashboard/phase3-status";
import { getPhase3StatusForClient } from "../csm-dashboard/actions/get-phase3-status";

export function Phase3StatusScreen() {
  const { user } = useAuth();
  const [phase3, setPhase3] = useState<Phase3Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.location_id) return;

    async function fetchStatus() {
      setLoading(true);
      setError(null);
      try {
        const status = await getPhase3StatusForClient(user.location_id);
        setPhase3(status);
      } catch (err) {
        setError("Failed to load status");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    // Poll for updates every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    fetchStatus();
    return () => clearInterval(interval);
  }, [user?.location_id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-ink-3">Loading Meta account setup status...</p>
      </div>
    );
  }

  if (!phase3) {
    return (
      <div className="rounded-lg border border-line bg-sunken p-6 text-center">
        <p className="text-sm text-ink-3">Meta account setup hasn't started yet</p>
        <p className="text-xs text-ink-3 mt-2">This will begin after you complete Phase 2 (intake form)</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Phase 3: Meta Account Setup</h1>
        <p className="text-sm text-ink-3">Connect your Meta Ads account to launch campaigns</p>
      </div>

      <Phase3StatusDisplay phase3={phase3} />

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger-tint p-4">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}
    </div>
  );
}

function Phase3StatusDisplay({ phase3 }: { phase3: Phase3Progress }) {
  const statusSteps = [
    {
      step: 1,
      title: "Check Account Status",
      description: "We check if you have an existing Meta ad account",
      icon: "🔍",
      active: ["in_progress", "meta_access_requested", "setup_guide_sent", "complete", "error"].includes(
        phase3.status
      ),
    },
    {
      step: 2,
      title: phase3.hasMetaAccount ? "Request System Access" : "Create Account",
      description: phase3.hasMetaAccount
        ? "Grant our system user access to your Meta Ads account"
        : "Create a new Meta Ads account",
      icon: phase3.hasMetaAccount ? "🔐" : "✨",
      active: ["meta_access_requested", "complete"].includes(phase3.status) || phase3.hasMetaAccount,
      complete: phase3.status === "complete",
    },
    {
      step: 3,
      title: "Launch Campaigns",
      description: "Create and manage Meta ad campaigns",
      icon: "🚀",
      active: phase3.status === "complete",
      complete: phase3.status === "complete",
    },
  ];

  return (
    <div className="space-y-4">
      {statusSteps.map((statusStep, idx) => (
        <div key={statusStep.step}>
          <div
            className={`rounded-lg border p-4 ${
              statusStep.active ? "border-ok/30 bg-ok-tint/10" : "border-line bg-sunken"
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`rounded-full w-10 h-10 flex items-center justify-center text-xl flex-shrink-0 ${
                  statusStep.complete
                    ? "bg-ok text-white"
                    : statusStep.active
                      ? "bg-ok-tint text-ok border border-ok/30"
                      : "bg-ink-tint text-ink-3 border border-line"
                }`}
              >
                {statusStep.complete ? "✓" : statusStep.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-sm">{statusStep.title}</h3>
                <p className="text-xs text-ink-3 mt-1">{statusStep.description}</p>

                {/* Status-specific content */}
                {statusStep.step === 2 && phase3.status === "meta_access_requested" && (
                  <div className="mt-3 p-3 rounded-lg bg-warn-tint/30 border border-warn/30">
                    <p className="text-xs text-warn font-medium">Action required from you</p>
                    <ol className="text-xs text-warn mt-2 space-y-1 list-decimal list-inside">
                      <li>Go to Meta Ads Manager</li>
                      <li>Navigate to Settings → Users and Permissions → System Users</li>
                      <li>Grant the system user: Ads Manager, ads_management, ads_read permissions</li>
                      <li>Reply to the email confirmation when complete</li>
                    </ol>
                  </div>
                )}

                {statusStep.step === 2 && phase3.status === "setup_guide_sent" && (
                  <div className="mt-3 p-3 rounded-lg bg-warn-tint/30 border border-warn/30">
                    <p className="text-xs text-warn font-medium">Action required from you</p>
                    <p className="text-xs text-warn mt-2">
                      Follow the setup guide we sent to your email. Reply with your Meta ad account ID once created.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {idx < statusSteps.length - 1 && (
            <div className="flex justify-center py-2">
              <div className={`h-6 border-l ${statusStep.active ? "border-ok" : "border-line"}`} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
