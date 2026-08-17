"use client";

import { type ClientData } from "@/lib/dashboard/csm-clients-types";
import { getStatusDisplay } from "@/lib/dashboard/health-scoring";
import { Panel } from "../../ui";

interface ListViewProps {
  clients: ClientData[];
  onSelectClient: (client: ClientData) => void;
}

export function ListView({ clients, onSelectClient }: ListViewProps) {
  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-2 text-left font-medium text-ink-2">Client</th>
              <th className="px-4 py-2 text-center font-medium text-ink-2">Status</th>
              <th className="px-4 py-2 text-right font-medium text-ink-2">Health</th>
              <th className="px-4 py-2 text-right font-medium text-ink-2">ROAS target</th>
              <th className="px-4 py-2 text-right font-medium text-ink-2">Budget</th>
              <th className="px-4 py-2 text-right font-medium text-ink-2">Leads target</th>
              <th className="px-4 py-2 text-center font-medium text-ink-2">Alerts</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => {
              const statusDisplay = getStatusDisplay(client.health.status);
              const metrics = client.metrics || { roas: 0, spend: 0, leads: 0, sla: 0 };

              return (
                <tr
                  key={client.id}
                  onClick={() => onSelectClient(client)}
                  className="cursor-pointer border-b border-line/50 hover:bg-raised transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-ink">{client.name}</p>
                      <p className="text-xs text-ink-3">{client.ghl_location_id}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium ${statusDisplay.color}`}>
                      {statusDisplay.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-ink">{client.health.score}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-ink">{metrics.roas.toFixed(0)}%</td>
                  <td className="px-4 py-3 text-right text-ink">{metrics.spend.toFixed(0)}%</td>
                  <td className="px-4 py-3 text-right text-ink">{Math.round(metrics.leads)}%</td>
                  <td className="px-4 py-3 text-center">
                    {client.alert_count > 0 ? (
                      <span className="rounded-full bg-danger/20 px-2 py-1 text-xs font-medium text-danger">
                        {client.alert_count}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-3">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
