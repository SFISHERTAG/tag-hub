import { Panel, Badge } from "../../ui";
import type { ClientData } from "@/lib/dashboard/csm-clients-types";
import { getStatusDisplay } from "@/lib/dashboard/health-scoring";

const NEEDS_ATTENTION = new Set<ClientData["health"]["status"]>(["at-risk", "critical", "alert"]);

const STATUS_TONE: Record<ClientData["health"]["status"], "ok" | "warn" | "danger"> = {
  excellent: "ok",
  healthy: "ok",
  "at-risk": "warn",
  critical: "danger",
  alert: "danger",
};

/** Same client set as PortfolioWidget, filtered to the ones that need eyes first. */
export function ClientHealthWidget({ clients }: { clients: ClientData[] }) {
  const flagged = clients
    .filter((c) => NEEDS_ATTENTION.has(c.health.status))
    .sort((a, b) => a.health.score - b.health.score);

  if (flagged.length === 0) {
    return (
      <Panel title="Client health">
        <p className="text-sm text-ink-3">No clients need attention right now.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Client health" meta={`${flagged.length} need attention`}>
      <ol className="space-y-1.5">
        {flagged.slice(0, 8).map((client) => (
          <li
            key={client.id}
            className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{client.name}</p>
              {client.escalation.reason && (
                <p className="truncate text-xs text-ink-3">{client.escalation.reason}</p>
              )}
            </div>
            <Badge tone={STATUS_TONE[client.health.status]}>
              {getStatusDisplay(client.health.status).label}
            </Badge>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
