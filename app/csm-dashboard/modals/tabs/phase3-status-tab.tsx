"use client";

import { useEffect, useState } from "react";
import { type ClientData } from "@/lib/dashboard/csm-clients";
import { type Phase3Progress } from "@/lib/dashboard/phase3-status";
import { getPhase3StatusForClient } from "../../actions/get-phase3-status";

interface Phase3StatusTabProps {
  client: ClientData;
}

export function Phase3StatusTab({ client }: Phase3StatusTabProps) {
  const [phase3, setPhase3] = useState<Phase3Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPhase3Status() {
      setLoading(true);
      setError(null);
      try {
        const data = await getPhase3StatusForClient(client.id);
        setPhase3(data);
      } catch (err) {
        setError("Failed to load Phase 3 status");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchPhase3Status();
  }, [client.id]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-ink-3">Loading Phase 3 status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger-tint p-4">
        <p className="text-sm text-danger">{error}</p>
      </div>
    );
  }

  if (!phase3) {
    return (
      <div className="rounded-lg border border-line bg-sunken p-6 text-center">
        <p className="text-sm text-ink-3">Phase 3 not yet started</p>
        <p className="text-xs text-ink-3 mt-2">Phase 3 begins after Phase 2 (intake form) is complete</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Phase3StatusCard phase3={phase3} />
    </div>
  );
}

function Phase3StatusCard({ phase3 }: { phase3: Phase3Progress }) {
  const statusConfig = {
    pending: {
      label: "Pending",
      color: "bg-warn-tint text-warn border-warn/30",
      icon: "⏳",
    },
    in_progress: {
      label: "In Progress",
      color: "bg-info-tint text-info border-info/30",
      icon: "🔄",
    },
    meta_access_requested: {
      label: "Access Requested",
      color: "bg-warn-tint text-warn border-warn/30",
      icon: "📧",
    },
    setup_guide_sent: {
      label: "Setup Guide Sent",
      color: "bg-warn-tint text-warn border-warn/30",
      icon: "📋",
    },
    complete: {
      label: "Complete",
      color: "bg-ok-tint text-ok border-ok/30",
      icon: "✅",
    },
    error: {
      label: "Error",
      color: "bg-danger-tint text-danger border-danger/30",
      icon: "❌",
    },
  };

  const config = statusConfig[phase3.status];

  return (
    <div className="rounded-lg border border-line p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="font-medium text-sm">Meta Account Setup (Phase 3)</h3>
          <p className="text-xs text-ink-3">
            {phase3.hasMetaAccount
              ? "Client has existing Meta ad account"
              : "Client creating new Meta ad account"}
          </p>
        </div>
        <div className={`rounded-full border px-3 py-1 ${config.color}`}>
          <span className="text-sm font-medium">
            {config.icon} {config.label}
          </span>
        </div>
      </div>

      {phase3.status === "meta_access_requested" && (
        <div className="rounded-lg bg-info-tint/30 border border-info/30 p-3">
          <p className="text-xs text-info font-medium">Awaiting client action</p>
          <p className="text-xs text-info mt-1">
            Access request sent to client. Waiting for them to grant system user permissions in Meta Ads Manager.
          </p>
        </div>
      )}

      {phase3.status === "setup_guide_sent" && (
        <div className="rounded-lg bg-warn-tint/30 border border-warn/30 p-3">
          <p className="text-xs text-warn font-medium">Awaiting client action</p>
          <p className="text-xs text-warn mt-1">
            Setup guide sent to client. Waiting for them to create Meta ad account and reply with account ID.
          </p>
        </div>
      )}

      {phase3.status === "error" && phase3.errorMessage && (
        <div className="rounded-lg bg-danger-tint/30 border border-danger/30 p-3">
          <p className="text-xs text-danger font-medium">Error</p>
          <p className="text-xs text-danger mt-1">{phase3.errorMessage}</p>
        </div>
      )}

      {phase3.lastEventTime && (
        <p className="text-xs text-ink-3">
          Last update: {new Date(phase3.lastEventTime).toLocaleDateString()} at{" "}
          {new Date(phase3.lastEventTime).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
