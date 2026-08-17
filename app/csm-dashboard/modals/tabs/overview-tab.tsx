"use client";

import { useEffect, useState } from "react";
import { type ClientData, type ClientAlert } from "@/lib/dashboard/csm-clients-types";
import { getClientAlertsForClient } from "@/app/csm-dashboard/actions/get-client-alerts";
import { Stat } from "@/app/ui";

interface OverviewTabProps {
  client: ClientData;
}

export function OverviewTab({ client }: OverviewTabProps) {
  const [alerts, setAlerts] = useState<ClientAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  useEffect(() => {
    async function fetchAlerts() {
      setLoadingAlerts(true);
      const data = await getClientAlertsForClient(client.id);
      setAlerts(data.slice(0, 5));
      setLoadingAlerts(false);
    }

    fetchAlerts();
  }, [client.id]);

  const metrics = client.metrics || { roas: 0, spend: 0, leads: 0, sla: 0 };
  const activeAlerts = alerts.filter((a) => !a.resolved_at);

  return (
    <div className="space-y-6">
      {/* Health Status */}
      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">Health Status</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Score"
            value={client.health.score}
            tone={
              client.health.status === "excellent" || client.health.status === "healthy"
                ? "ok"
                : client.health.status === "at-risk"
                  ? "warn"
                  : "danger"
            }
          />
          <Stat
            label="ROAS"
            value={client.health.roas_score}
            delta={`${metrics.roas.toFixed(1)}x`}
          />
          <Stat
            label="Spend"
            value={client.health.spend_score}
            delta={`$${(metrics.spend / 1000).toFixed(1)}k`}
          />
          <Stat
            label="SLA"
            value={client.health.sla_score}
            delta={`${metrics.sla.toFixed(0)}%`}
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">Key Metrics</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-line bg-sunken p-4">
            <p className="text-xs text-ink-3">Monthly ROAS</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{metrics.roas.toFixed(2)}x</p>
            <p className="mt-2 text-xs text-ink-2">Target: 3.5x</p>
          </div>
          <div className="rounded-lg border border-line bg-sunken p-4">
            <p className="text-xs text-ink-3">Monthly Spend</p>
            <p className="mt-1 text-2xl font-semibold text-ink">${(metrics.spend / 1000).toFixed(1)}k</p>
            <p className="mt-2 text-xs text-ink-2">Target: $25k</p>
          </div>
          <div className="rounded-lg border border-line bg-sunken p-4">
            <p className="text-xs text-ink-3">Monthly Leads</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{Math.round(metrics.leads)}</p>
            <p className="mt-2 text-xs text-ink-2">Target: 150</p>
          </div>
          <div className="rounded-lg border border-line bg-sunken p-4">
            <p className="text-xs text-ink-3">Response SLA</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{metrics.sla.toFixed(0)}%</p>
            <p className="mt-2 text-xs text-ink-2">Target: 95%+</p>
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">
          Recent Alerts ({activeAlerts.length})
        </h3>
        {loadingAlerts ? (
          <p className="text-sm text-ink-3">Loading alerts...</p>
        ) : activeAlerts.length === 0 ? (
          <div className="rounded-lg border border-ok/30 bg-ok-tint p-3">
            <p className="text-sm text-ok">No active alerts</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-lg border p-3 ${
                  alert.type === "critical"
                    ? "border-danger/30 bg-danger-tint"
                    : alert.type === "warning"
                      ? "border-warn/30 bg-warn-tint"
                      : "border-line bg-sunken"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{alert.title}</p>
                    <p className="mt-1 text-xs text-ink-2">{alert.message}</p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-medium ${
                      alert.type === "critical"
                        ? "text-danger"
                        : alert.type === "warning"
                          ? "text-warn"
                          : "text-ink-3"
                    }`}
                  >
                    {alert.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
