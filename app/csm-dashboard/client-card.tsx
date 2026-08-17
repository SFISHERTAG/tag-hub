"use client";

import { type ClientData } from "@/lib/dashboard/csm-clients-types";
import { getStatusDisplay } from "@/lib/dashboard/health-scoring";

interface ClientCardProps {
  client: ClientData;
  onClick?: () => void;
}

export function ClientCard({ client, onClick }: ClientCardProps) {
  const statusDisplay = getStatusDisplay(client.health.status);
  const metrics = client.metrics || { roas: 0, spend: 0, leads: 0, sla: 0 };

  return (
    <button
      onClick={onClick}
      className="group relative rounded-lg border border-line bg-surface p-4 text-left transition-all hover:border-accent hover:shadow-lg hover:shadow-accent/10 lift"
    >
      {/* Header with name and status */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink truncate">{client.name}</h3>
          <p className="text-xs text-ink-3">{client.ghl_location_id}</p>
        </div>
        {client.alert_count > 0 && (
          <div className="shrink-0 rounded-full bg-danger/20 px-2 py-1">
            <span className="text-xs font-medium text-danger">{client.alert_count}</span>
          </div>
        )}
      </div>

      {/* Health Score */}
      <div className="mb-3 space-y-1">
        <div className={`flex items-center gap-2 ${statusDisplay.color}`}>
          <span className="font-mono text-lg">{statusDisplay.icon}</span>
          <span className="text-sm font-medium">{client.health.score}</span>
        </div>
        <p className="text-xs text-ink-2">{statusDisplay.label}</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded bg-sunken p-2">
          <p className="text-xs text-ink-3">ROAS target</p>
          <p className="text-sm font-semibold text-ink">{metrics.roas.toFixed(0)}%</p>
        </div>
        <div className="rounded bg-sunken p-2">
          <p className="text-xs text-ink-3">Budget</p>
          <p className="text-sm font-semibold text-ink">{metrics.spend.toFixed(0)}%</p>
        </div>
        <div className="rounded bg-sunken p-2">
          <p className="text-xs text-ink-3">Leads target</p>
          <p className="text-sm font-semibold text-ink">{Math.round(metrics.leads)}%</p>
        </div>
        <div className="rounded bg-sunken p-2">
          <p className="text-xs text-ink-3">SLA</p>
          <p className="text-sm font-semibold text-ink">{metrics.sla.toFixed(0)}%</p>
        </div>
      </div>

      {/* Component Scores */}
      <div className="flex gap-1 text-xs text-ink-2">
        <div className="flex-1">
          <div className="mb-1 flex justify-between">
            <span>ROAS</span>
            <span className="text-ink">{client.health.roas_score}</span>
          </div>
          <div className="h-1.5 w-full rounded bg-sunken">
            <div
              className="h-full rounded bg-ok"
              style={{ width: `${client.health.roas_score}%` }}
            />
          </div>
        </div>
      </div>

      {/* Click hint */}
      <div className="pointer-events-none absolute inset-0 rounded-lg border border-transparent bg-gradient-to-r from-accent/0 via-accent/0 to-accent/5 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
