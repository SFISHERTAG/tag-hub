"use client";

import { type ClientData } from "@/lib/dashboard/csm-clients-types";
import { ClientCard } from "../client-card";
import { Panel } from "../../ui";
import { type ClientHealth } from "@/lib/dashboard/health-scoring";

interface KanbanViewProps {
  clients: ClientData[];
  onSelectClient: (client: ClientData) => void;
}

const STATUSES: Array<ClientHealth["status"]> = ["alert", "critical", "at-risk", "healthy", "excellent"];

const STATUS_CONFIG: Record<
  ClientHealth["status"],
  { label: string; color: string; bg: string }
> = {
  alert: { label: "Alert", color: "text-danger", bg: "bg-danger/5 border-danger/20" },
  critical: { label: "Critical", color: "text-danger", bg: "bg-danger/5 border-danger/20" },
  "at-risk": { label: "At-Risk", color: "text-warn", bg: "bg-warn/5 border-warn/20" },
  healthy: { label: "Healthy", color: "text-ok", bg: "bg-ok/5 border-ok/20" },
  excellent: { label: "Excellent", color: "text-ok", bg: "bg-ok/5 border-ok/20" },
};

export function KanbanView({ clients, onSelectClient }: KanbanViewProps) {
  const groupedClients = STATUSES.reduce(
    (acc, status) => {
      acc[status] = clients.filter((c) => c.health.status === status);
      return acc;
    },
    {} as Record<ClientHealth["status"], ClientData[]>,
  );

  return (
    <div className="overflow-x-auto pb-4">
      <div className="inline-flex gap-4 min-w-full">
        {STATUSES.map((status) => {
          const config = STATUS_CONFIG[status];
          const statusClients = groupedClients[status];

          return (
            <div key={status} className="w-72 flex-shrink-0">
              <div
                className={`rounded-lg border-2 ${config.bg} space-y-2 p-3 min-h-96`}
              >
                <div>
                  <h3 className={`font-semibold ${config.color}`}>{config.label}</h3>
                  <p className="text-xs text-ink-3">{statusClients.length} clients</p>
                </div>

                <div className="space-y-2">
                  {statusClients.map((client) => (
                    <div key={client.id} className="scale-95 origin-top-left">
                      <ClientCard
                        client={client}
                        onClick={() => onSelectClient(client)}
                      />
                    </div>
                  ))}

                  {statusClients.length === 0 && (
                    <div className="rounded border-2 border-dashed border-line/50 py-8 text-center">
                      <p className="text-xs text-ink-3">No clients</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
